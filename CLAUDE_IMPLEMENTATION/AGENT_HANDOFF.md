# Command Base — shared agent handoff

## Session boundary

Jason renewed this collaboration on **3 October 2026, 23:27 Australia/Sydney**, with hourly GitHub reviews until stopped or a meaningful approval/blocker requires him. The earlier morning deadline is superseded. Historical checkpoints below remain preserved. Preserve completed work and report any unfinished render; never kill unrelated processes. No purchases, new API subscriptions, normal-game rollout or changes to production art gates are authorised by this session.

`AGENT_HANDOFF.json` is the current ownership/state record. This document defines the workflow. Current starting baseline: main e1752d3, motion tag blender-walk-motion-baseline. Local Blender remains Claude's responsibility; Codex cannot launch it remotely.

## Ownership and exchange

1. Claude reads the latest state and claims the next task by setting status `CLAUDE_RUNNING`, owner `CLAUDE`; commit/push the claim before editing task files. Preserve unrelated local edits. Only Claude changes Blender/preview code during this task.
2. Claude completes one bounded task, runs relevant checks, pushes source/evidence/report, then sets status `CODEX_REVIEW`, owner `CODEX`, with report path, evidence paths and tested implementation commit. No need to ask Jason about routine fixes within the brief.
3. Codex reads the newest report, code and actual images/clips. It writes a review and the next precise task to the handoff, sets status `CLAUDE_READY`, owner `CLAUDE`. Codex does not simultaneously edit Claude-owned implementation files. Keep a last-reviewed implementation SHA to prevent duplicate reviews.
4. Claude checks GitHub for the handoff while its local session remains active. Checking a document does not wake an idle Claude session. Jason gives the bootstrap instruction once; no further copy/paste relay should be required for routine iterations.
5. If no evidence is ready, Codex leaves the state alone and does not notify Jason. If a task is blocked, record exactly what is missing. Bring Jason in only for meaningful visual approval, scope changes or a blocker needing his input.
6. When Jason stops the resumed session, or the preview is ready for his final approval, stop assigning tasks, set `SESSION_CLOSED` or `AWAITING_JASON` and provide a concise checkpoint. In-flight renders may finish and be saved, but do not start another pass. Keep .blend files local in art/local-blender. Use a new output folder per render.

Codex's resumed scheduled checks are hourly; they are not an instant chat or a 15-minute watch. Avoid overlapping reviewers. Re-read the latest GitHub ref before each write; use additive/non-forced commits. Never reset or stash someone else's local changes. On conflict, preserve both reports and reconcile the handoff before continuing.

## Task 1 — preview readability and frame selection

Preserve e1752d3's calibrated projection, pivot, 44 px standing height, stride 22 px, speed 38 px/s and pass-4 motion. Keep normal game, asset manifest/cache and walk release gate unchanged.

Create a **preview-only** controlled comparison:

- Current rendering versus warmer map-matched upper-left lighting and stronger uniform value contrast.
- Existing soldier accent colour and readable identity marker, with no labels covering boot contact.
- A subtle silhouette-only outline at actual runtime size; no lines across face, pockets or straps.
- Floor versus nearest-frame selection. Measure positional error and inspect the snapping; nearest-frame selection is not a promise to eliminate quantisation.

Do not change proportions, widen the body, rebuild the gait or create start animations in this task. Keep variables separable so the evidence explains what improves readability.

Return normal-size and max-zoom comparison PNGs, a short real-speed clip, drift measurements and a report in `CLAUDE_IMPLEMENTATION/13_BLENDER_READABILITY_REVIEW.md`, with candidate evidence under `art/review/blender-walk-06/`. Fix routine execution/clipping/alpha failures locally. Run asset validation and confirm normal-game files/gates are untouched. Push completed evidence even if the visual verdict is mixed.

## Subsequent work

Codex chooses the next bounded task from actual evidence. Continue within isolated walking/readability previews only. Final art approval and broad integration remain Jason's decisions. Progress means an improved visible result, not merely numerical checks passing.


## Codex task 1 review and next handoff — 3 October 2026

Reviewed implementation 495ba2f. See [14_CODEX_READABILITY_REVIEW.md](14_CODEX_READABILITY_REVIEW.md) for evidence limitations, validation and the bounded task 2. Warm/contrast + silhouette outline + identity marker are working preview choices, not production approval. Nearest frame centres error but does not remove snapping. Claude's next task is a preview-only 24-versus-48 unique-phase comparison, preserving motion, model and calibration. No source implementation was changed by Codex. Finish or checkpoint remaining renders before noon Sydney; do not broaden scope.


## Codex task 2 review and next handoff — 3 October 2026

Reviewed ca8cea0. [16_CODEX_DENSITY_REVIEW.md](16_CODEX_DENSITY_REVIEW.md) records independent measurements and frame inspection. Use 48-nearest as the working isolated preview, with final visual approval open. Task 3 is one right-facing contact-preserving idle-to-walk start, keeping existing loop, stop, model and calibration unchanged. No production integration. Checkpoint unfinished work at noon Sydney.


## Session checkpoint — 3 October 2026, after noon Sydney

Session closed; no new task assigned. The governing request for this review run ends at 12:00 Sydney. JSON also contains a 12:30 extension note; that note is preserved, but this reviewer has no direct updated instruction authorising further task assignment.

Completed and committed:
- Task 1 readability comparison (495ba2f): contrast, silhouette outline and marker improve visibility; warm lighting modest. Final style approval open.
- Task 2 density comparison (ca8cea0): 48 distinct phases with nearest selection halve measured planted-foot quantization, about 0.92 to 0.46 world px. Working preview baseline only; walking PNG cost doubles to about 1.43 MB per direction.
- Task 3 start transition (5e1eb1d): 20 rendered start frames and a 25-second comparison clip are committed under art/review/blender-walk-08. Claude reports zero continuous support slide, intact torso/harness and unchanged loop/stop/idle. Idle-to-start image difference is zero; start-to-loop boundary difference 1.099 versus ordinary loop steps 0.859–0.928, far below the old abrupt start's 9.89. Start heel-off quantization remains up to 0.95 world px, coarser than the 48-phase loop.

Final evidence review: read report 17, inspected the committed transition strip and a frame extracted from the actual start clip. The strip shows a gradual first step instead of the old abrupt pose jump. This is a limited frame review, not full real-time video approval. Re-ran world and routine tests: both pass. Claude reports asset validation clean; Codex cannot independently run its browser pixel stage in this environment. Implementation paths remain Blender/preview tools and evidence, not normal-game integration.

Remaining for a future authorised session (not assigned now): real-time visual judgement of the complete start/walk/stop clip, final model/lighting/outline style approval, other directions and turn transitions, and eventual production gate validation. No final art or release approval given.

Unfinished renders: none reported in the latest completed handoff; all listed task-3 frames and clip are committed. Claude's local process state is not remotely observable, so this is not a claim that every local Blender process has stopped. Preserve any in-flight render output; do not start another pass under this closed session.


## Resumed collaboration — 3 October 2026, 23:27 Sydney

Jason renewed hourly review and continued isolated preview work. Prior noon closure remains a historical checkpoint. Main still points to task-3 implementation 5e1eb1d; no later main implementation was found at reopening. See [18_DIRECTION_PREVIEW_BRIEF.md](18_DIRECTION_PREVIEW_BRIEF.md) for task 4, one calibrated down-facing movement set. Keep later local or branch work if present and report it before duplicating. Claude's local watcher must already be active. No production rollout or release-gate approval is authorised.


## Four-hour session closure — 4 October 2026

Jason requested the resumed review/run process stop after four hours. That limit has elapsed; SESSION_CLOSED, no next task assigned, hourly checks stopped.

Main at e137fbc still records task 4 (down-facing start/walk/stop/idle) as claimed by Claude. No new implementation commit, completed report or down-facing evidence was returned in the handoff. No visual or numerical pass for task 4 is claimed. The last reviewed implementation remains 5e1eb1d (right-facing start); earlier readability and 48-phase comparisons remain preserved.

Outstanding: down-facing render/evidence and review, further directions/turns, full real-time visual approval and final style/integration decisions. Unfinished-render status is unknown: GitHub provides no frame counts, render log or local process state for task 4. Claude should save any already-running render and report completed/remaining frames or a blocker; start no new task or pass. This closure does not stop local processes or discard local work. No normal-game rollout or production gate changes performed by Codex.
