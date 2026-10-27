/**
 * Rebuild launcher / favicon PNGs from public/pwa/source.jpg.
 *
 * Android adaptive (maskable) icons MUST be full-bleed opaque pixels to every
 * edge — no inset “safe zone” padding (that shows up as a black frame).
 * Safe-zone guidance only means: don’t put critical marks in the outer ~10%;
 * the bitmap itself still fills 100×100%.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'public/pwa/source.jpg');
const outDir = resolve(root, 'public/pwa');

/** Exact square cover — never stretch, never letterbox. */
async function fullBleed(size) {
  return sharp(srcPath)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#020617' })
    .png()
    .toBuffer();
}

async function write(buf, name) {
  const path = resolve(outDir, name);
  await sharp(buf).png().toFile(path);
  const meta = await sharp(path).metadata();
  if (meta.width !== meta.height) {
    throw new Error(`${name} is not square: ${meta.width}x${meta.height}`);
  }
  console.log(name, `${meta.width}x${meta.height}`);
}

const sizes = {
  512: await fullBleed(512),
  192: await fullBleed(192),
  180: await fullBleed(180),
  32: await fullBleed(32),
  16: await fullBleed(16),
};

// any + maskable are the same full-bleed art (Android needs edge fill on maskable)
await write(sizes[512], 'icon-512.png');
await write(sizes[192], 'icon-192.png');
await write(sizes[512], 'icon-512-maskable.png');
await write(sizes[192], 'icon-192-maskable.png');
await write(sizes[180], 'apple-touch-icon.png');
await write(sizes[192], 'favicon-192.png');
await write(sizes[32], 'favicon-32.png');
await write(sizes[16], 'favicon-16.png');
await sharp(sizes[32]).png().toFile(resolve(root, 'public/favicon.png'));
await sharp(sizes[32]).png().toFile(resolve(root, 'public/favicon.ico'));
console.log('favicon.png / favicon.ico');
console.log('done');
