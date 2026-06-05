# Credits

## Audio

### Letter-name recordings — `client/public/audio/letters/*.wav`

Source: [vgwb/Antura](https://github.com/vgwb/Antura), Modern Standard Arabic letter-name recordings from the `Assets/_lang_bundles/arabic/Audio/Letters/*__lettername.wav` bundle.

License: **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/

Attribution: Letter-name audio by Vento di gioia World Beyond (Antura project), used under CC BY 4.0. No modifications were made to the source recordings.

Mapping from Antura filename root to Bedaya glyph is in `scripts/fetch-antura-audio.mjs`. Re-run that script to refresh the bundle.

## Code patterns

- **Dual-layer learner memory** (`server/src/services/learner-memory.js`) is inspired by [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor), Apache-2.0 — SUMMARY + PROFILE files as the two memory layers.
- **Bayesian Knowledge Tracing** (`server/src/services/mastery.js`) follows the mastery-determination pattern from [CAHLR/OATutor](https://github.com/CAHLR/OATutor), MIT (CHI 2023).
- **Spaced repetition** (`server/src/services/scheduler.js`) is powered by [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), MIT.
- **Letter data model** (`server/src/db/schema.sql` — `bedaya_letters`, `bedaya_letter_forms`, `bedaya_words`, `bedaya_phrases`) takes its shape from Antura's content database.
