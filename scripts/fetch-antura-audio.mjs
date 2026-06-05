#!/usr/bin/env node
/**
 * Fetch Antura's MSA letter-name audio for the 30 Bedaya letters.
 * Source: vgwb/Antura, CC-BY 4.0 (attribution required, see CREDITS.md).
 *
 * Pipeline:
 *   1. Pull each pointer file from raw.githubusercontent.com (LFS pointers
 *      are tiny — they only carry the oid + size).
 *   2. Batch-request the actual blob URLs via GitHub's LFS batch API.
 *   3. Stream each blob into client/public/audio/letters/{glyph}.wav.
 *
 * Re-run safely — existing files are overwritten.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'client', 'public', 'audio', 'letters');

const ANTURA_BASE = 'https://raw.githubusercontent.com/vgwb/Antura/main/Assets/_lang_bundles/arabic/Audio/Letters';
const LFS_BATCH = 'https://github.com/vgwb/Antura.git/info/lfs/objects/batch';

// Bedaya glyph → Antura filename root (verified against the repo listing).
const MAPPING = {
  'ا': 'alef',  'ب': 'beh',   'ت': 'teh',   'ث': 'theh',
  'ج': 'jeem',  'ح': 'hah',   'خ': 'khah',  'د': 'dal',
  'ذ': 'thal',  'ر': 'reh',   'ز': 'zain',  'س': 'seen',
  'ش': 'sheen', 'ص': 'sad',   'ض': 'dad',   'ط': 'tah',
  'ظ': 'zah',   'ع': 'ain',   'غ': 'ghain', 'ف': 'feh',
  'ق': 'qaf',   'ك': 'kaf',   'ل': 'lam',   'م': 'meem',
  'ن': 'noon',  'ه': 'heh',   'و': 'waw',   'ي': 'yeh',
  'ة': 'teh_marbuta',
  'ء': 'hamza',
};

async function fetchPointer(name) {
  const url = `${ANTURA_BASE}/${name}__lettername.wav`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pointer ${name}: HTTP ${res.status}`);
  const text = await res.text();
  const oid = text.match(/oid sha256:([a-f0-9]+)/)?.[1];
  const size = Number(text.match(/size (\d+)/)?.[1]);
  if (!oid || !Number.isInteger(size)) throw new Error(`pointer ${name}: parse failed`);
  return { oid, size };
}

async function lfsBatch(objects) {
  const res = await fetch(LFS_BATCH, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.git-lfs+json',
      'Content-Type': 'application/vnd.git-lfs+json',
    },
    body: JSON.stringify({ operation: 'download', transfers: ['basic'], objects }),
  });
  if (!res.ok) throw new Error(`lfs batch: HTTP ${res.status}`);
  return res.json();
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${dest}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.length;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Fetching ${Object.keys(MAPPING).length} pointers…`);

  const pointers = [];
  for (const [glyph, name] of Object.entries(MAPPING)) {
    const p = await fetchPointer(name);
    pointers.push({ glyph, name, ...p });
    process.stdout.write('.');
  }
  console.log();

  console.log('Batch-requesting LFS URLs…');
  const batch = await lfsBatch(pointers.map(({ oid, size }) => ({ oid, size })));

  const urlByOid = new Map();
  for (const obj of batch.objects) {
    if (obj.actions?.download?.href) urlByOid.set(obj.oid, obj.actions.download.href);
    else if (obj.error) throw new Error(`LFS error for ${obj.oid}: ${obj.error.message}`);
  }

  console.log('Downloading WAVs…');
  let totalBytes = 0;
  for (const p of pointers) {
    const url = urlByOid.get(p.oid);
    if (!url) throw new Error(`no download URL for ${p.glyph}`);
    const dest = path.join(OUT_DIR, `${p.glyph}.wav`);
    const bytes = await downloadTo(url, dest);
    totalBytes += bytes;
    console.log(`  ${p.glyph}  ${bytes.toLocaleString()}  bytes  (${p.name})`);
  }
  console.log(`Done. ${pointers.length} files, ${(totalBytes / 1024).toFixed(1)} KB total.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
