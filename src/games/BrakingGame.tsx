import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../utils/storage';

export interface BrakingResult {
  score: number;
  accuracy: number;
  avgStopMs: number;
  bestStopMs: number;
  consistency: number;
  successes: number;
  trials: number;
  difficulty: Difficulty;
  shots: number;
  movingShots: number;
  headHits: number;
  bodyHits: number;
  overshoots: number;
  undershoots: number;
  duration: number;
  timeLimit: number;
}

interface Props {
  onBack: () => void;
  onFinish: (r: BrakingResult) => void;
}

const ROUND = 30000;
const COUNTDOWN_MS = 650;

const DIFF: Record<
  Difficulty,
  {
    label: string;
    tag: string;
    desc: string;
    maxSpeed: number;
    accel: number;
    brakePower: number;
    stopSpeed: number;
    window: number;
  }
> = {
  newbie: {
    label: '응애 나 뉴비에요',
    tag: 'ENTRY',
    desc: '넓은 정지 창 · 카운터 스트레이프 감각',
    maxSpeed: 360,
    accel: 4.2,
    brakePower: 10.5,
    stopSpeed: 22,
    window: 14,
  },

  normal: {
    label: '이제 사람 구실 좀 해볼게요',
    tag: 'RANKED',
    desc: '실전 템포 · 짧은 정지 창',
    maxSpeed: 500,
    accel: 5.4,
    brakePower: 12.5,
    stopSpeed: 18,
    window: 9,
  },

  hard: {
    label: '나 정도면 실력자지',
    tag: 'HARD',
    desc: '빠른 이동 · 짧은 발사 창',
    maxSpeed: 620,
    accel: 6.5,
    brakePower: 14,
    stopSpeed: 15,
    window: 7,
  },

  hell: {
    label: '경쟁에서 캐리할게요',
    tag: 'HELL',
    desc: '프로 템포 · 극도로 짧은 발사 창',
    maxSpeed: 760,
    accel: 7.6,
    brakePower: 16,
    stopSpeed: 12,
    window: 5,
  },
};

type Phase =
  | 'intro'
  | 'countdown'
  | 'playing';

type ShotType =
  | 'head'
  | 'body'
  | 'miss'
  | 'moving';

type ShotState = {
  type: ShotType;
  x: number;
  id: number;
};

type TargetState = {
  x: number;
  direction: -1 | 1;
  id: number;
};

type Stats = {
  shots: number;
  successes: number;
  movingShots: number;
  headHits: number;
  bodyHits: number;
  overshoots: number;
  undershoots: number;

  stopTimes: number[];
};

const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);

const clamp = (
  value: number,
  min: number,
  max: number,
) => Math.max(min, Math.min(max, value));

const createStats = (): Stats => ({
  shots: 0,
  successes: 0,
  movingShots: 0,
  headHits: 0,
  bodyHits: 0,
  overshoots: 0,
  undershoots: 0,
  stopTimes: [],
});

export default function BrakingGame({
  onBack,
  onFinish,
}: Props) {
  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  const [phase, setPhase] =
    useState<Phase>('intro');

  const [difficulty, setDifficulty] =
    useState<Difficulty>('normal');

  const [count, setCount] =
    useState(3);

  const [time, setTime] =
    useState(30);

  const [player, setPlayer] =
    useState(50);

  const [target, setTarget] =
    useState(72);

  const [speed, setSpeed] =
    useState(0);

  const [canFire, setCanFire] =
    useState(false);

  const [message, setMessage] =
    useState('D로 이동 → A로 브레이크');

  const [shot, setShot] =
    useState<ShotState | null>(null);

  const [hud, setHud] = useState({
    hits: 0,
    shots: 0,
    head: 0,
    moving: 0,
  });

  /*
   * ============================================================
   * REFS
   * ============================================================
   */

  const phaseRef =
    useRef<Phase>('intro');

  const rafRef =
    useRef<number | null>(null);

  const timerRefs =
    useRef<number[]>([]);

  const startRef =
    useRef(0);

  const lastRef =
    useRef(0);

  const targetIdRef =
    useRef(0);

  const targetRef =
    useRef<TargetState | null>(null);

  const playerRef =
    useRef(50);

  const velocityRef =
    useRef(0);

  const directionRef =
    useRef<-1 | 0 | 1>(0);

  const brakeStartRef =
    useRef(0);

  const stoppedAtRef =
    useRef(0);

  const statsRef =
    useRef<Stats>(createStats());

  const keysRef =
    useRef({
      a: false,
      d: false,
    });

  const stoppedRef =
    useRef(false);

  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });

    timerRefs.current = [];
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(
        rafRef.current,
      );

      rafRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopLoop();
    clearTimers();

    keysRef.current.a = false;
    keysRef.current.d = false;
  }, [clearTimers, stopLoop]);

  /*
   * ============================================================
   * HUD
   * ============================================================
   */

  const syncHud = useCallback(() => {
    const s = statsRef.current;

    setHud({
      hits: s.successes,
      shots: s.shots,
      head: s.headHits,
      moving: s.movingShots,
    });
  }, []);

  /*
   * ============================================================
   * TARGET
   * ============================================================
   */

  const spawnTarget = useCallback(() => {
    if (
      phaseRef.current !== 'playing'
    ) {
      return;
    }

    const direction: -1 | 1 =
      Math.random() < 0.5
        ? -1
        : 1;

    const x =
      direction === 1
        ? rand(68, 84)
        : rand(16, 32);

    const targetState: TargetState = {
      x,
      direction,
      id: ++targetIdRef.current,
    };

    targetRef.current =
      targetState;

    /*
     * 항상 중앙에서 새 타겟으로 출발
     */
    playerRef.current = 50;
    velocityRef.current =
      direction *
      DIFF[difficulty].maxSpeed *
      rand(0.62, 0.78);

    directionRef.current =
      direction;

    brakeStartRef.current = 0;
    stoppedAtRef.current = 0;
    stoppedRef.current = false;

    setPlayer(50);
    setTarget(x);
    setSpeed(
      Math.abs(velocityRef.current),
    );
    setCanFire(false);
    setShot(null);

    setMessage(
      direction === 1
        ? 'D로 이동 → A로 브레이크'
        : 'A로 이동 → D로 브레이크',
    );
  }, [difficulty]);

  /*
   * ============================================================
   * NEXT TARGET
   * ============================================================
   */

  const scheduleNextTarget =
    useCallback(() => {
      const id =
        window.setTimeout(() => {
          if (
            phaseRef.current ===
            'playing'
          ) {
            spawnTarget();
          }
        }, 280);

      timerRefs.current.push(id);
    }, [spawnTarget]);

  /*
   * ============================================================
   * FINISH
   * ============================================================
   */

  const finish = useCallback(() => {
    if (
      phaseRef.current !==
      'playing'
    ) {
      return;
    }

    phaseRef.current = 'intro';

    cleanup();

    setPhase('intro');

    const s = statsRef.current;

    const stops =
      s.stopTimes.length > 0
        ? s.stopTimes
        : [0];

    const avgStopMs =
      s.stopTimes.length > 0
        ? s.stopTimes.reduce(
            (a, b) => a + b,
            0,
          ) /
          s.stopTimes.length
        : 0;

    const bestStopMs =
      s.stopTimes.length > 0
        ? Math.min(...s.stopTimes)
        : 0;

    /*
     * 정지시간의 표준편차
     */
    const variance =
      stops.reduce(
        (sum, value) =>
          sum +
          (value - avgStopMs) ** 2,
        0,
      ) / stops.length;

    const standardDeviation =
      Math.sqrt(variance);

    /*
     * 일관성
     *
     * 표준편차가 낮을수록 높게 평가.
     */
    const consistency =
      s.stopTimes.length > 0
        ? clamp(
            100 -
              standardDeviation *
                0.55,
            0,
            100,
          )
        : 0;

    const accuracy =
      s.shots > 0
        ? (s.successes /
            s.shots) *
          100
        : 0;

    /*
     * 헤드 적중률
     */
    const headRate =
      s.shots > 0
        ? (s.headHits /
            s.shots) *
          100
        : 0;

    /*
     * 움직이는 상태에서 발사한 비율
     */
    const movingRate =
      s.shots > 0
        ? (s.movingShots /
            s.shots) *
          100
        : 0;

    /*
     * 점수
     *
     * 정확도 45
     * 헤드 25
     * 정지 일관성 20
     * 움직임 제어 10
     */
    const score = Math.round(
      clamp(
        accuracy * 0.45 +
          headRate * 0.25 +
          consistency * 0.2 +
          Math.max(
            0,
            100 - movingRate * 2,
          ) *
            0.1,
        0,
        100,
      ),
    );

    const duration = clamp(
      (performance.now() -
        startRef.current) /
        1000,
      0,
      ROUND / 1000,
    );

    onFinish({
      score,
      accuracy,
      avgStopMs,
      bestStopMs,
      consistency,

      successes: s.successes,
      trials: s.shots,

      difficulty,

      shots: s.shots,
      movingShots: s.movingShots,

      headHits: s.headHits,
      bodyHits: s.bodyHits,

      overshoots: s.overshoots,
      undershoots: s.undershoots,

      duration,
      timeLimit: ROUND / 1000,
    });
  }, [
    cleanup,
    difficulty,
    onFinish,
  ]);

  /*
   * ============================================================
   * SHOOT
   * ============================================================
   */

  const shoot = useCallback(() => {
    if (
      phaseRef.current !==
      'playing'
    ) {
      return;
    }

    const targetState =
      targetRef.current;

    if (!targetState) {
      return;
    }

    const d =
      DIFF[difficulty];

    const playerPosition =
      playerRef.current;

    const distance =
      Math.abs(
        playerPosition -
          targetState.x,
      );

    /*
     * lane 기준으로 계산하기 때문에
     * 실제 화면에서는 적당한 px 값으로 환산.
     *
     * 100% = lane 전체
     */
    const laneWidth =
      document.querySelector(
        '.braking-lane',
      )?.getBoundingClientRect()
        .width ?? 1000;

    const distancePx =
      (distance / 100) *
      laneWidth;

    const currentSpeed =
      Math.abs(
        velocityRef.current,
      );

    const s =
      statsRef.current;

    s.shots += 1;

    /*
     * ----------------------------------------------------------
     * 1. 움직이는 상태에서 발사
     * ----------------------------------------------------------
     */

    if (
      currentSpeed >
      d.stopSpeed
    ) {
      s.movingShots += 1;

      setShot({
        type: 'moving',
        x: playerPosition,
        id: targetState.id,
      });

      setMessage(
        `MOVING SHOT · 속도 ${Math.round(
          currentSpeed,
        )}`,
      );

      syncHud();

      scheduleNextTarget();

      return;
    }

    /*
     * ----------------------------------------------------------
     * 2. 완전히 멈췄지만 타겟을 빗나감
     * ----------------------------------------------------------
     */

    const bodyRadius =
      Math.max(
        6,
        d.window,
      ) + 11;

    if (
      distancePx >
      bodyRadius
    ) {
      if (
        playerPosition <
        targetState.x
      ) {
        s.undershoots += 1;
      } else {
        s.overshoots += 1;
      }

      setShot({
        type: 'miss',
        x: playerPosition,
        id: targetState.id,
      });

      setMessage(
        `MISS · 오차 ${Math.round(
          distancePx,
        )}px`,
      );

      syncHud();

      scheduleNextTarget();

      return;
    }

    /*
     * ----------------------------------------------------------
     * 3. 정상 적중
     * ----------------------------------------------------------
     */

    s.successes += 1;

    const stopMs =
      brakeStartRef.current > 0 &&
      stoppedAtRef.current > 0
        ? Math.max(
            0,
            stoppedAtRef.current -
              brakeStartRef.current,
          )
        : 0;

    s.stopTimes.push(stopMs);

    const headRadius =
      Math.max(
        5,
        d.window,
      );

    const isHead =
      distancePx <=
      headRadius;

    if (isHead) {
      s.headHits += 1;

      setShot({
        type: 'head',
        x: playerPosition,
        id: targetState.id,
      });

      setMessage(
        `HEAD HIT · 오차 ${Math.round(
          distancePx,
        )}px · 정지 ${Math.round(
          stopMs,
        )}ms`,
      );
    } else {
      s.bodyHits += 1;

      setShot({
        type: 'body',
        x: playerPosition,
        id: targetState.id,
      });

      setMessage(
        `BODY HIT · 오차 ${Math.round(
          distancePx,
        )}px`,
      );
    }

    syncHud();

    scheduleNextTarget();
  }, [
    difficulty,
    scheduleNextTarget,
    syncHud,
  ]);

  /*
   * ============================================================
   * GAME LOOP
   * ============================================================
   */

  const loop = useCallback(
    (now: number) => {
      if (
        phaseRef.current !==
        'playing'
      ) {
        return;
      }

      const d =
        DIFF[difficulty];

      /*
       * 30초 종료
       */
      const elapsed =
        now -
        startRef.current;

      if (
        elapsed >= ROUND
      ) {
        finish();
        return;
      }

      setTime(
        Math.max(
          0,
          Math.ceil(
            (ROUND - elapsed) /
              1000,
          ),
        ),
      );

      /*
       * 안정적인 delta time
       */
      const dt = clamp(
        (now - lastRef.current) /
          1000,
        0.004,
        0.025,
      );

      lastRef.current = now;

      const input =
        (keysRef.current.d
          ? 1
          : 0) -
        (keysRef.current.a
          ? 1
          : 0);

      const oldVelocity =
        velocityRef.current;

      /*
       * ----------------------------------------------------------
       * 이동
       * ----------------------------------------------------------
       */

      if (input === 0) {
        /*
         * 키를 놓으면 자연 감속
         */
        const friction =
          d.maxSpeed *
          4.5 *
          dt;

        if (
          Math.abs(
            velocityRef.current,
          ) <= friction
        ) {
          velocityRef.current = 0;
        } else {
          velocityRef.current -=
            Math.sign(
              velocityRef.current,
            ) *
            friction;
        }
      }

      /*
       * ----------------------------------------------------------
       * 카운터 스트레이프
       * ----------------------------------------------------------
       */

      const reversing =
        input !== 0 &&
        oldVelocity !== 0 &&
        Math.sign(input) !==
          Math.sign(oldVelocity);

      if (reversing) {
        if (
          brakeStartRef.current ===
          0
        ) {
          brakeStartRef.current =
            now;

          stoppedAtRef.current = 0;
          stoppedRef.current = false;

          setMessage(
            'BRAKING... 속도를 죽이는 중',
          );
        }

        const brakeAmount =
          d.maxSpeed *
          d.brakePower *
          dt;

        if (
          Math.abs(
            velocityRef.current,
          ) <= brakeAmount
        ) {
          velocityRef.current = 0;
        } else {
          velocityRef.current -=
            Math.sign(
              velocityRef.current,
            ) *
            brakeAmount;
        }
      } else if (
        input !== 0
      ) {
        /*
         * 완전히 정지 후
         * 반대 방향으로 다시 이동
         */
        if (
          velocityRef.current === 0
        ) {
          directionRef.current =
            input as -1 | 1;
        }

        velocityRef.current +=
          input *
          d.maxSpeed *
          d.accel *
          dt;
      }

      /*
       * 속도 제한
       */
      velocityRef.current =
        clamp(
          velocityRef.current,
          -d.maxSpeed,
          d.maxSpeed,
        );

      const absSpeed =
        Math.abs(
          velocityRef.current,
        );

      /*
       * ----------------------------------------------------------
       * 정지 판정
       * ----------------------------------------------------------
       */

      const isStopped =
        absSpeed <=
        d.stopSpeed;

      if (isStopped) {
        /*
         * 거의 0이면 실제 0으로 고정
         */
        if (
          absSpeed <=
          d.stopSpeed * 0.35
        ) {
          velocityRef.current = 0;
        }

        if (
          !stoppedRef.current &&
          brakeStartRef.current > 0
        ) {
          stoppedRef.current = true;

          stoppedAtRef.current =
            now;

          setMessage(
            'STOPPED — FIRE',
          );
        }
      } else {
        stoppedRef.current = false;
      }

      /*
       * 발사 가능 상태
       */
      setCanFire(
        isStopped &&
          stoppedRef.current,
      );

      /*
       * ----------------------------------------------------------
       * 위치 업데이트
       * ----------------------------------------------------------
       */

      const nextPosition =
        playerRef.current +
        (velocityRef.current *
          dt) /
          10;

      if (
        nextPosition <= 8
      ) {
        playerRef.current = 8;

        if (
          velocityRef.current <
          0
        ) {
          velocityRef.current = 0;
        }
      } else if (
        nextPosition >= 92
      ) {
        playerRef.current = 92;

        if (
          velocityRef.current >
          0
        ) {
          velocityRef.current = 0;
        }
      } else {
        playerRef.current =
          nextPosition;
      }

      /*
       * React UI 업데이트
       */
      setPlayer(
        playerRef.current,
      );

      setSpeed(
        Math.abs(
          velocityRef.current,
        ),
      );

      rafRef.current =
        requestAnimationFrame(
          loop,
        );
    },
    [difficulty, finish],
  );

  /*
   * ============================================================
   * BEGIN
   * ============================================================
   */

  const begin = useCallback(() => {
    cleanup();

    statsRef.current =
      createStats();

    targetRef.current = null;

    targetIdRef.current = 0;

    playerRef.current = 50;

    velocityRef.current = 0;

    directionRef.current = 0;

    brakeStartRef.current = 0;

    stoppedAtRef.current = 0;

    stoppedRef.current = false;

    setHud({
      hits: 0,
      shots: 0,
      head: 0,
      moving: 0,
    });

    setPlayer(50);
    setTarget(72);
    setSpeed(0);
    setCanFire(false);
    setShot(null);
    setTime(30);

    phaseRef.current =
      'countdown';

    setPhase('countdown');

    setCount(3);

    let current = 3;

    const countdown =
      window.setInterval(() => {
        current -= 1;

        setCount(
          Math.max(0, current),
        );

        if (current <= 0) {
          window.clearInterval(
            countdown,
          );

          phaseRef.current =
            'playing';

          setPhase('playing');

          startRef.current =
            performance.now();

          lastRef.current =
            performance.now();

          spawnTarget();

          rafRef.current =
            requestAnimationFrame(
              loop,
            );

          /*
           * 게임 시간 제한
           */
          const gameTimer =
            window.setInterval(() => {
              if (
                phaseRef.current !==
                'playing'
              ) {
                window.clearInterval(
                  gameTimer,
                );

                return;
              }

              const elapsed =
                performance.now() -
                startRef.current;

              if (
                elapsed >= ROUND
              ) {
                window.clearInterval(
                  gameTimer,
                );

                finish();
              }
            }, 100);

          timerRefs.current.push(
            gameTimer,
          );
        }
      }, COUNTDOWN_MS);

    timerRefs.current.push(
      countdown,
    );
  }, [
    cleanup,
    finish,
    loop,
    spawnTarget,
  ]);

  /*
   * ============================================================
   * KEY EVENTS
   * ============================================================
   */

  useEffect(() => {
    const down = (
      e: KeyboardEvent,
    ) => {
      const key =
        e.key.toLowerCase();

      if (
        key !== 'a' &&
        key !== 'd'
      ) {
        return;
      }

      e.preventDefault();

      keysRef.current[
        key as 'a' | 'd'
      ] = true;
    };

    const up = (
      e: KeyboardEvent,
    ) => {
      const key =
        e.key.toLowerCase();

      if (
        key !== 'a' &&
        key !== 'd'
      ) {
        return;
      }

      e.preventDefault();

      keysRef.current[
        key as 'a' | 'd'
      ] = false;
    };

    const blur = () => {
      keysRef.current.a = false;
      keysRef.current.d = false;
    };

    window.addEventListener(
      'keydown',
      down,
    );

    window.addEventListener(
      'keyup',
      up,
    );

    window.addEventListener(
      'blur',
      blur,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        down,
      );

      window.removeEventListener(
        'keyup',
        up,
      );

      window.removeEventListener(
        'blur',
        blur,
      );
    };
  }, []);

  /*
   * ============================================================
   * UNMOUNT
   * ============================================================
   */

  useEffect(() => {
    return () => {
      phaseRef.current =
        'intro';

      cleanup();
    };
  }, [cleanup]);

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
            onClick={onBack}
          >
            ← EXIT
          </button>

          <div>
            <p className="eyebrow">
              BRAKING // COUNTER-STRAFE
            </p>

            <h1>
              브레이킹 훈련
            </h1>
          </div>

          <div className="game-help">
            30 SEC
          </div>
        </header>

        <section className="setup panel">
          <p className="eyebrow">
            MOVE → COUNTER → STOP → FIRE
          </p>

          <h2>
            움직임을 멈추는 순간을
            정확하게 잡아.
          </h2>

          <p className="setup-copy">
            A / D로 이동하고 반대 방향
            키를 눌러 속도를 줄입니다.
            완전히 멈춘 순간 타겟을 클릭하세요.
            움직이는 상태에서 클릭하면
            MOVING SHOT으로 기록됩니다.
          </p>

          <div className="choice-grid difficulty-grid">
            {(
              Object.entries(
                DIFF,
              ) as [
                Difficulty,
                (typeof DIFF)[Difficulty],
              ][]
            ).map(
              ([id, d]) => (
                <button
                  key={id}
                  className={`choice-card difficulty-${id} ${
                    difficulty === id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() =>
                    setDifficulty(id)
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
                    최대 {d.maxSpeed}
                    px/s · 정지창 ±
                    {d.window}px
                  </small>
                </button>
              ),
            )}
          </div>

          <button
            className="primary-btn wide"
            onClick={begin}
          >
            ▶ BRAKING 시작 · 30초
          </button>
        </section>
      </main>
    );
  }

  /*
   * ============================================================
   * COUNTDOWN
   * ============================================================
   */

  if (
    phase === 'countdown'
  ) {
    return (
      <main className="game-page">
        <div className="countdown-screen">
          <div className="countdown-card clean-countdown">
            <strong>
              {count}
            </strong>
          </div>
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
              'intro';

            cleanup();

            targetRef.current =
              null;

            setTarget(72);

            setPhase('intro');

            onBack();
          }}
        >
          × 종료
        </button>

        <div>
          <b>
            COUNTER-STRAFE //
            STOP → AIM → SHOOT
          </b>

          <span>
            {DIFF[difficulty].label}
          </span>
        </div>

        <div className="live-stats">
          <span>
            HIT{' '}
            <b>
              {hud.hits}
            </b>
          </span>

          <span>
            SHOT{' '}
            <b>
              {hud.shots}
            </b>
          </span>

          <span>
            HEAD{' '}
            <b>
              {hud.head}
            </b>
          </span>

          <span>
            MOVING{' '}
            <b>
              {hud.moving}
            </b>
          </span>

          <span>
            TIME{' '}
            <b>
              {time}s
            </b>
          </span>
        </div>
      </header>

      <div className="braking-stage">
        <div className="braking-lane">
          <div className="braking-center" />

          <div
            className={`braking-target ${
              canFire
                ? 'fire-window'
                : ''
            }`}
            style={{
              left: `${target}%`,
            }}
          >
            <span>
              ENEMY
            </span>

            <i />
          </div>

          <div
            className={`braking-player ${
              canFire
                ? 'player-stopped'
                : ''
            }`}
            style={{
              left: `${player}%`,
            }}
          />
        </div>

        <div
          className={`braking-direction ${
            canFire
              ? 'stopped'
              : ''
          }`}
        >
          {canFire
            ? 'STOPPED — FIRE'
            : speed < 30
              ? 'BRAKE'
              : 'STRAFE'}
        </div>

        {shot && (
          <div
            key={shot.id}
            className={`braking-shot ${shot.type}`}
            style={{
              left: `${shot.x}%`,
            }}
          >
            {shot.type === 'head'
              ? 'HEADSHOT'
              : shot.type === 'body'
                ? 'BODY HIT'
                : shot.type ===
                    'moving'
                  ? 'MOVING SHOT'
                  : 'MISS'}
          </div>
        )}

        <button
          type="button"
          className={`braking-crosshair ${
            canFire
              ? 'ready'
              : ''
          }`}
          onPointerDown={(
            e,
          ) => {
            e.preventDefault();

            shoot();
          }}
          aria-label="Shoot"
        >
          +
        </button>

        <h2>
          {message}
        </h2>

        <p>
          A / D 이동 → 반대 키로
          브레이크 →{' '}
          <b>
            정지 상태에서 클릭
          </b>{' '}
          ·{' '}
          <b>
            30초 무제한 타겟
          </b>
        </p>
      </div>
    </main>
  );
}