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
2. `EnterWorktree` (isolated worktree — recommended default, established Phase 1).
3. Execute via `superpowers:subagent-driven-development`: implementer → task review → (fix loop) per task, ledger at `.superpowers/sdd/progress.md` inside the worktree.
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

## Phase status

| # | Phase | Scope (from the published audit) | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | esc/clone/uid, fmtDateBR/brl/ageFrom, toast/modal/loadingHTML | ✅ Done | `2026-08-15-migration-phase1-foundations.md` | `73da3ab` (+ `d684c28` test-scope fix) |
| 2a | Categories | addCategory/removeCategory/renameCategory/ensureCategories/activeCategory/switchCategory/categoryBar (categorySnapshot/categoryTeamLimitReached/canAddTeams deferred to Phase 6, billing-coupled) | ✅ Done | `2026-08-15-migration-phase2a-categories.md` | `6c625a8` |
| 2b | Teams & athletes (full roster) | addAthlete/delAthlete/editAthlete/saveAthlete/athleteById/athName/eaPhoto/compressPhoto/readAndResizeImage/pickLogo/teamById/teamNameById/teamLogoMini/renTeam/delT | Not started | — | — |
| 2c | Venues & officials | addVenue/delVenue/venueById/addOfficial/delOfficial/officialById/staffRow/setStaff | Not started | — | — |
| 2d | Phases & format (liga/grupos/mata-mata) | addPhase/removePhase/renamePhase/ensurePhases/activePhase/switchPhase/phaseBar/phaseSnapshot/phaseComplete/phaseParticipants/newPhaseFromRoot/loadPhaseIntoRoot/saveRootIntoActive/loadCategoryIntoRoot/setPhaseFormat/generateActivePhase/setFmt/renderFmtOpts/setProgressMode/setProgressCount/setProgressTarget/progressBar/progressionSummary/applyProgression/qualifiedFromPhase | Not started | — | — |
| 3a | Draw & bracket engine | drawBracket/drawGroups/runDraw/confirmDraw/finishDraw/toggleSeed/refreshSeeds/seedOrder/genCross/makeBracketFromOrdered/buildFixtures/buildGxg/nextPow2/roundRobin/renderDraw/renderBracketView/renderMataFromGroups/advanceBracket/loserOf/findTie | Not started | — | — |
| 3b | Matches & scoring | setScore/setTie/tieHTML/tieObj/matchRow/matchMeta/matchContext/matchEvents/openMatchOps/saveMatchOps/opsConfigHTML/mark/clearResults/nextMatchesCard/allMatchObjs/h2h/resolveTie | Not started | — | — |
| 3c | Standings & scorers | computeStandings/standingsForPhase/standingsTable/standsToRows/cardRanking/scorerRanking | Not started | — | — |
| 3d | Discipline & suspensions | viewDisciplina/suspensionInfo/critAdd/critMove/critRemove/critCommit/critTail/criteriaEditor/optCrit/optTurnos | Not started | — | — |
| 4 | Reports & exports (PDF) | exportJSON/importJSON/exportPDF/exportRosterReport/exportStandingsReport/exportScorersReport/exportDisciplineReport/exportOfficialsReport/exportTeamsReport/exportResultsReport/exportScheduleReport/exportRoundBulletin/exportAthleteCards/reportBase/reportName/reportStandingsBlocks/printSumula/sumulaModal/renderSumula | Not started | — | — |
| 5 | Public portal & registration | enterViewer/publicHome/publicChampionshipPayload/publicBrandHero/publicNavHTML/publicMatchCard/publicMiniStandings/publicTopScorers/publicAthleteRows/publicSponsorsHTML/sanitizePublicState/sharePublic/shareLinkFor/downloadQR/qrDataURL/renderPublicationQRs/publicationCard + registrationCfg/registrationDeadlineClosed/registrationStatusLabel/setRegistrationDocs/addPublicAthleteRow/copyRegistrationLink + brandingConfigHTML/sponsorsConfigHTML/addSponsor/removeSponsor/ensureBranding/clearBrandImage/setBrandImage | Not started | — | — |
| 6 | Administration | inviteManager/removeManager/changeManagerRole/ensureCollaborators/myCollaborator/myRole/roleLabel/can/isOwner + renderSuperadmin/loadPlatformAdmin/superOpenChamp/suAdd/suAddAnon/suDel/suObj + renderAuditCenter/renderSecurityCenter/renderPrivacyCenter/privacyNoticeHTML/renderBetaHardening + choosePlan/currentPlan/planCardsHTML/planLimitText/canCreateChampionship/confirmPlanRequest/approvePendingPlan | Not started | — | — |
| 7 | Build cutover | remove `scripts/prepare-legacy.mjs` from the build, expand `scripts/verify-routes.mjs`, canary, retire the monolith | Not started | — | — |

## Resume instructions (post-compaction / new session)

1. Read this file — it's the map.
2. `git log --oneline -15` on `main` to confirm the last merged phase matches the table above.
3. Pick up at the first row still "Not started" / "⏳ Next", following "How each phase runs" above.
