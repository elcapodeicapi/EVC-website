# Customer planning data mapping

The customer planning page now reads directly from Firestore to display a participant’s traject and competencies.

## trajects/{trajectId}

Each traject is stored as a top-level document. The planner consumes the following keys:

- `name` _(string)_ – Display name shown in the page header.
- `description` _(string, optional)_ – Short explanation surfaced alongside the header copy.
- `competencyCount` _(number, optional)_ – Used for analytics only; not required by the UI.

## trajects/{trajectId}/competencies/{competencyId}

Competencies are stored as a subcollection under their traject. Every document should provide:

- `code` _(string)_ – Short code (e.g. `B1-K1`). Displayed as the accordion label.
- `title` _(string)_ – Competency name.
- `description` _(string)_ – General summary of the competency.
- `desiredOutcome` _(string)_ – Text for the “Gewenst resultaat” section.
- `subjectKnowledge` _(string[] | string)_ – Items rendered in the “Vakkennis & vaardigheden” list. Strings are accepted and split on newline.
- `behavioralComponents` _(string[] | string)_ – Items rendered in the “Gedragscomponenten” list. Strings are accepted and split on newline.
- `groupOrder`, `competencyOrder`, `order` _(numbers, optional)_ – Ordering hints used to keep competencies in their original sequence.

Additional fields are preserved but ignored by the UI, so future metadata can be added safely.

### Evidence uploads

Uploads are still handled through the existing `/evidence/upload` endpoint. After an upload succeeds, the planner refreshes via `/customer/planning` to merge evidence metadata with the Firestore competencies. Ensure the backend keeps returning `uploads` arrays keyed by `competencyId` so the UI can merge the two data sources.
