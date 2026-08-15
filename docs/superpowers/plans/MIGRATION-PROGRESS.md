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

## Phase status

| # | Phase | Scope (from the published audit) | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | esc/clone/uid, fmtDateBR/brl/ageFrom, toast/modal/loadingHTML | ✅ Done | `2026-08-15-migration-phase1-foundations.md` | `73da3ab` (+ `d684c28` test-scope fix) |
| 2a | Categories | addCategory/removeCategory/renameCategory/ensureCategories/activeCategory/switchCategory/categoryBar (categorySnapshot/categoryTeamLimitReached/canAddTeams deferred to Phase 6, billing-coupled) | 🔧 In progress | `2026-08-15-migration-phase2a-categories.md` | — |
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
