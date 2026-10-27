/**
 * Rebuild PWA / favicon assets.
 *
 * - Launcher (Android / apple-touch): full-bleed scene from source.jpg
 * - Browser tab favicons: transparent gold emblem from brand-mark (black → alpha)
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scenePath = resolve(root, 'public/pwa/source.jpg');
const markPath = resolve(root, 'src/assets/brand-mark-lg.png');
const outDir = resolve(root, 'public/pwa');

/** Crop painted squircle glow from cinematic source (~8–10% per side). */
const KEEP = 0.82;

async function sceneSquare(size) {
  const meta = await sharp(scenePath).metadata();
  const w = meta.width;
  const h = meta.height;
  const side = Math.round(Math.min(w, h) * KEEP);
  const left = Math.round((w - side) / 2);
  const top = Math.round((h - side) / 2);
  return sharp(scenePath)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: 'fill' })
    .flatten({ background: '#020617' })
    .png()
    .toBuffer();
}

/** Emblem only: near-black pixels become transparent. */
async function emblemSquare(size) {
  const { data, info } = await sharp(markPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 22 && g < 22 && b < 22) data[i + 3] = 0;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
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
  console.log(name, `${meta.width}x${meta.height}`, meta.hasAlpha ? 'alpha' : 'opaque');
}

const s512 = await sceneSquare(512);
const s192 = await sceneSquare(192);
const s180 = await sceneSquare(180);
const mark192 = await emblemSquare(192);
const mark32 = await emblemSquare(32);
const mark16 = await emblemSquare(16);

// Android / install icons — cinematic scene (cache-bust -a copies too)
for (const [buf, base] of [
  [s512, 'icon-512'],
  [s192, 'icon-192'],
  [s512, 'icon-512-maskable'],
  [s192, 'icon-192-maskable'],
  [s180, 'apple-touch-icon'],
]) {
  await write(buf, `${base}.png`);
  await write(buf, `${base}-a.png`);
}

// Browser tab favicons — transparent emblem only
await write(mark192, 'favicon-192.png');
await write(mark32, 'favicon-32.png');
await write(mark16, 'favicon-16.png');
// Keep -a tab names pointing at emblem too (index may still reference them)
await write(mark192, 'favicon-192-a.png');
await write(mark32, 'favicon-32-a.png');
await write(mark16, 'favicon-16-a.png');

await sharp(mark32).png().toFile(resolve(root, 'public/favicon.png'));
await sharp(mark32).png().toFile(resolve(root, 'public/favicon.ico'));
console.log('favicon.png / favicon.ico (transparent emblem)');
console.log('done');
