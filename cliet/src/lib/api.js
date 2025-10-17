import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE || "";

async function getBearerToken({ forceRefresh = false } = {}) {
  const user = auth?.currentUser || null;
  if (!user) return null;
  try {
    const idToken = await user.getIdToken(forceRefresh);
    return idToken ? `Bearer ${idToken}` : null;
  } catch (_) {
    return null;
  }
}

export async function apiFetch(path, opts = {}) {
  const { method = "GET", headers = {}, body, isForm = false } = opts;
  const bearer = await getBearerToken({ forceRefresh: false });
  const init = { method, headers: { ...headers, ...(bearer ? { Authorization: bearer } : {}) } };
  if (body !== undefined) {
    if (isForm) {
      init.body = body; // FormData
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
  }
  let res = await fetch(`${API_BASE}${path}`, init);
  let data;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text().catch(() => null);
  }
  // If unauthorized and we used a Firebase token, refresh token once and retry
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    const refreshedBearer = await getBearerToken({ forceRefresh: true });
    if (refreshedBearer) {
      const retryInit = {
        ...init,
        headers: { ...init.headers, Authorization: refreshedBearer },
      };
      res = await fetch(`${API_BASE}${path}`, retryInit);
      const retryCt = res.headers.get("content-type") || "";
      if (retryCt.includes("application/json")) {
        try { data = await res.json(); } catch { data = null; }
      } else {
        data = await res.text().catch(() => null);
      }
    }
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || res.statusText || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const get = (path, headers) => apiFetch(path, { method: "GET", headers });
export const post = (path, body, headers) => apiFetch(path, { method: "POST", body, headers });
export const put = (path, body, headers) => apiFetch(path, { method: "PUT", body, headers });
export const postForm = (path, formData, headers) => apiFetch(path, { method: "POST", body: formData, headers, isForm: true });
