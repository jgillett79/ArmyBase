# ArmyBase asset generator

Generates the 15 images from `ASSETS.md` using **Cloudflare Workers AI**
(free), then removes backgrounds (`rembg`) and resizes to the exact
in-game sizes — all locally.

## Cost

**Free.** Cloudflare's Free plan includes 10,000 Neurons/day at no charge;
all 15 images cost only a few hundred Neurons. `rembg` and `pillow` are
open-source and run on your machine.

## 1. Install dependencies (one time)

```
pip install -r tools/requirements.txt
```

(First run of `rembg` downloads a ~180 MB model automatically — also free.)

## 2. Add your free Cloudflare credentials

1. Sign up / log in at https://dash.cloudflare.com (Free plan is fine)
2. **AI → Workers AI → "Use REST API"**
3. Create an API token with **Workers AI Read + Edit**, copy it
4. Copy your **Account ID** from the same page

Then copy `.env.example` to `.env` and paste them in:

```
CF_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CF_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.env` is git-ignored, so your token stays private.

## 3. Generate

```
python tools/generate_assets.py            # all 15 (skips ones already made)
python tools/generate_assets.py --force    # regenerate everything
python tools/generate_assets.py --only barracks         # just one
python tools/generate_assets.py --only soldier_01 --only soldier_02
python tools/generate_assets.py --keep-raw # also save pre-cleanup output
python tools/generate_assets.py --list     # list asset names + paths
```

Files are written straight to their correct paths, e.g.
`assets/buildings/barracks.png`, `assets/units/soldiers/soldier_01.png`.

## Notes

- Default model: `@cf/black-forest-labs/flux-1-schnell` for both buildings
  and characters — it gives the cleanest flat-vector look and best prompt
  adherence. Character post-processing also isolates the single figure
  (largest region), enforces the desaturated gray palette, and crops+fits
  to the target canvas so nothing is squished. Force SDXL instead with
  `--model @cf/stabilityai/stable-diffusion-xl-base-1.0` if you want exact
  width/height control.
- Diffusion output is random. Re-run a single asset with `--only <name>
  --force` until you like it.
- `--no-bg` keeps the opaque image if a background-removal result looks
  rough and you'd rather clean it up by hand.
- This does **not** wire the art into the game yet — `js/render.js` still
  draws shapes. That's the follow-up "wiring pass" mentioned in `ASSETS.md`.
```
