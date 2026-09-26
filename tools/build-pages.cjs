// Build the static Cloudflare Pages output without bundling project notes,
// tests or art explorations into the public site.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const publicPaths = ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets'];

let revision = process.env.CF_PAGES_COMMIT_SHA;
if (!revision) {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { revision = 'local'; }
}
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(revision)) throw new Error('Invalid deployment revision');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const item of publicPaths) {
  fs.cpSync(path.join(root, item), path.join(output, item), { recursive: true });
}
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const versionedWorker = worker.replace(
  /const CACHE_NAME = 'command-base-v\d+';/,
  `const CACHE_NAME = 'command-base-${revision.slice(0, 12)}';`
);
if (versionedWorker === worker) throw new Error('Service worker cache declaration changed; update the build');
fs.writeFileSync(path.join(output, 'service-worker.js'), versionedWorker);

// Fail the deployment if an offline asset was omitted from the output.
for (const [, asset] of worker.matchAll(/^\s*"([^"\n]+)"[,]?$/gm)) {
  if (asset === './') continue;
  if (!fs.existsSync(path.join(output, asset))) throw new Error(`Missing offline asset: ${asset}`);
}
console.log(`Built ${output} for ${revision.slice(0, 12)}`);
