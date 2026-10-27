/**
 * Thematic icons for public objectives (and secret row).
 * tone → CSS modifier on .osc-goal-icon
 */
const BY_ID = {
  // Stage I — base
  p1_b01: { icon: 'fa-globe', tone: 'terra' }, // 4 planets same type
  p1_b02: { icon: 'fa-crosshairs', tone: 'war' }, // ships near Mecatol
  p1_b03: { icon: 'fa-atom', tone: 'tech' }, // 2 techs in 2 colors
  p1_b04: { icon: 'fa-landmark', tone: 'influence' }, // spend 8 influence
  p1_b05: { icon: 'fa-coins', tone: 'trade' }, // spend 5 TG
  p1_b06: { icon: 'fa-map', tone: 'expand' }, // 6 planets outside home
  p1_b07: { icon: 'fa-gem', tone: 'resource' }, // spend 8 resources
  p1_b08: { icon: 'fa-gears', tone: 'war' }, // 2 unit upgrades
  p1_b09: { icon: 'fa-chess', tone: 'command' }, // spend 3 command tokens
  p1_b10: { icon: 'fa-satellite', tone: 'tech' }, // 3 tech specialty planets

  // Stage I — PoK
  p1_p01: { icon: 'fa-satellite-dish', tone: 'void' }, // units in 3 empty systems
  p1_p02: { icon: 'fa-users', tone: 'expand' }, // more planets than neighbors
  p1_p03: { icon: 'fa-star', tone: 'legend' }, // legendary / mecatol / anomaly
  p1_p04: { icon: 'fa-building', tone: 'structure' }, // 4 structures
  p1_p05: { icon: 'fa-paperclip', tone: 'attach' }, // 2 planets with attachments
  p1_p06: { icon: 'fa-jet-fighter', tone: 'fleet' }, // 5 ships in one system
  p1_p07: { icon: 'fa-sack-dollar', tone: 'wealth' }, // spend 3/3/3
  p1_p08: { icon: 'fa-border-all', tone: 'edge' }, // 3 edge systems
  p1_p09: { icon: 'fa-city', tone: 'structure' }, // structures on 3 planets
  p1_p10: { icon: 'fa-sun', tone: 'fleet' }, // flagship or war sun

  // Stage II — base
  p2_b01: { icon: 'fa-gem', tone: 'resource' }, // spend 16 resources
  p2_b02: { icon: 'fa-gears', tone: 'war' }, // 3 unit upgrades
  p2_b03: { icon: 'fa-globe', tone: 'expand' }, // 11 planets outside home
  p2_b04: { icon: 'fa-atom', tone: 'tech' }, // 2 techs in each of 4 colors
  p2_b05: { icon: 'fa-house', tone: 'war' }, // planet in another home
  p2_b06: { icon: 'fa-satellite', tone: 'tech' }, // 5 tech specialty planets
  p2_b07: { icon: 'fa-landmark', tone: 'influence' }, // spend 16 influence
  p2_b08: { icon: 'fa-globe', tone: 'terra' }, // 6 planets same type
  p2_b09: { icon: 'fa-coins', tone: 'trade' }, // spend 10 TG
  p2_b10: { icon: 'fa-chess', tone: 'command' }, // spend 6 command tokens

  // Stage II — PoK
  p2_p01: { icon: 'fa-satellite-dish', tone: 'void' }, // 5 units in empty systems
  p2_p02: { icon: 'fa-building', tone: 'structure' }, // 5 structures outside home
  p2_p03: { icon: 'fa-archway', tone: 'attach' }, // 3 planets with attachments
  p2_p04: { icon: 'fa-house', tone: 'expand' }, // planets near other homes
  p2_p05: { icon: 'fa-sun', tone: 'fleet' }, // FS/WS in home or Mecatol
  p2_p06: { icon: 'fa-border-all', tone: 'edge' }, // 5 edge systems
  p2_p07: { icon: 'fa-city', tone: 'structure' }, // 7 structures
  p2_p08: { icon: 'fa-jet-fighter', tone: 'fleet' }, // 8 ships in one system
  p2_p09: { icon: 'fa-sack-dollar', tone: 'wealth' }, // spend 6/6/6
  p2_p10: { icon: 'fa-star', tone: 'legend' }, // 4 legendary/mecatol/anomaly
};

export const SECRET_OBJECTIVE_ICON = {
  icon: 'fa-star',
  tone: 'secret',
};

const FALLBACK = { icon: 'fa-bullseye', tone: 'void' };

/** @param {{ id?: string } | null | undefined} objective */
export function getObjectiveIcon(objective) {
  if (!objective?.id) return FALLBACK;
  return BY_ID[objective.id] || FALLBACK;
}
