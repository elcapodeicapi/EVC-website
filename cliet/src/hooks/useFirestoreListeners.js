import { useEffect, useRef } from "react";
import { auth } from "../firebase";
import { onIdTokenChanged } from "firebase/auth";

/**
 * useResubscribingListener
 *
 * Manages a Firestore onSnapshot subscription with:
 * - Proper cleanup via unsubscribe on unmount or dep changes
 * - Auto resubscribe on token refresh or auth state change
 * - Graceful retry on TOKEN_EXPIRED / permission-denied
 * - Optional console debug logs (VITE_DEBUG_LISTENERS=true)
 *
 * @param {() => (void|function)} subscribeFactory - function that starts the listener and returns the unsubscribe function
 * @param {Array<any>} deps - React deps to control lifecycle
 * @param {{ name?: string, retryMs?: number }} options
 */
export function useResubscribingListener(subscribeFactory, deps = [], options = {}) {
  const { name = "listener", retryMs = 1500 } = options;
  const unsubRef = useRef(null);
  const authUnsubRef = useRef(null);
  const retryTimerRef = useRef(null);
  const generationRef = useRef(0);
  const lastResubscribeAtRef = useRef(0);

  const debug = (msg, ...args) => {
    if (import.meta?.env?.VITE_DEBUG_LISTENERS === "true") {
      // eslint-disable-next-line no-console
      console.log(`[fs:${name}] ${msg}`, ...args);
      
    }
  };

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
    const myGen = generationRef.current;

    const cleanup = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (typeof unsubRef.current === "function") {
        try {
          unsubRef.current();
        } catch (_) {
          // ignore
        }
      }
      unsubRef.current = null;
    };

    const start = () => {
      cleanup();
      try {
        // Provide an onError helper to the factory so it can signal retry-worthy errors
        const helpers = {
          onError: (err) => {
            handleError(err);
          },
        };
        const unsub = subscribeFactory(helpers);
        unsubRef.current = typeof unsub === "function" ? unsub : null;
        debug("subscribed");
      } catch (err) {
        debug("subscribe error", err);
      }
    };

    // Wrapper to handle typical token/permission errors from child code
    const handleError = async (error) => {
      debug("error", error);
      const code = (error?.code || "").toLowerCase();
      const message = (error?.message || "").toLowerCase();
      const isAuthish =
        code.includes("permission") ||
        code.includes("unauth") ||
        message.includes("token") ||
        message.includes("expired");

      if (!active || myGen !== generationRef.current) return;

      // Best-effort token refresh then retry
      if (isAuthish && auth?.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
          debug("token refreshed, scheduling resubscribe");
        } catch (_) {
          // ignore
        }
      }
      retryTimerRef.current = setTimeout(() => {
        if (!active || myGen !== generationRef.current) return;
        debug("retrying subscribe");
        start();
      }, retryMs);
    };

    // Expose error helper on window for debugging if desired
    // not required, but handy during temporary diagnostics
    // window.__fsListenerError = handleError;

    // Kick off subscription
    start();

    // Resubscribe when ID token changes (login/logout/refresh)
    try {
      authUnsubRef.current = onIdTokenChanged(auth, () => {
        if (!active || myGen !== generationRef.current) return;
        const now = Date.now();
        // Debounce resubscribe storms during impersonation/login flows
        if (now - lastResubscribeAtRef.current < 750) {
          debug("onIdTokenChanged ignored (debounced)");
          return;
        }
        lastResubscribeAtRef.current = now;
        debug("onIdTokenChanged → resubscribe");
        start();
      });
    } catch (_) {
      // ignore
    }

    return () => {
      active = false;
      cleanup();
      if (typeof authUnsubRef.current === "function") {
        try { authUnsubRef.current(); } catch (_) {}
      }
      authUnsubRef.current = null;
      debug("unsubscribed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {};
}

/**
 * Utility to wrap a subscribe function and add error handler routing
 * Usage inside a subscribeFactory:
 *   return subscribeX(params, ({data, error}) => {
 *     if (error) onError(error);
 *     else onNext(data);
 *   });
 */
export function withObserver(onNext, onError, helpers) {
  return ({ data, error }) => {
    if (error) {
      helpers?.onError?.(error);
      return onError?.(error);
    }
    return onNext?.(data);
  };
}
