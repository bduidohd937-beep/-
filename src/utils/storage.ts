export type TrainingType = 'flick' | 'reaction' | 'tracking' | 'braking' | 'switching' | 'micro';
export type Difficulty = 'newbie' | 'normal' | 'hard' | 'hell';

export interface TrainingRecord {
  id: string;
  timestamp: number;
  type: TrainingType;
  score: number;
  accuracy: number;
  reactionMs: number;
  hits: number;
  shots: number;
  bestMs?: number;
  consistency?: number;
  falseStarts?: number;
  avgError?: number;
  targetSpeed?: number;
  overshoots?: number;
  mode?: string;
  difficulty?: Difficulty;
}

const KEY = 'sanghyeon-aim-lab-history-v6';
const LEGACY_KEY = 'yeonho-aim-lab-history-v5';
const MAX_HISTORY = 100;
export function loadHistory(): TrainingRecord[] {
  try {
    const current = localStorage.getItem(KEY);
    const legacy = current ? null : localStorage.getItem(LEGACY_KEY);
    const parsed = JSON.parse(current || legacy || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch { return []; }
}
export function saveResult(r: TrainingRecord) {
  const h = loadHistory();
  localStorage.setItem(KEY, JSON.stringify([...h.filter(x => x.id !== r.id), r].slice(-MAX_HISTORY)));
}
