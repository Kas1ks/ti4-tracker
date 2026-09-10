import { PLAYER_COLORS } from './gameData';

/** Base TI4 production costs (resources). `per` = units per cost payment. */
export const PRODUCTION_UNITS = [
  { id: 'infantry', name: 'Пехота', file: 'Infantry_Plastic.webp', cost: 1, per: 2 },
  { id: 'fighter', name: 'Истребители', file: 'Fighter_Plastic.webp', cost: 1, per: 2 },
  { id: 'destroyer', name: 'Эсминцы', file: 'Destroyer_Plastic.webp', cost: 1, per: 1 },
  { id: 'cruiser', name: 'Крейсеры', file: 'Cruiser_Plastic.webp', cost: 2, per: 1 },
  { id: 'carrier', name: 'Транспортники', file: 'Carrier_Plastic.webp', cost: 3, per: 1 },
  { id: 'dreadnought', name: 'Дредноуты', file: 'Dreadnought_Plastic.webp', cost: 4, per: 1 },
  { id: 'mech', name: 'Мехи', file: 'Mech_Plastic.webp', cost: 2, per: 1 },
  { id: 'flagship', name: 'Флагман', file: 'Flagship_Plastic.webp', cost: 8, per: 1 },
  { id: 'warsun', name: 'Солнце войны', file: 'War_Sun_Plastic.webp', cost: 12, per: 1 },
];

export function figurineColorId(hex) {
  const needle = String(hex || '').toLowerCase();
  const match = PLAYER_COLORS.find(c => c.hex.toLowerCase() === needle);
  if (match) return match.id;
  if (needle === '#090d16' || needle === '#030712' || needle === '#000') return 'black';
  return 'blue';
}

export function unitImageUrl(unit, colorHex) {
  const color = figurineColorId(colorHex);
  return `/figurines/${color}/${unit.file}`;
}

export function unitBatchSize(unit) {
  return Math.max(1, Number(unit.per) || 1);
}

/** How many production “slots” this stack uses (2 infantry = 1). */
export function unitSlotCount(unit, count) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return 0;
  return Math.ceil(n / unitBatchSize(unit));
}

export function unitResourceCost(unit, count) {
  return unitSlotCount(unit, count) * (Number(unit.cost) || 0);
}

export function productionTotals(counts) {
  let units = 0;
  let resources = 0;
  PRODUCTION_UNITS.forEach((unit) => {
    const n = Math.max(0, Number(counts[unit.id]) || 0);
    const slots = unitSlotCount(unit, n);
    units += slots;
    resources += slots * (Number(unit.cost) || 0);
  });
  return { units, resources };
}
