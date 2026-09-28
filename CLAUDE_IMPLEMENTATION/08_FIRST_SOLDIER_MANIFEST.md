# Brief 08 manifest — first soldier chapter

Branch `brief-08-first-soldier`. It implements [08_FIRST_SOLDIER_CHAPTER.md](08_FIRST_SOLDIER_CHAPTER.md), including its *Player customization* section. Round 2 (28 September): `main` at `eda0f9b` was merged in.

**Status:** deliverables A–D and the customization slice work in gameplay. All eight test suites, asset validation and real-time browser playthroughs pass: desktop, portrait phone (touch), and desktop with candidate art. **Deliverable E (grounded directional walking) is still blocked on art.** The movement passes its checks in code, but walk and idle art facing up and sideways isn't approved, so by default soldiers still glide as still sprites. **Not done:** a playtest with someone unfamiliar with the code. It needs a person; the script is in section 7.

## 0. Round 2 changes

- **Merge with `eda0f9b`.** Main changed only the brief (the new customization section) and added the variant-1 portrait candidate plus its handoff, so the merge was clean. `DESIGN.md` and `js/asset-manifest.js` were not touched on main. The overlap was in meaning rather than text: the portrait needed a manifest entry, a lookup and a validator. All three are done (section 2).
- **Readiness is +3 accuracy**, reached through a labelled **first-soldier range drill**. Details and pacing measurements are in sections 1 and 4.
- **Customization:** an optional callsign and one of four accent colours per soldier, plus Randomise. They are saved and migrated, and they show on the card, roster, map and debrief.
- **Portrait:** the variant-1 candidate is wired in with a safe fallback. It arrived with 88–99% alpha, like earlier deliveries. The delivered file is kept untouched as a source, and `prepare-art` writes the cleaned copy.
- Kept as they were: five-minute early recovery, explicit recall, and the walk release gate (blocked).

## 1. What a new player gets

1. **Meet your first visitor.** A visitor checks in at the gate barrier and walks to an Entrance Hall chair. The objective card names them, the map rings and marks them, and their roster card pulses. Tapping them (on the map, the roster or the card button) opens a visitor card with a portrait, what admission costs ($50) and what it does.
2. **Admit [name].** Admission opens the new soldier's card straight away. The first soldier always wears body variant 1, the only body with a matching portrait and painted walk (per the portrait handoff). This is set before the uniform goes on and saved; nobody else changes. They walk to the barracks in civilian clothes and change into uniform there.
3. **Train [name] at the range.** Building the Shooting Range ($80) is an explicit step; starting cash covers the recruit and the range ($200 → $70). Next comes "Assign [name] to the range". The target is **accuracy at admission + 3** (e.g. `Accuracy 46 / 49`). The card says why the first soldier trains faster: *"Range drill: as the base's first soldier, Omar trains 3× faster at any waking hour (06:00–22:00) until patrol-ready. About 25 s at the range."* Their recommendation chip reads "Range drill: train accuracy". The drill (`FIRST_SOLDIER_DRILL`, `mission.js`) applies only to the first soldier, only while they are assigned to the range, and only until they reach the target. It never applies again after the intro patrol. Sleep and the low-energy safety net still take priority. Everyone else keeps the normal schedule and rates, and a test checks that.
4. **(Optional) make them yours.** On the same card the player can type a callsign ("Kestrel"), pick one of four accent colours, or press Randomise. Nothing asks for this and it never blocks the patrol.
5. **Send [name] on Local Patrol.** Once ready, the card and the Missions button lead to the one-time introductory assignment: 75 s, solo, "Guaranteed return (introductory patrol)", $70 + 60 XP. A soldier who is busy is sent with a named recall: "Recall Omar and send on Local Patrol".
6. **Welcome [name] back.** A countdown shows while they're away; they walk out through the gate and back in. The debrief opens once. It shows portrait, accent badge, name, callsign, what happened, the exact cash and XP awarded, the service record ("…trained at the range from accuracy 46 to 49…") and the next construction (the Mess Hall) with a Build button.
7. **Use patrol earnings to improve the base.** Building anything completes the chapter, and the folded resources and build choices open up.

"Skip guidance" hides the card and changes nothing else; the intro patrol and its reward remain.

## 2. Where it lives

| Area | File | What |
|---|---|---|
| Chapter state | `js/state.js` | `freshChapter()`, `chapterStage()` (derived), `guidanceActive`, `onboarding`, `dismissGuidance()`, `noteConstruction()`, `nextConstructionAdvice()`, `recommendationFor()`, `trainingSecondsToTarget()` |
| Range drill | `js/mission.js`, `js/state.js`, `js/unit.js` | `FIRST_SOLDIER_DRILL { multiplier: 3, from: 6, to: 22 }`, `isOnRangeDrill()`, runtime `unit.onDrill` (re-derived every tick, never saved), `desiredStatus()` drill branch, `applyTrainingGain(…, multiplier)` |
| Deployment | `js/state.js` | `deploymentCheck(unit, tier)` → `{ ok, recall, reason }`, `introTierFor()`, `dispatchMission(tier, ids, { recall })` |
| Debriefs | `js/state.js` | the report records `callsign`/`accent` as snapshots next to cash, XP, level, recovery and `seen`; `unseenReports()`, `markReportSeen()`, `missionHistoryFor()` |
| Customization | `js/unit.js`, `js/state.js` | `ACCENT_COLOURS` (red / blue / gold / white), `CALLSIGN_POOL`, `sanitizeCallsign()` (≤ 12 printable chars, empty clears), `defaultAccentFor()`, `unit.fieldName`; `setCallsign()`, `setAccent()`, `randomiseIdentity()` (an unused pool callsign and a *different* accent) |
| Accent drawing | `js/animation.js`, `js/render.js` | the accent strip is filled with the chosen colour and drawn over walk/idle frames that have an approved mask (`accentFile`); otherwise it is a pip before the map name and a badge on portraits. The body is never tinted by the accent |
| Portrait | `js/render.js`, `js/asset-manifest.js` | `ASSET_MANIFEST.portraits[1]` (candidate), `portraitArt(variant)`, `drawPortrait()` fallback = crop of the soldier's own tinted still |
| Art pipeline | `tools/prepare-art.cjs`, `tools/validate-assets.cjs` | accent strips cut and resampled with the same frames; portrait alpha cleaned from `delivered`; validator checks accent strip size, ≥ 95% on the figure, and the portrait's transparency and files |
| UI | `js/main.js`, `index.html`, `css/style.css` | objective card (drill text), soldier card (callsign field, accent swatches, Randomise, portrait badge), roster (callsign + badge), debrief (callsign + badge), mission panel, toasts |
| Release gate | `js/asset-manifest.js` | `walkReleaseGate()` → `{ ready, blockers }` |

## 3. Save

- Still schema 2 and `armybase_save_v2`, with optional additions only. Round 1 added `chapter`, per-unit `trained`/`serviceTag`/`serviceRecord`/`hospitalReason`, and debrief fields in the mission log. Round 2 adds per-unit `callsign` and `accent`, and report `callsign`/`accent`.
- **Migration** (`save.js` `migrateCustomization()`, used for storage, v1 migration and imported backups): soldiers without the fields get `callsign: null` and their stable default accent. Hand-edited values are cleaned rather than refused: an overlong callsign is cut, and an unknown accent falls back to the default.
- Callsign and accent edits save immediately; so do name edits, which previously waited for the 10-second autosave.
- Chapter rules from round 1 are unchanged: an established base starts with the chapter done, an orphaned chapter is closed, and resolution, reward and report happen exactly once.

## 4. Tests and evidence

```
node tests/chapter.cjs       # chapter, drill, deployment, recovery, saves, customization, movement, release gate
node tests/pacing.cjs        # prompt and slow players (new)
node tests/ui-smoke.cjs      # + card/roster/debrief customization through the real handlers
node tests/activity.cjs tests/smoke.cjs tests/save-migration.cjs tests/render-data.cjs tests/world.cjs
node tools/validate-assets.cjs
node tools/capture-first-session.cjs desktop | phone | desktop --candidates
node tools/capture-accent-closeup.cjs
```

**Pacing (`tests/pacing.cjs`).** A scripted player acts N real seconds after each new step and plays fresh, seeded games in simulated real time, with visitors spawning as in the browser. Five seeds per reaction time. It asserts:
- the first patrol leaves by the limit shown;
- no collapse in the first 10 minutes;
- the chapter completes inside 10 minutes;
- the soldier reaches the range within a minute of being assigned;
- there are zero seconds spent assigned but waiting for the range to open.

| reaction per step | first patrol (5 seeds) | limit | chapter complete | collapses | waiting for the range |
|---|---|---|---|---|---|
| 3 s | 69–84 s | 150 s | 154–168 s | none | 0 s |
| 10 s | 95–107 s | 180 s | 200–212 s | none | 0 s |
| 20 s | 135–152 s | 240 s | 270–287 s | none | 0 s |
| 30 s | 178–189 s | 300 s | 343–354 s | none | 0 s |
| 60 s (known limit) | 716–719 s | — | 972–974 s | once each, 5 min | 100 s |

The 60-second player is reported rather than hidden. They assign the soldier near 22:00 game time, so the soldier sleeps first. Day 2 then begins with nothing that restores energy, because there is no Mess Hall yet, and the soldier collapses before becoming patrol-ready. The test asserts only that the collapse lasts at most 5 minutes and that they still finish. Fixing this needs a decision (section 8 C). The drill can't solve it: it's hunger, not training time.

**`tests/chapter.cjs`** covers everything from round 1, plus:
- the drill: +3 target; training at 18:00 when the normal schedule says free time; 3 × 0.5 accuracy per game hour; other soldiers keep their schedule and never train outside the blocks; the drill ends at the target;
- customization: defaults; cleaning; palette-only accents; unknown soldier rejected; survives reload; `fieldName`; carried into the mission report; v1 fixture, hand-edited and pre-customization saves migrate;
- the first soldier wears variant 1.

**`tests/ui-smoke.cjs`** now drives the card's own callsign, swatch and Randomise handlers. It checks the card badge and `aria-checked`, the roster name and badge, and the debrief callsign and badge (the debrief shows the soldier as they are now).

**Browser playthroughs** (real time, real input, fresh save). After assigning the range, the tool taps the callsign field, types "Kestrel" with key events, and taps the gold swatch. It then checks the roster, the map name, survival across a mid-patrol reload, the debrief text and badge, and the saved report.

| | desktop (mouse) | phone (touch) | desktop, `?art=candidates` |
|---|---|---|---|
| admitted | 21 s | 20 s | 20 s |
| assigned to range (drill) | 41 s | 46 s | 39 s |
| callsign + accent set on the card | 43 s | 48 s | 41 s |
| ready for patrol (+3 accuracy) | 76 s | 86 s | 73 s |
| **first patrol dispatched** | **80 s** (recalled from a meal) | **90 s** (recalled from training) | **77 s** (recalled from a meal) |
| patrol returned, debrief | 155 s | 164 s | 152 s |
| chapter complete (Mess Hall built) | 166 s | 175 s | 163 s |

All three runs also checked: resume at "away" after a mid-patrol reload; debrief cash equal to the state's award; no second debrief or reward after a later reload; and the touch path on phone (canvas tap on the visitor, then every button). Once the drill ends at the target, the normal schedule resumes, which is why the soldier was at a meal or still training when recalled.

**Accent close-up** (`tools/capture-accent-closeup.cjs`, candidate view, 2.5×): the chosen colour fills only the helmet band and shoulder patch, in walk and idle frames. Skin, kit and shading are untouched. The first version of the shot also showed the release-gate problem directly: soldiers turning up or sideways switch to the grey still sprites.

Screenshots: `docs/screenshots/2026-09-28-chapter-r2-*.jpg`. Step logs: `docs/brief08-first-session-*.txt`. Clips are not committed (`captures/` is ignored) and live in `captures/first-session/<mode>/`.

## 5. Blocked by art (Deliverable E)

- `walkReleaseGate()` reports: walk down: candidate; walk up: missing; walk right: missing; idle down: candidate; idle up: missing; idle right: missing. It stays blocked until approved up/right walk and idle art passes the clip review.
- In code, route geometry, continuity, facing and stopping all pass (`tests/chapter.cjs`, 38–46 s at 30 fps, trail legs within 1 world px).
- By default, players see still sprites that glide. That is not presented as finished.
- The portrait is a candidate too. It shows only in candidate view, where the map uses the same master's down walk, so the card never shows a face the map doesn't.

## 6. Decisions that need review

1. **The range drill** (3×, 06:00–22:00, first soldier, until +3). It is a named special case rather than a change to training rates or the schedule. The multiplier and hours are placeholders tuned against `tests/pacing.cjs`.
2. **Neglect recovery is 5 minutes** (was 23 hours), to keep CLAUDE.md's "never harsher than mission failure" rule. Options are in section 8 C.
3. **Very slow first sessions still collapse once** (the 60 s row above), again because nothing restores energy before the Mess Hall. The same options apply.
4. **The first soldier wears body variant 1.** This follows the portrait handoff's suggestion, so card, map and report share one face. Everyone admitted later keeps a random body.
5. **The accent palette** is signal red, sky blue, gold and white. Randomise always changes the accent and prefers a callsign nobody on the roster uses. Callsigns are at most 12 characters, and a card shows `Omar "Kestrel"`.
6. **Where the accent shows by default.** Only as a map pip and badges, because the default stills have no approved mask. The painted walk/idle masks colour the helmet band and shoulder patch in candidate view only, until that art is approved.
7. **Portrait alpha was cleaned in the pipeline.** Codex's export is kept as `art/production/source/soldier-portrait-01-256-v1.png`.
8. Carried over from round 1: later tier recoveries (30 min / 2 h / 4 h), recall from any on-base activity, specialities, and schema 2 with optional fields.

## 7. Playtest script (not yet run — needs a person)

Use a fresh browser profile. Say only "this is a base-building game; play for ten minutes". Don't point at anything. Note the time of the first patrol and every hesitation longer than 10 s. Afterwards ask:
1. Who is your first soldier? (Name or callsign without looking?)
2. What did training change?
3. Why did you send that soldier on the patrol?
4. What did the patrol earn?
5. What should you do next?

Also note whether they noticed or used the callsign and accent, and whether "range drill" read as a special first-soldier rule or confused them.

## 8. Options for the design discussion (Jason, ChatGPT and Claude)

Open questions with my recommendation marked ★.

### A. First-session pacing — decided in round 2

A +3 target with a labelled first-soldier range drill (closest to the A2 option from round 1). It is kept here for the record. Open follow-up: should the drill also show on the map (a "DRILL" tag on the range)?

### B. Consumables — Jason's idea ("potions … free at first, later as mission or ad rewards")

- **B1. Field ration**: one use; the soldier eats anywhere (+40 energy). The first two are free, and later ones come from Local Patrol. It directly covers the 60 s row above.
- **B2. Training manual**: one use; doubles one range session.
- **B3. Medkit**: halves one recovery. This is the "pay to undo" pattern CLAUDE.md warns about if it is ever sold, so earned-only.
- **Ads:** acceptable only as convenience, and only if the free path is comfortable without them. Nothing in the first session should need one.
- Scope: this is a new item system, so it needs its own brief.
- ★ **B1 as an earned mission reward**, no ads in v1.

### C. Neglect vs failure recovery

- **C1. Equal and short** (current, 5 min).
- **C2.** 5 min until the Mess Hall exists, then 30 min.
- **C3. Prevent instead of punish**: a soldier at energy 20 with no Mess Hall uses a free ration (B1). The first session never shows the aid station.
- ★ **C2 now, C3 with B1**. C3 would also fix the 60 s pacing row.

### D. Character-led ideas

- **D1. Letters home**: a one-line diary entry per mission in the soldier's history, built from the mission facts.
- **D2. Buddy pairs**: soldiers who train together three times form a named bond, worth +5% when they deploy together.
- **D3. Callouts** on the map during range use, now using the callsign ("Kestrel: target down!"), rate-limited.
- **D4. Welcome-back moment** at the gate when a squad returns.
- ★ **D1 first, then D3**: the callsign now gives D3 a voice.

## 9. Observations outside the brief

- In one round 1 desktop screenshot, a visitor crossing the gate bridge was hidden while their highlight ring still showed. That suggests the bridge front rail's depth order. It is not reproduced since.
- The hero banner still says "Recruit your people"; the chapter uses "meet" and "admit". That copy is left for Jason.
