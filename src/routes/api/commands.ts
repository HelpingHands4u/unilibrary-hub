import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const Body = z.object({ command: z.string().min(1).max(40), args: z.array(z.any()).max(6) });
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function admin() {
  const { getApps, initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  if (!getApps().length) {
    const raw = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
    initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  }
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  return { auth: getAuth(), db: getFirestore() };
}

export const Route = createFileRoute('/api/commands')({
  server: {
    handlers: {
      GET: async () => json({ status: 'ok', configured: Boolean(process.env['FIREBASE_SERVICE_ACCOUNT_JSON']) }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ detail: 'Invalid request' }, 400);
        const { command, args } = parsed.data;
        let services;
        try { services = await admin(); } catch { return json({ detail: 'Library service is not configured on the server' }, 503); }
        const { auth, db } = services;
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        let uid: string;
        try { uid = (await auth.verifyIdToken(token ?? '', true)).uid; } catch { return json({ detail: 'Please sign in again' }, 401); }
        const { apply, COLLECTIONS, DEFAULTS, PermissionError, ValidationError } = await import('@/lib/library/domain.server');
        try {
          const result = await db.runTransaction(async tx => {
            // A shared revision document serializes mutations; retries re-evaluate eligibility.
            const revision = db.collection('system').doc('revision');
            const settingsDoc = db.collection('settings').doc('library');
            const [revSnap, roleSnap, settingsSnap] = await Promise.all([tx.get(revision), tx.get(db.collection('user_roles').doc(uid)), tx.get(settingsDoc)]);
            const role = roleSnap.data()?.['role'] ?? 'student';
            const s: any = {};
            for (const [key, path] of Object.entries(COLLECTIONS)) s[key] = (await tx.get(db.collection(path))).docs.map(d => ({ ...d.data(), id: d.id }));
            s.settings = { ...DEFAULTS, ...(settingsSnap.data() ?? {}) };
            const before = structuredClone(s);
            const out = apply(s, uid, role, command, args);
            let writes = 1;
            for (const [key, path] of Object.entries(COLLECTIONS)) {
              const old = new Map<string, any>(before[key].map((r: any) => [r.id, r]));
              const next = new Map<string, any>(s[key].map((r: any) => [r.id, r]));
              for (const [id, row] of next) if (JSON.stringify(old.get(id)) !== JSON.stringify(row)) { tx.set(db.collection(path).doc(id), row); writes++; }
              for (const id of old.keys()) if (!next.has(id)) { tx.delete(db.collection(path).doc(id)); writes++; }
            }
            if (JSON.stringify(s.settings) !== JSON.stringify(before.settings)) { tx.set(settingsDoc, s.settings); writes++; }
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
