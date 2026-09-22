import unrated from './ranks/tile000.png';

import iron1 from './ranks/tile001.png';
import iron2 from './ranks/tile002.png';
import iron3 from './ranks/tile003.png';

import bronze1 from './ranks/tile005.png';
import bronze2 from './ranks/tile006.png';
import bronze3 from './ranks/tile007.png';

import silver1 from './ranks/tile008.png';
import silver2 from './ranks/tile010.png';
import silver3 from './ranks/tile011.png';

import gold1 from './ranks/tile012.png';
import gold2 from './ranks/tile013.png';
import gold3 from './ranks/tile015.png';

import platinum1 from './ranks/tile016.png';
import platinum2 from './ranks/tile017.png';
import platinum3 from './ranks/tile018.png';

import diamond1 from './ranks/tile020.png';
import diamond2 from './ranks/tile021.png';
import diamond3 from './ranks/tile022.png';

import ascendant1 from './ranks/tile023.png';
import ascendant2 from './ranks/tile025.png';
import ascendant3 from './ranks/tile026.png';

import immortal1 from './ranks/tile027.png';
import immortal2 from './ranks/tile028.png';
import immortal3 from './ranks/tile031.png';

import radiant from './ranks/tile032.png';

export interface RankInfo {
  id: string;
  name: string;
  tier: number;
  image: string;
}

export const RANKS: RankInfo[] = [
  { id: 'unrated', name: '언랭', tier: 0, image: unrated },

  { id: 'iron1', name: '아이언 1', tier: 1, image: iron1 },
  { id: 'iron2', name: '아이언 2', tier: 2, image: iron2 },
  { id: 'iron3', name: '아이언 3', tier: 3, image: iron3 },

  { id: 'bronze1', name: '브론즈 1', tier: 4, image: bronze1 },
  { id: 'bronze2', name: '브론즈 2', tier: 5, image: bronze2 },
  { id: 'bronze3', name: '브론즈 3', tier: 6, image: bronze3 },

  { id: 'silver1', name: '실버 1', tier: 7, image: silver1 },
  { id: 'silver2', name: '실버 2', tier: 8, image: silver2 },
  { id: 'silver3', name: '실버 3', tier: 9, image: silver3 },

  { id: 'gold1', name: '골드 1', tier: 10, image: gold1 },
  { id: 'gold2', name: '골드 2', tier: 11, image: gold2 },
  { id: 'gold3', name: '골드 3', tier: 12, image: gold3 },

  { id: 'platinum1', name: '플래티넘 1', tier: 13, image: platinum1 },
  { id: 'platinum2', name: '플래티넘 2', tier: 14, image: platinum2 },
  { id: 'platinum3', name: '플래티넘 3', tier: 15, image: platinum3 },

  { id: 'diamond1', name: '다이아몬드 1', tier: 16, image: diamond1 },
  { id: 'diamond2', name: '다이아몬드 2', tier: 17, image: diamond2 },
  { id: 'diamond3', name: '다이아몬드 3', tier: 18, image: diamond3 },

  { id: 'ascendant1', name: '초월자 1', tier: 19, image: ascendant1 },
  { id: 'ascendant2', name: '초월자 2', tier: 20, image: ascendant2 },
  { id: 'ascendant3', name: '초월자 3', tier: 21, image: ascendant3 },

  { id: 'immortal1', name: '불멸 1', tier: 22, image: immortal1 },
  { id: 'immortal2', name: '불멸 2', tier: 23, image: immortal2 },
  { id: 'immortal3', name: '불멸 3', tier: 24, image: immortal3 },

  { id: 'radiant', name: '레디언트', tier: 25, image: radiant },
];

export function getRank(tier: number): RankInfo {
  const safeTier = Math.max(
    0,
    Math.min(tier, RANKS.length - 1)
  );

  return RANKS[safeTier];
}