/**
 * Rebuild Android/PWA launcher icons from public/pwa/source.jpg.
 *
 * Android maskable icons must be opaque full-bleed squares.
 * source.jpg has a painted rounded “frame” near the edges — that becomes a
 * second border under the launcher mask. We zoom-crop ~11% so only the scene
 * remains, then resize to exact squares (never stretch).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'public/pwa/source.jpg');
const outDir = resolve(root, 'public/pwa');

/** Fraction of source kept after center crop (1 = no zoom). */
/** Crop enough to drop the painted squircle glow (~8–10% per side). */
const KEEP = 0.82;

async function squareIcon(size) {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width;
  const h = meta.height;
  const side = Math.round(Math.min(w, h) * KEEP);
  const left = Math.round((w - side) / 2);
  const top = Math.round((h - side) / 2);
  return sharp(srcPath)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: 'fill' }) // already square crop — fill = 1:1, no stretch
    .flatten({ background: '#020617' })
    .png()
    .toBuffer();
}

async function write(buf, name) {
  const path = resolve(outDir, name);
  await sharp(buf).png().toFile(path);
  const meta = await sharp(path).metadata();
  if (meta.width !== meta.height) {
    throw new Error(`${name} not square: ${meta.width}x${meta.height}`);
  }
  console.log(name, `${meta.width}x${meta.height}`);
}

const s512 = await squareIcon(512);
const s192 = await squareIcon(192);
const s180 = await squareIcon(180);
const s32 = await squareIcon(32);
const s16 = await squareIcon(16);

// Canonical + cache-bust "-a" names (Android PWA icon cache is sticky).
for (const [buf, base] of [
  [s512, 'icon-512'],
  [s192, 'icon-192'],
  [s512, 'icon-512-maskable'],
  [s192, 'icon-192-maskable'],
  [s180, 'apple-touch-icon'],
  [s192, 'favicon-192'],
  [s32, 'favicon-32'],
  [s16, 'favicon-16'],
]) {
  await write(buf, `${base}.png`);
  await write(buf, `${base}-a.png`);
}
await sharp(s32).png().toFile(resolve(root, 'public/favicon.png'));
await sharp(s32).png().toFile(resolve(root, 'public/favicon.ico'));
console.log('favicon.png / favicon.ico');
console.log('done keep=', KEEP);
