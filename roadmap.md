# UniLibrary — task roadmap
- [x] Port UniLibrary source (routes, catalog, circulation desk, admin, e-resources) into the project
- [x] Firebase Admin backend: FIREBASE_SERVICE_ACCOUNT_JSON or individual env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
- [x] Automatic local fallback when live credentials are absent or the live service fails — no 503 "not configured" for book actions
- [x] Verified: reserve, wishlist, review, issue, return, reservation queue hold (Playwright, zero console errors)
- [ ] Renew + fine pay/waive verified in live mode — blocked: no Firebase service account credentials supplied yet
- [ ] Live-mode end-to-end (Firestore writes) — blocked: same credentials; user can add them via project secrets
