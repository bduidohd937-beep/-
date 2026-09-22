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
];

export function getRank(tier: number): RankInfo {
  const safeTier = Math.max(
    0,
    Math.min(tier, RANKS.length - 1)
  );

  return RANKS[safeTier];
}