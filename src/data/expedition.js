/** Official expedition face (claim wells). */
export const EXPEDITION_TOKEN_SRC = '/expedition/thunders-edge-expedition.png?v=27';
/** Planet face after expedition completes. */
export const EXPEDITION_PLANET_SRC = '/expedition/thunders-edge-planet.png';

/**
 * Thunder's Edge expedition slices (clockwise from top).
 * `crest` = desktop dock; `crestMobile` = phone sheet (optional override).
 */
export const EXPEDITION_SLICES = [
  {
    id: 'resources',
    label: '5 ресурсов',
    short: '5⚙',
    hint: 'Потратить 5 ресурсов',
    angleDeg: -90,
    crest: { left: 50, top: 12.42, size: 17.2 },
    crestMobile: { left: 50, top: 12.42, size: 17.2 },
  },
  {
    id: 'actionCards',
    label: '2 карты действий',
    short: '2 КД',
    hint: 'Сбросить 2 карты действий',
    angleDeg: -30,
    crest: { left: 83.96, top: 32.23, size: 15.1 },
    crestMobile: { left: 84.16, top: 31.41, size: 16.9 },
  },
  {
    id: 'influence',
    label: '5 влияния',
    short: '5 влияние',
    hint: 'Потратить 5 влияния',
    angleDeg: 30,
    crest: { left: 84.91, top: 66.51, size: 16.4 },
    crestMobile: { left: 84.21, top: 67.29, size: 16.9 },
  },
  {
    id: 'secret',
    label: 'Секретная цель',
    short: 'Секрет',
    hint: 'Сбросить незасчитанную секретную цель',
    angleDeg: 90,
    crest: { left: 49.69, top: 86.32, size: 17.2 },
    crestMobile: { left: 49.75, top: 86.18, size: 18.4 },
  },
  {
    id: 'techPlanet',
    label: 'Tech-планета',
    short: 'Tech',
    hint: 'Истощить планету со спец. технологией',
    angleDeg: 150,
    crest: { left: 14.78, top: 66.51, size: 16.7 },
    crestMobile: { left: 15.81, top: 67.49, size: 16.7 },
  },
  {
    id: 'tradeGoods',
    label: '3 торговых товара',
    short: '3 ТГ',
    hint: 'Потратить 3 торговых товара',
    angleDeg: 210,
    crest: { left: 16.04, top: 31.6, size: 16.4 },
    crestMobile: { left: 16.04, top: 31.6, size: 16.4 },
  },
];

/** Pick crest layout for current viewport (mobile override when calibrated). */
export function crestForSlice(slice, isMobile) {
  if (isMobile && slice.crestMobile) return slice.crestMobile;
  return slice.crest;
}

export const EXPEDITION_SLICE_IDS = EXPEDITION_SLICES.map(s => s.id);

export function emptyExpeditionSlices() {
  const slices = {};
  EXPEDITION_SLICE_IDS.forEach(id => {
    slices[id] = null;
  });
  return slices;
}
