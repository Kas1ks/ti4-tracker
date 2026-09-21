/** @typedef {'green'|'blue'|'yellow'|'red'} TechColor */
/** @typedef {'generic'|'unit'|'faction'} TechKind */
/** @typedef {'base'|'pok'|'te'|'codex'} TechSource */

/**
 * @typedef {object} Tech
 * @property {string} id
 * @property {string} name
 * @property {TechColor|null} color
 * @property {TechKind} kind
 * @property {TechColor[]} prereqs
 * @property {TechSource} source
 * @property {string} [factionId]
 * @property {boolean} [omega]
 * @property {string} [text]
 */

import { BREAKTHROUGH_SYNERGY, breakthroughByFaction } from './breakthroughs';

export { BREAKTHROUGH_SYNERGY, breakthroughByFaction };

export const TECH_COLORS = Object.freeze(['green', 'blue', 'yellow', 'red']);

export const TECH_COLOR_META = Object.freeze({
  green: {
    label: 'Биотические',
    short: 'G',
    css: 'emerald',
    icon: '/tech-icons/biotic.webp',
  },
  blue: {
    label: 'Движения',
    short: 'B',
    css: 'sky',
    icon: '/tech-icons/propulsion.webp',
  },
  yellow: {
    label: 'Кибернетические',
    short: 'Y',
    css: 'amber',
    icon: '/tech-icons/cybernetic.webp',
  },
  red: {
    label: 'Военные',
    short: 'R',
    css: 'rose',
    icon: '/tech-icons/warfare.webp',
  },
});

/** @type {Tech[]} */
const GENERIC = [
  // Biotic
  { id: 'neural_motivator', name: 'Neural Motivator', color: 'green', kind: 'generic', prereqs: [], source: 'base', text: 'В фазе статуса берите 2 КД вместо 1.' },
  { id: 'psychoarchaeology', name: 'Psychoarchaeology', color: 'green', kind: 'generic', prereqs: [], source: 'pok', text: 'Спец. tech планет без истощения; истощить спец. → 1 ТГ.' },
  { id: 'dacxive_animators', name: 'Dacxive Animators', color: 'green', kind: 'generic', prereqs: ['green'], source: 'base', text: 'После победы в наземном бою — 1 пехота.' },
  { id: 'bio_stims', name: 'Bio-Stims', color: 'green', kind: 'generic', prereqs: ['green'], source: 'pok', text: 'Истощить: восстановить планету со спец. или другую tech.' },
  { id: 'hyper_metabolism', name: 'Hyper Metabolism', color: 'green', kind: 'generic', prereqs: ['green', 'green'], source: 'base', text: 'В фазе статуса +3 жетона приказов вместо 2.' },
  { id: 'x89_bacterial_weapon', name: 'X-89 Bacterial Weapon Ω', color: 'green', kind: 'generic', prereqs: ['green', 'green', 'green'], source: 'codex', omega: true, text: 'Удвоить hits BOMBARDMENT и наземного боя; истощить планеты.' },

  // Propulsion
  { id: 'antimass_deflectors', name: 'Antimass Deflectors', color: 'blue', kind: 'generic', prereqs: [], source: 'base', text: 'Движение через астероиды; −1 к SPACE CANNON против вас.' },
  { id: 'dark_energy_tap', name: 'Dark Energy Tap', color: 'blue', kind: 'generic', prereqs: [], source: 'pok', text: 'Исследовать frontier; отступление в пустые смежные системы.' },
  { id: 'gravity_drive', name: 'Gravity Drive', color: 'blue', kind: 'generic', prereqs: ['blue'], source: 'base', text: '+1 Move одному кораблю при тактическом действии.' },
  { id: 'sling_relay', name: 'Sling Relay', color: 'blue', kind: 'generic', prereqs: ['blue'], source: 'pok', text: 'ACTION: истощить → произвести 1 корабль у дока.' },
  { id: 'fleet_logistics', name: 'Fleet Logistics', color: 'blue', kind: 'generic', prereqs: ['blue', 'blue'], source: 'base', text: '2 действия за ход вместо 1.' },
  { id: 'light_wave_deflector', name: 'Light/Wave Deflector', color: 'blue', kind: 'generic', prereqs: ['blue', 'blue', 'blue'], source: 'base', text: 'Движение через системы с чужими кораблями.' },

  // Cybernetic
  { id: 'sarween_tools', name: 'Sarween Tools', color: 'yellow', kind: 'generic', prereqs: [], source: 'base', text: 'Production: −1 к суммарной стоимости.' },
  { id: 'scanlink_drone_network', name: 'Scanlink Drone Network', color: 'yellow', kind: 'generic', prereqs: [], source: 'pok', text: 'При активации — explore планету с вашими юнитами.' },
  { id: 'graviton_laser_system', name: 'Graviton Laser System', color: 'yellow', kind: 'generic', prereqs: ['yellow'], source: 'base', text: 'Истощить: SPACE CANNON hits сначала на non-fighters.' },
  { id: 'predictive_intelligence', name: 'Predictive Intelligence', color: 'yellow', kind: 'generic', prereqs: ['yellow'], source: 'pok', text: '+3 голоса; при провале — истощить; перераспределить CT.' },
  { id: 'transit_diodes', name: 'Transit Diodes', color: 'yellow', kind: 'generic', prereqs: ['yellow', 'yellow'], source: 'base', text: 'Истощить: переместить до 4 GF на контролируемые планеты.' },
  { id: 'integrated_economy', name: 'Integrated Economy', color: 'yellow', kind: 'generic', prereqs: ['yellow', 'yellow', 'yellow'], source: 'base', text: 'После захвата планеты — Production по её ресурсам.' },

  // Warfare
  { id: 'plasma_scoring', name: 'Plasma Scoring', color: 'red', kind: 'generic', prereqs: [], source: 'base', text: '+1 куб BOMBARDMENT или SPACE CANNON.' },
  { id: 'ai_development_algorithm', name: 'AI Development Algorithm', color: 'red', kind: 'generic', prereqs: [], source: 'pok', text: 'Истощить: игнор 1 пререка unit upgrade; −стоимость Production.' },
  { id: 'magen_defense_grid', name: 'Magen Defense Grid ΩΩ', color: 'red', kind: 'generic', prereqs: ['red'], source: 'codex', omega: true, text: 'При активации системы со структурами — 1 пехота; +1 hit в GC.' },
  { id: 'self_assembly_routines', name: 'Self Assembly Routines', color: 'red', kind: 'generic', prereqs: ['red'], source: 'pok', text: 'После Production — mech; за уничтоженный mech — 1 ТГ.' },
  { id: 'duranium_armor', name: 'Duranium Armor', color: 'red', kind: 'generic', prereqs: ['red', 'red'], source: 'base', text: 'Чинить 1 повреждённый юнит за раунд боя.' },
  { id: 'assault_cannon', name: 'Assault Cannon', color: 'red', kind: 'generic', prereqs: ['red', 'red', 'red'], source: 'base', text: 'Старт space combat (≥3 non-fighters): уничтожить 1 чужой non-fighter.' },
];

/** @type {Tech[]} */
const UNIT_UPGRADES = [
  { id: 'carrier_2', name: 'Carrier II', color: null, kind: 'unit', prereqs: ['blue', 'blue'], source: 'base' },
  { id: 'cruiser_2', name: 'Cruiser II', color: null, kind: 'unit', prereqs: ['green', 'yellow'], source: 'base' },
  { id: 'destroyer_2', name: 'Destroyer II', color: null, kind: 'unit', prereqs: ['red', 'red'], source: 'base' },
  { id: 'dreadnought_2', name: 'Dreadnought II', color: null, kind: 'unit', prereqs: ['blue', 'blue', 'yellow'], source: 'base' },
  { id: 'fighter_2', name: 'Fighter II', color: null, kind: 'unit', prereqs: ['green', 'blue'], source: 'base' },
  { id: 'infantry_2', name: 'Infantry II', color: null, kind: 'unit', prereqs: ['green', 'green'], source: 'base' },
  { id: 'pds_2', name: 'PDS II', color: null, kind: 'unit', prereqs: ['red', 'yellow'], source: 'base' },
  { id: 'space_dock_2', name: 'Space Dock II', color: null, kind: 'unit', prereqs: ['yellow', 'yellow'], source: 'base' },
  { id: 'war_sun', name: 'War Sun', color: null, kind: 'unit', prereqs: ['red', 'red', 'yellow', 'yellow'], source: 'base' },
];

/** @type {Tech[]} */
const FACTION_TECHS = [
  // Base
  {
    id: 'bioplasmosis', name: 'Bioplasmosis', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'base', factionId: 'arborec',
    text: 'В конце фазы статуса можете снять любое число пехоты с планет под контролем и разместить их на 1+ планетах под контролем в тех же или смежных системах.',
  },
  {
    id: 'letani_warrior_2', name: 'Letani Warrior II', color: null, kind: 'unit',
    prereqs: ['green', 'green'], source: 'base', factionId: 'arborec',
    text: 'Production 2. После уничтожения — бросок: на 6+ положите юнит на эту карту. В начале следующего хода разместите каждый юнит с карты на планету под контролем в домашней системе.',
  },
  {
    id: 'l4_disruptors', name: 'L4 Disruptors', color: 'yellow', kind: 'faction',
    prereqs: ['yellow'], source: 'base', factionId: 'letnev',
    text: 'Во время вторжения юниты не могут использовать Space Cannon против ваших юнитов.',
  },
  {
    id: 'non_euclidean_shielding', name: 'Non-Euclidean Shielding', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'base', factionId: 'letnev',
    text: 'Когда ваш юнит использует Sustain Damage, отменяйте 2 hits вместо 1.',
  },
  {
    id: 'chaos_mapping', name: 'Chaos Mapping', color: 'blue', kind: 'faction',
    prereqs: ['blue'], source: 'base', factionId: 'saar',
    text: 'Другие не могут активировать asteroid fields с вашими кораблями. В начале хода в фазе действий можете произвести 1 юнит в системе с ≥1 вашим юнитом с Production.',
  },
  {
    id: 'floating_factory_2', name: 'Floating Factory II', color: null, kind: 'unit',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'saar',
    text: 'Space Dock в космосе (не на планете). Может двигаться и отступать как корабль. При блокаде уничтожается. Production 7, Move 2, Capacity 5.',
  },
  {
    id: 'magmus_reactor', name: 'Magmus Reactor Ω', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'codex', omega: true, factionId: 'muaat',
    text: 'Ваши корабли могут входить в supernova. Каждая supernova с ≥1 вашим юнитом получает Production 5, как будто это ваш юнит.',
  },
  {
    id: 'prototype_war_sun_2', name: 'Prototype War Sun II', color: null, kind: 'unit',
    prereqs: ['red', 'red', 'yellow', 'yellow'], source: 'base', factionId: 'muaat',
    text: 'Чужие юниты в этой системе теряют Planetary Shield. Sustain Damage, Bombardment 3×3. Cost 10, Combat 3, Move 3, Capacity 6.',
  },
  {
    id: 'production_biomes', name: 'Production Biomes', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'base', factionId: 'hacan',
    text: 'ACTION: истощить и потратить 1 жетон из strategy pool — получите 4 ТГ и выберите 1 другого игрока; он получает 2 ТГ.',
  },
  {
    id: 'quantum_datahub_node', name: 'Quantum Datahub Node', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow', 'yellow'], source: 'base', factionId: 'hacan',
    text: 'В конце фазы стратегии можете потратить 1 жетон из strategy pool и отдать другому игроку 3 своих ТГ. Если сделали — обменяйтесь с ним одной картой стратегии.',
  },
  {
    id: 'spec_ops_2', name: 'Spec Ops II', color: null, kind: 'unit',
    prereqs: ['green', 'green'], source: 'base', factionId: 'sol',
    text: 'После уничтожения — бросок: на 5+ положите юнит на эту карту. В начале следующего хода разместите каждый юнит с карты на планету под контролем в домашней системе. Cost 1, Combat 6.',
  },
  {
    id: 'advanced_carrier_2', name: 'Advanced Carrier II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue'], source: 'base', factionId: 'sol',
    text: 'Sustain Damage. Cost 3, Combat 9, Move 2, Capacity 8.',
  },
  {
    id: 'wormhole_generator', name: 'Wormhole Generator Ω', color: 'blue', kind: 'faction',
    prereqs: ['blue', 'blue'], source: 'codex', omega: true, factionId: 'creuss',
    text: 'ACTION: истощить — разместить или переместить Creuss wormhole token в систему с планетой под контролем или в не-домашнюю систему без чужих кораблей.',
  },
  {
    id: 'dimensional_splicer', name: 'Dimensional Splicer', color: 'red', kind: 'faction',
    prereqs: ['red'], source: 'base', factionId: 'creuss',
    text: 'В начале космического боя в системе с wormhole и ≥1 вашим кораблём можете произвести 1 hit и назначить его 1 чужому кораблю.',
  },
  {
    id: 'inheritance_systems', name: 'Inheritance Systems', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'l1z1x',
    text: 'Можете истощить и потратить 2 ресурса при исследовании tech, чтобы игнорировать все пререквизиты этой tech.',
  },
  {
    id: 'super_dreadnought_2', name: 'Super-Dreadnought II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue', 'yellow'], source: 'base', factionId: 'l1z1x',
    text: '«Direct Hit» больше не действует на этот тип корабля. Sustain Damage, Bombardment 4. Cost 4, Combat 4, Move 2, Capacity 2.',
  },
  {
    id: 'salvage_operations', name: 'Salvage Operations', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'mentak',
    text: 'После победы или поражения в космическом бою получите 1 ТГ; при победе можете также произвести в этой системе 1 корабль любого типа, уничтоженного в бою.',
  },
  {
    id: 'mirror_computing', name: 'Mirror Computing', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow', 'yellow'], source: 'base', factionId: 'mentak',
    text: 'Когда тратите ТГ, каждый ТГ стоит 2 ресурса или 2 influence вместо 1.',
  },
  {
    id: 'neuroglaive', name: 'Neuroglaive', color: 'green', kind: 'faction',
    prereqs: ['green', 'green', 'green'], source: 'base', factionId: 'naalu',
    text: 'После того как другой игрок активирует систему с ≥1 вашим кораблём, он снимает 1 жетон из своего fleet pool и возвращает в подкрепления.',
  },
  {
    id: 'hybrid_crystal_fighter_2', name: 'Hybrid Crystal Fighter II', color: null, kind: 'unit',
    prereqs: ['green', 'blue'], source: 'base', factionId: 'naalu',
    text: 'Может двигаться без транспорта. Истребители сверх capacity считаются за ½ корабля против fleet pool. Cost 1, Combat 7, Move 2.',
  },
  {
    id: 'valefar_assimilator_x', name: 'Valefar Assimilator X', color: null, kind: 'faction',
    prereqs: [], source: 'base', factionId: 'nekro',
    text: 'Когда получаете чужую tech фракционной способностью, можете положить токен X на фракционную tech того игрока вместо этого. Пока токен на tech — эта карта получает её текст. Нельзя класть на tech, где уже есть assimilator.',
  },
  {
    id: 'valefar_assimilator_y', name: 'Valefar Assimilator Y', color: null, kind: 'faction',
    prereqs: [], source: 'base', factionId: 'nekro',
    text: 'Когда получаете чужую tech фракционной способностью, можете положить токен Y на фракционную tech того игрока вместо этого. Пока токен на tech — эта карта получает её текст. Нельзя класть на tech, где уже есть assimilator.',
  },
  {
    id: 'exotrireme_2', name: 'Exotrireme II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue', 'yellow'], source: 'base', factionId: 'saardakk',
    text: 'После раунда космического боя можете уничтожить этот юнит, чтобы уничтожить до 2 кораблей в системе. «Direct Hit» не действует. Sustain Damage, Bombardment 4×2. Cost 4, Combat 5, Move 2, Capacity 1.',
  },
  {
    id: 'valkyrie_particle_weave', name: 'Valkyrie Particle Weave', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'base', factionId: 'saardakk',
    text: 'После боевых бросков в раунде наземного боя, если противник произвёл ≥1 hit, вы производите 1 дополнительный hit.',
  },
  {
    id: 'e_res_siphons', name: 'E-Res Siphons', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'jolnar',
    text: 'После того как другой игрок активирует систему с ≥1 вашим кораблём, получите 4 ТГ.',
  },
  {
    id: 'spacial_conduit_cylinder', name: 'Spatial Conduit Cylinder', color: 'blue', kind: 'faction',
    prereqs: ['blue', 'blue'], source: 'base', factionId: 'jolnar',
    text: 'Можете истощить после активации системы с ≥1 вашим юнитом; эта система считается смежной со всеми другими системами с вашими юнитами в этой активации.',
  },
  {
    id: 'lazax_gate_folding', name: 'Lazax Gate Folding', color: 'blue', kind: 'faction',
    prereqs: ['blue', 'blue'], source: 'base', factionId: 'winnu',
    text: 'В тактических действиях, если не контролируете Mecatol Rex, считайте её систему как с α и β wormhole. ACTION: если контролируете Mecatol — истощить, чтобы разместить 1 пехоту на Mecatol.',
  },
  {
    id: 'hegemonic_trade_policy', name: 'Hegemonic Trade Policy', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'winnu',
    text: 'Истощить, когда ≥1 ваш юнит использует Production: до конца хода поменяйте местами resource и influence одной планеты под контролем.',
  },
  {
    id: 'instinct_training', name: 'Instinct Training', color: 'green', kind: 'faction',
    prereqs: ['green'], source: 'base', factionId: 'xxcha',
    text: 'Можете истощить и потратить 1 жетон из strategy pool, когда другой игрок играет КД — отменить эту КД.',
  },
  {
    id: 'nullification_field', name: 'Nullification Field', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'xxcha',
    text: 'После того как другой игрок активирует систему с ≥1 вашим кораблём, можете истощить и потратить 1 жетон из strategy pool — немедленно завершить его ход.',
  },
  {
    id: 'yin_spinner', name: 'Yin Spinner Ω', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'codex', omega: true, factionId: 'yin',
    text: 'После производства юнитов разместите до 2 пехоты из подкреплений на любую планету под контролем или в любую космическую зону с ≥1 вашим кораблём.',
  },
  {
    id: 'impulse_core', name: 'Impulse Core', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'base', factionId: 'yin',
    text: 'В начале космического боя можете уничтожить 1 свой cruiser или destroyer в активной системе, чтобы произвести 1 hit против чужих кораблей; hit назначается non-fighter, если возможно.',
  },
  {
    id: 'mageon_implants', name: 'Mageon Implants', color: 'green', kind: 'faction',
    prereqs: ['green', 'green', 'green'], source: 'base', factionId: 'yssaril',
    text: 'ACTION: истощить — посмотреть руку КД другого игрока, выбрать 1 и взять себе.',
  },
  {
    id: 'transparasteel_plating', name: 'Transparasteel Plating', color: 'green', kind: 'faction',
    prereqs: ['green'], source: 'base', factionId: 'yssaril',
    text: 'В ваш ход фазы действий игроки, которые уже спасовали, не могут играть КД.',
  },

  // PoK
  {
    id: 'aerie_hololattice', name: 'Aerie Hololattice', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'pok', factionId: 'argent',
    text: 'Другие не могут двигать корабли через системы с вашими структурами. Каждая планета с ≥1 вашей структурой получает Production 1, как будто это ваш юнит.',
  },
  {
    id: 'strike_wing_alpha_2', name: 'Strike Wing Alpha II', color: null, kind: 'unit',
    prereqs: ['red', 'red'], source: 'pok', factionId: 'argent',
    text: 'При Anti-Fighter Barrage каждый результат 9–10 также уничтожает 1 чужую пехоту в космосе активной системы. AFB 6×3. Cost 1, Combat 7, Move 2, Capacity 1.',
  },
  {
    id: 'aetherstream', name: 'Aetherstream', color: 'blue', kind: 'faction',
    prereqs: ['blue', 'blue'], source: 'pok', factionId: 'empyrean',
    text: 'После того как вы или сосед активируете систему, смежную с аномалией, можете дать +1 Move всем кораблям этого игрока в этом тактическом действии.',
  },
  {
    id: 'voidwatch', name: 'Voidwatch', color: 'green', kind: 'faction',
    prereqs: ['green'], source: 'pok', factionId: 'empyrean',
    text: 'После того как игрок двигает корабли в систему с ≥1 вашим юнитом, он должен отдать вам 1 promissory из руки, если может.',
  },
  {
    id: 'genetic_recombination', name: 'Genetic Recombination', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'pok', factionId: 'mahact',
    text: 'Можете истощить до того, как игрок голосует; этот игрок должен отдать ≥1 голос за исход на ваш выбор или снять 1 жетон из fleet pool в подкрепления.',
  },
  {
    id: 'crimson_legionnaire_2', name: 'Crimson Legionnaire II', color: null, kind: 'unit',
    prereqs: ['green', 'green'], source: 'pok', factionId: 'mahact',
    text: 'После уничтожения — 1 commodity или конвертировать 1 commodity в ТГ; затем положите юнит на эту карту. В начале следующего хода разместите каждый юнит с карты на планету под контролем в домашней системе. Cost 1, Combat 7.',
  },
  {
    id: 'supercharge', name: 'Supercharge', color: 'red', kind: 'faction',
    prereqs: ['red'], source: 'pok', factionId: 'naazrokha',
    text: 'В начале раунда боя можете истощить — +1 к результатам боевых бросков всех ваших юнитов в этом раунде.',
  },
  {
    id: 'prefab_arcologies', name: 'Pre-Fab Arcologies', color: 'green', kind: 'faction',
    prereqs: ['green', 'green', 'green'], source: 'pok', factionId: 'naazrokha',
    text: 'После explore планеты — ready эту планету.',
  },
  {
    id: 'temporal_command_suite', name: 'Temporal Command Suite', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'pok', factionId: 'nomad',
    text: 'После того как агент любого игрока истощён, можете истощить эту карту, чтобы ready этого агента; если ready чужого агента — можете провести сделку с этим игроком.',
  },
  {
    id: 'memoria_2', name: 'Memoria II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue', 'yellow'], source: 'pok', factionId: 'nomad',
    text: 'Можете считать этот юнит смежным с системами, где есть ≥1 ваш mech. Sustain Damage, AFB 5×3. Cost 8, Combat 5, Move 2, Capacity 6.',
  },
  {
    id: 'saturn_engine_2', name: 'Saturn Engine II', color: null, kind: 'unit',
    prereqs: ['green', 'yellow'], source: 'pok', factionId: 'titans',
    text: 'Cruiser II Титанов. Sustain Damage. Cost 2, Combat 6, Move 3, Capacity 2.',
  },
  {
    id: 'hel_titan_2', name: 'Hel-Titan II', color: null, kind: 'unit',
    prereqs: ['red', 'yellow'], source: 'pok', factionId: 'titans',
    text: 'Считается структурой и наземным отрядом; нельзя транспортировать. Planetary Shield, Space Cannon 5, Sustain Damage, Production 1. Space Cannon можно использовать против кораблей в смежных системах. Combat 6.',
  },
  {
    id: 'dimensional_tear_2', name: 'Dimensional Tear II', color: null, kind: 'unit',
    prereqs: ['yellow', 'yellow'], source: 'pok', factionId: 'vuilraith',
    text: 'Система — gravity rift (ваши корабли не бросают за него). До 12 истребителей не считают против capacity. Production 7.',
  },
  {
    id: 'vortex', name: 'Vortex', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'pok', factionId: 'vuilraith',
    text: 'ACTION: истощить — выбрать чужой non-structure юнит в системе, смежной с ≥1 вашим space dock. Capture 1 юнит этого типа из подкреплений того игрока.',
  },

  // TE — Council Keleres (Executive Order replaces IIHQ; IIHQ moved to breakthrough)
  {
    id: 'iihq_modernization', name: 'Executive Order', color: 'yellow', kind: 'faction',
    prereqs: ['yellow'], source: 'te', factionId: 'keleres_argent',
    text: 'ACTION: истощить и взять верхнюю или нижнюю карту колоды agenda. Игроки сразу голосуют, как будто вы спикер; на эту agenda можете тратить ТГ и ресурсы как голоса.',
  },
  {
    id: 'agency_supply_network', name: 'Agency Supply Network', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'te', factionId: 'keleres_argent',
    text: 'Раз за действие, когда разрешаете Production юнита, можете также разрешить Production другого своего юнита в любой системе.',
  },
  {
    id: 'iihq_modernization_m', name: 'Executive Order', color: 'yellow', kind: 'faction',
    prereqs: ['yellow'], source: 'te', factionId: 'keleres_mentak',
    text: 'ACTION: истощить и взять верхнюю или нижнюю карту колоды agenda. Игроки сразу голосуют, как будто вы спикер; на эту agenda можете тратить ТГ и ресурсы как голоса.',
  },
  {
    id: 'agency_supply_network_m', name: 'Agency Supply Network', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'te', factionId: 'keleres_mentak',
    text: 'Раз за действие, когда разрешаете Production юнита, можете также разрешить Production другого своего юнита в любой системе.',
  },
  {
    id: 'iihq_modernization_x', name: 'Executive Order', color: 'yellow', kind: 'faction',
    prereqs: ['yellow'], source: 'te', factionId: 'keleres_xxcha',
    text: 'ACTION: истощить и взять верхнюю или нижнюю карту колоды agenda. Игроки сразу голосуют, как будто вы спикер; на эту agenda можете тратить ТГ и ресурсы как голоса.',
  },
  {
    id: 'agency_supply_network_x', name: 'Agency Supply Network', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'te', factionId: 'keleres_xxcha',
    text: 'Раз за действие, когда разрешаете Production юнита, можете также разрешить Production другого своего юнита в любой системе.',
  },

  // Thunder's Edge factions
  {
    id: 'exile_2', name: 'Exile II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue'], source: 'te', factionId: 'crimson',
    text: 'В конце боя любого игрока в этой системе или до 2 систем дальше можете разместить активный или неактивный breach в той системе. AFB 6×3. Cost 1, Combat 7, Move 2.',
  },
  {
    id: 'subatomic_splicer', name: 'Subatomic Splicer', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'te', factionId: 'crimson',
    text: 'Когда один из ваших кораблей уничтожен, можете произвести корабль того же типа у space dock в домашней системе.',
  },
  {
    id: 'hydrothermal_mining', name: 'Hydrothermal Mining', color: 'yellow', kind: 'faction',
    prereqs: ['yellow'], source: 'te', factionId: 'deepwrought',
    text: 'В начале фазы статуса получите 1 ТГ за каждую ocean-карту в игре.',
  },
  {
    id: 'radical_advancement', name: 'Radical Advancement', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'te', factionId: 'deepwrought',
    text: 'В начале фазы статуса можете заменить одну свою non-unit tech на tech того же цвета ровно с +1 пререквизитом.',
  },
  {
    id: 'plane_splitter', name: 'Planesplitter', color: 'blue', kind: 'faction',
    prereqs: ['blue', 'blue'], source: 'te', factionId: 'firmament',
    text: 'При получении выведите Fracture в игру. Переверните карту, если в игре Obsidian. (Obs.: в начале strategic actions можете переместить ingress token в систему с вашими юнитами или смежную.)',
  },
  {
    id: 'neural_parasite', name: 'Neural Parasite', color: 'green', kind: 'faction',
    prereqs: ['green', 'green'], source: 'te', factionId: 'firmament',
    text: 'В начале фазы статуса можете разместить 1 пехоту из подкреплений на планету под контролем в домашней системе. Переверните карту при Obsidian. (Obs.: в начале хода уничтожьте 1 чужую пехоту в/смежно с системой с вашей пехотой.)',
  },
  {
    id: 'heliosphere_v2', name: '4X41C "Helios" V2', color: null, kind: 'unit',
    prereqs: ['red', 'yellow'], source: 'te', factionId: 'bastion',
    text: 'Production = resource планеты +4. Resource планеты +2. До 3 истребителей не считают против capacity.',
  },
  {
    id: 'proxima_targeting', name: 'Proxima Targeting VI', color: 'red', kind: 'faction',
    prereqs: ['red', 'red'], source: 'te', factionId: 'bastion',
    text: 'Отменяйте 1 hit от Bombardment против ваших наземных за каждый ваш galvanized юнит здесь. В начале раунда наземного боя можете разрешить Bombardment 8×3 против чужих GF; если да — такой же бросок против своих GF.',
  },
  {
    id: 'linkship_2', name: 'Linkship II', color: null, kind: 'unit',
    prereqs: ['blue', 'blue'], source: 'te', factionId: 'ralnel',
    text: 'Может использовать Space Cannon одной вашей структуры в своей космической зоне; несколько linkship могут триггерить одну структуру. AFB 6×3. Cost 1, Combat 8, Move 4.',
  },
  {
    id: 'nanomachines', name: 'Nanomachines', color: 'yellow', kind: 'faction',
    prereqs: ['yellow', 'yellow'], source: 'te', factionId: 'ralnel',
    text: 'ACTION: истощить — разместить 1 PDS на планету под контролем. ACTION: истощить — починить все повреждённые юниты. ACTION: истощить и сбросить 1 КД — взять 1 КД.',
  },
];

/** @type {Tech[]} */
export const ALL_TECHNOLOGIES = Object.freeze([...GENERIC, ...UNIT_UPGRADES, ...FACTION_TECHS]);

export const TECH_BY_ID = Object.freeze(
  Object.fromEntries(ALL_TECHNOLOGIES.map(t => [t.id, t])),
);

/**
 * Fixed starting techs. Choice / research factions stay empty until
 * startingTechDraft completes after START_GAME.
 */
export const STARTING_TECH_BY_FACTION = Object.freeze({
  arborec: ['magen_defense_grid'],
  argent: [],
  letnev: ['antimass_deflectors', 'plasma_scoring'],
  saar: ['antimass_deflectors'],
  muaat: ['plasma_scoring'],
  hacan: ['antimass_deflectors', 'sarween_tools'],
  empyrean: ['dark_energy_tap'],
  sol: ['neural_motivator', 'antimass_deflectors'],
  creuss: ['gravity_drive'],
  l1z1x: ['neural_motivator', 'plasma_scoring'],
  mahact: ['bio_stims', 'predictive_intelligence'],
  mentak: ['sarween_tools', 'plasma_scoring'],
  naalu: ['neural_motivator', 'sarween_tools'],
  naazrokha: ['psychoarchaeology', 'ai_development_algorithm'],
  nekro: ['dacxive_animators', 'valefar_assimilator_x', 'valefar_assimilator_y'],
  nomad: ['sling_relay'],
  saardakk: [],
  titans: ['antimass_deflectors', 'scanlink_drone_network'],
  jolnar: ['neural_motivator', 'antimass_deflectors', 'sarween_tools', 'plasma_scoring'],
  vuilraith: ['self_assembly_routines'],
  winnu: [],
  xxcha: ['graviton_laser_system'],
  yin: ['sarween_tools'],
  yssaril: ['neural_motivator'],
  keleres_argent: [],
  keleres_mentak: [],
  keleres_xxcha: [],
  crimson: [],
  deepwrought: [],
  firmament: [],
  bastion: [],
  ralnel: [],
});

/**
 * Post-start draft rules.
 * kind: pick | research | fromOthers
 */
export const STARTING_TECH_CHOICES = Object.freeze({
  argent: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 2,
    options: Object.freeze(['neural_motivator', 'sarween_tools', 'plasma_scoring']),
  }),
  winnu: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 1,
    filter: Object.freeze({ maxPrereqs: 0 }),
  }),
  crimson: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 1,
    filter: Object.freeze({ colors: Object.freeze(['red', 'blue']), maxPrereqs: 0 }),
  }),
  firmament: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 1,
    filter: Object.freeze({ colors: Object.freeze(['green', 'yellow']), maxPrereqs: 0 }),
  }),
  bastion: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 1,
    filter: Object.freeze({ colors: Object.freeze(['blue', 'yellow']), maxPrereqs: 0 }),
  }),
  ralnel: Object.freeze({
    kind: 'pick',
    wave: 'A',
    pick: 1,
    filter: Object.freeze({ colors: Object.freeze(['red', 'green']), maxPrereqs: 0 }),
  }),
  deepwrought: Object.freeze({
    kind: 'research',
    wave: 'B',
    pick: 2,
  }),
  keleres_argent: Object.freeze({ kind: 'fromOthers', wave: 'C', pick: 2 }),
  keleres_mentak: Object.freeze({ kind: 'fromOthers', wave: 'C', pick: 2 }),
  keleres_xxcha: Object.freeze({ kind: 'fromOthers', wave: 'C', pick: 2 }),
});

export function startingTechIds(factionId) {
  if (!factionId) return [];
  const list = STARTING_TECH_BY_FACTION[factionId];
  return Array.isArray(list) ? [...list] : [];
}

export function startingTechChoice(factionId) {
  return STARTING_TECH_CHOICES[factionId] || null;
}

export function needsStartingTechDraft(factionId) {
  return !!startingTechChoice(factionId);
}

export function playersNeedingStartingTechDraft(players = []) {
  return players.filter(p => !p.eliminated && needsStartingTechDraft(p.factionId));
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(id => typeof id === 'string');
}

function matchesPickFilter(tech, filter = {}) {
  if (!tech || tech.kind === 'faction') return false;
  const prereqCount = Array.isArray(tech.prereqs) ? tech.prereqs.length : 0;
  if (filter.maxPrereqs != null && prereqCount > filter.maxPrereqs) return false;
  if (filter.exactPrereqs != null && prereqCount !== filter.exactPrereqs) return false;
  if (filter.colors?.length) {
    if (!tech.color || !filter.colors.includes(tech.color)) return false;
  }
  return true;
}

/** Tech ids already owned at the table for Keleres (others + confirmed draft picks). */
export function ownedTechIdsForKeleresPool(state, excludePlayerId) {
  const draft = state?.startingTechDraft;
  const ids = new Set();
  (state?.players || []).forEach((p) => {
    if (p.id === excludePlayerId || p.eliminated) return;
    const response = draft?.responses?.[p.id];
    if (response?.status === 'confirmed' && Array.isArray(response.picks)) {
      response.picks.forEach(id => ids.add(id));
      return;
    }
    (p.techIds || []).forEach(id => ids.add(id));
  });
  return [...ids];
}

export function isStartingTechWaveAReady(state) {
  const draft = state?.startingTechDraft;
  if (!draft?.active) return false;
  return (state.players || []).every((p) => {
    if (p.eliminated) return true;
    const choice = startingTechChoice(p.factionId);
    if (!choice || choice.wave !== 'A') return true;
    return draft.responses?.[p.id]?.status === 'confirmed';
  });
}

/**
 * Options for a seat during starting-tech draft.
 * @returns {string[]} tech ids
 */
export function startingTechOptions(factionId, state, { playerId, sessionPicks = [] } = {}) {
  const choice = startingTechChoice(factionId);
  if (!choice) return [];
  const usePok = !!state?.meta?.usePok;
  const useTe = !!state?.meta?.useTe;

  if (choice.options) {
    return [...choice.options].filter(id => {
      const tech = techById(id);
      if (!tech) return false;
      if (tech.source === 'pok' && !usePok) return false;
      if (tech.source === 'te' && !useTe) return false;
      return true;
    });
  }

  if (choice.kind === 'fromOthers') {
    return ownedTechIdsForKeleresPool(state, playerId).filter((id) => {
      const tech = techById(id);
      return tech && tech.kind !== 'faction';
    });
  }

  if (choice.kind === 'research') {
    const owned = [...sessionPicks];
    const player = (state?.players || []).find(p => p.id === playerId);
    const synergy = synergyForPlayer(factionId, player?.breakthrough, useTe);
    return availableTechs({ usePok, useTe, factionId })
      .filter(tech => canResearch(tech, owned, { synergyColors: synergy }))
      .map(t => t.id);
  }

  // Filtered pick from catalog (Winnu / TE color picks)
  return availableTechs({ usePok, useTe, factionId: null })
    .filter(tech => !tech.factionId && matchesPickFilter(tech, choice.filter))
    .map(t => t.id);
}

/** Sanitize picks against current options (and research legality for Deepwrought). */
export function sanitizeStartingTechPicks(factionId, picks, state = null, opts = {}) {
  const choice = startingTechChoice(factionId);
  if (!choice) return [];
  const playerId = opts.playerId ?? null;
  const raw = asStringArray(picks);
  const unique = [];

  if (choice.kind === 'research') {
    const player = (state?.players || []).find(p => p.id === playerId);
    const synergy = synergyForPlayer(
      factionId,
      player?.breakthrough,
      !!state?.meta?.useTe,
    );
    for (const id of raw) {
      if (unique.includes(id)) continue;
      const tech = techById(id);
      if (!canResearch(tech, unique, { synergyColors: synergy })) continue;
      unique.push(id);
      if (unique.length >= choice.pick) break;
    }
    return unique;
  }

  const allowed = new Set(
    state
      ? startingTechOptions(factionId, state, { playerId, sessionPicks: [] })
      : (choice.options || []),
  );
  for (const id of raw) {
    if (!allowed.has(id) || unique.includes(id)) continue;
    unique.push(id);
    if (unique.length >= choice.pick) break;
  }
  return unique;
}

export function hasValidStartingTechChoice(player, state = null) {
  if (!player?.factionId) return true;
  const choice = startingTechChoice(player.factionId);
  if (!choice) return true;
  const picks = state
    ? (state.startingTechDraft?.responses?.[player.id]?.picks
      ?? player.startingTechIds)
    : player.startingTechIds;
  const clean = sanitizeStartingTechPicks(player.factionId, picks, state, {
    playerId: player.id,
  });
  if (choice.kind === 'fromOthers') {
    const pool = startingTechOptions(player.factionId, state, { playerId: player.id });
    const needed = Math.min(choice.pick, pool.length);
    return clean.length === needed;
  }
  return clean.length === choice.pick;
}

export function canConfirmStartingTech(player, state) {
  if (!player || !state?.startingTechDraft?.active) return false;
  const choice = startingTechChoice(player.factionId);
  if (!choice) return false;
  if (choice.wave === 'C' && !isStartingTechWaveAReady(state)) return false;
  const response = state.startingTechDraft.responses?.[player.id];
  if (response?.status === 'confirmed') return false;
  return hasValidStartingTechChoice(player, state);
}

/** Fixed list only — choice factions start empty until draft applies. */
export function resolveStartingTechIds(player) {
  if (!player?.factionId) return [];
  if (startingTechChoice(player.factionId)) return [];
  return startingTechIds(player.factionId);
}

export function techById(id) {
  return TECH_BY_ID[id] || null;
}

/**
 * Techs visible for a seat given expansions and faction.
 */
export function availableTechs({ usePok = false, useTe = false, factionId = null } = {}) {
  return ALL_TECHNOLOGIES.filter(tech => {
    if (tech.source === 'pok' && !usePok) return false;
    if (tech.source === 'te' && !useTe) return false;
    if (tech.factionId && tech.factionId !== factionId) return false;
    return true;
  });
}

export function ownedColorCounts(ownedIds) {
  const counts = { green: 0, blue: 0, yellow: 0, red: 0 };
  for (const id of ownedIds || []) {
    const tech = TECH_BY_ID[id];
    if (!tech || tech.kind === 'unit') continue;
    if (tech.color && counts[tech.color] != null) counts[tech.color] += 1;
  }
  return counts;
}

function prereqNeed(prereqs) {
  const need = { green: 0, blue: 0, yellow: 0, red: 0 };
  for (const c of prereqs || []) {
    if (need[c] != null) need[c] += 1;
  }
  return need;
}

function colorDeficit(need, counts) {
  let missing = 0;
  for (const color of TECH_COLORS) {
    const gap = (need[color] || 0) - (counts[color] || 0);
    if (gap > 0) missing += gap;
  }
  return missing;
}

function withSynergyRemap(counts, from, to) {
  return {
    ...counts,
    [from]: 0,
    [to]: (counts[from] || 0) + (counts[to] || 0),
  };
}

/**
 * @param {Tech} tech
 * @param {string[]} ownedIds
 * @param {{ synergyColors?: [TechColor, TechColor]|null, ignoreCount?: number }} [opts]
 */
export function canResearch(tech, ownedIds, opts = {}) {
  if (!tech) return false;
  const owned = new Set(ownedIds || []);
  if (owned.has(tech.id)) return false;

  const ignoreCount = Math.max(0, Number(opts.ignoreCount) || 0);
  const need = prereqNeed(tech.prereqs);
  const baseCounts = ownedColorCounts(ownedIds);
  const synergy = opts.synergyColors;

  if (colorDeficit(need, baseCounts) <= ignoreCount) return true;
  if (!synergy || synergy.length !== 2) return false;

  const [a, b] = synergy;
  if (colorDeficit(need, withSynergyRemap(baseCounts, a, b)) <= ignoreCount) return true;
  if (colorDeficit(need, withSynergyRemap(baseCounts, b, a)) <= ignoreCount) return true;
  return false;
}

/** Human-readable gap for UI error when research is blocked. */
export function prereqGapMessage(tech, ownedIds, opts = {}) {
  if (!tech) return 'Технология не найдена';
  if ((ownedIds || []).includes(tech.id)) return 'Эта технология уже изучена';
  if (!tech.prereqs?.length) return '';
  const need = prereqNeed(tech.prereqs);
  const counts = ownedColorCounts(ownedIds);
  const synergy = opts.synergyColors;
  let best = counts;
  if (synergy?.length === 2) {
    const [a, b] = synergy;
    const c1 = withSynergyRemap(counts, a, b);
    const c2 = withSynergyRemap(counts, b, a);
    best = colorDeficit(need, c1) <= colorDeficit(need, c2) ? c1 : c2;
  }
  const missing = [];
  for (const color of TECH_COLORS) {
    const gap = (need[color] || 0) - (best[color] || 0);
    if (gap > 0) {
      const label = TECH_COLOR_META[color]?.label || color;
      missing.push(`${gap}× ${label}`);
    }
  }
  if (!missing.length) return '';
  return `Не хватает пререквизитов: ${missing.join(', ')}`;
}

export function synergyForPlayer(factionId, breakthrough, useTe) {
  if (!useTe || !breakthrough || !factionId) return null;
  const pair = BREAKTHROUGH_SYNERGY[factionId];
  return pair ? [...pair] : null;
}

/** Synergy opts for research from a seated player + game meta. */
export function researchSynergyOpts(player, state) {
  return {
    synergyColors: synergyForPlayer(
      player?.factionId,
      player?.breakthrough,
      !!state?.meta?.useTe,
    ),
  };
}

export function maxResearchSlots(mode) {
  return mode === 'primary' ? 2 : 1;
}
