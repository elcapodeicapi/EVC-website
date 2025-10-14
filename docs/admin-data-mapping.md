# Admin data mapping

This document summarizes the Firestore collections used by the admin experience after replacing the mock data.

## users (collection)

Every authenticated account created through the portal keeps a Firestore profile document under `users/{uid}`. The admin pages consume the following fields:

- `name` _(string)_ – Display name for listings and profile headers.
- `email` _(string)_ – Contact address rendered in tables and mailto links.
- `role` _(string)_ – Case-insensitive role flag (`admin`, `coach`, `customer`).
- `trajectId` _(string|null)_ – Optional traject identifier (shows in user lists and drives coach/customer pairing).
- `phone`, `location`, `bio` _(strings, optional)_ – Optional contact and biography details for admin profile.
- `responsibilities` _(string[])_ – Optional list rendered on the profile page.
- `highlights` _(object[])_ – Optional metrics rendered as cards, with each object shaped as `{ id, metric, label }`.
- `certifications` _(object[])_ – Optional professional development items shaped as `{ id, title, issuer, year }`.
- `securityClearance` _(object, optional)_ – Holds clearance metadata: `{ level, renewedOn, badge }`. The `badge` value maps to a Lucide icon name (e.g. `shield-check`).

Missing optional fields simply render as friendly placeholders in the UI.

## adminProfiles (collection)

An optional overlay document at `adminProfiles/{uid}` can store extended profile information without polluting the core `users` document. Fields mirror the optional keys above and take precedence when present.

## assignments (collection)

Customer ↔ coach pairings live beneath `assignments`. Each document contains:

- `customerId` _(string)_ – UID of the customer (references `users/{uid}`).
- `coachId` _(string)_ – UID of the coach.
- `status` _(string)_ – Friendly status label. Defaults to `pending`.
- `createdAt` _(Timestamp)_ – Server timestamp for ordering.
- `createdBy` _(string|null)_ – UID of the admin who created the entry.

When the admin page renders assignments, it joins the user documents client-side so names, emails, and roles always reflect live data.

These structures allow the admin UI to reflect live Firestore data while staying flexible for future schema changes.
