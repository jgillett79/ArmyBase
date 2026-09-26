# Play Command Base through Cloudflare Pages

The repo includes a static build command. It copies only `index.html`, `manifest.webmanifest`, `css/`, `js/`, `assets/` and a versioned service worker to `dist/`. Project docs, tools, tests, exploration art and `.env` are not published. No API token is needed in the Pages project.

## One-time setup in your Cloudflare account

1. Open [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), choose **Create application → Pages → Connect to Git**, and connect GitHub repository `jgillett79/ArmyBase`. Grant access to this repository.
2. Create a Pages project, for example `command-base`. Choose **`main` as the production branch** so the current beta PR remains a preview until merged. Framework preset: **None**. Root directory: repository root. Build command: **`node tools/build-pages.cjs`**. Build output directory: **`dist`**. No environment variables are required.
3. Select **Save and Deploy**. The production `*.pages.dev` site initially follows `main`. Cloudflare should also create a preview for PR #2's `command-base-beta-import` branch. Open the preview link from the Pages deployment list or GitHub PR to play the current beta. New pushes to that PR branch update its preview alias automatically.
4. After the beta is ready to become the public game, merge the PR into `main`. Subsequent merges to `main` auto-deploy to the production URL. Keep preview links for work in progress.

## Add the Saltrock Games address

Use a dedicated game subdomain (for example `commandbase.<your-actual-domain>`) so the existing homepage stays in place. In the Pages project choose **Custom domains → Set up a domain**, enter the exact subdomain, and follow Cloudflare's DNS prompts. If DNS is outside Cloudflare, add the requested CNAME pointing to `<your-project>.pages.dev` at the DNS provider. Add the domain in Pages before changing its DNS record. This custom domain follows the production branch by default; the current beta remains playable at its preview URL.

If you instead want a custom *beta* subdomain that tracks `command-base-beta-import`, Cloudflare's branch-alias setup requires a proxied DNS record in Cloudflare. First deploy the preview, add the custom domain in Pages, then change its proxied CNAME target to `command-base-beta-import.<your-project>.pages.dev`.

## Checks

- Locally: `node tools/build-pages.cjs && node tests/smoke.cjs && node tests/ui-smoke.cjs`.
- In Pages: confirm the deployment succeeded, open the beta preview, recruit a visitor, refresh, and check that your roster persists on the same device.
- Saves use browser localStorage and are scoped to each hostname. A beta preview and the custom production domain will have separate saves. Use the game's backup export/import to move progress between them.
- This is a public beta when a preview URL is shared; do not describe it as the final release until the visual and gameplay checks in `GOLDEN_SLICE.md` pass.
