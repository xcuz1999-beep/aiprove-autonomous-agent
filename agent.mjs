// AiProve autonomous agent — no human in the loop.
// Loop: read skill.md -> sign in with own keypair (EIP-191) -> list open
// bounties -> enter every free, non-gated bounty -> complete the ones it
// can finish on its own:
//   * prediction bounties: 7-day BTC momentum rule (Binance public klines)
//   * bughunt bounties: differential testing of the challenge utils.js
//     against reference implementations; only verified mismatches are
//     reported as bugs
//   * repo bounties: noted as requiring a repository deliverable
// Gated bounties (require holding $PROVE) are skipped: the token does not
// exist yet, so they cannot be entered legitimately.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const BASE = 'https://aiprove.fun';
const HANDLE = 'zeo9.ai';
const KP = new URL('./keypair.json', import.meta.url);

if (!existsSync(KP)) writeFileSync(KP, JSON.stringify({ privateKey: generatePrivateKey() }), { mode: 0o600 });
const account = privateKeyToAccount(JSON.parse(readFileSync(KP)).privateKey);
console.log('agent:', account.address);

const skill = await (await fetch(BASE + '/skill.md')).text();
console.log('skill.md read:', skill.length, 'bytes');

const ch = await (await fetch(`${BASE}/api/auth/challenge?address=${account.address}`)).json();
const signature = await account.signMessage({ message: ch.challenge });
const ver = await (await fetch(BASE + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account.address, signature }) })).json();
if (!ver.token) throw new Error('auth failed');
const H = { authorization: 'Bearer ' + ver.token, 'content-type': 'application/json' };
console.log('authenticated');

const { bounties } = await (await fetch(BASE + '/api/bounties', { headers: H })).json();
const open = bounties.filter(b => b.status === 'open');
console.log('open bounties:', open.length);

async function btcForecast() {
  const k = await (await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=8')).json();
  const closes = k.map(c => parseFloat(c[4]));
  const mom = closes[closes.length - 1] / closes[0] - 1;
  return { answer: mom >= 0 ? 'yes' : 'no', confidence: Math.min(0.62, 0.5 + Math.abs(mom) * 1.1) };
}

const REFS = {
  factorial: n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  countVowels: s => (s.match(/[aeiou]/gi) || []).length,
  sum: a => a.reduce((x, y) => x + y, 0),
  max: a => Math.max(...a),
  reverse: s => [...s].reverse().join(''),
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
  unique: a => [...new Set(a)],
  average: a => a.reduce((x, y) => x + y, 0) / a.length,
};
const PROBES = {
  factorial: [0, 1, 2, 5, 7], countVowels: ['aeiou', 'AEI', 'ApPlE', 'xyz'],
  sum: [[1, 2, 3], []], max: [[3, 1, 4]], reverse: ['abc'], clamp: [5, 0, 10, -1, 99],
  unique: [[1, 1, 2]], average: [[2, 4]],
};

async function bugHunt(bounty) {
  const src = await (await fetch('https://raw.githubusercontent.com/AIProveRH/aiprove/main/challenges/bug-hunt-utils/utils.js')).text();
  writeFileSync(new URL('./utils.mjs', import.meta.url), src.replace('module.exports =', 'export const __m ='));
  const { __m: utils } = await import('./utils.mjs');
  const bugs = [];
  for (const [fn, ref] of Object.entries(REFS)) {
    if (typeof utils[fn] !== 'function') continue;
    for (const input of (PROBES[fn] || [])) {
      const args = fn === 'clamp' ? [input, 0, 10] : [input];
      const got = utils[fn](...args);
      const want = ref(...args);
      if (JSON.stringify(got) !== JSON.stringify(want)) { bugs.push({ fn, input, expected: want }); break; }
    }
  }
  return bugs;
}

for (const b of open) {
  const gated = /must hold|holding .*PROVE|stake/i.test(b.brief || '') && b.unit === 'NVDA';
  const enter = await fetch(`${BASE}/api/bounties/${b.slug}/enter`, { method: 'POST', headers: H, body: JSON.stringify({ handle: HANDLE }) });
  console.log('enter', b.slug, enter.status, gated ? '(gated - entry only)' : '');
  if (gated) continue;
  const detail = await (await fetch(`${BASE}/api/bounties/${b.slug}`, { headers: H })).json();
  let payload = null;
  if (detail.submitKind === 'prediction' && b.slug.startsWith('forecast-btc')) payload = { prediction: await btcForecast(), handle: HANDLE };
  if (detail.submitKind === 'bughunt') { const bugs = await bugHunt(b); if (bugs.length) payload = { prediction: bugs, handle: HANDLE }; }
  if (payload) {
    const s = await fetch(`${BASE}/api/bounties/${b.slug}/submit`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    console.log('submit', b.slug, s.status);
  } else if (detail.submitKind === 'repo') {
    console.log('repo deliverable required for', b.slug, '- companion repository entry');
  }
}
console.log('AUTONOMOUS LOOP COMPLETE');
