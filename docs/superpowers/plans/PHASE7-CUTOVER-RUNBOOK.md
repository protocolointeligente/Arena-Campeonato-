# Phase 7 Cutover Runbook

Manual steps to flip production from the legacy monolith to the `src/` Vite app.
Do not start until `node scripts/cutover-check.mjs` exits 0.

## Pre-flight

1. `git checkout main && git pull`
2. `node scripts/cutover-check.mjs` — must print `OK: phases 1-6 all done, cutover is safe to run`. If it doesn't, stop; the printed phase list is what's still missing.
3. `npm test` — must be green.
4. `npm run verify` — must be green (confirms Phase 4/5/6 entry points are wired into `main.js`).

## Canary build (no code changes yet)

5. `npx vite build` (skip `prepare-legacy.mjs` — run vite directly, not `npm run build`) to produce a `dist/` that is the real `src/` app, unmodified by the legacy overwrite.
6. `npx vite preview` and manually click through: home, a championship's Chaveamento/Tabela/Súmula/Disciplina tabs, PDF export, public portal link, registration flow, superadmin panel.
7. Deploy this `dist/` to a Vercel preview URL (push a branch — Vercel's default preview-per-branch already does this, no extra config needed) and repeat the same manual pass against the preview URL, not just localhost.

## Cutover (Task 4 of the phase 7 plan)

8. Only after 1–7 all pass: execute Task 4 (removes `prepare-legacy.mjs` from the build script, deletes the legacy HTML file).
9. `npm run build && npm run verify` on the result — confirms the *production* build script (not just `vite build` directly) now emits the `src/` app.
10. Deploy to production (`firebase deploy --only hosting`, per `firebase.json`).
11. Smoke-test the production URL with the same manual pass as step 6.

## Rollback

If anything is wrong post-deploy: `git revert <cutover commit>`, `npm run build`, `firebase deploy --only hosting` again — this restores `prepare-legacy.mjs` and the legacy file, putting the monolith back in front of users. Keep the reverted commit's SHA noted in `MIGRATION-PROGRESS.md` if this happens, so the next cutover attempt knows what broke.