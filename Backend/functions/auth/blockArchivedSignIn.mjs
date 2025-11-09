import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { getDb } from "../firebase.js";

export const blockArchivedCandidateSignIn = beforeUserSignedIn({ region: "europe-west1" }, async (event) => {
  try {
    const db = getDb();
    const uid = event?.data?.uid || event?.data?.user?.uid;
    if (!uid) return;

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return;
    const user = userSnap.data() || {};
    const role = (user.role || "").toString().toLowerCase();
    if (!(role === "customer" || role === "user")) return;

    const assignSnap = await db.collection("assignments").doc(uid).get();
    const status = assignSnap.exists ? (assignSnap.data()?.status || "") : "";
    if (status === "In archief") {
      // Block the sign-in with a clear message
      throw new Error("Je traject is gearchiveerd. Neem contact op met je begeleider voor meer informatie.");
    }
  } catch (err) {
    // In case of errors (e.g., connectivity), do not block sign-in silently; keep logs on server
    console.warn("blockArchivedCandidateSignIn: error while checking", err?.message || err);
  }
});
