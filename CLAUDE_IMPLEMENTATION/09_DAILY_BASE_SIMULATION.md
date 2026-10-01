# Brief 09 — a visible daily life for named soldiers

Approved direction, 1 October 2026. Jason's player test changes the centre of the game: run a base where named soldiers live, queue, use equipment and develop through a daily routine; send the people you develop on missions to bring resources home. This target supersedes conflicting visitor admission, schedule, unlimited amenities and first-soldier drill rules in older briefs. It is a target to implement, not a claim about current main. Keep the terrain-shaped map, identities, customization, mission rewards, no permadeath and save compatibility.

## Deliver one complete day first

Claude owns runtime, station geometry, UI, simulation and tests. Codex owns art and sprite production against Claude's measured anchors. Work on `brief-09-daily-base`; deliver focused commits. First demonstrate a fresh base with four soldiers and enough basic amenities to function, then a six-soldier capacity stress case. Do not add every facility or a full RPG while building this slice. Read `DESIGN.md`, this brief, `art/DAILY_BASE_ACTION_ASSETS.md` and `09_DAILY_BASE_BUILD_PLAN.md`.

### Perimeter admission

Move recruitment to a guardhouse on the fence line. Its service window and applicant waiting line face outside the base; the accepted route begins at the barrier. Civilians must never enter the interior path graph, sit in the interior Entrance Hall, or cross the bridge inside the gate before admission. Their routes are outside approach → outside queue → guardhouse service → admission or outside departure. Jason inspects a portrait/name card and admits or rejects them. Only admitted recruits, soldiers and explicitly authorised staff can cross. An admitted recruit may cross in civilian clothes and change at the barracks: admission status, not appearance, controls access. Preserve boom/bridge geometry unless a measured layout change requires an updated contract. The old Entrance Hall may become an administration building; do not confuse it with recruitment.

Give applicants a visible arrival/service capacity limit and a bounded outside queue. Overflow arrivals wait outside or leave; they never leak inside. Reload preserves who has admission permission and rebuilds valid routes. Disallow a manual soldier action on an unadmitted applicant.

### Shared daily timetable

Use a data-driven half-open schedule covering 24 hours, including the midnight wrap. Do not keep the out-of-hours first-soldier range drill from brief 08. Tutorial objectives explain this routine rather than overriding it.

| Time | Task | Visible use |
|---|---|---|
| 22:00–06:00 | Sleep | Walk to assigned bunk, get in, lie down, wake and leave |
| 06:00–07:00 | Bathroom | Toilet queue/use, then basin wash if time permits |
| 07:00–08:00 | Breakfast | Queue for serving, collect meal, find seat, eat |
| 08:00–12:00 | Morning training | Automatic, focus or specific equipment assignment |
| 12:00–13:00 | Lunch | Serving and seating sequence |
| 13:00–17:00 | Afternoon training | Same station-use rules |
| 17:00–19:00 | Recreation | Use a bench/leisure station; restore morale |
| 19:00–20:00 | Dinner | Serving and seating sequence |
| 20:00–21:00 | Shower | Queue, enter private stall, wash, leave |
| 21:00–22:00 | Free time / bed preparation | Leave facilities and return toward bunk |

Travel and queuing count against the window. At a boundary stop new service starts and release waiting reservations; allow an already started short hygiene/serving action to finish with a small configurable grace (initial target ≤5 game minutes), then move to the new task. Meals can finish similarly; sleep starts on reaching the bunk. Mark unmet tasks at the end of each window exactly once. Do not teleport, cut a soldier out of a shower mid-frame, or allow an old queue to persist into the next activity. Mission departure, hospital admission and manual recall interrupt and release all occupied resources safely. Returning soldiers join the currently scheduled task; do not replay the day's missed tasks.

### Time, travel and service budgets

The existing five-real-minute day gives a one-hour window only 12.5 seconds; a walk across the base can consume it. Start the prototype with a configurable **20-real-minute day** (one game hour = 50 real seconds) and a visible pause plus 1×/2×/4× simulation speed for testing and player observation. Speed changes accelerate the day, movement and services together; real-time mission/hospital deadlines stay real time and their UI must say so. Pause freezes the base simulation; it does not reset real deadlines. Tune against measured door-to-station travel on desktop and phone, not arbitrary sprite speed increases.

Declare durations in game minutes and stat rates per game hour. Initial service targets for testing: toilet 8 minutes, basin wash 4, serving 3, eating 15, shower 10, training bout 30, recreation 20. These are provisional. A four-soldier starter base must fit necessary travel and service within its windows; a six-soldier low-capacity configuration must visibly miss some services. If it cannot, adjust station layout, service count or duration and record the measured reason. Longer pacing is a prototype choice to verify, not a final retention claim.

## Station simulation and interactions

Build on existing slots and queues, replacing building-wide needs gains and training maps where necessary. A station has stable ID, facility ID, type, capacity, approach/exit anchors, interaction ground pivot, facing, compatible activity, service duration, effect, queue anchors and front/back occlusion information. Multiple occupants are allowed only when the station declares distinct positions. Keep coordinate metadata separate from business rules. Stat effects are station data, not renderer conditions.

The per-soldier action sequence is `travel → queued → approach → enter → use → exit`; multi-stage activities compose these steps. UI exposes an understandable activity and next action. The renderer reads action state and animation progress; it must never grant food or stats. Movement, equipment, effects and animation should describe the same event.

**Current player-observed failure:** soldiers wander aimlessly even though a schedule exists in code. Do not treat that schedule as implementation of this brief. During a scheduled activity each soldier must have a traceable destination, queue position or use station. Disable generic wander targets during these blocks. If there is no valid station, show the shortage and use a designated waiting/rest spot with a readable reason; never silently wander across the base. At each gate, provide a per-soldier trace of scheduled task → selected station → route → queue/use → result so Jason can compare visible behaviour with the schedule. Free-time wandering may exist only in designated recreation space during free time.

### Sleep and bathroom

Assign each admitted soldier one persistent bed. A bed is reserved for its owner; report a bed shortage rather than piling soldiers at one anchor. Sleep recovers energy while actually lying in that bed. A temporary fallback bed may be explicit, but must have its own spot and reduced effectiveness. Toilets and washbasins are distinct resources. A soldier queues for a toilet, enters, completes use and goes to wash if time remains. Show privacy doors/stall occupancy, no nudity or bodily detail. A shower has the same privacy/occupancy pattern. A missed bathroom or shower window reduces sanitation; partial wash gives partial benefit.

### Mess / kitchen

The kitchen has a serving station and separate dining seats. A soldier queues at the chef/cook, reaches the counter, receives one meal (consume food once), then walks carrying a tray to a reserved seat and eats. Start serving only when food and a dining place are available, avoiding an unbounded crowd holding trays; reserve the seat at serving start and release it on cancellation. Track a soldier's meal token so reload cannot charge or feed twice. Energy improves only during actual eating. Counter throughput and seating are separate upgrade levers. A meal missed because of no food must be reported differently from a queue/capacity failure.

### Training equipment

Policies persist per soldier: **Auto**, **Focus on a stat**, or **Specific equipment/station**. Show Auto by default. Auto chooses a compatible available station with a short queue and avoids recently used equipment when a comparable option is free; use seeded tie-breaks, not a random reroute each tick. Focus prefers equipment affecting the requested stat, with a clear fallback policy. Specific waits for the named station and exposes its wait. A missing/unbuilt station produces a readable warning and falls back to Auto after migration.

Training bouts can repeat while time remains. Grants accrue only during `use`, and only for the selected station: range lane → accuracy; weights/barbell → strength; beam/tyre stepping → endurance for this first slice. Do not invent agility/speed stats or blend unlike stat scales into new mission rules yet. Fitness may improve differently at later stations through data. The first day needs two clearly different station types. Advanced obstacle sequences (tyres → beam → net) are a later gate requiring their own movement/occlusion and sprite contract. Do not fake climbing with a standing figure translated upward.

### Queues, needs and capacity feedback

Use FIFO within a station queue, with exclusive stable reservations and visible spacing. No slot theft, overlapping occupants or starvation from continuous newcomers. Leaving the schedule, recalling, hospitalising, dispatching, removing a soldier or changing assignment clears their reservation and queue entry once. Keep logical throughput separate from artist-drawn props: each usable shower or seat needs a real slot, and decorative copies do not add capacity.

Start with manageable effects: one missed hygiene use causes a modest sanitation loss; repeated misses impose a visible efficiency/comfort penalty. Avoid immediate hospital from one missed service. Keep hygiene and morale soft penalties and energy as the existing safety route; tune measured values so a functional starter base survives several days. Show why the value changed. Do not use the one-time starter field meal as a substitute for functional kitchen service in this new slice.

At each window and day end record completed/missed uses and reason (full queue, absent station, no stock, away on mission, recovery, no bed). Missions/recovery are excluded from the facility-demand denominator. UI summaries should say `Showers: 4/6 completed; 2 missed because stalls were full`, `Lunch: 5/6 meals; serving counter was the bottleneck`, `Training: 2h15 used / 8h scheduled`, with a recommended capacity improvement. Avoid requiring every soldier card to diagnose the same shortage. Display clock, current block and next block prominently. The soldier card retains portrait/name/callsign/accent, daily itinerary, actual activity and training policy.

## Starter setup, economy and missions

A fresh base begins with perimeter recruitment, basic bunks, latrine/basin, a simple serving counter/table, shower and exercise area. They can look like temporary field facilities; upgrades add comfort, service speed or physical slots. Make four soldiers' basic day work without buying five buildings immediately or hitting a cash dead end. Record starter capacities and cash changes; migrate old saves without deleting paid upgrades or forcing a fresh base. Existing buildings gain station definitions. New toilet/basin facilities need a save default. Preserve the introductory mission reward entitlement if already started, but transition guidance to daily routine objectives; remove the special out-of-hours training boost for new routine saves.

Missions remain the outward resource loop. Preview who is available, their readiness and what scheduled activity departure will interrupt. Recall is explicit. A squad leaving releases beds only for use (not bed ownership), tables, equipment and queues. Return rejoins the current timetable. Do not build combat views or new tiers in this slice.

## Saves, offline simulation and verification

Persist identities, policies, beds, time, meal/service progress and completed-window/day records needed to prevent duplicate gains. Rebuild transient routes/queues/reservations deterministically from saved action state, without changing who already paid for a meal. Schema/migration approach is Claude's choice, with round-trip and legacy fixtures. Offline catch-up must process schedule boundaries, service completions and mission deadlines in order; a giant tick cannot grant a whole hour of training to a soldier who was in a queue. Bound catch-up as today and avoid unbounded event simulation for a 20-person roster.

Required evidence: four soldiers complete one full accelerated day; six with deliberately scarce stalls form a visible queue and some miss a hygiene window; adding capacity measurably improves completions. One soldier never gains strength while merely walking to weights. Kitchen charges once, seats correctly, releases on recall and resumes after reload. An applicant remains outside before admission. No teleport at time changes. Reload mid-service, mid-queue, mid-meal and during midnight sleep; offline and online results agree within documented simulation tolerance. Existing mission/customization tests still pass or are updated for explicitly changed design rules. Save desktop/portrait screenshots and continuous clips around each activity transition.

Build with clearly marked placeholder poses where art is missing so logic can be tested. A demonstration with placeholders is not production approval. Before the visual release gate passes, require approved directional walking plus each visible action listed in the asset plan, correct layering and game-size clips. Jason must be able to see a soldier in a bed, a tray being collected and eaten, a shower/toilet being occupied and two different training actions. Read all new sprite grids and pivots from the contract; never stretch or rotate a whole character sprite to fake an unsupported view.
