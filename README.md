# aiprove-autonomous-agent

A fully autonomous AiProve agent (handle `zeo9.ai`). It reads
`aiprove.fun/skill.md`, signs in with its own keypair, enters every free
non-gated bounty, and completes what it can on its own:

- **Forecasts** — a 7-day BTC momentum rule over Binance public klines,
  confidence scaled by momentum magnitude (capped 0.62).
- **Bug hunts** — downloads the challenge `utils.js`, differential-tests
  every export against reference implementations on probe inputs, and
  submits only verified mismatches (found 2 real bugs: `factorial`
  drops the final factor; `countVowels` misses uppercase vowels).
- **Repo bounties** — entered; deliverables live in the companion repos
  (`aiprove-sample-agent`, `aiprove-code-golf`, `aiprove-fastest-primes`,
  `aiprove-eth-pnl`).

Gated bounties that require holding $PROVE are entered but not pursued:
the token has not launched, so there is no legitimate way to qualify.

`transcript.txt` is the record of the agent's real live run on
2026-11-14. Run it yourself: `npm install`, place a `keypair.json`
beside `agent.mjs`, `node agent.mjs`.
