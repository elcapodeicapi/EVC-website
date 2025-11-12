# QA Smoke Tests

This checklist verifies the two critical flows just implemented: admin email change sync and impersonation persistence across reloads.

## 1) Admin changes user email (Auth + Firestore in sync)

Prereqs:

- You are logged in as an Admin in the deployed app.
- Functions are deployed (PUT /auth/admin/users/:uid/email is live).

Steps:

1. Open Admin → Gebruikers → click a user → "Bewerken".
2. Change the E-mail field to a new unique address and click Opslaan.
3. Expect a success message only after the operation completes (Auth + Firestore).
4. Refresh the page.
5. Verify the new email shows in the admin UI.
6. Open Firebase Console → Authentication → Users → verify the same user’s email is updated.
7. (Optional) Log out and attempt login with the new email to confirm end-to-end.

Failure cases to validate:

- Changing to an email already in use should show a clear error (HTTP 409). No partial update.
- If Firestore write fails after Auth update (rare), the backend rolls back Auth to the old email and returns 500.

## 2) Impersonation session persists across reloads, no token error

Prereqs:

- You are logged in as an Admin.
- There is at least one target account (kandidaat or begeleider) to impersonate.

Steps:

1. Open Admin → Gebruikers. Click the impersonate action for a target user.
2. Confirm you are redirected into the target’s area (Customer or Coach).
3. Hard refresh the browser (Ctrl+R or Cmd+R).
4. Verify you remain impersonated; no "No token provided" banner.
5. Verify data loads normally (e.g., dashboard stats, lists).
6. Click "Stop impersoneren" (or exit control) to return to the Admin session.
7. Verify you are back in the Admin area and remain logged in after another hard refresh.

What changed under the hood:

- Before signInWithCustomToken, the client sets browserLocalPersistence so the session survives reloads.
- The API client now waits for Firebase Auth hydration (onAuthStateChanged) before attaching tokens; it also retries once on 401/403 with a forced refresh.
- Archived-candidate redirect is bypassed during admin impersonation.

Troubleshooting:

- If you still see "No token provided" after refresh, verify your environment variables and that VITE_API_BASE points to the deployed functions domain.
- Check the browser devtools: the first API request after load should include an Authorization: Bearer <idToken> header.
- If impersonation fails to sign-in, ensure the admin has permission to impersonate that role and that the custom token endpoint returns both target and admin tokens.
