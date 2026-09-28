# Brief 08 — First soldier chapter and character-led progression

**Decision:** Claude implements this gameplay/UI slice. Codex owns art direction and later portrait/sprite production. This brief supersedes conflicting first-session pacing and hospital numbers in `DESIGN.md`; keep the existing world, save compatibility and code architecture. The goal is a legible ten-minute first session, not a full game rebalance.

## Player promise and success condition

The player should remember a specific soldier they admitted, trained and sent out, and know why the next building helps that soldier. The first meaningful sequence is **visitor at gate → admission → named soldier card → range training → first patrol → individual debrief → useful unlock**. Build the game around this single sequence before adding facilities or mission tiers. Avoid tutorials that merely list controls.

At the end of an unscripted first ten-minute playtest, a new player should be able to answer: Who is my first soldier? What did training change? Why did I send that soldier on the patrol? What did the patrol earn? What should I do next? Record confusion and time-to-first-patrol; do not claim the design works without testing it.

## Ground truth in the current code

`js/unit.js` already stores stable name, level, XP, stats, appearance variant, equipment array and mission state; `js/main.js` already has recruit, roster, profile and mission panels. `js/mission.js` has a 3-minute Local Patrol and three later timed tiers; `js/state.js` dispatches only units with status `IDLE`, resolves outcomes per soldier, and a failed soldier can face 23 hours of real recovery. `DESIGN.md` currently emphasizes eight facilities and a 20-person roster. These are implementation starting points, not a reason to show all decisions to a first-time player.

## Deliverable A: guided first session

1. Introduce a **small objective card** with one instruction, progress and one obvious action at a time. Its sequence: `Meet your first visitor`, `Admit [name]`, `Train [name] at the range`, `Send [name] on Local Patrol`, `Welcome [name] back`, `Use patrol earnings to improve the base`. Names interpolate from the actual recruited unit. The player can still pan, inspect and play normally; do not block the whole UI with modal tutorial steps.
2. Start with the existing Entrance Hall and gate and make the first recruit and one useful training station feasible with starting cash. Use a real world route and visible check-in. If the range needs building, explicitly make building it the next objective; do not silently jump over that cost. Do not force the soldier to be named Alex or change a player's chosen name.
3. Highlight the relevant gate visitor, unit card, facility and mission button in context. If a player clicks elsewhere, preserve progress and restore the current objective. Persist chapter stage and first soldier ID; derive the current stage from durable state where possible so reload and old saves cannot restart or strand the sequence. Provide a compact `Skip guidance` control without skipping rewards or game state.
4. Keep all existing systems reachable, but hide or collapse advanced build choices and resource counts behind a `Base`/`More` section until the first patrol returns. Show a clear next action and its cost/requirement instead of a wall of buttons. Existing saves with experienced rosters should not be forced into onboarding.

## Deliverable B: memorable soldier identity

1. Use one canonical soldier card accessed from the roster and map. Show a consistent portrait slot or bust derived from that soldier's appearance variant, full editable name, role/speciality earned through play, current activity, 1–2 relevant stats, XP to next level, and a short mission history. Clicking the card locates the soldier; tapping the soldier opens the same card. Do not synthesize a unique illustrated portrait per name; a small set of stable visual variants with consistent identity is sufficient for first release. Coordinate with Codex on portrait export before promoting final art.
2. Show a compact individual event on meaningful change: `accuracy 48 → 55`, `qualified for Local Patrol`, `returned with 70 cash`, `level 2`. Keep the full stats in the detailed profile. Avoid repetitive popups for every training tick.
3. Keep character identity across save/load, clothes, field view, portrait, mission report and hospital. No permadeath. Give the first soldier a memorable earned tag or one-sentence service record after the patrol; this is a presentation feature, not a new RPG tree.

### Player customization: deliberately small first slice

Allow the player to rename a soldier (already present), choose or edit a short optional callsign, and choose one of 3–4 **visible identity accent colours** for the helmet band/shoulder patch. Persist these choices per soldier and show them on the card, in the in-world sprite and in the mission report using the existing accent mask pipeline where approved. The portrait currently has no accent mask: display its chosen colour as a consistent UI badge beside the portrait until an accurate mask is supplied. Use one shared palette and do not tint skin, kit, shadows or the whole body. Provide a `Randomise` control for callsign/accent and reasonable defaults; customization should be optional and should never block the first patrol. Reuse the existing name-edit UI rather than opening a full character creator on admission.

Do not offer selectable face, body, hair or uniform parts until each option has matching down/up/right walk and idle, portrait and activity art. Avoid implying that a portrait choice changes the in-world character when it does not. Later equipment may change abilities and cosmetic kit together, but its effects require a separate balance and asset brief. Add a save migration for callsign/accent and verify edits survive reload and appear consistently in the roster, map and debrief.

## Deliverable C: training leads to a choice

1. The objective and mission card should explain the relevant stat threshold and show progress (`Accuracy 48 / 55`), estimated training time and where to train. The first patrol may have an onboarding readiness threshold even though the current tier technically allows level 1 and any stats; make the value meaningful and visible. Do not quietly change later tier formulas or add multiple currencies.
2. Fix the deployment trap: a soldier assigned to training is currently often `TRAINING`, while `eligibleUnitsForTier()` accepts only `IDLE`. At dispatch, allow an otherwise eligible on-base soldier to be recalled/removed from a training slot through a clearly named action, preserving slot, queue and route invariants. Show ineligibility reasons rather than an unexplained disabled button. Do not dispatch a soldier who is hospitalised, away or still entering the base.
3. Provide one explicit recommendation at a time (`Train accuracy`, `Ready for patrol`, `Rest before deployment`) and let players choose freely afterward. Building upgrades should say what they change in terms of people served or missions enabled.

## Deliverable D: first mission with a payoff

1. Make the first Local Patrol a short **one-time introductory assignment** for the first soldier, around 60–90 seconds in real time, with an explicitly guaranteed successful tutorial result. Afterward Local Patrol uses the regular mission rules and existing 3-minute timer. Do not silently manipulate a displayed success percentage. The introductory assignment uses the ordinary gate departure/return, save-safe timer and resource/XP reward pipeline.
2. Show departure, a named active mission card and visible return time. On return show an individual debrief with portrait/name, concrete event text, XP change, reward and the next affordable/aspirational construction choice. Cash/resource amounts must match what the state awarded; avoid a generic success toast. Returning after a closed tab should surface the debrief once, not lose or duplicate it.
3. Separate later missions by **purpose** as well as difficulty: e.g. Supply Run obtains lumber for the next upgrade, Outpost secures steel, specialist operation earns rare materials. The mission cards must say which building/upgrade the reward unlocks. Keep the existing tier implementations as the first pass; avoid adding map combat or tactical minigames in this brief.
4. Replace the 23-hour real-time hospital penalty for early mission failure with a short, readable recovery (suggest 5 minutes for Local Patrol; later tier durations can scale and need testing). Persist the deadline, explain the outcome and do not erase growth or identity. Ensure an unlucky second patrol cannot halt the first session for a day.

## Deliverable E: grounded movement gate

Character movement is part of the usability of this chapter. Before calling the chapter complete, show the same first soldier travelling gate → range → gate → return with feet on the path and no visual pop when turning or stopping. Continue the existing Gate 2 direction work: approved down walk/idle plus painted up/right walk/idle from a shared master; left may mirror right only if rifle and kit remain convincing. Use the existing gait validator, planted-foot tracking and continuous 30-second game-size clip. If the missing directional art is not yet approved, implement A–D on a branch but explicitly mark this release gate blocked; do not present gliding figures as finished.

## Engineering and review

- Keep vanilla JS/Canvas/localStorage and save migration. Put state transitions in `js/state.js`, presentation in `js/main.js`/CSS, tier data in `js/mission.js`; avoid a separate tutorial simulation or duplicate economy.
- Make the intro resumable after refresh, offline return and save export/import. Migrate old saves safely; an existing advanced base starts with guidance dismissed. No onboarding rewards may be duplicated by reload, multiple tabs or repeated report opening.
- Tests: intro stage progression; first soldier ID persistence; an assigned trainer can deploy after explicit recall; ineligible reasons; one-time guaranteed intro outcome and subsequent normal rolls; recovery duration; exactly-once report/reward across reload; mobile touch objective path; 30-second gait continuity. Run existing suites and asset validation, then save desktop and portrait captures.
- Review with at least one person unfamiliar with the code. Capture the first ten minutes, noting whether they can name their soldier, explain the training-to-mission link and find the next action without prompting. If not, improve the presentation before adding systems.

## Scope boundaries and handoff

Do **not** build additional training facilities, new mission tiers, monetisation, procedural portraits, combat views, gear crafting, elaborate traits, or a 20-person roster screen redesign in this brief. First demonstrate that one soldier creates a compelling loop. Claude should commit implementation and evidence to its own branch, share screenshots/clip and test results for review, then merge or push to `main` as already authorised by Jason. Codex can deliver portrait and walking assets against Claude's measured export contract separately.
