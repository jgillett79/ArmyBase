# Brief 08 manifest — first soldier chapter

Branch `brief-08-first-soldier`, 28 September 2026. Implements [08_FIRST_SOLDIER_CHAPTER.md](08_FIRST_SOLDIER_CHAPTER.md).

**Status:** deliverables A–D work in gameplay. Automated tests and a real-time browser playthrough on desktop and on a portrait phone (touch input) both pass. **Deliverable E (grounded directional walking) is blocked on art.** The movement itself passes its checks in code, but up/right walk and idle art doesn't exist yet, so soldiers still glide as still sprites when they walk up or sideways. **Not done:** a playtest with someone unfamiliar with the code. It needs a person; the script is in section 7.

## 1. What a new player gets

1. **Meet your first visitor.** A visitor checks in at the gate barrier and walks to an Entrance Hall chair. The objective card names them, the map rings and marks them, and their roster card pulses. Tapping them (on the map, the roster or the card button) opens a visitor card with a portrait, what admission costs ($50) and what it does.
2. **Admit [name].** Admission opens the new soldier's card straight away. They walk to the barracks in civilian clothes and change into uniform there (the existing route and check-in).
3. **Train [name] at the range.** The Shooting Range isn't built at the start, so building it ($80) is an explicit step. The button opens the normal build mode and the range site is highlighted. Starting cash covers the recruit and the range ($200 → $70). Next comes "Assign [name] to the range", with progress `Accuracy 49 / 50`, an estimate ("about 25 s at the range"), and the range's hours (09:00–12:00, 13:00–17:00 of game time) with the current clock.
4. **Send [name] on Local Patrol.** Once ready, the card and the Missions button lead to Local Patrol, preselected. For this soldier it is the one-time introductory assignment: 75 s real time, solo, labelled "Guaranteed return (introductory patrol)", $70 + 60 XP. If they are training or eating, the button says so: "Recall Linda and send on Local Patrol".
5. **Welcome [name] back.** A countdown shows while they're away. They walk out through the gate and back in. Then the debrief opens once, with portrait, name, what happened, the exact cash and XP awarded, the service record ("First In: The base's first soldier: admitted at the gate, trained at the range from accuracy 48 to 49, and home from the first Local Patrol with $70."), and the next construction (Mess Hall, $120: "Meals with your food stock, so soldiers stop collapsing from hunger. You have $146.") with a Build button.
6. **Use patrol earnings to improve the base.** Building anything completes the chapter. Resources, the "More" HUD section and all build choices open up.

Throughout: "Skip guidance" hides the card and highlights. It changes no state and skips no rewards (the intro patrol is still there), and "Show guidance" brings the card back. Resource counts (food, lumber, steel, gems) sit behind "More", and only the suggested building shows, until the first patrol returns. "All buildings" shows the rest at any time.

## 2. Where it lives

| Area | File | What |
|---|---|---|
| Chapter state | `js/state.js` | `freshChapter()`, `chapterStage()` (derived), `guidanceActive`, `onboarding`, `dismissGuidance()`, `noteConstruction()`, `nextConstructionAdvice()`, `recommendationFor()`, `trainingSecondsToTarget()` |
| Deployment | `js/state.js` | `deploymentCheck(unit, tier)` → `{ ok, recall, reason }`, `introTierFor()`, `dispatchMission(tier, ids, { recall })`. Recall releases the slot or queue place and keeps the training assignment |
| Debriefs | `js/state.js` | `resolveMissionForUnit()` writes the report (`id, unitId, cash, resource, xp, levelFrom/To, recoveryUntil, intro, seen`), `unseenReports()`, `markReportSeen()`, `missionHistoryFor()` |
| Moments | `js/state.js` | `pushEvent()` (runtime only): uniform, departure, return, level, readiness, one line per training session (`accuracy 49 → 50 at the Shooting Range`), collapse, recovery |
| Tier data | `js/mission.js` | `purpose`/`unlocks`/`recoveryMs` per tier, `INTRO_PATROL`, `INTRO_READINESS_GAIN`, `NEGLECT_RECOVERY_MS` |
| Identity | `js/unit.js` | `trained` (stat points gained by training) → `speciality` (Recruit / Marksman / Breacher / Pathfinder), `serviceTag`, `serviceRecord`, `hospitalReason` |
| UI | `js/main.js`, `index.html`, `css/style.css` | objective card, soldier card (portrait, role, activity, recommendation, key stat, XP to next level, service record, last 3 missions, "Show on map", full profile folded), visitor card, mission panel (purpose, unlock, every soldier with a reason or recall note), debrief, event toasts, onboarding folding |
| Map | `js/render.js` | `drawPortrait()` (head and shoulders from the soldier's own tinted front still), `drawGuideHighlight()` (ring and marker on the person, dashed outline on the facility) |
| Release gate | `js/asset-manifest.js` | `walkReleaseGate()` → `{ ready, blockers }` |

`BUILDING_LABELS` moved from `render.js` to `building.js` so state code can name facilities.

## 3. Save

- Still schema 2 and `armybase_save_v2`. Every addition is optional, so an older build still loads these saves (it ignores the extras). Added: `chapter`, per-unit `trained`/`serviceTag`/`serviceRecord`/`hospitalReason`, and richer mission-log entries.
- A save without `chapter` (v1 migration, an older v2 save, or an imported backup) gets one from `chapterForSave()`. Any soldier, mission history or built facility means an **established base**: chapter done, guidance dismissed, no intro patrol. An empty save starts the chapter.
- A chapter that follows a soldier who isn't on the roster (only possible in an edited backup) is closed rather than refusing the whole save. A malformed chapter field is a readable validation error.
- Exactly-once: resolution, reward and the report are written in the same tick that clears `ON_MISSION`, so a saved game holds either the pending mission or its result, never both. The debrief is `seen: false` until read. Reading it saves immediately, and dispatch, admission and construction also save immediately. Two tabs on one save each simulate their own copy, and the last save wins, so a reward can't be counted twice in stored progress. There is no cross-tab lock.

## 4. Tests and evidence

Commands (all pass, 28 Sep):

```
node tests/chapter.cjs        # new — see below
node tests/activity.cjs tests/smoke.cjs tests/save-migration.cjs tests/render-data.cjs tests/ui-smoke.cjs tests/world.cjs
node tools/validate-assets.cjs
node tools/capture-first-session.cjs desktop   # real time, mouse
node tools/capture-first-session.cjs phone     # real time, 390x844 @2x, touch taps
```

`tests/chapter.cjs` covers:
- stage progression, with first-soldier id persistence across reloads;
- range construction as an explicit step;
- readiness gating with its reason;
- the deployment trap (a trainee is refused without `recall`, then sent with it; slot released, assignment kept, recall logged);
- the solo intro, which can't be sent twice;
- reload mid-patrol;
- a guaranteed intro even when the random roll would fail, and a later normal Local Patrol that can fail;
- recovery (5 min Local Patrol, 5 min neglect, tier table 5/30/120/240 min, neglect ≤ shortest);
- every ineligibility reason;
- exactly-once report and reward across three reloads, with a repeated read being a no-op;
- skip guidance keeps the intro;
- old saves (the v1 fixture is established; an empty v2 starts the chapter; an orphaned chapter is closed; a malformed chapter is rejected; legacy log entries are never "unread");
- **movement continuity**: 38–46 s of the soldier walking gate → range slot → out of the gate → back in, sampled at 30 fps. No frame moves further than walking speed allows. Trail legs stay within 1 world px of the authored trail. Door-to-slot steps stay by the entrance. Facing never flickers and never turns while standing, and arrival holds still;
- the release gate (reports the blockers, and candidates stay hidden by default).

Browser playthroughs (real time, real input, fresh save):

| | desktop (mouse) | phone (touch) |
|---|---|---|
| admitted | 19 s | 19 s |
| assigned to range | 46 s | 42 s |
| ready for patrol | 110 s | 104 s |
| **first patrol dispatched** | **114 s** | **107 s** |
| patrol returned, debrief | 189 s | 182 s |
| chapter complete (Mess Hall built) | 199 s | 193 s |

Both also checked that the chapter resumed at "away" after a mid-patrol reload, that the debrief cash matched the state's award, and that a reload after completion showed no second debrief and no second reward. The phone run tapped the visitor on the canvas with touch events, and every button was tapped through touch. In both runs the soldier was recalled from the range ("Recall Mary and send on Local Patrol"). An earlier run of the same script dispatched at 78 s (desktop, recalled from a meal break) and 127 s (phone, reached the range just before lunch). The spread comes from the in-game clock and each soldier's walking speed.

Screenshots: `docs/screenshots/2026-09-28-chapter-desktop-*.jpg` and `…-phone-*.jpg`. Clips (not committed; `captures/` is ignored) are in `captures/first-session/<mode>/`: `clip-range-to-gate.webm` (recall at the range → out of the gate, camera following) and `clip-gate-return.webm` (walking back in).

Headless pacing (scratch simulation of a player who acts N seconds after each step, same rules as the game):

| reaction per step | first patrol | chapter complete |
|---|---|---|
| 3 s | 115 s | 196 s |
| 10 s | 135 s | 230 s |
| 20 s | 146 s | 261 s |
| 30 s | ~760 s: missed day 1's training window, collapsed overnight, recovered | ~900 s |

## 5. Blocked by art (Deliverable E)

- `walkReleaseGate()` currently reports: walk down: candidate; walk up: missing; walk right: missing; idle down: candidate; idle up: missing; idle right: missing.
- What works in code: route geometry, continuity, facing and stopping (see the test above). With `?art=candidates`, the approved-quality down walk and idle already play (`tools/capture-walk-clip.cjs`).
- What players see by default: still sprites that glide. Per the brief this is **not** presented as finished. The request is in `art/CHATGPT_FEEDBACK.md`, seventh round, together with the portrait export contract (six 256 × 256 busts from the same master, in the neutral palette so the identity tint applies).

## 6. Decisions that need review

1. **Readiness target is +1 accuracy** (`INTRO_READINESS_GAIN`). The brief's example implied a bigger jump. Measured: the range trains 7 of every 24 game hours, a game day is 5 real minutes, and walking uses game hours, so a new player gains about 1.5 accuracy on day 1. At +3 the first patrol slipped to about 12 minutes and the soldier collapsed overnight first. At +1 the first patrol is at 2–2.5 minutes. The real lever is the training rate or schedule, which the brief said not to change quietly (see options below).
2. **Neglect recovery is now 5 minutes** (was 23 hours). CLAUDE.md locks "neglect never harsher than mission failure". Once Local Patrol failure became 5 minutes, neglect had to be at most 5 minutes. That makes starvation a mild setback. Alternatives are in the options below.
3. **Later tier recoveries** are 30 min / 2 h / 4 h (equal to each mission's duration). These are placeholders.
4. **Deploying from any on-base activity.** The brief asked for recall from training. I applied the same explicit recall to eating, showering, free time and sleeping, because the old IDLE-only rule also blocked missions for most of every game day. Exhausted soldiers (energy ≤ 20) can't be sent: "Too tired — needs food and rest first".
5. **Specialities.** The role is the stat trained most (Marksman / Breacher / Pathfinder, or Recruit before one whole point). The first soldier's tag is "First In". Both are presentation only.
6. **Schema.** I kept schema 2 with optional fields instead of bumping to 3, so a cached older build never refuses a newer save.
7. **The day-1 collapse trap is reduced, not removed.** Without a Mess Hall, a soldier runs out of energy on day 2 (about 6–7 real minutes in). The chapter now leads to the Mess Hall, and patrol earnings pay for it. A slow player can still see a collapse before that: a 5-minute recovery, explained on the card.

## 7. Playtest script (not yet run — needs a person)

Use a fresh browser profile. Say only "this is a base-building game; play for ten minutes". Don't point at anything. Note the time of the first patrol and every hesitation longer than 10 s. Afterwards ask:
1. Who is your first soldier? (Can they give the name without looking?)
2. What did training change?
3. Why did you send that soldier on the patrol?
4. What did the patrol earn?
5. What should you do next?

Record where they looked first, whether they found the visitor without the card, and whether "Skip guidance" or "More" confused them. If any answer fails, improve the presentation before adding systems (brief rule).

## 8. Options for the design discussion (Jason, ChatGPT and Claude)

These are open design questions, written so all three of us can argue them. My recommendation is marked ★, but none of this is built.

### A. First-session pacing (why the readiness target is only +1)

- **A1. Keep the rules and accept +1** (current). Pro: no economy change. Con: "training changed my soldier" is a single point.
- **A2. Faster training for level-1 soldiers** (for example ×3 until level 2). Pro: a bigger visible change early, then normal rates. Con: a special case in the training formula.
- **A3. Longer training blocks** (for example 08:00–12:00 and 13:00–18:00) or a longer game day. Pro: simple. Con: shifts every needs/schedule balance.
- **A4. Readiness by range time instead of stat** ("complete one range session"). Pro: robust to walking time. Con: less of a number to watch.
- ★ **A2**, capped at level 2, together with a +3 target. That gives a clearly visible change (for example 48 → 51) inside the first day. It needs a new headless pacing run before committing.

### B. Consumables — Jason's idea ("potions … free at first, later as mission or ad rewards")

- **B1. Field ration**: one use; the soldier eats anywhere (+40 energy). The first two are free, and later ones come as Local Patrol rewards. It directly covers the day-1 hunger problem.
- **B2. Training manual**: one use; doubles training for one range session. It pairs with A1 and could replace A2.
- **B3. Medkit**: halves one recovery. **Careful:** this is the "pay to undo the consequence" pattern CLAUDE.md warns about if it is ever sold. It is fine as an earned-only reward.
- **Ads:** CLAUDE.md accepts "watch an ad to skip wait time" as convenience. Rewarded ads that grant consumables are acceptable only if the free path is comfortable without them. Rule of thumb: nothing in the first session should need one.
- Scope: this is a new item system (inventory, UI, save, rewards), so it needs its own brief. Brief 08 explicitly excluded it.
- ★ **B1 as an earned mission reward**, no ads in v1. It gives Local Patrol a second purpose ("bring back rations") and softens neglect without making the recovery rule arbitrary.

### C. Neglect vs failure recovery

- **C1. Equal and short** (current, 5 min). Pro: follows the locked rule. Con: starvation barely matters.
- **C2. Neglect scales with the base**: 5 min until the Mess Hall exists, then 30 min. Pro: the rule "never harsher than a mission failure" still holds against the 30 min Supply Run. Con: one more rule to explain.
- **C3. Prevent instead of punish**: a soldier at energy 20 with no Mess Hall auto-uses a free field ration (B1). Pro: no hospital in the first session at all.
- ★ **C2 for now, C3 if B1 is built.**

### D. My additional ideas (small, character-led)

- **D1. Letters home**: after each mission a one-line diary entry in the soldier's history, written from the mission facts. Cheap, and it builds attachment.
- **D2. Buddy pairs**: two soldiers who train together (same range session three times) get a named bond and +5% when they deploy together. It rewards knowing individuals, not numbers.
- **D3. First-name callouts** on the map ("Linda: Target down!") during range use, rate-limited. Presentation only.
- **D4. Welcome-back moment at the gate**: other on-base soldiers turn to face the gate when a squad returns. Uses existing facing and routing, no new art.
- ★ **D1 first**: it is the cheapest way to strengthen question 1 of the playtest ("who is your soldier?").

## 9. Observations outside the brief

- In one desktop screenshot a visitor crossing the gate bridge was hidden while their highlight ring still showed. That points at the bridge front rail's depth order. It is not reproduced on phone, and I didn't change it here.
- The hero banner still says "Recruit your people"; the chapter uses "meet" and "admit". Left as copy for Jason.
