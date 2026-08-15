# Arena — Legacy → src/ Migration Progress

Durable tracker for the incremental "strangler fig" migration of
`arena-campeonatos-v2-intervencao-19.html` (still shipped to production via
`scripts/prepare-legacy.mjs`) into the modular `src/` Vite app. Source of
truth for what's actually landed on `main` — conversation memory does not
survive compaction, this file does.

Mode: autonomous. User has authorized executing every phase to completion,
always taking the recommended path, without stopping to ask — see decision
log below. Only stop for a genuine blocker.

## How each phase runs

1. Write/refresh the phase's plan under `docs/superpowers/plans/` (writing-plans skill).
2. `EnterWorktree`, then immediately `git merge main --ff-only` (worktrees branch from `origin/main`, not local `main` — see the decision log entry below).
3. Execute via `superpowers:subagent-driven-development`: implementer → task review → (fix loop) per task, ledger at `.superpowers/sdd/progress.md` inside the worktree. Every new/changed `class="..."` gets checked against `layout.css`/`tokens.css` for both the class's own rule and any `<class> <child-selector>` rule — see "Process note" below.
4. Final whole-branch review (opus) → fix Critical/Important → re-review.
5. `npm test && npm run build && npm run verify` green on the merged result.
6. Merge to `main` locally (recommended default, established Phase 1), delete branch, clean up worktree.
7. Update this file.

## Decision log

- 2026-08-15: User chose incremental migration (strangler fig) over finishing the rewrite blind or abandoning it — condition: every ported function must actually work, not stub.
- 2026-08-15: User authorized autonomous execution of all remaining phases, always the recommended option, no further check-ins until the project is done.
- 2026-08-15: Found `npm test` on `main` (not the Phase 1 worktree) picking up stray Jest specs from an untracked `.chrome-cdp/` directory at the repo root (an unrelated leftover browser-extension checkout). Fixed with `vitest.config.js` scoping `include` to `src/**/*.test.js` — commit `d684c28`. Unrelated to the migration itself but blocked honestly verifying "tests green" on `main`, so fixed inline rather than deferred.
- 2026-08-15: A fresh worktree created with `EnterWorktree` branches from `origin/<default-branch>` by default, not local `main` — since Phase 1 was merged locally but never pushed, Phase 2a's worktree initially missed it entirely. Fixed by `git merge main --ff-only` inside the worktree right after creation. **Standing instruction for every future phase:** immediately after `EnterWorktree`, run `git merge main --ff-only` (or push local `main` to `origin` first) before doing anything else — don't rediscover this the hard way each time.

## Known follow-ups (not bugs, deliberately deferred — surfaced by Phase 2a's final review)

- **Public portal, PDF export, and registration-approval only see the *active* category.** Root-mirroring (`state.teams`/`state.matches`) means `public-championship.js`, `services/pdf.js`, and the registration-approval handler in `championship.js` all read/write whichever category was active at last save — switch categories and save anything, and the public link's team/match list silently changes to the new active category (the full data isn't lost — it's all still in `state.categories` — just not what these three surfaces currently read). Not urgent: `src/` isn't the live production surface yet (`scripts/prepare-legacy.mjs` still ships the legacy monolith). Must be resolved before Phase 7 (build cutover) — either by making these three surfaces category-aware, or by an explicit product decision that they intentionally show "whichever category was last active."
- **Registration approvals have no way to pick which category a new team joins** — same root cause as above.
- Cosmetic, low-priority: `addCategory`'s default name (`Categoria ${length+1}`) can repeat after a remove-then-add cycle (ids stay unique, so no functional bug); `ordem` field is written but nothing reads it yet (dormant until Phase 2d's phase ordering needs it); category audit log entries don't name which category was added/renamed/removed.
- Pre-existing, predates Phase 2a, not introduced by it: `[data-pdf]`/`[data-publication]` in `championship.js`'s `bind()` use `addEventListener` on nodes that live outside the re-rendered `content` section and are never cleaned up, so listeners accumulate one per `render()` call. `[data-remove-team]` filters `state.teams` without fixing up the numeric `match.home`/`match.away` indices in `state.matches`, corrupting any already-generated fixture list when a team is removed after fixtures exist. Worth a small fix-it pass (own plan, not blocking) before Phase 3b (Matches & scoring) builds more on top of the match/team relationship.

## Known follow-ups — Phase 2b (Teams & Roster)

- **Image payload strategy needs revisiting before Phase 5.** `compressPhoto` stores photos as base64 data URIs directly in the Firestore document (a faithful legacy port, not a new risk on its own) — but combined with category root-mirroring, each photo is now duplicated across `state.teams` and `state.categories[].teams`, and the whole state re-serializes on every save. A few dozen photographed athletes can approach Firestore's 1 MiB per-document limit. Phase 5 (branding/sponsors) adds more images via `readAndResizeImage` — worth switching to Firebase Storage + URL references before that lands, rather than compounding the same pattern a second time.
- `roster.js`'s `athleteById`/`athName`/`teamNameById` are ported and tested but have no caller yet in `src/` — they're the read-side helpers Phase 3 (match events, disciplinary views) will need. Not dead code, just early.
- `class="btn ghost sm"` (`championship.js`, roster modal) has no `.sm` CSS rule anywhere in `src/styles/` — pre-existing gap (already used elsewhere before this phase), same class of bug `.row` was in Task 2 before its fix. Worth a sweep for every `class="..."` in `src/pages/*` with no matching selector, rather than fixing them one at a time as each is noticed.
- `persist()` (in `championship.js`) now catches a failed `saveChampionship` and toasts it, but callers still proceed to write an `addAudit(...)` entry for a change that was never actually saved (a log-accuracy gap, not data loss — the in-memory state is intact for a retry). Fix belongs with a broader look at `persist()`'s callers, not a one-line patch.
- `categoriesView()`'s category row (2-3 children) now sits in the same 4-column `.team-row` grid the roster UI needed; the unused 4th track shifts its "Remover" button ~10px from where it sat before. Cosmetic only.
- `updateAthlete`'s `dob`/`numero` fields accept only strings (`(dob || '').trim()`-style coercion) — fine for every current DOM-sourced caller, but worth a guard if a future non-DOM caller (e.g. a bulk-import feature) ever passes a number or Date.

## Known follow-ups — Phase 2c (Venues, Officials & Team Staff)

- `venueById`/`officialById` are ported and tested but uncalled until Phase 3b wires them into match scheduling — same "early, not dead" status as Phase 2b's read helpers.
- `officials[].phone` is supported by `ops.js` and not yet populated by any UI, so no leak today — but when Phase 3b's match-ops screen adds a phone field, `publicState()` (`services/championships.js`) needs to strip it before it reaches `publicChampionships`, the same way `foto` was stripped in Phase 2b.

## Process note: the class/CSS mismatch bug, three times running

Phase 2b (`.row` used with no CSS rule; `.team-row` overflowing a 5-child athlete row) and Phase 2c (`.team-row` overflowing a 4-child staff row; then the fix's replacement `.row` having no input styling) all shipped the same root cause: markup written against a CSS class without checking what that class's rule — or its children's rule — actually does. Every instance was only caught by the whole-branch review, never the task-level one. **Standing instruction from Phase 2d onward:** for every new or changed `class="..."` in a diff, grep `layout.css`/`tokens.css` for that exact class **and** for `<that-class> <child-selector>` rules (e.g. `.row input`, not just `.row`) before considering the task done — both at implementer self-review and at task-review time, not deferred to the final pass.

## Phase status

| # | Phase | Scope (from the published audit) | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | esc/clone/uid, fmtDateBR/brl/ageFrom, toast/modal/loadingHTML | ✅ Done | `2026-08-15-migration-phase1-foundations.md` | `73da3ab` (+ `d684c28` test-scope fix) |
| 2a | Categories | addCategory/removeCategory/renameCategory/ensureCategories/activeCategory/switchCategory/categoryBar (categorySnapshot/categoryTeamLimitReached/canAddTeams deferred to Phase 6, billing-coupled) | ✅ Done | `2026-08-15-migration-phase2a-categories.md` | `6c625a8` |
| 2b | Teams & roster | addAthlete/delAthlete/editAthlete/saveAthlete/athleteById/athName/eaPhoto/compressPhoto/pickLogo/teamById/teamNameById/teamLogoMini (delT→already covered by home.js; readAndResizeImage→moved to Phase 5, branding-coupled; renTeam→existing flow already covers it, seedNames half deferred to Phase 3a) | ✅ Done | `2026-08-15-migration-phase2b-roster.md` | `d433ada` |
| 2c | Venues, officials & team staff | addVenue/delVenue/venueById/addOfficial/delOfficial/officialById/staffRow/setStaff | ✅ Done | `2026-08-15-migration-phase2c-ops.md` | `082f9ea` |
| 2d | Phases & format (liga/grupos/gxg — mata-mata deferred to 3a, applyProgression/qualifiedFromPhase deferred to 3c, see plan) | addPhase/removePhase/renamePhase/ensurePhases/activePhase/switchPhase/phaseBar/phaseSnapshot/phaseComplete/phaseParticipants/newPhaseFromRoot/loadPhaseIntoRoot/saveRootIntoActive/loadCategoryIntoRoot/setPhaseFormat/generateActivePhase/setProgressMode/setProgressCount/setProgressTarget/progressBar/progressionSummary (roundRobin/buildFixtures/buildGxg pulled forward from 3a; setFmt/renderFmtOpts belong to the legacy creation wizard, not this flow) | ⏳ In progress | `2026-08-15-migration-phase2d-phases.md` | — |
| 3a | Draw & bracket engine | drawBracket/drawGroups/runDraw/confirmDraw/finishDraw/toggleSeed/refreshSeeds/seedOrder/genCross/makeBracketFromOrdered/buildFixtures/buildGxg/nextPow2/roundRobin/renderDraw/renderBracketView/renderMataFromGroups/advanceBracket/loserOf/findTie | Not started | — | — |
| 3b | Matches & scoring | setScore/setTie/tieHTML/tieObj/matchRow/matchMeta/matchContext/matchEvents/openMatchOps/saveMatchOps/opsConfigHTML/mark/clearResults/nextMatchesCard/allMatchObjs/h2h/resolveTie | Not started | — | — |
| 3c | Standings & scorers | computeStandings/standingsForPhase/standingsTable/standsToRows/cardRanking/scorerRanking | Not started | — | — |
| 3d | Discipline & suspensions | viewDisciplina/suspensionInfo/critAdd/critMove/critRemove/critCommit/critTail/criteriaEditor/optCrit/optTurnos | Not started | — | — |
| 4 | Reports & exports (PDF) | exportJSON/importJSON/exportPDF/exportRosterReport/exportStandingsReport/exportScorersReport/exportDisciplineReport/exportOfficialsReport/exportTeamsReport/exportResultsReport/exportScheduleReport/exportRoundBulletin/exportAthleteCards/reportBase/reportName/reportStandingsBlocks/printSumula/sumulaModal/renderSumula | Not started | — | — |
| 5 | Public portal & registration | enterViewer/publicHome/publicChampionshipPayload/publicBrandHero/publicNavHTML/publicMatchCard/publicMiniStandings/publicTopScorers/publicAthleteRows/publicSponsorsHTML/sanitizePublicState/sharePublic/shareLinkFor/downloadQR/qrDataURL/renderPublicationQRs/publicationCard + registrationCfg/registrationDeadlineClosed/registrationStatusLabel/setRegistrationDocs/addPublicAthleteRow/copyRegistrationLink + brandingConfigHTML/sponsorsConfigHTML/addSponsor/removeSponsor/ensureBranding/clearBrandImage/setBrandImage/readAndResizeImage | Not started | — | — |
| 6 | Administration | inviteManager/removeManager/changeManagerRole/ensureCollaborators/myCollaborator/myRole/roleLabel/can/isOwner + renderSuperadmin/loadPlatformAdmin/superOpenChamp/suAdd/suAddAnon/suDel/suObj + renderAuditCenter/renderSecurityCenter/renderPrivacyCenter/privacyNoticeHTML/renderBetaHardening + choosePlan/currentPlan/planCardsHTML/planLimitText/canCreateChampionship/confirmPlanRequest/approvePendingPlan | Not started | — | — |
| 7 | Build cutover | remove `scripts/prepare-legacy.mjs` from the build, expand `scripts/verify-routes.mjs`, canary, retire the monolith | Not started | — | — |

## Resume instructions (post-compaction / new session)

1. Read this file — it's the map.
2. `git log --oneline -15` on `main` to confirm the last merged phase matches the table above.
3. Pick up at the first row still "Not started" / "⏳ Next", following "How each phase runs" above.
