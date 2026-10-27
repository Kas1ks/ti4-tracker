/**
 * Rebuild launcher / favicon PNGs from public/pwa/source.jpg.
 *
 * - purpose "any": full-bleed cover (square, no stretch)
 * - purpose "maskable": full-bleed blurred backdrop + artwork in center ~80% safe zone
 *   (Android adaptive icons crop the outer 10% — edge-flush art looks crushed/wide)
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'public/pwa/source.jpg');
const outDir = resolve(root, 'public/pwa');

async function fullBleed(size) {
  return sharp(srcPath)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

/** Maskable: keep the mark inside the center 80% safe zone. */
async function maskable(size) {
  const safe = Math.round(size * 0.8);
  const pad = Math.round((size - safe) / 2);
  const backdrop = await sharp(srcPath)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .blur(28)
    .modulate({ brightness: 0.72, saturation: 1.05 })
    .png()
    .toBuffer();
  const art = await sharp(srcPath)
    .resize(safe, safe, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  return sharp(backdrop)
    .composite([{ input: art, left: pad, top: pad }])
    .png()
    .toBuffer();
}

async function write(buf, name) {
  const path = resolve(outDir, name);
  await sharp(buf).png().toFile(path);
  const meta = await sharp(path).metadata();
  console.log(name, `${meta.width}x${meta.height}`);
}

const any512 = await fullBleed(512);
const any192 = await fullBleed(192);
const mask512 = await maskable(512);
const mask192 = await maskable(192);
const apple = await fullBleed(180);
const fav32 = await fullBleed(32);
const fav16 = await fullBleed(16);

await write(any512, 'icon-512.png');
await write(any192, 'icon-192.png');
await write(mask512, 'icon-512-maskable.png');
await write(mask192, 'icon-192-maskable.png');
await write(apple, 'apple-touch-icon.png');
await write(any192, 'favicon-192.png');
await write(fav32, 'favicon-32.png');
await write(fav16, 'favicon-16.png');
await sharp(fav32).png().toFile(resolve(root, 'public/favicon.png'));
console.log('favicon.png 32x32');
console.log('done');
