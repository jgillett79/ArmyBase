# Brief 09 — gate 09A implementation report (with the routine core of 09B–09D)

Claude, 1 October 2026, branch `brief-09-daily-base` (from `main` at 766ab1c). **Not merged**: the brief asks for review first. Read with [09_DAILY_BASE_SIMULATION.md](09_DAILY_BASE_SIMULATION.md), [09_DAILY_BASE_BUILD_PLAN.md](09_DAILY_BASE_BUILD_PLAN.md) and the measured [09_STATION_VISUAL_CONTRACT.md](09_STATION_VISUAL_CONTRACT.md).

Jason asked for, in order: perimeter admission; every soldier at a real station, in a queue, or visibly waiting with a reason; one complete day with four soldiers; a six-soldier capacity shortage; the station contract for Codex; placeholder art clearly marked. All of that is in this branch. The visual release gate is **still blocked** (no approved walk, no interaction art).

## What changed for the player

- **Applicants stay outside.** The map now reaches 200 world px west of the gate: an outside valley road. Applicants walk up it, queue on the verge (five places, bounded — a full line means no new arrivals), and are interviewed one at a time at the guardhouse's **outside** window. Only the one at the window can be admitted (Admit / Turn away / Not now on their card). Admission, not clothing, lets them cross; the recruit walks through the gate in civilian clothes and changes at the Barracks. The boom opens only for people allowed to cross. The old Entrance Hall is now labelled Administration and no longer seats visitors.
- **A shared daily timetable** (sleep, bathroom, breakfast, morning training, lunch, afternoon training, recreation, dinner, shower, free time) drives every soldier. Each window they walk to a real station, queue in a visible FIFO line, use it, and walk out — or, if there is no station, wait on their own **parade-ground** spot with a reason ("no facility built for it", "no bed", "finished early — standing by for Lunch at 12:00"). **There is no random wandering any more.**
- **Real station capacity**: own beds; toilet stalls, basins and shower stalls (privacy: users hidden behind a closed door with a red pip); a serving counter that charges one meal and reserves a seat, then a tray carried to the seat; training equipment by **Auto / Focus a stat / Only one facility**; rec benches.
- **A clock bar** above the map: day, time, current block, next block, **pause / 1× / 2× / 4×**, and a note that missions and recovery count real time. A **Day report** names completions, the reason for misses, and the one most useful upgrade. The soldier card shows today's itinerary (✓ ½ ✗ with reasons), the current activity and the training policy.
- **Starter field facilities** on every base: Barracks level 1 (6 beds), Mess Hall level 1 (one serving counter, six seats), Wash Block level 1 (2 toilets, 1 basin, 2 showers). Mess level 2 (+1 counter, $180) and Wash Block levels 2–3 are cash upgrades (Wash Block L3 also 10 lumber).

## Measured decisions (the brief said: adjust layout, service count or duration, and record why)

1. **20-minute day** (`DAY_LENGTH_REAL_MS`, was 5): one game hour = 50 s. Provisional, as the brief says.
2. **Walk matrix.** Door-to-door game minutes at 38 px/s (`node tools/walk-matrix.cjs`):

   | from \ to | reception | west rise | north terrace | centre knoll | knoll east | river bend | east meadow |
   |---|---|---|---|---|---|---|---|
   | centre knoll | 20 | 20 | 20 | 0 | 16 | 22 | 19 |
   | knoll east | 32 | 31 | 25 | 16 | 0 | 13 | 9 |
   | river bend | 35 | 25 | 14 | 22 | 13 | 0 | 16 |
   | east meadow | 35 | 34 | 28 | 19 | 9 | 16 | 0 |

   On the old placements (barracks centre knoll, mess north terrace, showers river bend) the evening rec → mess walk took 33 game minutes and mess → showers 28; four soldiers missed dinner and showers on a starter base. **Fresh-base layout is now mess on Centre knoll (the hub), wash block on Knoll east, barracks on River bend**, weight room on North terrace. Old saves keep their buildings where they are.
3. **Two starter toilets.** With one, four soldiers could not finish the bathroom window: 24 min barracks → wash walk + 8 min per use + about 5 min per queue hand-off.
4. **Mess level 2 = a second serving counter.** For six soldiers the single counter is the measured bottleneck (lunch 3/6). A cash upgrade so the shortage loop works before lumber.
5. **Last serving 15 minutes before a meal window ends.** The six-soldier trace showed a soldier charged at 12:53 who could never eat — wasted food. Now they miss with "the kitchen had stopped serving".
6. **Meal food cost 1 per meal**, charged when called to the counter, once per window (a token survives reloads and recalls).
7. **Needs rates** (per game hour, placeholders): awake −2 energy, training −6, bed +6, bedroll +3, eating +100 (≈+25/meal); hygiene −2/h, toilet +15, basin +10, shower +30; morale −1.5/h, rec bout +12. Low hygiene still only speeds energy loss; low morale halves training. No new death paths.

## Evidence (all headless, re-runnable)

`node tests/routine.cjs` (new) — output on this branch:

```
4 soldiers | Bathroom: 4/4 used the toilet (4 also washed)
4 soldiers | Breakfast: 4/4 meals
4 soldiers | Morning training: 14h00 used / 16h00 scheduled
4 soldiers | Lunch: 4/4 meals
4 soldiers | Afternoon training: 14h00 used / 16h00 scheduled
4 soldiers | Recreation: 4/4 relaxed
4 soldiers | Dinner: 4/4 meals
4 soldiers | Shower: 4/4 showers
six soldiers: meals 12/18 -> 18/18 with Mess Hall level 2
scarce stalls: hygiene 6/12 -> 12/12 with the starter block
kitchen: one charge, reserved seat, release on recall, resume after reload
reload: queue order, service progress and midnight sleep preserved
offline catch-up matches live play (1 day: ~75 ms; 24 h cap, 6 soldiers: ~1.5 s)
perimeter: applicants served outside, bounded line, only admitted recruits cross
```

It also asserts, every tick of the day: no teleport (worst extra jump < 1.5 px), strength only changes while using strength equipment, accuracy only at a firing point, and every soldier has a destination, a queue place or a reason. Per-soldier traces (task → station/queue → use → result) for Jason to compare with the map:

- [trace-4-soldiers.md](../docs/screenshots/2026-10-01-daily-base/trace-4-soldiers.md) — all ✓
- [trace-6-soldiers.md](../docs/screenshots/2026-10-01-daily-base/trace-6-soldiers.md) — lunch/dinner 3/6, "Suggested: Upgrade the Mess Hall"
- [trace-6-soldiers-mess-l2.md](../docs/screenshots/2026-10-01-daily-base/trace-6-soldiers-mess-l2.md) — 18/18 meals; training stations now the limit

Regenerate with `node tools/trace-daily-base.cjs <n> <out.md> [--setup "state.messHall.level = 2;"]`. Screenshots: `node tools/capture-daily-base.cjs [--phone]`; contract numbers: `node tools/station-contract.cjs`.

**The "deliberately scarce stalls" case is configured, not a game level**: the test overrides the wash block to one toilet and one shower for six soldiers (a queue of up to 3+ forms, hygiene 6/12), and compares with the real starter block (12/12). On the real starter base six soldiers hit the *kitchen*, not the stalls.

All suites pass: `routine, activity, chapter, pacing, render-data, save-migration, smoke, ui-smoke, world`, and `tools/validate-assets.cjs`.

## Rules changed on purpose (tests updated to say so)

- **Brief 08's first-soldier range drill is gone** (the brief says so). Measured first patrol at 1×: prompt players ~8.5–9 min (was 2.5–5); a player taking 60 s per step usually only reaches +3 accuracy in day 2's morning block, ~23 min (one seed ~10 min). **Flag for Jason**: either accept (2×/4× shortens it), lower the readiness gain, or start the first session closer to 08:00. `tests/pacing.cjs` pins today's numbers.
- **The starter field meal is retired** — a kitchen exists from the start, and the brief forbids using it as a substitute. The saved flag still loads.
- **Brief 02's "needs buildings never queue"** is reversed: kitchen, wash block and beds have real capacity.
- **Training assignment has no cap**: an assignment is the "Only this facility" policy and queues for its stations.
- **Deployment recall**: anyone walking to, queuing for or using a station needs an explicit recall; standing by or waiting on the parade ground does not.
- Missions/hospital exclude the soldier from that window's demand; on return they join the current window (missed tasks aren't replayed).

## Saves

Schema stays 2 with optional additions: per unit `bedId`, `trainingPolicy`, `lastStationId`, `routine` (window, task, step, stage, station, progress, reason, meal token, per-window log, queue key/index, pending window/grace end); top level `day` and `routineRecords` (last ~3 days). On load: starter facilities raised to level ≥ 1 (paid levels kept), beds re-assigned in roster order, then each soldier is restored exactly — still on their station with their progress, queues rebuilt in saved order, a held meal seat re-reserved, no second charge. A save without routine data simply joins the current window. Offline catch-up: 1 s steps for the last two game days, 5 s steps before that (a 24 h absence is 72 game days), routes memoised.

## Files

- New: `js/routine.js` (timetable, station rules, geometry), `js/daily.js` (admission line, routine scheduler, stations, queues, records, summary — GameState methods), `tests/routine.cjs`, `tests/lib/sandbox.cjs`, `tools/capture-daily-base.cjs`, `tools/trace-daily-base.cjs`, `tools/station-contract.cjs`.
- `js/world.js`: `WORLD_X0` outside road, `road_west`, `WORLD.perimeter`, `WORLD.muster`, starter placements, validation for both; memoised `findWorldRoute`.
- `js/state.js`: 20-minute day, `day` counter, starter facilities, tick through `tickRoutine`, admission-only recruitment, recall rules, saves, catch-up.
- `js/render.js`: placeholder station layer (marked), privacy doors, lying/seated/tray placeholders, occupancy plates, boom permission, debug overlay additions. `js/main.js`/`index.html`/`css`: clock bar, speed, day report, card itinerary and policy, applicant card.

## Not done (next gates)

- 09B/09C/09D art and animation (contract published), the cook loop, seat upgrades, the Focus policy's UI is a simple select (works; no stat-preview yet).
- Continuous clips of transitions (need the walk set).
- Barracks beds beyond six (open question in the contract), first-session pacing decision above, and routine guidance objectives replacing the brief 08 chapter text (09E).
