# Toy army style proof

Open https://jgillett79.github.io/ArmyBase/art/prototypes/toy-army/ .

This isolated preview explores a friendly cartoon direction: larger helmet and face, shorter limbs, broad boots, quiet terrain, rounded trees and an open-front Mess Hall. It retains the elevated oblique camera. One continuous jointed Canvas character supplies all four walking directions, idle, collecting food, carrying a tray and sitting/eating; its portrait uses the same drawing and accent. Both anatomical legs alternate, and the rifle remains on the same shoulder. Callsign and four accent controls illustrate personal attachment.

The 37-second loop demonstrates walking, a queue, service and table use. Walking and Mealtime buttons isolate those sections. Phone framing follows the soldier. This is a staged visual demonstration, not the base simulation: its layout and timing are not station contracts or gameplay changes.

## Review before replacement

Jason should judge character appeal, clarity at game size, movement and visibility of station use. If accepted, Claude and Codex should agree a revised visual contract before migrating real buildings or actions. Reuse the existing schedules, queues, occupancy and gameplay. Integrate one character and one kitchen first, then validate actual contacts and a continuous turn-and-idle clip on desktop and phone. Do not replace every asset at once.

The original game's asset manifest, cache, saves, motion and walking release gate are untouched. This proof does not approve the earlier painted sheets or constitute production animation. Canvas drawing is the editable source here; raster exports could follow approval. The rig is a possible alternative to generated frame sheets, and needs real-game occlusion, path-turn and station integration checks.

## Checks

`node tools/check-toy-army-proof.cjs <output-folder>` uses `@napi-rs/canvas`. It checks continuous stance cancellation for both legs in four directions, renders every routine state at desktop and phone sizes, and checks callsign, accent and scene controls through a stub DOM. These are native Canvas integration checks, not a full browser or gameplay playtest.
