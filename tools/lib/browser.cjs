// Shared helpers for the review/asset tools: a tiny static file server and a
// headless Edge/Chrome driven over the DevTools protocol. No dependencies —
// Node 22+ provides fetch and WebSocket. Image work (WebP decode, alpha
// scans, crops, exports) runs inside the browser's canvas, since Node has no
// built-in image codecs.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CONTENT_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

// Serves `root` on 127.0.0.1 (random port). Returns { url, close }.
function startStaticServer(root) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let file = path.join(base, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () =>
    resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

function findBrowser() {
  const candidates = [process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Edge/Chrome found; set BROWSER to its path');
  return found;
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    this.ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      } else if (message.method) this.listeners.forEach(fn => fn(message));
    };
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

// Launches a headless browser with one page. Returns helpers bound to it:
// send(method, params), evaluate(expression), navigate(url), problems[]
// (page errors/exceptions), close().
async function launchBrowser({ port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-browser-'));
  const child = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let version;
  for (let i = 0; i < 75 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); }
  }
  if (!version) { child.kill(); throw new Error('Browser did not start'); }
  const cdp = new Cdp(version.webSocketDebuggerUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const problems = [];
  cdp.listeners.push(message => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') {
      problems.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      problems.push(message.params.args.map(a => a.value ?? a.description).join(' '));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(`${expression.slice(0, 80)}…: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    }
    return result.result.value;
  };
  const navigate = async (url, readyExpression = 'document.readyState === "complete"') => {
    await send('Page.navigate', { url });
    for (let i = 0; i < 150; i++) {
      await sleep(100);
      if (await evaluate(readyExpression).catch(() => false)) return;
    }
    throw new Error(`Timed out loading ${url}`);
  };
  const close = async () => {
    await cdp.send('Browser.close').catch(() => {});
    child.kill();
  };
  return { send, evaluate, navigate, problems, close };
}

module.exports = { sleep, startStaticServer, launchBrowser };
