# Command Base — shared agent handoff

## Session boundary

Jason authorised this collaboration through **3 October 2026, 12:00 Australia/Sydney (UTC+10)**. Start no new work after the deadline. Preserve completed work and report any unfinished render; never kill unrelated processes. No purchases, new API subscriptions, normal-game rollout or changes to production art gates are authorised by this session.

`AGENT_HANDOFF.json` is the current ownership/state record. This document defines the workflow. Current starting baseline: main e1752d3, motion tag blender-walk-motion-baseline. Local Blender remains Claude's responsibility; Codex cannot launch it remotely.

## Ownership and exchange

1. Claude reads the latest state and claims the next task by setting status `CLAUDE_RUNNING`, owner `CLAUDE`; commit/push the claim before editing task files. Preserve unrelated local edits. Only Claude changes Blender/preview code during this task.
2. Claude completes one bounded task, runs relevant checks, pushes source/evidence/report, then sets status `CODEX_REVIEW`, owner `CODEX`, with report path, evidence paths and tested implementation commit. No need to ask Jason about routine fixes within the brief.
3. Codex reads the newest report, code and actual images/clips. It writes a review and the next precise task to the handoff, sets status `CLAUDE_READY`, owner `CLAUDE`. Codex does not simultaneously edit Claude-owned implementation files. Keep a last-reviewed implementation SHA to prevent duplicate reviews.
4. Claude checks GitHub for the handoff while its local session remains active. Checking a document does not wake an idle Claude session. Jason gives the bootstrap instruction once; no further copy/paste relay should be required for routine iterations.
5. If no evidence is ready, Codex leaves the state alone and does not notify Jason. If a task is blocked, record exactly what is missing. Bring Jason in only for meaningful visual approval, scope changes or a blocker needing his input.
6. At noon, stop assigning tasks, set `SESSION_CLOSED` and provide a concise checkpoint. In-flight renders may finish and be saved, but do not start another pass. Keep .blend files local in art/local-blender. Use a new output folder per render.

Codex's scheduled checks are hourly (10:00, 11:00, 12:00); they are not an instant chat or a 15-minute watch. Avoid overlapping reviewers. Re-read the latest GitHub ref before each write; use additive/non-forced commits. Never reset or stash someone else's local changes. On conflict, preserve both reports and reconcile the handoff before continuing.

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
