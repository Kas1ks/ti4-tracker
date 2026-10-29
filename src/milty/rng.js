/** Seeded PRNG (mulberry32). Not compatible with PHP mt_rand. */

export function createRng(seed) {
  let t = (Number(seed) >>> 0) || 1;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  const max = 1125899906842624; // 2^50
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return (buf[0] * 0x100000000 + (buf[1] >>> 0)) % max || 1;
  }
  return Math.floor(Math.random() * max) + 1;
}

/** Fisher–Yates using rng(); mutates array in place. */
export function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function shuffleCopy(arr, rng) {
  return shuffleInPlace([...arr], rng);
}
