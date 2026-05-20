# بداية — Bedaya

**Bedaya** (بداية, "beginning") is an adult literacy app for Egyptians who never
learned to read or write. It teaches reading and writing only — strictly
secular, no religious content of any kind. What learners choose to read with
that literacy is their own business.

The pedagogy is a 10-minute daily session: a short warm-up reviewing known
letters, a phonics drill introducing one new letter, a handwriting trace, and a
reading payoff using only the letters learned so far.

## Stack

- **client/** — React 19 + Vite + Tailwind, fully RTL Arabic (Cairo + Noto Naskh)
- **server/** — Node + Express + PostgreSQL, with a Claude/Ollama-backed
  story generator constrained to the learner's known letters

## Running locally

You need PostgreSQL and either an Anthropic API key or a local Ollama install.

```bash
# 1. Server
cd server
cp .env.example .env        # fill in DATABASE_URL + ANTHROPIC_API_KEY
npm install
npm run migrate             # creates the bedaya_* tables
npm run dev                 # http://localhost:4001

# 2. Client (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5183
```

The client dev server proxies `/api` to `http://localhost:4001`.

## How the lesson loop works

1. **Warm-up** — review the letters already learned (tap to hear each).
2. **Phonics** — a new letter is introduced with its sound and example words.
3. **Trace** — handwriting practice on a canvas with a ghost-letter underlay.
   Nothing is uploaded; the trace never leaves the device.
4. **Reading** — below ~12 known letters the app shows real words buildable
   from the learned set; beyond that, a short story is generated and validated
   to contain only known letters.
5. **Mastery** — the letter is marked mastered and the next one is queued.

Letter order is **frequency-weighted** by default (so functional words appear
fast) and switchable to the **MOE-traditional** order (ا ب ت ث) for
ministry-branded deployments.

## Privacy

- Voice is synthesised on-device; no audio is uploaded.
- Handwriting traces are never stored.
- Learner identity is a name plus an optional phone — no email required.

## Status

v0 — the core lesson loop works end to end. Not yet built: offline/PWA support,
recorded voice cast, AI handwriting grading, the facilitator dashboard, and
numeracy/life-skills tracks.
