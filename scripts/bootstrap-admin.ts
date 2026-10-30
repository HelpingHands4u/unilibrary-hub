/* Offline operator tool: bun scripts/bootstrap-admin.ts <uid> [seed.json]. Requires FIREBASE_SERVICE_ACCOUNT_JSON. Never exposed over HTTP. */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [uid, seed] = process.argv.slice(2);
if (!uid) throw new Error('Usage: bun scripts/bootstrap-admin.ts <admin-uid> [seed.json]');
initializeApp({ credential: cert(JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT_JSON'] ?? '{}')) });
const db = getFirestore();
await getAuth().getUser(uid);
if (!(await db.collection('users').doc(uid).get()).exists) throw new Error('Register this account through UniLibrary first');
await db.collection('user_roles').doc(uid).set({ role: 'admin' });
if (seed) {
  const data = JSON.parse(readFileSync(seed, 'utf8'));
  const paths: Record<string, string> = { books: 'books', copies: 'book_copies', resources: 'resources' };
  for (const [key, path] of Object.entries(paths)) for (const row of data[key] ?? []) await db.collection(path).doc(row.id).set(row);
  await db.collection('settings').doc('library').set(data.settings);
}
console.log('Administrator provisioned. Catalog seed imported if supplied; no demo member identities were imported.');
