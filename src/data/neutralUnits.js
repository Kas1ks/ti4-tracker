/** Thunder's Edge Neutral Unit Reference — Combat values (hit on d10 ≥ combat). */

export const NEUTRAL_OPPONENT_ID = 'neutral';

/** Order matches mockup 2-col grid: left/right pairs. Icons = light plastic (whitened in CSS). */
export const NEUTRAL_UNITS = Object.freeze([
  { id: 'infantry', name: 'Пехота', combat: 8, dice: 1, file: 'Infantry_Plastic.webp' },
  { id: 'mech', name: 'Мех', combat: 6, dice: 1, file: 'Mech_Plastic.webp' },
  { id: 'fighter', name: 'Истребитель', combat: 8, dice: 1, file: 'Fighter_Plastic.webp' },
  { id: 'destroyer', name: 'Эсминец', combat: 8, dice: 1, file: 'Destroyer_Plastic.webp' },
  { id: 'cruiser', name: 'Крейсер', combat: 6, dice: 1, file: 'Cruiser_Plastic.webp' },
  { id: 'carrier', name: 'Транспорт', combat: 9, dice: 1, file: 'Carrier_Plastic.webp' },
  { id: 'dreadnought', name: 'Дредноут', combat: 5, dice: 1, file: 'Dreadnought_Plastic.webp' },
  { id: 'warsun', name: 'Солнце войны', combat: 3, dice: 3, file: 'War_Sun_Plastic.webp' },
  { id: 'flagship', name: 'Флагман', combat: 7, dice: 2, max: 1, file: 'Flagship_Plastic.webp' },
]);

export function neutralUnitIconUrl(unit) {
  if (!unit?.file) return null;
  // Yellow plastics have real highlight/shadow range; CSS then maps them to white.
  return `/figurines/yellow/${unit.file}`;
}

export function emptyNeutralCounts() {
  return Object.fromEntries(NEUTRAL_UNITS.map(u => [u.id, 0]));
}

export function rollD10(rng = Math.random) {
  return 1 + Math.floor(rng() * 10);
}

/**
 * Auto-roll Combat dice for neutral units.
 * @param {Record<string, number>} counts unit id → count
 * @param {() => number} [rng] injectable RNG in [0,1)
 * @returns {{ hits: number, diceTotal: number, details: Array<{ unitId: string, name: string, combat: number, rolls: number[], hits: number }> }}
 */
export function rollNeutralCombat(counts = {}, rng = Math.random) {
  const details = [];
  let hits = 0;
  let diceTotal = 0;

  NEUTRAL_UNITS.forEach((unit) => {
    let n = Math.max(0, Math.floor(Number(counts[unit.id]) || 0));
    if (unit.max != null) n = Math.min(n, unit.max);
    if (!n) return;
    const diceCount = n * (unit.dice || 1);
    const rolls = [];
    let unitHits = 0;
    for (let i = 0; i < diceCount; i += 1) {
      const roll = rollD10(rng);
      rolls.push(roll);
      if (roll >= unit.combat) unitHits += 1;
    }
    diceTotal += diceCount;
    hits += unitHits;
    details.push({
      unitId: unit.id,
      name: unit.name,
      combat: unit.combat,
      rolls,
      hits: unitHits,
    });
  });

  return { hits, diceTotal, details };
}

export function summarizeNeutralRoll(result) {
  if (!result?.diceTotal) return 'Нет кубиков';
  const parts = (result.details || []).map((d) => {
    const shown = d.rolls.length <= 8
      ? d.rolls.join(',')
      : `${d.rolls.slice(0, 6).join(',')}…`;
    return `${d.name} (≥${d.combat}): [${shown}] → ${d.hits}`;
  });
  return `${result.diceTotal}d10 → ${result.hits} попаданий · ${parts.join(' · ')}`;
}
