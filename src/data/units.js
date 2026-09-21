import { PLAYER_COLORS } from './gameData';
import { techById } from './technologies';

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

/** Per-unit resource cost after faction upgrades (e.g. Muaat Prototype War Sun II → 10). */
export function unitCostForPlayer(unit, { factionId = null, techIds = [] } = {}) {
  const base = Number(unit?.cost) || 0;
  if (
    unit?.id === 'warsun'
    && factionId === 'muaat'
    && techIds.includes('prototype_war_sun_2')
  ) {
    return 10;
  }
  return base;
}

export function unitResourceCost(unit, count, opts = {}) {
  return unitSlotCount(unit, count) * unitCostForPlayer(unit, opts);
}

/** Owned unit-upgrade techs (AI Development Algorithm discount). */
export function countOwnedUnitUpgrades(techIds = []) {
  return techIds.filter((id) => techById(id)?.kind === 'unit').length;
}

/**
 * Production totals with tech discounts.
 * - Sarween Tools: −1 to combined cost
 * - AI Development Algorithm (when applied): −1 per owned unit upgrade
 */
export function productionTotals(counts, {
  factionId = null,
  techIds = [],
  applyAiAlgorithm = false,
} = {}) {
  let units = 0;
  let baseResources = 0;
  const opts = { factionId, techIds };

  PRODUCTION_UNITS.forEach((unit) => {
    const n = Math.max(0, Number(counts[unit.id]) || 0);
    const slots = unitSlotCount(unit, n);
    units += slots;
    baseResources += slots * unitCostForPlayer(unit, opts);
  });

  let sarweenDiscount = 0;
  if (techIds.includes('sarween_tools') && baseResources > 0) {
    sarweenDiscount = 1;
  }

  let aiDiscount = 0;
  if (
    applyAiAlgorithm
    && techIds.includes('ai_development_algorithm')
    && baseResources > 0
  ) {
    aiDiscount = countOwnedUnitUpgrades(techIds);
  }

  const discount = Math.min(baseResources, sarweenDiscount + aiDiscount);
  const resources = Math.max(0, baseResources - discount);

  return {
    units,
    resources,
    baseResources,
    discount,
    sarweenDiscount: Math.min(baseResources, sarweenDiscount),
    aiDiscount: Math.min(
      Math.max(0, baseResources - sarweenDiscount),
      aiDiscount,
    ),
  };
}
