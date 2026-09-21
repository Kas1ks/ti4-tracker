/**
 * Thunder's Edge breakthroughs — official ability text (RU) + color synergy.
 * Synergy: treat either listed color as the other for research / tech objectives (not both).
 */

/** @typedef {'green'|'blue'|'yellow'|'red'} TechColor */

/**
 * @typedef {object} Breakthrough
 * @property {string} name
 * @property {string} text
 * @property {[TechColor, TechColor]|null} synergy
 * @property {boolean} [startsUnlocked]
 */

/** @type {Readonly<Record<string, Breakthrough>>} */
export const BREAKTHROUGHS = Object.freeze({
  arborec: Object.freeze({
    name: 'Psychospore',
    synergy: Object.freeze(['red', 'green']),
    text: 'ACTION: истощить — снять жетон приказа из системы с ≥1 вашей пехотой и вернуть его в подкрепления. Затем разместить 1 пехоту в этой системе.',
  }),
  argent: Object.freeze({
    name: 'Wing Transfer',
    synergy: Object.freeze(['blue', 'yellow']),
    text: 'Когда активируете систему только со своими юнитами, можете положить жетоны приказа из подкреплений в смежные системы только со своими юнитами; в конце действия можете перемещать корабли между активной и этими смежными системами с вашими жетонами.',
  }),
  bastion: Object.freeze({
    name: 'The Icon',
    synergy: Object.freeze(['red', 'yellow']),
    text: 'Когда производите корабли, можете истощить эту карту, чтобы разместить их в системе с вашим жетоном приказа, ≥1 вашим наземным отрядом и без чужих кораблей.',
  }),
  creuss: Object.freeze({
    name: 'Particle Synthesis',
    synergy: Object.freeze(['blue', 'yellow']),
    text: 'Каждый wormhole в системе с вашими кораблями получает Production 1, как будто это ваш юнит. Снижайте суммарную стоимость производства в системах с wormhole на 1 за каждый wormhole в системе.',
  }),
  crimson: Object.freeze({
    name: 'Resonance Generator',
    synergy: Object.freeze(['blue', 'red']),
    startsUnlocked: true,
    text: 'В тактических действиях +1 Move кораблям, начинающим движение в домашней системе или в системе с активным breach. ACTION: истощить — перевернуть любой breach или разместить активный breach в не-домашней системе с вашими юнитами.',
  }),
  deepwrought: Object.freeze({
    name: 'Visionaria Select',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'ACTION: истощить — каждый другой игрок может потратить 3 ТГ и отдать вам 1 promissory. Каждый сделавший это исследует 1 non-faction non-unit tech. Вы также получаете каждую исследованную так tech.',
  }),
  empyrean: Object.freeze({
    name: 'Void Tether',
    synergy: Object.freeze(['green', 'blue']),
    text: 'Когда активируете систему, содержащую или смежную с вашим юнитом/планетой, можете разместить или переместить 1 void tether token на общую границу с другой системой; другие игроки не считают эти системы смежными, пока вы не разрешите.',
  }),
  firmament: Object.freeze({
    name: 'The Sowing / The Reaping',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'The Sowing: при получении и в начале фазы статуса можете положить до 3 своих ТГ на эту карту. При становлении Obsidian карта переворачивается в The Reaping: +1 ТГ с запаса за победу в бою против puppeted; в начале статуса заберите ТГ с карты и столько же с запаса.',
  }),
  hacan: Object.freeze({
    name: 'Auto-Factories',
    synergy: Object.freeze(['red', 'yellow']),
    text: 'Когда производите ≥3 non-fighter корабля, положите 1 жетон приказа из подкреплений в ваш fleet pool.',
  }),
  jolnar: Object.freeze({
    name: 'Specialized Compounds',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'При исследовании через карту «Технологии» можете истощить планету со спец. tech вместо ресурсов; тогда обязаны исследовать tech этого цвета.',
  }),
  keleres_argent: Object.freeze({
    name: 'I.I.H.Q. Modernization',
    synergy: Object.freeze(['green', 'yellow']),
    text: 'При получении возьмите планету Custodia Vigilia и её legendary ability. Вы соседи со всеми, у кого есть юниты или планеты в системе Mecatol Rex или смежных. (Пока контролируете Mecatol: Space Cannon 5 и Production 3; +2 CT, когда другой игрок берёт VP по 2-й части Imperial.)',
  }),
  keleres_mentak: Object.freeze({
    name: 'I.I.H.Q. Modernization',
    synergy: Object.freeze(['green', 'yellow']),
    text: 'При получении возьмите планету Custodia Vigilia и её legendary ability. Вы соседи со всеми, у кого есть юниты или планеты в системе Mecatol Rex или смежных. (Пока контролируете Mecatol: Space Cannon 5 и Production 3; +2 CT, когда другой игрок берёт VP по 2-й части Imperial.)',
  }),
  keleres_xxcha: Object.freeze({
    name: 'I.I.H.Q. Modernization',
    synergy: Object.freeze(['green', 'yellow']),
    text: 'При получении возьмите планету Custodia Vigilia и её legendary ability. Вы соседи со всеми, у кого есть юниты или планеты в системе Mecatol Rex или смежных. (Пока контролируете Mecatol: Space Cannon 5 и Production 3; +2 CT, когда другой игрок берёт VP по 2-й части Imperial.)',
  }),
  l1z1x: Object.freeze({
    name: 'Fealty Uplink',
    synergy: Object.freeze(['red', 'green']),
    text: 'Когда получаете контроль над планетой, разместите на ней пехоту из подкреплений равную значению influence этой планеты.',
  }),
  letnev: Object.freeze({
    name: 'Grav-Leash Maneuvers',
    synergy: Object.freeze(['blue', 'red']),
    text: 'Перед бросками в космическом бою +X к результатам бросков 1 вашего корабля, где X — число типов кораблей у вас в бою. Во время движения Move non-fighter кораблей равен наивысшему Move среди двигающихся кораблей в системе, откуда они стартовали.',
  }),
  mahact: Object.freeze({
    name: 'Vaults of the Heir',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'ACTION: истощить и purge 1 вашей технологии — получить 1 relic.',
  }),
  mentak: Object.freeze({
    name: "The Table's Grace",
    synergy: null,
    text: 'Если у вас есть Cruiser II, переверните эту карту и положите поверх Cruiser II → Corsair: Capacity 2, Move 3, Combat 6; может двигаться через системы с чужими кораблями, если в активной системе есть чужие non-fighter корабли.',
  }),
  muaat: Object.freeze({
    name: 'Stellar Genesis',
    synergy: Object.freeze(['red', 'yellow']),
    text: 'При получении разместите жетон планеты Avernus в не-домашней системе, смежной с вашей планетой; получите контроль и ready. После движения вашего War Sun из/через систему Avernus в не-домашнюю систему можете переместить Avernus вместе с ним.',
  }),
  naalu: Object.freeze({
    name: 'Mindsieve',
    synergy: Object.freeze(['green', 'red']),
    text: 'Когда собираетесь выполнить secondary чужой карты стратегии, можете отдать этому игроку promissory, чтобы выполнить её без траты жетона приказа.',
  }),
  naazrokha: Object.freeze({
    name: 'Absolute Synergy',
    synergy: Object.freeze(['green', 'blue']),
    text: 'Когда у вас 4 меха в одной системе, можете вернуть 3 меха в подкрепления, чтобы перевернуть эту карту и положить её поверх карты меха → Eidolon Maximum (корабль и наземный отряд; особые правила боя и размещения).',
  }),
  nekro: Object.freeze({
    name: 'Valefar Assimilator Z',
    synergy: null,
    text: 'Когда получаете чужую tech через фракционную способность, можете вместо этого положить assimilator Z на фракционный лист того игрока. Ваш флагман получает текстовые способности флагмана этой фракции в дополнение к своим.',
  }),
  nomad: Object.freeze({
    name: "Thunder's Paradox",
    synergy: Object.freeze(['green', 'yellow']),
    text: 'В начале хода любого игрока можете истощить 1 своего агента, чтобы ready любого другого агента.',
  }),
  ralnel: Object.freeze({
    name: 'Data Skimmer',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'В фазе действий, пока вы не спасовали, чужие action cards сбрасываются на эту карту. Когда пасуете — возьмите 1 КД с этой карты в руку и сбросьте остальные.',
  }),
  saar: Object.freeze({
    name: 'Deorbit Barrage',
    synergy: Object.freeze(['blue', 'red']),
    text: 'ACTION: истощить и потратить любое число ресурсов — выбрать планету до 2 систем от asteroid field с вашими кораблями; бросьте столько кубов, сколько потратили, и назначьте 1 hit наземному отряду на планете за каждый результат ≥4.',
  }),
  saardakk: Object.freeze({
    name: "N'orr Supremacy",
    synergy: Object.freeze(['blue', 'red']),
    text: 'После победы в бою либо получите 1 жетон приказа, либо исследуйте 1 unit upgrade technology.',
  }),
  sol: Object.freeze({
    name: 'Bellum Gloriosum',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'Когда производите корабль с capacity, можете также произвести любую комбинацию наземных отрядов или истребителей до capacity этого корабля; они не считаются против лимита Production.',
  }),
  titans: Object.freeze({
    name: 'Slumberstate Computing',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'Когда Coalescence приводит к наземному бою и вы не коммитите других юнитов, можете выбрать сосуществование вместо боя. В фазе статуса за каждого игрока, с которым сосуществуете, вы и он берёте +1 КД. Другие могут разрешить вам положить sleeper на планету под их контролем.',
  }),
  vuilraith: Object.freeze({
    name: "Al'raith Ix Ianovar",
    synergy: Object.freeze(['red', 'green']),
    text: 'Выводит Fracture в игру без броска (если ещё нет). После появления карты переместите до 2 ingress tokens в системы с gravity rift. +1 Move каждому вашему кораблю, начинающему движение в Fracture.',
  }),
  winnu: Object.freeze({
    name: 'Imperator',
    synergy: Object.freeze(['blue', 'red']),
    text: '+1 к результатам боевых бросков ваших юнитов за каждый «Support for the Throne» в зоне противника. После активации системы с легендарной планетой +1 Move одному кораблю в этом тактическом действии.',
  }),
  xxcha: Object.freeze({
    name: "Archon's Gift",
    synergy: Object.freeze(['yellow', 'green']),
    text: 'Можете тратить influence как resources и resources как influence.',
  }),
  yin: Object.freeze({
    name: 'Yin Ascendant',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'Когда получаете эту карту или score public objective — получите alliance-способность случайной неиспользованной фракции.',
  }),
  yssaril: Object.freeze({
    name: 'Deepgloom Executable',
    synergy: Object.freeze(['yellow', 'green']),
    text: 'Можете разрешить другим использовать ваши Stall Tactics или Scheming; при этом можете провести сделку с этим игроком. В фазе действий эта сделка не считается против лимита «один раз за ход на игрока».',
  }),
});

/** Color pairs only (for research prereq remap). */
export const BREAKTHROUGH_SYNERGY = Object.freeze(
  Object.fromEntries(
    Object.entries(BREAKTHROUGHS)
      .filter(([, bt]) => Array.isArray(bt.synergy) && bt.synergy.length === 2)
      .map(([id, bt]) => [id, bt.synergy]),
  ),
);

export function breakthroughByFaction(factionId) {
  if (!factionId) return null;
  return BREAKTHROUGHS[factionId] || null;
}

export function breakthroughStartsUnlocked(factionId) {
  return !!breakthroughByFaction(factionId)?.startsUnlocked;
}
