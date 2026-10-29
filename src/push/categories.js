/** Push notification category ids and reason → category mapping (needsAction reasons). */

export const PUSH_PREFS_CACHE = 'ti4-push-prefs';
export const PUSH_PREFS_URL = '/ti4-push-prefs.json';

export const PUSH_CATEGORIES = [
  {
    id: 'turn',
    label: 'Ваш ход',
    desc: 'Когда наступает ваш ход в фазе действий',
  },
  {
    id: 'milty',
    label: 'Milty Draft',
    desc: 'Ваш ход в драфте слайсов и фракций',
  },
  {
    id: 'combat',
    label: 'Бой',
    desc: 'Попадания, назначение урона, действия хоста',
  },
  {
    id: 'strategy',
    label: 'Ответ по стратегии',
    desc: 'Подтверждение или отказ от эффекта карты',
  },
  {
    id: 'scoring',
    label: 'Скоринг и Imperial',
    desc: 'Заявление целей и выбор по Imperial',
  },
  {
    id: 'tech',
    label: 'Технологии',
    desc: 'Исследование и стартовый выбор технологий',
  },
  {
    id: 'politics',
    label: 'Политика',
    desc: 'Голосование, влияние и выбор спикера',
  },
  {
    id: 'expedition',
    label: 'Экспедиция',
    desc: 'Контроль Thunder\'s Edge',
  },
];

export function defaultPushCategories() {
  const out = {};
  for (const cat of PUSH_CATEGORIES) out[cat.id] = true;
  return out;
}

/**
 * Map a needsAction reason string to a category id.
 * @param {string|null|undefined} reason
 * @returns {string|null}
 */
export function reasonToCategory(reason) {
  if (!reason || typeof reason !== 'string') return null;
  if (reason === 'turn') return 'turn';
  if (reason === 'milty-turn' || reason === 'milty-done') return 'milty';
  if (reason.startsWith('combat')) return 'combat';
  if (reason === 'strategy-resolution') return 'strategy';
  if (reason === 'scoring' || reason === 'imperial') return 'scoring';
  if (reason === 'tech' || reason === 'starting-tech') return 'tech';
  if (reason.startsWith('politics')) return 'politics';
  if (reason === 'expedition') return 'expedition';
  return null;
}

/**
 * @param {Record<string, boolean>|null|undefined} categories
 * @param {string|null|undefined} reason
 */
export function isPushReasonAllowed(categories, reason) {
  const cat = reasonToCategory(reason);
  if (!cat) return true; // unknown reasons still show
  if (!categories || typeof categories !== 'object') return true;
  return categories[cat] !== false;
}
