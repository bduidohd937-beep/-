import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { CrosshairConfig } from '../utils/crosshair';
import CrosshairView from '../utils/CrosshairView';

export interface SwitchingResult {
  score: number;
  accuracy: number;
  hits: number;
  shots: number;
  avgSwitchMs: number;
  bestSwitchMs: number;
  duration: number;
  difficulty: any;
  maxCombo: number;
  misses: number;
}

interface Props {
  onBack: () => void;
  onFinish: (r: SwitchingResult) => void;
  crosshair: CrosshairConfig;
}

const COUNTS = [10, 20, 30, 50, 100];

const TARGET_SIZE = 30;

/**
 * 동시에 보이는 타겟 수
 */
const TARGETS_ON_SCREEN = 4;

const CLUSTER_RADIUS = 9
;
const MIN_TARGET_DISTANCE = 6.5;

/**
 * 화면 가장자리 안전 영역
 */
const MIN_X = 12;
const MAX_X = 88;
const MIN_Y = 14;
const MAX_Y = 82;

let audio: AudioContext | null = null;

function sound(ok: boolean) {
  try {
    const C =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!C) return;

    audio ??= new C();

    if (audio.state === 'suspended') {
      void audio.resume();
    }

    const o = audio.createOscillator();
    const g = audio.createGain();

    o.type = 'square';
    o.frequency.value = ok ? 220 : 75;

    g.gain.setValueAtTime(
      ok ? 0.035 : 0.016,
      audio.currentTime,
    );

    g.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + 0.055,
    );

    o.connect(g).connect(audio.destination);

    o.start();
    o.stop(audio.currentTime + 0.055);
  } catch {
    // AudioContext unavailable
  }
}

interface Target {
  id: number;
  x: number;
  y: number;
}

interface Cluster {
  x: number;
  y: number;
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 화면 중앙 부근에 클러스터 생성
 */
function createCluster(): Cluster {
  return {
    x: 35 + Math.random() * 30,
    y: 32 + Math.random() * 25,
  };
}

/**
 * 클러스터 안에 타겟 하나 생성
 */
function createTargetInCluster(
  id: number,
  cluster: Cluster,
  existing: Target[] = [],
): Target {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;

    const radius =
      Math.sqrt(Math.random()) * CLUSTER_RADIUS;

    const candidate = {
      id,
      x: clamp(
        cluster.x + Math.cos(angle) * radius,
        MIN_X,
        MAX_X,
      ),
      y: clamp(
        cluster.y + Math.sin(angle) * radius,
        MIN_Y,
        MAX_Y,
      ),
    };

    const tooClose = existing.some(
      (t) =>
        distance(candidate, t) <
        MIN_TARGET_DISTANCE,
    );

    if (!tooClose) {
      return candidate;
    }
  }

  /**
   * 안전 fallback
   */
  return {
    id,
    x: clamp(cluster.x, MIN_X, MAX_X),
    y: clamp(cluster.y, MIN_Y, MAX_Y),
  };
}

/**
 * 초기 4개 타겟 생성
 */
function createClusterTargets():{
  targets:Target[];
  cluster:Cluster;
}{
  const cluster = createCluster();

  const targets:Target[] = [];

  // 타겟 중심 간 최소 거리
  // 30px 타겟이므로 너무 붙지 않도록 여유를 둠
  const MIN_INITIAL_DISTANCE = 6.5;

  for(let i=0;i<TARGETS_ON_SCREEN;i++){

    let target:Target | null = null;

    // 충분히 떨어진 위치가 나올 때까지 재생성
    for(let attempt=0;attempt<100;attempt++){

      const angle =
        Math.random() * Math.PI * 2;

      const radius =
        2.5 + Math.random() * 7;

      const candidate:Target = {
        id:i+1,
        x:clamp(
          cluster.x +
          Math.cos(angle) * radius,
          MIN_X,
          MAX_X
        ),
        y:clamp(
          cluster.y +
          Math.sin(angle) * radius,
          MIN_Y,
          MAX_Y
        )
      };

      const valid =
        targets.every(existing =>
          distance(candidate,existing) >=
          MIN_INITIAL_DISTANCE
        );

      if(valid){
        target = candidate;
        break;
      }
    }

    // 혹시 100번 안에 못 찾으면
    // 마지막 안전 위치 사용
    if(!target){
      target = createTargetInCluster(
        i+1,
        cluster,
        targets
      );
    }

    targets.push(target);
  }

  return {
    targets,
    cluster
  };
}
export default function SwitchingGame({
  onBack,
  onFinish,
  crosshair,
}: Props) {
  const [phase, setPhase] =
    useState<'intro' | 'live'>('intro');

  const [targetCount, setTargetCount] =
    useState(20);

  const [targetSlots, setTargetSlots] =
    useState<Target[]>([]);

  const [hits, setHits] = useState(0);
  const [shots, setShots] = useState(0);

  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const [feedback, setFeedback] =
    useState<'hit' | 'miss' | ''>('');

  const [elapsed, setElapsed] =
    useState(0);

  /**
   * 조준선 위치
   *
   * -1로 시작해서 게임 시작 전에는
   * 화면에 이상하게 붙지 않게 한다.
   */
  const [mouse, setMouse] = useState({
    x: -100,
    y: -100,
  });

  const stage =
    useRef<HTMLDivElement>(null);

  const start = useRef(0);
  const lastHit = useRef(0);

  const hitsRef = useRef(0);
  const shotsRef = useRef(0);
  const missesRef = useRef(0);

  const active = useRef(false);
  const completed = useRef(false);

  const switches =
    useRef<number[]>([]);

  const clusterRef =
    useRef<Cluster>({
      x: 50,
      y: 50,
    });

  const feedbackTimer =
    useRef<number | null>(null);

  /**
   * 피드백 표시
   */
  const showFeedback = (
    value: 'hit' | 'miss',
  ) => {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(
        feedbackTimer.current,
      );
    }

    setFeedback(value);

    feedbackTimer.current =
      window.setTimeout(() => {
        setFeedback('');
        feedbackTimer.current = null;
      }, 120);
  };

  /**
   * 다음 타겟 생성
   *
   * 방금 맞힌 타겟 위치가 아니라
   * 현재 클러스터 중심 기준.
   */
  const createNextTarget = (
  id: number,
  existing: Target[],
): Target => {
  // 기존 타겟이 없다면 클러스터 중심에서 생성
  if (existing.length === 0) {
    return createTargetInCluster(
      id,
      clusterRef.current,
      existing,
    );
  }

  // 현재 남아있는 타겟들의 중심
  const center = existing.reduce(
    (acc, target) => ({
      x: acc.x + target.x / existing.length,
      y: acc.y + target.y / existing.length,
    }),
    { x: 0, y: 0 },
  );

  /**
   * 새 타겟 생성
   *
   * 핵심:
   * 1. 기존 타겟들과 최소 거리 확보
   * 2. 기존 군집에서 너무 멀어지지 않음
   * 3. 실패 시에도 절대 겹치는 위치를 사용하지 않음
   */
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const angle =
      Math.random() * Math.PI * 2;

    // 기존 타겟 주변의 좁은 군집
    const radius =
      3.5 + Math.random() * 5.5;

    const candidate: Target = {
      id,
      x: clamp(
        center.x +
          Math.cos(angle) * radius,
        MIN_X,
        MAX_X,
      ),
      y: clamp(
        center.y +
          Math.sin(angle) * radius,
        MIN_Y,
        MAX_Y,
      ),
    };

    // 기존 타겟과 충분히 떨어졌는지 검사
    const valid =
      existing.every(
        (target) =>
          distance(candidate, target) >=
          MIN_TARGET_DISTANCE,
      );

    if (valid) {
      return candidate;
    }
  }

  /**
   * 300번 시도했는데도 못 찾은 경우
   *
   * 절대 랜덤 위치를 강제로 넣지 않고,
   * 기존 타겟 중 가장 멀리 떨어질 수 있는 위치를 탐색한다.
   */
  let bestCandidate: Target | null = null;
  let bestDistance = -1;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const angle =
      Math.random() * Math.PI * 2;

    const radius =
      5 + Math.random() * 7;

    const candidate: Target = {
      id,
      x: clamp(
        center.x +
          Math.cos(angle) * radius,
        MIN_X,
        MAX_X,
      ),
      y: clamp(
        center.y +
          Math.sin(angle) * radius,
        MIN_Y,
        MAX_Y,
      ),
    };

    const nearestDistance =
      Math.min(
        ...existing.map((target) =>
          distance(candidate, target),
        ),
      );

    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestCandidate = candidate;
    }
  }

  return (
    bestCandidate ?? {
      id,
      x: center.x,
      y: center.y,
    }
  );
};

  /**
   * 게임 종료
   */
  const finish = () => {
    if (completed.current) return;

    completed.current = true;
    active.current = false;

    const shotsValue =
      Math.max(1, shotsRef.current);

    const hitsValue =
      hitsRef.current;

    const accuracy =
      (hitsValue / shotsValue) * 100;

    const avg =
      switches.current.length
        ? switches.current.reduce(
            (a, b) => a + b,
            0,
          ) /
          switches.current.length
        : 999;

    const best =
      switches.current.length
        ? Math.min(...switches.current)
        : 999;

    const speedScore =
      Math.max(
        0,
        100 -
          Math.min(
            Math.max(0, avg - 180) / 5,
            100,
          ),
      );

    const score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          accuracy * 0.65 +
            speedScore * 0.35,
        ),
      ),
    );

    onFinish({
      score,
      accuracy,
      hits: hitsValue,
      shots: shotsValue,
      avgSwitchMs: avg,
      bestSwitchMs: best,
      duration:
        (performance.now() -
          start.current) /
        1000,
      difficulty:
        `${targetCount} TARGETS` as any,
      maxCombo,
      misses: missesRef.current,
    });
  };

  /**
   * 게임 시작
   */
  const startGame = () => {
    completed.current = false;
    active.current = true;

    hitsRef.current = 0;
    shotsRef.current = 0;
    missesRef.current = 0;

    switches.current = [];
    lastHit.current = 0;

    setHits(0);
    setShots(0);
    setCombo(0);
    setMaxCombo(0);
    setElapsed(0);
    setFeedback('');

    /**
     * 클러스터 하나 생성
     */
    const initial =
      createClusterTargets();

    clusterRef.current =
      initial.cluster;

    setTargetSlots(initial.targets);

    /**
     * 마우스 좌표 초기화
     */
    setMouse({
      x: -100,
      y: -100,
    });

    start.current =
      performance.now();

    setPhase('live');
  };

  /**
   * 시간 업데이트
   */
  useEffect(() => {
    if (phase !== 'live') return;

    let raf = 0;

    const loop = (now: number) => {
      if (completed.current) return;

      setElapsed(
        (now - start.current) / 1000,
      );

      raf =
        requestAnimationFrame(loop);
    };

    raf =
      requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  /**
   * 컴포넌트 정리
   */
  useEffect(() => {
    return () => {
      active.current = false;
      completed.current = true;

      if (
        feedbackTimer.current !== null
      ) {
        window.clearTimeout(
          feedbackTimer.current,
        );
      }
    };
  }, []);

  /**
   * 마우스 이동
   *
   * PointerEvent 사용.
   * Crosshair와 동일한 이벤트 체계를 사용한다.
   */
  const move = (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const r =
      stage.current?.getBoundingClientRect();

    if (!r) return;

    setMouse({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  };

  /**
   * 빈 공간 클릭 = MISS
   */
  const registerMiss = () => {
    if (
      phase !== 'live' ||
      completed.current
    ) {
      return;
    }

    shotsRef.current += 1;
    missesRef.current += 1;

    setShots(
      shotsRef.current,
    );

    setCombo(0);

    showFeedback('miss');

    sound(false);
  };

  /**
   * 타겟 적중
   */
  const hitTarget = (
    e: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      phase !== 'live' ||
      completed.current
    ) {
      return;
    }

    const t =
      targetSlots[index];

    if (!t) return;

    const now =
      performance.now();

    /**
     * 클릭 = shot
     */
    shotsRef.current += 1;

    setShots(
      shotsRef.current,
    );

    /**
     * 두 번째 타겟부터
     * 실제 switching 시간 기록
     */
    if (lastHit.current > 0) {
      switches.current.push(
        now - lastHit.current,
      );
    }

    lastHit.current = now;

    hitsRef.current += 1;

    setHits(
      hitsRef.current,
    );

    /**
     * 현재 콤보
     */
    const nextCombo =
      combo + 1;

    const nextMaxCombo =
      Math.max(
        maxCombo,
        nextCombo,
      );

    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);

    showFeedback('hit');

    sound(true);

    /**
     * 목표 개수 달성
     */
    if (
      hitsRef.current >=
      targetCount
    ) {
      /**
       * 마지막 콤보가 결과에
       * 즉시 반영되도록 직접 계산.
       */
      completed.current = true;
      active.current = false;

      const shotsValue =
        Math.max(
          1,
          shotsRef.current,
        );

      const accuracy =
        (hitsRef.current /
          shotsValue) *
        100;

      const avg =
        switches.current.length
          ? switches.current.reduce(
              (a, b) => a + b,
              0,
            ) /
            switches.current.length
          : 999;

      const best =
        switches.current.length
          ? Math.min(
              ...switches.current,
            )
          : 999;

      const speedScore =
        Math.max(
          0,
          100 -
            Math.min(
              Math.max(
                0,
                avg - 180,
              ) / 5,
              100,
            ),
        );

      const score = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            accuracy * 0.65 +
              speedScore * 0.35,
          ),
        ),
      );

      onFinish({
        score,
        accuracy,
        hits: hitsRef.current,
        shots: shotsValue,
        avgSwitchMs: avg,
        bestSwitchMs: best,
        duration:
          (now - start.current) /
          1000,
        difficulty:
          `${targetCount} TARGETS` as any,
        maxCombo: nextMaxCombo,
        misses: missesRef.current,
      });

      return;
    }

    /**
     * 타겟 제거 후
     * 동일 클러스터 안에서
     * 새 타겟 생성
     */
    setTargetSlots((prev) => {
      const remaining =
        prev.filter(
          (_, i) => i !== index,
        );

      const nextId =
        prev.reduce(
          (max, target) =>
            Math.max(
              max,
              target.id,
            ),
          0,
        ) + 1;

      const next =
        createNextTarget(
          nextId,
          remaining,
        );

      remaining.push(next);

      return remaining;
    });
  };

  /**
   * 스테이지 빈 공간 클릭
   */
  const click = (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      phase !== 'live' ||
      completed.current
    ) {
      return;
    }

    /**
     * 버튼에서 올라온 이벤트는
     * hitTarget에서 stopPropagation되므로
     * 여기까지 오지 않는다.
     */
    if (
      e.target !== e.currentTarget
    ) {
      return;
    }

    registerMiss();
  };

  const progress =
    targetCount > 0
      ? (hits / targetCount) * 100
      : 0;

  /**
   * -------------------------
   * INTRO
   * -------------------------
   */
  if (phase === 'intro') {
    return (
      <main className="game-page">
        <header className="game-header">
          <button
            className="back-btn"
            onClick={onBack}
          >
            ← EXIT
          </button>

          <div>
            <p className="eyebrow">
              SWITCHING // TARGET TRANSFER
            </p>

            <h1>
              타겟 스위칭
            </h1>
          </div>

          <div className="game-help">
            COUNT MODE
          </div>
        </header>

        <section className="setup panel switching-setup">
          <p className="eyebrow">
            FIND → FLICK → CONFIRM → SWITCH
          </p>

          <h2>
            하나 잡으면 바로 다음 타겟.
          </h2>

          <p className="setup-copy">
            여러 타겟이
            <b> 가까운 공간에 모여 있고</b>
            하나를 잡으면
            <b> 같은 공간에 새로운 타겟</b>
            이 나타나.
            화면 반대편으로 갑자기 튀지 않아.
          </p>

          <div className="choice-grid target-count-grid">
            {COUNTS.map((n) => (
              <button
                key={n}
                className={`choice-card target-count ${
                  targetCount === n
                    ? 'selected'
                    : ''
                }`}
                onClick={() =>
                  setTargetCount(n)
                }
              >
                <span className="choice-kicker">
                  TARGETS
                </span>

                <strong>
                  {n}개
                </strong>

                <em>
                  {n <= 20
                    ? '빠르게 한 판'
                    : n <= 50
                      ? '기본 연습'
                      : '지속력까지'}
                </em>

                <small>
                  {n === 10
                    ? '짧게 감각만'
                    : n === 100
                      ? '장시간 집중'
                      : '한 세트 연습'}
                </small>
              </button>
            ))}
          </div>

          <button
            className="primary-btn wide"
            onClick={startGame}
          >
            ▶ SWITCHING 시작 ·{' '}
            {targetCount}개
          </button>
        </section>
      </main>
    );
  }

  /**
   * -------------------------
   * LIVE
   * -------------------------
   */
  return (
    <main className="game-page training-live">
      <header className="live-hud">
        <button
          className="back-btn"
          onClick={() => {
            active.current = false;
            completed.current = true;

            if (
              feedbackTimer.current !==
              null
            ) {
              window.clearTimeout(
                feedbackTimer.current,
              );
            }

            onBack();
          }}
        >
          × 종료
        </button>

        <div>
          <b>
            TARGET SWITCHING
          </b>

          <span>
            {hits} / {targetCount}{' '}
            TARGETS
          </span>
        </div>

        <div className="live-stats">
          <span>
            HIT <b>{hits}</b>
          </span>

          <span>
            SHOT <b>{shots}</b>
          </span>

          <span>
            COMBO <b>{combo}</b>
          </span>

          <span>
            TIME{' '}
            <b>
              {elapsed.toFixed(1)}s
            </b>
          </span>

          <i
            className={`live-feedback ${feedback}`}
            aria-label={
              feedback ||
              'feedback'
            }
          />
        </div>
      </header>

      <div
        ref={stage}
        className="switching-stage"
        onPointerMove={move}
        onPointerDown={click}
      >
        {targetSlots.map(
          (t, index) => (
            <button
              key={t.id}
              type="button"
              className="switch-target"
              onPointerDown={(e) =>
                hitTarget(
                  e,
                  index,
                )
              }
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: TARGET_SIZE,
                height: TARGET_SIZE,
              }}
              aria-label="타겟"
            >
              <span />
            </button>
          ),
        )}

        <CrosshairView
          config={crosshair}
          className="live-crosshair"
          style={{
            left: mouse.x,
            top: mouse.y,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />

        <div
          className={`switch-feedback-edge ${feedback}`}
          style={{
            pointerEvents: 'none',
          }}
        />

        <div
          className="switching-progress"
          style={{
            width: `${progress}%`,
            pointerEvents: 'none',
          }}
        />
      </div>
    </main>
  );
}