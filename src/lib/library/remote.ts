import { getFirebaseApp } from '@/lib/firebase';
import type { LibraryState, User } from './types';

// Saving runs inside this same website (/api/commands), so one Vercel deployment serves everything.
export const apiConfigured = true;
export async function libraryCommand(command: string, args: unknown[]) {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured');
  const { getAuth } = await import('firebase/auth');
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Please sign in first');
  const response = await fetch('/api/commands', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ command, args }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Unable to save this change');
  return result.result;
}

export async function connectFirestore(update: (key: keyof LibraryState, rows: unknown) => void, session: (user: User | null) => void, error: (message: string) => void) {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const { getAuth, onAuthStateChanged } = await import('firebase/auth');
  const { getFirestore, collection, doc, getDoc, onSnapshot, query, where } = await import('firebase/firestore');
  const db = getFirestore(app);
  let generation = 0;
  let privateStops: (() => void)[] = [];
  const mapping = { books: 'books', copies: 'book_copies', reviews: 'reviews' } as const;
  const stops = Object.entries(mapping).map(([key, path]) => onSnapshot(collection(db, path), s => update(key as keyof LibraryState, s.docs.map(d => ({ ...d.data(), id: d.id }))), () => error('Catalog connection failed. Check Firestore rules.')));
  stops.push(onSnapshot(doc(db, 'settings', 'library'), s => { if (s.exists()) update('settings', s.data()); }, () => error('Library settings could not be loaded.')));
  const privateMap = { users: 'users', loans: 'loans', reservations: 'reservations', fines: 'fines', wishlists: 'wishlists', notifications: 'notifications', recent: 'recent', audit: 'audit' } as const;
  const authStop = onAuthStateChanged(getAuth(app), async authUser => {
    const current = ++generation;
    let publicResources: unknown[] = [];
    let ownResources: unknown[] = [];
    let profiles: User[] = [];
    let roles: Record<string, User["role"]> = {};
    const emitUsers = () => { if (current === generation) update("users", profiles.map(p => ({ ...p, role: roles[p.id] ?? "student" }))); };
    const emitResources = () => { if (current === generation) { const rows = [...publicResources, ...ownResources] as { id: string }[]; update("resources", Array.from(new Map(rows.map(r => [r.id,r])).values())); } };
    update("resources", []);
    privateStops.forEach(stop => stop()); privateStops = [];
    for (const key of Object.keys(privateMap)) update(key as keyof LibraryState, []);
    session(null);
    try {
      let user: User | null = null;
      if (authUser) {
        const [profile, role] = await Promise.all([getDoc(doc(db, 'users', authUser.uid)), getDoc(doc(db, 'user_roles', authUser.uid))]);
        if (profile.exists()) user = { ...profile.data(), id: authUser.uid, role: role.data()?.['role'] ?? 'student' } as User;
      }
      if (current !== generation) return;
      session(user);
      const staff = user?.role === 'admin' || user?.role === 'librarian';
      if (user) {
        for (const [key, path] of Object.entries(privateMap)) {
          if (key === 'audit' && !staff) continue;
          const source = staff ? collection(db, path) : query(collection(db, path), where(key === 'users' ? 'id' : 'userId', '==', user.id));
          privateStops.push(onSnapshot(source, s => { if (current !== generation) return; const rows = s.docs.map(d => ({ ...d.data(), id: d.id })); if (key === "users") { profiles = rows as User[]; emitUsers(); } else update(key as keyof LibraryState, rows); }, () => error('Account records could not be loaded.')));
        }
      }
      if (user) privateStops.push(onSnapshot(staff ? collection(db, "user_roles") : query(collection(db, "user_roles"), where("__name__", "==", user.id)), s => { roles = Object.fromEntries(s.docs.map(d => [d.id, d.data()["role"]])); emitUsers(); }, () => error("Member roles could not be loaded.")));
      // Owner read path includes pending faculty submissions; public reads include approved only.
      privateStops.push(onSnapshot(user?.role === 'admin' ? collection(db, 'resources') : query(collection(db, 'resources'), where('approved', '==', true)), s => { publicResources = s.docs.map(d => ({ ...d.data(), id: d.id })); emitResources(); }, () => error('Resources could not be loaded.')));
      if (user && user.role !== 'admin') privateStops.push(onSnapshot(query(collection(db, 'resources'), where('submittedBy', '==', user.id)), s => { ownResources = s.docs.map(d => ({ ...d.data(), id: d.id })); emitResources(); }, () => error('Your submissions could not be loaded.')));
    } catch { error('Your library profile could not be loaded.'); }
  });
  return () => { authStop(); stops.forEach(s => s()); privateStops.forEach(s => s()); };
}
