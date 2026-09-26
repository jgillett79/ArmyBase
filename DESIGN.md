# Command Base — current game design

This document describes the **current playable build**. `README.md` records the development history, `CLAUDE.md` explains earlier decisions, and `ASSETS.md` retains the art prompts. Historical sections in those files may describe features as pending even after they were built.

## Player promise

A small roster of up to 20 soldiers matters as individuals. Players recruit visitors at the gate, name soldiers, train them, send squads on timed missions, and build a home for the people who return. There is no permanent death: a failed mission or neglect sends a soldier to hospital for 23 real hours, without losing their identity, equipment, or stats.

## First public release scope

One base, with a complete recruit → train → mission → upgrade loop. Players can recruit and name soldiers, assign one of four training facilities, manage food/needs, dispatch four tiers of missions, earn XP and rewards, and return to a saved base. Missions are independent rolls per soldier; mixed outcomes are possible. The first patrol returns in three real minutes, then missions scale to 30 minutes, 2 hours and 4 hours. Completing all eight facilities and recruiting 20 soldiers marks the outpost complete. These pacing and reward numbers are **provisional** and need real player testing.

The browser build remains vanilla JavaScript, Canvas and localStorage, with no build step, account, backend, payment, or adverts. Its desktop map is fixed-size; on small screens it scrolls horizontally and the HTML roster provides reliable touch selection. A manifest and service worker provide an installable offline shell over HTTPS; the service worker cache version must be incremented with each release.

## The progression loop

- Recruits start at level 1. Missions grant XP on both success and failure, with more XP on success. Levels and trained stats jointly gate harder mission tiers.
- Cash trickles in slowly; patrols and higher missions are the main way to finance buildings. Food is bought with cash. The second level of Barracks/training buildings also needs 10 lumber, and the third needs 6 steel. Gems are earned at the top mission tier; their spending rules still need design before promotion or equipment.
- Training buildings have three levels. They add assignment slots, not faster training. Needs buildings are bought once. The Entrance Hall is always present.
- A game day lasts five real minutes; hospital and mission timers use real time. Reload and suspended-tab catch-up use bounded simulation steps, capped at one real day.

## Visual direction

Warm, grounded illustrated alpine outpost. The field starts with an entrance and a few visible building clearings; later facilities emerge among the meadow as they are built. The layout is staggered, clearings are irregular and people follow a gently winding path that connects the gate and facility entrances. Four initial facilities (Entrance Hall, Barracks, Shooting Range and Mess Hall) have revised sprites without hard rectangular plinths. The other facility assets still need the same pass.

The old split-leg animation was removed because it visibly distorted the characters. Existing directional character drawings now move intact with a subtle body bounce. This is still an interim movement treatment, not a finished walk cycle; authored full-body frames for each direction and activity remain a production requirement.

New artwork was generated for the project with this brief: a small welcoming military training outpost among mountain foothills, flat digital illustration with dark outlines, restrained olive/khaki/teal palette, readable shapes, no embedded text; overhead seamless rugged meadow and maintained earth texture variants in the same palette. The project serves optimized WebP copies under `assets/`.

## Design decisions still needed

1. **Promotion and multiple bases.** Base 1 must persist with its remaining soldiers and passive income; two chosen soldiers move to Base 2. Define carried resources, construction, mission unlocks, and save migrations before implementing.
2. **Further material sinks.** Validate the provisional lumber and steel upgrade costs with playtesting; specify gem costs for equipment and promotion so the top mission reward has lasting value.
3. **Audience and release target.** Playtest the first session, mission wait times, 23-hour hospital consequence and portrait phone layout. Verify the installable PWA and offline cache on the deployed HTTPS host.
4. **Visual production.** Produce consistent full-body walk frames for each character direction and activity. Finish the organic-base treatment for the remaining facilities, improve scale/composition and add environmental detail after checking the first four revised buildings at gameplay size.
5. **Player trust.** Backup download and restore are available, but save migration and corruption recovery need more work before promising durable long-term progress. localStorage can be cleared by a browser or device change.

## Release checks

A public announcement should follow hands-on testing on desktop and portrait phones, a full progression run from a fresh save, reload and long absence checks, playtest feedback on pacing and visuals, and a working deployment on HTTPS. The current build should be described as a **beta** until those checks pass.
