<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## UniLibrary (migrated from HelpingHands4u/unilibrary)
- App mode is owned by the server: GET /api/commands reports `configured` only when Firebase Admin credentials are present AND the admin service initializes; the client store (src/lib/library/mode.ts) probes it once and falls back to the local demonstration store otherwise. A mid-session 503 "not configured" degrades to local mode automatically instead of surfacing an error. Why: book actions must never 503 without credentials.
- Firebase Admin credentials accept either FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY; firebase-admin is imported with a hidden dynamic specifier so it is never bundled for the Worker runtime.
