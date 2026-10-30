// Firebase client (browser-safe, publishable config only).
// Set these in Vercel → Project → Environment Variables (and a local .env):
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

// Publishable web config for project dls-15bfd; env vars override it.
const cfg = {
  apiKey: (import.meta.env['VITE_FIREBASE_API_KEY'] as string | undefined) ?? "AIzaSyCzAxKOEuChTUwe6i--E496NhtTUxVh7LY",
  authDomain: (import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string | undefined) ?? "dls-15bfd.firebaseapp.com",
  projectId: (import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string | undefined) ?? "dls-15bfd",
  appId: (import.meta.env['VITE_FIREBASE_APP_ID'] as string | undefined) ?? "1:289567587129:web:8ab0ff3a453b95853b46e8",
};

export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain);

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured || typeof window === "undefined") return null;
  return getApps()[0] ?? initializeApp({ apiKey: cfg.apiKey ?? "", authDomain: cfg.authDomain ?? "", projectId: cfg.projectId ?? "", appId: cfg.appId ?? "" });
}

/** Sign in with Firebase Auth, then read the role from Firestore users/{uid} (written only by admins / backend). */
export async function firebaseSignIn(email: string, password: string, register?: { name: string; rollNumber: string; department: string }) {
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase is not configured");
  const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
  const { getFirestore, doc, getDoc, setDoc } = await import("firebase/firestore");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const cred = register
    ? await createUserWithEmailAndPassword(auth, email, password)
    : await signInWithEmailAndPassword(auth, email, password);
  if (register) {
    await updateProfile(cred.user, { displayName: register.name });
    // Profiles never contain permissions; user_roles is written only by the trusted service.
    await setDoc(doc(db, "users", cred.user.uid), { id: cred.user.uid, name: register.name, email: cred.user.email, rollNumber: register.rollNumber, department: register.department, maxBorrowLimit: 4, active: true });
  }
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  const roleSnap = await getDoc(doc(db, "user_roles", cred.user.uid));
  const role = (roleSnap.data()?.['role'] as "student" | "librarian" | "admin" | "faculty") ?? "student";
  return { uid: cred.user.uid, email: cred.user.email ?? email, name: snap.data()?.['name'] ?? cred.user.displayName ?? email, role };
}
