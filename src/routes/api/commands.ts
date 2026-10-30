import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const Body = z.object({ command: z.string().min(1).max(40), args: z.array(z.any()).max(6) });
const json = (body: unknown, status = 200) => Response.json(body, { status });

// Node.js Firebase Admin credentials. Accepts either a single service-account
// JSON blob (FIREBASE_SERVICE_ACCOUNT_JSON) or the three individual fields
// (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) so
// standard Node.js service-account credentials work as-is.
function serviceAccountCredentials(): Record<string, string> | null {
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
  if (raw && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }
  const projectId = process.env['FIREBASE_PROJECT_ID'];
  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  const privateKey = process.env['FIREBASE_PRIVATE_KEY'];
  if (projectId && clientEmail && privateKey) {
    return { project_id: projectId, client_email: clientEmail, private_key: privateKey.replaceAll('\\n', '\n') };
  }
  return null;
}

// firebase-admin targets a full Node.js host; keep it out of the Worker bundle
// and resolve it from node_modules at runtime. When the import is unavailable
// the handlers degrade to "not configured" instead of failing the request.
async function importAdmin(name: string) {
  return import(/* @vite-ignore */ name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let services: { auth: any; db: any } | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function admin(): Promise<{ auth: any; db: any }> {
  if (services) return services;
  const credentials = serviceAccountCredentials();
  if (!credentials) throw new Error('Firebase Admin credentials are not configured');
  const { getApps, initializeApp, cert } = await importAdmin('firebase-admin/app');
  if (!getApps().length) initializeApp({ credential: cert(credentials), projectId: credentials['project_id'] ?? credentials['projectId'] });
  const { getAuth } = await importAdmin('firebase-admin/auth');
  const { getFirestore } = await importAdmin('firebase-admin/firestore');
  services = { auth: getAuth(), db: getFirestore() };
  return services;
}

export const Route = createFileRoute('/api/commands')({
  server: {
    handlers: {
      GET: async () => {
        if (!serviceAccountCredentials()) return json({ status: 'ok', configured: false, mode: 'local' });
        try {
          await admin();
          return json({ status: 'ok', configured: true, mode: 'live' });
        } catch (error) {
          console.error('Firebase Admin credentials present but the service could not start:', error);
          return json({ status: 'ok', configured: false, mode: 'local', detail: 'Firebase Admin credentials were provided but the service could not start' });
        }
      },
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ detail: 'Invalid request' }, 400);
        const { command, args } = parsed.data;
        let s;
        try { s = await admin(); } catch { return json({ detail: 'Library service is not configured on the server' }, 503); }
        const { auth, db } = s;
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        let uid: string;
        try { uid = (await auth.verifyIdToken(token ?? '', true)).uid; } catch { return json({ detail: 'Please sign in again' }, 401); }
        const { apply, COLLECTIONS, DEFAULTS, PermissionError, ValidationError } = await import('@/lib/library/domain.server');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await db.runTransaction(async (tx: any) => {
            // A shared revision document serializes mutations; retries re-evaluate eligibility.
            const revision = db.collection('system').doc('revision');
            const settingsDoc = db.collection('settings').doc('library');
            const [revSnap, roleSnap, settingsSnap] = await Promise.all([tx.get(revision), tx.get(db.collection('user_roles').doc(uid)), tx.get(settingsDoc)]);
            const role = roleSnap.data()?.['role'] ?? 'student';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state: any = {};
            for (const [key, path] of Object.entries(COLLECTIONS)) state[key] = (await tx.get(db.collection(path))).docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({ ...d.data(), id: d.id }));
            state.settings = { ...DEFAULTS, ...(settingsSnap.data() ?? {}) };
            const before = structuredClone(state);
            const out = apply(state, uid, role, command, args);
            let writes = 1;
            for (const [key, path] of Object.entries(COLLECTIONS)) {
              const old = new Map<string, any>(before[key].map((r: any) => [r.id, r]));
              const next = new Map<string, any>(state[key].map((r: any) => [r.id, r]));
              for (const [id, row] of next) if (JSON.stringify(old.get(id)) !== JSON.stringify(row)) { tx.set(db.collection(path).doc(id), row); writes++; }
              for (const id of old.keys()) if (!next.has(id)) { tx.delete(db.collection(path).doc(id)); writes++; }
            }
            if (JSON.stringify(state.settings) !== JSON.stringify(before.settings)) { tx.set(settingsDoc, state.settings); writes++; }
            if (command === 'setRole') { tx.set(db.collection('user_roles').doc(out.roleUserId), { role: out.role }); writes++; }
            if (writes > 450) throw new ValidationError('Too many records changed in one request');
            tx.set(revision, { value: (revSnap.data()?.['value'] ?? 0) + 1 });
            return out;
          });
          return json({ result });
        } catch (e) {
          if (e instanceof PermissionError) return json({ detail: e.message }, 403);
          if (e instanceof ValidationError) return json({ detail: e.message }, 400);
          if (e instanceof TypeError) return json({ detail: 'Invalid command arguments' }, 400);
          return json({ detail: 'Library service is temporarily unavailable' }, 503);
        }
      },
    },
  },
});
