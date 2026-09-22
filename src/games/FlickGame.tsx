import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { CrosshairConfig } from '../utils/crosshair';
import CrosshairView from '../utils/CrosshairView';
import type { Difficulty } from '../utils/storage';
import { loadSensitivity } from '../utils/sensitivity';

export type FlickPattern =
  | 'short'
  | 'long'
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'chaos';

export type PatternStat = {
  shots: number;
  hits: number;
  rx: number[];
};

export interface FlickResult {
  score: number;
  accuracy: number;
  avgReactionMs: number;
  hits: number;
  shots: number;
  bestReactionMs: number;
  overshoots: number;
  maxCombo: number;
  mode: string;
  difficulty: Difficulty;

  /**
   * 훈련 분석
   */
  feedback: {
    weakestPattern: FlickPattern | null;
    strongestPattern: FlickPattern | null;
    accuracyGrade: 'good' | 'normal' | 'poor';
    reactionGrade: 'good' | 'normal' | 'poor';
    overshootGrade: 'good' | 'normal' | 'poor';
  };

  patternStats: Record<
    FlickPattern,
    PatternStat
  >;
}

type Mode = 'random' | 'headline' | 'bot';

type Props = {
  onExit: () => void;
  onComplete: (r: FlickResult) => void;
  crosshair: CrosshairConfig;
};

const ROUND = 30000;

const DIFF: Record<
  Difficulty,
  {
    label: string;
    tag: string;
    desc: string;
    exposure: number;
    gap: number;
  }
> = {
  newbie: {
    label: '응애 나 뉴비에요',
    tag: 'ENTRY',
    desc: '넉넉한 노출 · 정확도 우선',
    exposure: 1500,
    gap: 260,
  },

  normal: {
    label: '나 정도면 실력자지',
    tag: 'RANKED',
    desc: '실전 템포 · 빠른 전환',
    exposure: 1050,
    gap: 190,
  },

  hard: {
    label: '이제 사람 구실 좀 해볼게요',
    tag: 'HARD',
    desc: '짧은 노출 · 빠른 전환 · 실전 압박',
    exposure: 650,
    gap: 120,
  },
  hell: {
    label: '경쟁에서 캐리할게요',
    tag: 'HELL',
    desc: '프로 템포 · 극단적으로 짧은 전환',
    exposure: 500,
    gap: 90,
  },
};

const MODES = [
  {
    id: 'random' as Mode,
    title: 'RANDOM',
    sub: '전방위',
    detail: '화면 상하좌우에 타겟이 랜덤 등장',
  },

  {
    id: 'headline' as Mode,
    title: 'HEADLINE',
    sub: '헤드라인',
    detail: '화면 중앙 높이에만 타겟 등장',
  },

  {
    id: 'bot' as Mode,
    title: 'ROBOT HEAD',
    sub: '훈련봇',
    detail: '훈련봇의 머리 중심을 정확히 클릭',
  },
];

let audioContext: AudioContext | null = null;

const beep = (ok: boolean) => {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    audioContext ??= new AudioContextCtor();

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const o = audioContext.createOscillator();
    const g = audioContext.createGain();

    o.type = 'square';
    o.frequency.value = ok ? 190 : 70;
    g.gain.setValueAtTime(ok ? 0.04 : 0.018, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.045);

    o.connect(g).connect(audioContext.destination);
    o.start();
    o.stop(audioContext.currentTime + 0.045);
  } catch {
    // AudioContext unavailable
  }
};

const createPatternStats = (): Record<
  FlickPattern,
  PatternStat
> => ({
  short: {
    shots: 0,
    hits: 0,
    rx: [],
  },

  long: {
    shots: 0,
    hits: 0,
    rx: [],
  },

  horizontal: {
    shots: 0,
    hits: 0,
    rx: [],
  },

  vertical: {
    shots: 0,
    hits: 0,
    rx: [],
  },

  diagonal: {
    shots: 0,
    hits: 0,
    rx: [],
  },

  chaos: {
    shots: 0,
    hits: 0,
    rx: [],
  },
});

const getPattern = (
  difficulty: Difficulty,
): FlickPattern => {
  const roll = Math.random();

  if (difficulty === 'newbie') {
    if (roll < 0.30) return 'short';
    if (roll < 0.55) return 'horizontal';
    if (roll < 0.75) return 'vertical';
    if (roll < 0.90) return 'long';

    return 'chaos';
  }

  if (difficulty === 'normal') {
    if (roll < 0.18) return 'short';
    if (roll < 0.38) return 'long';
    if (roll < 0.58) return 'horizontal';
    if (roll < 0.75) return 'vertical';
    if (roll < 0.90) return 'diagonal';

    return 'chaos';
  }

  if (roll < 0.15) return 'short';
  if (roll < 0.35) return 'long';
  if (roll < 0.55) return 'horizontal';
  if (roll < 0.73) return 'vertical';
  if (roll < 0.90) return 'diagonal';

  return 'chaos';
};

type TargetState = {
  x: number;
  y: number;
  born: number;
  id: number;
  resolved: boolean;

  pattern: FlickPattern;

  distanceFromPrevious: number;
};

type Stats = {
  shots: number;
  hits: number;
  rx: number[];
  over: number;

  combo: number;
  maxCombo: number;

  lastReactionMs: number;

  pattern: Record<
    FlickPattern,
    PatternStat
  >;
};

export default function FlickGame({
  onExit,
  onComplete,
  crosshair,
}: Props) {
  const stage =
    useRef<HTMLDivElement>(null);

  const targetRef =
    useRef<TargetState | null>(null);

  const timers =
    useRef<number[]>([]);

  const phaseRef = useRef<
    'intro' | 'countdown' | 'playing' | 'finished'
  >('intro');

  const startRef = useRef(0);

  const idRef = useRef(0);

  const lastSpawnRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const stats = useRef<Stats>({
    shots: 0,
    hits: 0,
    rx: [],
    over: 0,

    combo: 0,
    maxCombo: 0,

    lastReactionMs: 0,

    pattern: createPatternStats(),
  });

  const sens = loadSensitivity();

  const [phase, setPhase] = useState<
    'intro' | 'countdown' | 'playing'
  >('intro');

  const [step, setStep] =
    useState<'difficulty' | 'mode'>(
      'difficulty',
    );

  const [difficulty, setDifficulty] =
    useState<Difficulty>('newbie');

  const [mode, setMode] =
    useState<Mode>('random');

  const [count, setCount] = useState(3);

  const [time, setTime] = useState(30);

  const [target, setTarget] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [cursor, setCursor] = useState({
    x: -999,
    y: -999,
  });

  const [hud, setHud] = useState({
    hits: 0,
    shots: 0,
  });

  const [liveStats, setLiveStats] =
    useState({
      combo: 0,
      lastReactionMs: 0,
      avgReactionMs: 0,
      bestReactionMs: 0,
    });

  /**
   * 모든 예약 timer 제거
   */
  const clear = useCallback(() => {
    timers.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });

    timers.current = [];
  }, []);

  /**
   * HUD 갱신
   */
  const syncHud = useCallback(() => {
    const s = stats.current;

    setHud({
      hits: s.hits,
      shots: s.shots,
    });

    const avg = s.rx.length
      ? Math.round(
          s.rx.reduce(
            (a, b) => a + b,
            0,
          ) / s.rx.length,
        )
      : 0;

    const best = s.rx.length
      ? Math.min(...s.rx)
      : 0;

    setLiveStats({
      combo: s.combo,
      lastReactionMs:
        s.lastReactionMs,
      avgReactionMs: avg,
      bestReactionMs: best,
    });
  }, []);

  /**
   * MISS 처리
   *
   * 타겟 하나당 반드시 한 번만 처리
   */
  const resolveMiss = useCallback(
    (
      currentTarget: TargetState,
      overshoot = false,
    ) => {
      if (currentTarget.resolved) {
        return false;
      }

      currentTarget.resolved = true;

      const s = stats.current;

      s.shots += 1;

      /**
       * 패턴별 MISS 기록
       */
      const patternStats =
        s.pattern[
          currentTarget.pattern
        ];

      patternStats.shots += 1;

      /**
       * MISS = 콤보 초기화
       */
      s.combo = 0;

      if (overshoot) {
        s.over += 1;
      }

      if (
        targetRef.current?.id ===
        currentTarget.id
      ) {
        targetRef.current = null;
      }

      setTarget(null);

      syncHud();

      beep(false);

      return true;
    },
    [syncHud],
  );

  /**
   * 게임 종료
   */
  const finish = useCallback(() => {
  if (
    phaseRef.current !== 'playing'
  ) {
    return;
  }

  phaseRef.current = 'finished';

  clear();

  /**
   * 종료 순간 살아있는 타겟은 MISS
   */
  const activeTarget =
    targetRef.current;

  if (
    activeTarget &&
    !activeTarget.resolved
  ) {
    activeTarget.resolved = true;

    stats.current.shots += 1;

    stats.current.pattern[
      activeTarget.pattern
    ].shots += 1;

    stats.current.combo = 0;

    targetRef.current = null;
  }

  setTarget(null);

  syncHud();

  const s = stats.current;

  /**
   * --------------------------------------------------
   * 기본 통계
   * --------------------------------------------------
   */

  const accuracy = s.shots
    ? (s.hits / s.shots) * 100
    : 0;

  /**
   * 안전장치:
   *
   * 정상적인 타겟 반응시간은
   * 현재 난이도의 exposure보다 클 수 없다.
   *
   * 혹시 브라우저 타이머 지연이나
   * 비정상적인 값이 들어와도 결과 화면을
   * 망치지 않도록 여기서 제거한다.
   */
  const maxValidReaction =
    DIFF[difficulty].exposure + 250;

  const validRx = s.rx.filter(
    (value) =>
      Number.isFinite(value) &&
      value > 0 &&
      value <= maxValidReaction,
  );

  const avgReactionMs =
    validRx.length
      ? validRx.reduce(
          (a, b) => a + b,
          0,
        ) / validRx.length
      : 0;

  const bestReactionMs =
    validRx.length
      ? Math.min(...validRx)
      : 0;

  /**
   * --------------------------------------------------
   * 패턴 데이터 정리
   * --------------------------------------------------
   */

  const patternEntries =
    (
      Object.entries(
        s.pattern,
      ) as [
        FlickPattern,
        PatternStat,
      ][]
    ).filter(
      ([, stat]) =>
        stat.shots > 0,
    );

  /**
   * 표본이 너무 적은 패턴은
   * 강점/약점 판정에서 제외한다.
   */
  const analyzablePatterns =
    patternEntries.filter(
      ([, stat]) =>
        stat.shots >= 3,
    );

  let weakestPattern:
    FlickPattern | null = null;

  let strongestPattern:
    FlickPattern | null = null;

  if (
    analyzablePatterns.length > 0
  ) {
    let weakestAccuracy =
      Infinity;

    let strongestAccuracy =
      -Infinity;

    for (const [
      pattern,
      stat,
    ] of analyzablePatterns) {
      const patternAccuracy =
        stat.shots > 0
          ? (stat.hits /
              stat.shots) *
            100
          : 0;

      if (
        patternAccuracy <
        weakestAccuracy
      ) {
        weakestAccuracy =
          patternAccuracy;

        weakestPattern =
          pattern;
      }

      if (
        patternAccuracy >
        strongestAccuracy
      ) {
        strongestAccuracy =
          patternAccuracy;

        strongestPattern =
          pattern;
      }
    }
  }

  /**
   * --------------------------------------------------
   * 등급
   * --------------------------------------------------
   */

  const accuracyGrade =
    accuracy >= 80
      ? 'good'
      : accuracy >= 65
        ? 'normal'
        : 'poor';

  const reactionGrade =
    avgReactionMs <= 300
      ? 'good'
      : avgReactionMs <= 500
        ? 'normal'
        : 'poor';

  const overshootRate =
    s.shots > 0
      ? (s.over / s.shots) *
        100
      : 0;

  const overshootGrade =
    overshootRate <= 5
      ? 'good'
      : overshootRate <= 15
        ? 'normal'
        : 'poor';

  /**
   * --------------------------------------------------
   * 점수
   *
   * 정확도 60
   * 반응속도 20
   * 명중량 10
   * 콤보 10
   *
   * 오버슈트는 별도 지표로 표시.
   * 기존처럼 점수에서 중복 차감하지 않는다.
   * --------------------------------------------------
   */

  const accuracyScore =
    accuracy * 0.60;

  const reactionScore =
    Math.max(
      0,
      100 -
        Math.min(
          avgReactionMs / 5,
          100,
        ),
    ) * 0.20;

  const hitScore =
    Math.min(
      100,
      s.hits * 2,
    ) * 0.10;

  const comboScore =
    Math.min(
      100,
      s.maxCombo * 5,
    ) * 0.10;

  const score = Math.round(
    accuracyScore +
      reactionScore +
      hitScore +
      comboScore,
  );

  /**
   * 결과 전달
   */
  onComplete({
    score,
    accuracy,
    avgReactionMs,
    hits: s.hits,
    shots: s.shots,
    bestReactionMs,
    overshoots: s.over,
    maxCombo: s.maxCombo,

    mode,
    difficulty,

    feedback: {
      weakestPattern,
      strongestPattern,
      accuracyGrade,
      reactionGrade,
      overshootGrade,
    },

    patternStats: s.pattern,
  });
}, [
  clear,
  difficulty,
  mode,
  onComplete,
  syncHud,
]);
  /**
   * 새로운 타겟 위치 생성
   *
   * 직전 타겟과 너무 가까운 위치를 피한다.
   */
  const getSpawnPosition =
    useCallback(
      (
        width: number,
        height: number,
      ) => {
        const pad = 74;

        const minDistance =
          Math.min(
            width,
            height,
          ) * 0.22;

        let bestX =
          pad +
          Math.random() *
            Math.max(
              1,
              width - pad * 2,
            );

        let bestY =
          pad +
          Math.random() *
            Math.max(
              1,
              height - pad * 2,
            );

        /**
         * 최대 12번 새로운 위치 시도
         */
        for (
          let i = 0;
          i < 12;
          i += 1
        ) {
          const x =
            pad +
            Math.random() *
              Math.max(
                1,
                width - pad * 2,
              );

          const y =
            pad +
            Math.random() *
              Math.max(
                1,
                height - pad * 2,
              );

          const previous =
            lastSpawnRef.current;

          if (!previous) {
            bestX = x;
            bestY = y;
            break;
          }

          const distance =
            Math.hypot(
              x - previous.x,
              y - previous.y,
            );

          bestX = x;
          bestY = y;

          if (
            distance >= minDistance
          ) {
            break;
          }
        }

        return {
          x: bestX,
          y: bestY,
        };
      },
      [],
    );

  /**
   * 다음 타겟 생성
   */
  const spawn = useCallback(() => {
    if (
      phaseRef.current !== 'playing'
    ) {
      return;
    }

    const r =
      stage.current?.getBoundingClientRect();

    if (!r) {
      return;
    }

    let x = 0;
    let y = 0;

    const pattern =
      getPattern(difficulty);

    const previous =
      lastSpawnRef.current;

    const pad = 74;

    const randomX = () =>
      pad +
      Math.random() *
        Math.max(
          1,
          r.width - pad * 2,
        );

    const randomY = () =>
      pad +
      Math.random() *
        Math.max(
          1,
          r.height - pad * 2,
        );

    /**
     * RANDOM / BOT
     *
     * 패턴에 따라 이전 타겟과의
     * 이동 방향과 거리를 결정한다.
     */
    if (
      mode === 'random' ||
      mode === 'bot'
    ) {
      const position =
        getSpawnPosition(
          r.width,
          r.height,
        );

      x = position.x;
      y = position.y;

      if (previous) {
        const prevX =
          previous.x;

        const prevY =
          previous.y;

        switch (pattern) {
          /**
           * 짧은 플릭
           */
          case 'short': {
            const angle =
              Math.random() *
              Math.PI *
              2;

            const distance =
              Math.min(
                r.width,
                r.height,
              ) *
              (0.10 +
                Math.random() *
                  0.08);

            x =
              prevX +
              Math.cos(angle) *
                distance;

            y =
              prevY +
              Math.sin(angle) *
                distance;

            break;
          }

          /**
           * 긴 플릭
           */
          case 'long': {
            const angle =
              Math.random() *
              Math.PI *
              2;

            const distance =
              Math.min(
                r.width,
                r.height,
              ) *
              (0.42 +
                Math.random() *
                  0.25);

            x =
              prevX +
              Math.cos(angle) *
                distance;

            y =
              prevY +
              Math.sin(angle) *
                distance;

            break;
          }

          /**
           * 좌우 플릭
           */
          case 'horizontal': {
            const distance =
              r.width *
              (0.35 +
                Math.random() *
                  0.25);

            const direction =
              prevX <
              r.width / 2
                ? 1
                : -1;

            x =
              prevX +
              direction *
                distance;

            y =
              prevY +
              (Math.random() -
                0.5) *
                100;

            break;
          }

          /**
           * 상하 플릭
           */
          case 'vertical': {
            const distance =
              r.height *
              (0.30 +
                Math.random() *
                  0.25);

            const direction =
              prevY <
              r.height / 2
                ? 1
                : -1;

            y =
              prevY +
              direction *
                distance;

            x =
              prevX +
              (Math.random() -
                0.5) *
                120;

            break;
          }

          /**
           * 대각선 플릭
           */
          case 'diagonal': {
            const distance =
              Math.min(
                r.width,
                r.height,
              ) *
              (0.30 +
                Math.random() *
                  0.20);

            const dx =
              Math.random() < 0.5
                ? -1
                : 1;

            const dy =
              Math.random() < 0.5
                ? -1
                : 1;

            x =
              prevX +
              dx * distance;

            y =
              prevY +
              dy * distance;

            break;
          }

          /**
           * 완전 랜덤
           */
          case 'chaos':
          default:
            x = randomX();
            y = randomY();
            break;
        }

        /**
         * 화면 밖으로 나가지 않도록 보정
         */
        x = Math.max(
          pad,
          Math.min(
            r.width - pad,
            x,
          ),
        );

        y = Math.max(
          pad,
          Math.min(
            r.height - pad,
            y,
          ),
        );
      }
    }

    /**
     * HEADLINE
     *
     * 기존처럼 화면 중앙 높이에서 생성.
     */
    if (mode === 'headline') {
      const headlinePad = 74;

      x =
        headlinePad +
        Math.random() *
          Math.max(
            1,
            r.width -
              headlinePad * 2,
          );

      const center =
        r.height * 0.5;

      const variation =
        Math.min(
          55,
          r.height * 0.12,
        );

      y =
        center +
        (Math.random() * 2 - 1) *
          variation;

      y = Math.max(
        headlinePad,
        Math.min(
          r.height -
            headlinePad,
          y,
        ),
      );

      /**
       * 헤드라인도 이전 타겟과
       * 너무 가까우면 반대쪽으로 보정
       */
      if (previous) {
        const distance =
          Math.hypot(
            x - previous.x,
            y - previous.y,
          );

        if (
          distance <
          r.width * 0.18
        ) {
          x =
            x < r.width / 2
              ? r.width * 0.75
              : r.width * 0.25;
        }
      }
    }

    /**
     * 이전 타겟과 실제 거리
     */
    const distanceFromPrevious =
      lastSpawnRef.current
        ? Math.hypot(
            x -
              lastSpawnRef.current.x,
            y -
              lastSpawnRef.current.y,
          )
        : 0;

    const newTarget: TargetState = {
      x,
      y,

      born: performance.now(),

      id: ++idRef.current,

      resolved: false,

      pattern,

      distanceFromPrevious,
    };

    targetRef.current =
      newTarget;

    lastSpawnRef.current = {
      x,
      y,
    };

    setTarget({
      x: (x / r.width) * 100,
      y: (y / r.height) * 100,
    });

    /**
     * 노출 시간 종료 → MISS
     */
    const hide =
      window.setTimeout(() => {
        if (
          phaseRef.current !==
          'playing'
        ) {
          return;
        }

        const current =
          targetRef.current;

        if (!current) {
          return;
        }

        if (
          current.id !==
          newTarget.id
        ) {
          return;
        }

        if (!current.resolved) {
          resolveMiss(current);
        }

        /**
         * 다음 타겟
         */
        const next =
          window.setTimeout(
            () => {
              if (
                phaseRef.current ===
                'playing'
              ) {
                spawn();
              }
            },
            DIFF[difficulty].gap,
          );

        timers.current.push(next);
      },
      DIFF[difficulty].exposure,
    );

    timers.current.push(hide);
  }, [
    difficulty,
    getSpawnPosition,
    mode,
    resolveMiss,
  ]);

  /**
   * 게임 시작
   */
  const begin = () => {
    clear();

    stats.current = {
      shots: 0,
      hits: 0,
      rx: [],
      over: 0,

      combo: 0,
      maxCombo: 0,

      lastReactionMs: 0,

      pattern:
        createPatternStats(),
    };

    targetRef.current = null;

    lastSpawnRef.current = null;

    setHud({
      hits: 0,
      shots: 0,
    });

    setLiveStats({
      combo: 0,
      lastReactionMs: 0,
      avgReactionMs: 0,
      bestReactionMs: 0,
    });

    setTarget(null);

    setTime(30);

    phaseRef.current =
      'countdown';

    setPhase('countdown');

    setCount(3);

    let n = 3;

    const id =
      window.setInterval(() => {
        n -= 1;

        setCount(n);

        if (n <= 0) {
          clearInterval(id);

          phaseRef.current =
            'playing';

          setPhase('playing');

          startRef.current =
            performance.now();

          /**
           * 첫 타겟
           */
          const first =
            window.setTimeout(
              () => {
                if (
                  phaseRef.current ===
                  'playing'
                ) {
                  spawn();
                }
              },
              40,
            );

          timers.current.push(
            first,
          );

          /**
           * 게임 타이머
           */
          const loop =
            window.setInterval(
              () => {
                const rem =
                  ROUND -
                  (performance.now() -
                    startRef.current);

                setTime(
                  Math.max(
                    0,
                    Math.ceil(
                      rem / 1000,
                    ),
                  ),
                );

                if (rem <= 0) {
                  clearInterval(loop);

                  finish();
                }
              },
              50,
            );

          timers.current.push(
            loop,
          );
        }
      }, 650);

    timers.current.push(id);
  };

  /**
   * 마우스 이동
   */
  const move = (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const r =
      stage.current?.getBoundingClientRect();

    if (!r) {
      return;
    }

    setCursor({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  };

  /**
   * 빈 공간 클릭
   */
  const registerMiss = (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      phaseRef.current !==
      'playing'
    ) {
      return;
    }

    const t =
      targetRef.current;

    if (!t || t.resolved) {
      return;
    }

    const r =
      stage.current?.getBoundingClientRect();

    if (!r) {
      return;
    }

    const x =
      e.clientX - r.left;

    const y =
      e.clientY - r.top;

    const distance =
      Math.hypot(
        x - t.x,
        y - t.y,
      );

    /**
     * 타겟 근처에서 빗나간 클릭
     */
    const overshoot =
      distance < 66;

    resolveMiss(
      t,
      overshoot,
    );

    /**
     * 다음 타겟
     */
    const next =
      window.setTimeout(
        () => {
          if (
            phaseRef.current ===
            'playing'
          ) {
            spawn();
          }
        },
        DIFF[difficulty].gap,
      );

    timers.current.push(next);
  };

  /**
   * 타겟 명중
   */
  const hit = (
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();

    e.stopPropagation();

    if (
      phaseRef.current !==
      'playing'
    ) {
      return;
    }

    const t =
      targetRef.current;

    if (!t || t.resolved) {
      return;
    }

    /**
     * 타겟 즉시 resolve
     */
    t.resolved = true;

   const rawReaction =
  performance.now() -
  t.born;

const maxValidReaction =
  DIFF[difficulty].exposure + 250;

const reaction = Math.min(
  Math.max(rawReaction, 1),
  maxValidReaction,
);

    const s = stats.current;

    s.shots += 1;

    s.hits += 1;

    s.rx.push(reaction);

    /**
     * 패턴별 HIT 기록
     */
    const patternStats =
      s.pattern[t.pattern];

    patternStats.shots += 1;

    patternStats.hits += 1;

    patternStats.rx.push(
      reaction,
    );

    /**
     * 콤보 증가
     */
    s.combo += 1;

    if (
      s.combo > s.maxCombo
    ) {
      s.maxCombo =
        s.combo;
    }

    s.lastReactionMs =
      reaction;

    syncHud();

    beep(true);

    targetRef.current = null;

    setTarget(null);

    /**
     * 다음 타겟
     */
    const next =
      window.setTimeout(
        () => {
          if (
            phaseRef.current ===
            'playing'
          ) {
            spawn();
          }
        },
        DIFF[difficulty].gap,
      );

    timers.current.push(next);
  };

  /**
   * 언마운트 cleanup
   */
  useEffect(() => {
    return () => {
      phaseRef.current =
        'finished';

      clear();
    };
  }, [clear]);

  /*
   * ============================================================
   * INTRO
   * ============================================================
   */

  if (phase === 'intro') {
    return (
      <main className="game-page">
        <header className="game-header">
          <button
            className="back-btn"
            onClick={onExit}
          >
            ← EXIT
          </button>

          <div>
            <p className="eyebrow">
              FLICK // PRECISION TRANSFER
            </p>

            <h1>플릭 훈련</h1>
          </div>

          <div className="game-help">
            30 SEC
          </div>
        </header>

        <section className="setup panel">
          <div className="setup-progress">
            <span
              className={
                step === 'difficulty'
                  ? 'active'
                  : 'done'
              }
            >
              01 난이도
            </span>

            <i>→</i>

            <span
              className={
                step === 'mode'
                  ? 'active'
                  : ''
              }
            >
              02 훈련 모드
            </span>
          </div>

          {step === 'difficulty' ? (
            <>
              <p className="eyebrow">
                01 // SPEED PROFILE
              </p>

              <h2>
                먼저 타겟 템포를 골라.
              </h2>

              <p className="setup-copy">
                난이도와 게임 모드를
                분리했습니다.
                먼저 노출 속도를
                선택하세요.
              </p>

              <div className="choice-grid difficulty-grid">
                {Object.entries(
                  DIFF,
                ).map(([id, d]) => (
                  <button
                    key={id}
                    className={`choice-card difficulty-${id} ${
                      difficulty === id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setDifficulty(
                        id as Difficulty,
                      )
                    }
                  >
                    <span className="choice-kicker">
                      {d.tag}
                    </span>

                    <strong>
                      {d.label}
                    </strong>

                    <em>
                      {d.desc}
                    </em>

                    <small>
                      노출 {d.exposure}ms ·
                      간격 {d.gap}ms
                    </small>
                  </button>
                ))}
              </div>

              <button
                className="primary-btn wide"
                onClick={() =>
                  setStep('mode')
                }
              >
                다음 — 훈련 모드 선택
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">
                02 // TRAINING MODE
              </p>

              <h2>
                어디를 맞힐지 선택해.
              </h2>

              <p className="setup-copy">
                HEADLINE은 헤드 높이,
                ROBOT HEAD는 훈련봇
                머리 중심을 노립니다.
              </p>

              <div className="choice-grid mode-grid">
                {MODES.map((m, i) => (
                  <button
                    key={m.id}
                    className={`choice-card mode-${m.id} ${
                      mode === m.id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setMode(m.id)
                    }
                  >
                    <span className="mode-number">
                      0{i + 1}
                    </span>

                    <strong>
                      {m.title}
                    </strong>

                    <b>{m.sub}</b>

                    <em>
                      {m.detail}
                    </em>
                  </button>
                ))}
              </div>

              <div className="setup-summary">
                <span>
                  난이도{' '}
                  <b>
                    {
                      DIFF[difficulty]
                        .label
                    }
                  </b>
                </span>

                <span>
                  현재 감도{' '}
                  <b>
                    {sens.dpi} DPI ·{' '}
                    {sens.sens.toFixed(
                      3,
                    )}
                  </b>
                </span>
              </div>

              <div className="setup-actions">
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setStep(
                      'difficulty',
                    )
                  }
                >
                  ← 난이도
                </button>

                <button
                  className="primary-btn"
                  onClick={begin}
                >
                  ▶ FLICK 시작
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  /*
   * ============================================================
   * COUNTDOWN
   * ============================================================
   */

  if (phase === 'countdown') {
    return (
      <main className="game-page">
        <div className="countdown-screen">
          <div className="countdown-card clean-countdown"><strong>{count}</strong></div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * LIVE
   * ============================================================
   */

  return (
    <main className="game-page training-live">
      <header className="live-hud">
        <button
          className="back-btn"
          onClick={() => {
            phaseRef.current =
              'finished';

            clear();

            targetRef.current = null;

            setTarget(null);

            onExit();
          }}
        >
          × 종료
        </button>

        <div>
          <b>
            {mode === 'bot'
              ? 'ROBOT HEAD'
              : mode === 'headline'
                ? 'HEADLINE'
                : 'RANDOM FLICK'}
          </b>

          <span>
            {DIFF[difficulty].label}
          </span>
        </div>

        <div className="live-stats">
          <span>HIT <b>{hud.hits}</b></span>
          <span>SHOT <b>{hud.shots}</b></span>
          <span>COMBO <b>{liveStats.combo}</b></span>
          <span>TIME <b>{time}s</b></span>
        </div>
      </header>

      <div
        className={`training-stage flick-stage ${mode}`}
        ref={stage}
        onPointerMove={move}
        onPointerDown={registerMiss}
      >
        {mode === 'bot' &&
          target && (
            <div
              className="bot-anchor bot-live bot-head-anchor"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
              }}
            >
              <div className="training-bot">
                <div className="bot-antenna" />

                <div className="bot-head">
                  <span className="bot-eye" />
                  <span className="bot-eye" />
                </div>

                <div className="bot-neck" />

                <div className="bot-shoulder left" />
                <div className="bot-shoulder right" />

                <div className="bot-torso">
                  <i />
                  <i />
                  <b />
                </div>

                <div className="bot-arm left" />
                <div className="bot-arm right" />

                <div className="bot-forearm left" />
                <div className="bot-forearm right" />

                <div className="bot-leg left" />
                <div className="bot-leg right" />

                <div className="bot-foot left" />
                <div className="bot-foot right" />
              </div>

              <button
                className="bot-head-hit bot-head-hit-exact"
                aria-label="shoot robot head"
                onPointerDown={hit}
              />
            </div>
          )}

        {target &&
          mode !== 'bot' && (
            <button
              className="aim-target"
              aria-label="shoot target"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
              }}
              onPointerDown={hit}
            />
          )}

        <CrosshairView
          config={crosshair}
          className="live-crosshair"
          style={{
            left: cursor.x,
            top: cursor.y,
          }}
        />

        <div className="training-vignette" />
      </div>
    </main>
  );
}