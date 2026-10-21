/**
 * Faction reference sheets.
 * Mechanical text is a careful RU translation of official TI4 ability wording
 * (cross-checked against twilight-imperium.fandom.com faction pages).
 * Not a verbatim dump of wiki prose/lore.
 */

import { ALL_FACTIONS } from './gameData';
import { breakthroughByFaction } from './breakthroughs';

export function factionWikiUrl(slug) {
  if (!slug) return 'https://twilight-imperium.fandom.com/wiki/Twilight_Imperium_Wiki';
  return `https://twilight-imperium.fandom.com/wiki/${slug}`;
}

export function getFactionGuide(factionId) {
  if (!factionId) return null;
  const base = FACTION_GUIDE[factionId];
  if (!base) return null;
  const bt = breakthroughByFaction(factionId);
  if (!bt || base.breakthrough) return base;
  return {
    ...base,
    breakthrough: {
      name: bt.name,
      short: bt.text,
      text: bt.text,
    },
  };
}

export function listGuidedFactions() {
  return ALL_FACTIONS
    .filter((f) => FACTION_GUIDE[f.id])
    .map((f) => ({
      ...f,
      guide: FACTION_GUIDE[f.id],
    }));
}

export const FACTION_GUIDE = {
  sol: {
    id: 'sol',
    wikiSlug: 'Federation_of_Sol',
    source: 'https://twilight-imperium.fandom.com/wiki/Federation_of_Sol',
    blurb: 'Сильные пехота и носители. Дополнительный жетон приказа в статусе.',
    commodities: 4,
    complexity: 'Низкая',
    complexityLevel: 1,
    homePlanets: [
      { name: 'Jord', resources: 4, influence: 2 },
    ],
    startingUnits: [
      '2 носителя',
      '1 эсминец',
      '3 истребителя',
      '5 пехоты',
      '1 космопорт',
    ],
    startingTech: ['Neural Motivator', 'Antimass Deflectors'],
    abilities: [
      {
        name: 'Orbital Drop',
        short: 'ACTION: 1 жетон из стратегического пула → 2 пехоты на вашу планету.',
        text: 'ACTION: потратьте 1 жетон из стратегического пула, чтобы разместить 2 пехоты из подкреплений на 1 планете, которую вы контролируете.',
      },
      {
        name: 'Versatile',
        short: 'В фазе статуса получаете +1 жетон приказа.',
        text: 'Когда в фазе статуса вы получаете жетоны приказов, получите 1 дополнительный жетон приказа.',
      },
    ],
    promissory: {
      name: 'Military Support',
      short: 'В начале хода Сол: снимите 1 жетон из его стратегии (если есть); вы можете поставить 2 пехоты. Верните карту Сол.',
      text: 'В начале хода игрока Сол: снимите 1 жетон из его стратегического пула (если возможно) и верните в подкрепления. Затем вы можете разместить 2 пехоты из подкреплений на любой контролируемой вами планете. Затем верните эту карту игроку Сол.',
    },
    factionTech: [
      {
        name: 'Spec Ops II',
        short: 'Пехота: бой 6. После уничтожения на 5+ возвращается на родину в начале вашего следующего хода.',
        text: 'Улучшение пехоты (бой 6). После уничтожения бросьте 1 куб: на 5+ положите юнит на эту карту. В начале вашего следующего хода разместите каждый юнит с этой карты на планете в вашей родной системе, которую вы контролируете.',
      },
      {
        name: 'Advanced Carrier II',
        short: 'Носитель: ход 2, вместимость 8, Sustain Damage.',
        text: 'Улучшение носителя: ход 2, вместимость 8, Sustain Damage. (Advanced Carrier I: вместимость 6.)',
      },
    ],
    leaders: {
      agent: {
        name: 'Evelyn Delouis',
        unlock: 'Со старта',
        short: 'В начале раунда наземного боя: +1 куб выбранной наземной силе.',
        text: 'В начале раунда наземного боя: исчерпайте карту, чтобы выбрать 1 наземную силу в активной системе; в этом раунде боя она бросает на 1 куб больше.',
      },
      commander: {
        name: 'Claire Gibson',
        unlock: 'Планеты суммарно ≥ 12 ресурсов',
        short: 'В начале наземного боя на вашей планете: +1 пехота туда.',
        text: 'В начале наземного боя на планете, которую вы контролируете: можете разместить 1 пехоту из подкреплений на этой планете.',
      },
      hero: {
        name: 'Jace X. 4th Air Legion',
        unlock: '3 засчитанные цели',
        short: 'ACTION: верните все свои жетоны приказов с поля в подкрепления. Уничтожьте карту.',
        text: 'HELIO COMMAND ARRAY — ACTION: снимите каждый свой жетон приказа с игрового поля и верните в подкрепления. Затем уничтожьте (purge) эту карту.',
      },
    },
    flagship: {
      name: 'Genesis',
      cost: 8,
      combat: '5×2',
      move: 1,
      capacity: 12,
      short: 'Sustain. В конце статуса: +1 пехота в космос этой системы.',
      abilities: 'Sustain Damage. В конце фазы статуса разместите 1 пехоту из подкреплений в космическую область этой системы.',
    },
    mech: {
      name: 'ZS Thunderbolt M2',
      cost: 2,
      combat: 6,
      short: 'DEPLOY: после Orbital Drop можете потратить 3 ресурса → 1 мех на ту планету.',
      text: 'DEPLOY: после использования способности Orbital Drop можете потратить 3 ресурса, чтобы разместить 1 мех на этой планете. Sustain Damage.',
    },
  },

  jolnar: {
    id: 'jolnar',
    wikiSlug: 'Universities_of_Jol-Nar',
    source: 'https://twilight-imperium.fandom.com/wiki/Universities_of_Jol-Nar',
    blurb: 'Сильный research. Штраф −1 ко всем броскам боя.',
    commodities: 4,
    complexity: 'Низкая',
    complexityLevel: 1,
    homePlanets: [
      { name: 'Jol', resources: 1, influence: 2 },
      { name: 'Nar', resources: 2, influence: 3 },
    ],
    startingUnits: [
      '1 дредноут',
      '2 носителя',
      '1 истребитель',
      '2 пехоты',
      '1 космопорт',
      '2 PDS',
    ],
    startingTech: [
      'Neural Motivator',
      'Antimass Deflectors',
      'Sarween Tools',
      'Plasma Scoring',
    ],
    abilities: [
      {
        name: 'Fragile',
        short: 'К каждому броску боя ваших юнитов −1.',
        text: 'Применяйте −1 к результату каждого броска боя ваших юнитов.',
      },
      {
        name: 'Brilliant',
        short: 'Вторичка «Технологии» за жетон → можете сыграть первичку.',
        text: 'Когда вы тратите жетон приказа, чтобы сыграть вторичную способность карты стратегии «Технологии», можете вместо этого сыграть первичную способность.',
      },
      {
        name: 'Analytical',
        short: 'При research (не unit upgrade) игнорируйте 1 пререквизит.',
        text: 'Когда вы исследуете технологию, которая не является улучшением юнита, можете игнорировать 1 пререквизит.',
      },
    ],
    promissory: {
      name: 'Research Agreement',
      short: 'После research Джол-Нара (не расовая тех.): получите ту же технологию. Верните карту.',
      text: 'После того как игрок Джол-Нар исследовал технологию, которая не является расовой технологией: получите эту технологию. Затем верните эту карту игроку Джол-Нар.',
    },
    factionTech: [
      {
        name: 'E-Res Siphons',
        short: 'Другой игрок активировал систему с вашими кораблями → +4 TG.',
        text: 'После того как другой игрок активировал систему, содержащую 1 или более ваших кораблей, получите 4 торговых товара.',
      },
      {
        name: 'Spatial Conduit Cylinder',
        short: 'После активации своей системы: она смежна со всеми системами с вашими юнитами в этой активации.',
        text: 'Можете исчерпать эту карту после активации системы, содержащей 1 или более ваших юнитов; во время этой активации эта система считается смежной со всеми другими системами, содержащими 1 или более ваших юнитов.',
      },
    ],
    leaders: {
      agent: {
        name: 'Doctor Sucaban',
        unlock: 'Со старта',
        short: 'При трате ресурсов на research: снимайте пехоту → −1 ресурса за каждую.',
        text: 'Когда игрок тратит ресурсы на исследование: исчерпайте карту, чтобы позволить этому игроку снять любое число своей пехоты с поля. За каждый снятый юнит уменьшите потраченные ресурсы на 1.',
      },
      commander: {
        name: 'Ta Zern',
        unlock: 'Владейте 8 технологиями',
        short: 'После бросков кубов способности юнита можете перебросить любые из них.',
        text: 'После того как вы бросили кубы для способности юнита: можете перебросить любые из этих кубов.',
      },
      hero: {
        name: 'Rin, The Master’s Legacy',
        unlock: '3 засчитанные цели',
        short: 'ACTION: замените каждую не-upgrade технологию на любую того же цвета. Уничтожьте карту.',
        text: 'GENETIC MEMORY — ACTION: за каждую технологию (не улучшение юнита), которой вы владеете, можете заменить её на любую технологию того же цвета из колоды. Затем уничтожьте (purge) эту карту.',
      },
    },
    flagship: {
      name: 'J.N.S. Hylarim',
      cost: 8,
      combat: '6×2',
      move: 1,
      capacity: 3,
      short: 'Sustain. Нат. 9 или 10 (до модификаторов) → ещё +2 попадания.',
      abilities: 'Sustain Damage. При броске боя этого корабля каждый результат 9 или 10 (до модификаторов) даёт 2 дополнительных попадания.',
    },
    mech: {
      name: 'Shield Paling',
      cost: 2,
      combat: 6,
      short: 'Пехота на этой планете не получает Fragile. Sustain.',
      text: 'Ваша пехота на этой планете не подвержена способности Fragile. Sustain Damage.',
    },
  },

  hacan: {
    id: 'hacan',
    wikiSlug: 'Emirates_of_Hacan',
    source: 'https://twilight-imperium.fandom.com/wiki/Emirates_of_Hacan',
    blurb: 'Торговля без соседей; в сделках можно менять карты действий.',
    commodities: 6,
    complexity: 'Низкая',
    complexityLevel: 1,
    homePlanets: [
      { name: 'Arretze', resources: 2, influence: 0 },
      { name: 'Hercant', resources: 1, influence: 1 },
      { name: 'Kamdorn', resources: 0, influence: 1 },
    ],
    startingUnits: [
      '2 носителя',
      '1 крейсер',
      '2 истребителя',
      '4 пехоты',
      '1 космопорт',
    ],
    startingTech: ['Antimass Deflectors', 'Sarween Tools'],
    abilities: [
      {
        name: 'Masters of Trade',
        short: 'Вторичку «Торговли» можно сыграть без жетона приказа.',
        text: 'Вам не нужно тратить жетон приказа, чтобы сыграть вторичную способность карты стратегии «Торговля».',
      },
      {
        name: 'Guild Ships',
        short: 'Можете заключать сделки с игроками, которые не ваши соседи.',
        text: 'Вы можете вести переговоры о сделках с игроками, которые не являются вашими соседями.',
      },
      {
        name: 'Arbiters',
        short: 'В сделке можно обменивать карты действий.',
        text: 'Когда вы ведёте переговоры о сделке, карты действий могут быть частью обмена.',
      },
    ],
    promissory: {
      name: 'Trade Convoys',
      short: 'ACTION: лицо вверх — торгуйте с несоседями. Активация системы с юнитами Хакана → верните карту.',
      text: 'ACTION: положите эту карту лицом вверх в свою игровую зону. Пока карта там, вы можете вести сделки с несоседями. Если вы активируете систему, содержащую 1 или более юнитов игрока Хакан, верните карту игроку Хакан.',
    },
    factionTech: [
      {
        name: 'Production Biomes',
        short: 'ACTION: исчерпайте + 1 жетон стратегии → +4 TG вам, +2 TG другому.',
        text: 'ACTION: исчерпайте эту карту и потратьте 1 жетон из стратегического пула, чтобы получить 4 торговых товара и выбрать 1 другого игрока; этот игрок получает 2 торговых товара.',
      },
      {
        name: 'Quantum Datahub Node',
        short: 'Конец стратегии: 1 жетон + отдайте 3 TG → обмен одной картой стратегии.',
        text: 'В конце фазы стратегии можете потратить 1 жетон из стратегического пула и отдать другому игроку 3 своих торговых товара. Если так — отдайте ему 1 свою карту стратегии и возьмите 1 его карту стратегии.',
      },
    ],
    leaders: {
      agent: {
        name: 'Carth of Golden Sands',
        unlock: 'Со старта',
        short: 'В фазе действий: +2 commodities себе или пополнить commodities другого.',
        text: 'В фазе действий: исчерпайте карту, чтобы получить 2 commodities или пополнить commodities другого игрока.',
      },
      commander: {
        name: 'Gila the Silvertongue',
        unlock: 'Имейте 10 торговых товаров',
        short: 'При голосовании: любой число TG → +2 голоса за каждый.',
        text: 'Когда вы отдаёте голоса: можете потратить любое число торговых товаров; за каждый потраченный получите 2 дополнительных голоса.',
      },
      hero: {
        name: 'Harrugh Gefhara',
        unlock: '3 засчитанные цели',
        short: 'При PRODUCTION: стоимость каждого юнита 0. Затем уничтожьте карту.',
        text: 'GALACTIC SECURITIES NET — когда 1 или более ваших юнитов используют PRODUCTION: можете снизить стоимость каждого вашего юнита до 0 в этом использовании PRODUCTION. Если так — уничтожьте (purge) эту карту.',
      },
    },
    flagship: {
      name: 'Wrath of Kenara',
      cost: 8,
      combat: '7×2',
      move: 1,
      capacity: 3,
      short: 'Sustain. После броска куба в космобое здесь: 1 TG → +1 к результату.',
      abilities: 'Sustain Damage. После броска куба во время космического боя в этой системе можете потратить 1 торговый товар, чтобы применить +1 к результату.',
    },
    mech: {
      name: 'Pride of Kenara',
      cost: 2,
      combat: 6,
      short: 'Карту планеты можно отдать в сделке; юниты переносятся на другую вашу планету.',
      text: 'Карту этой планеты можно обменять как часть сделки; если так — переместите все свои юниты с этой планеты на другую планету, которую вы контролируете. Sustain Damage.',
    },
  },
};
