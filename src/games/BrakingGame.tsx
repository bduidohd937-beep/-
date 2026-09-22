import {useEffect,useRef,useState} from 'react';
import type {Difficulty} from '../utils/storage';

export interface BrakingResult{
  score:number;
  accuracy:number;
  avgStopMs:number;
  bestStopMs:number;
  consistency:number;
  successes:number;
  trials:number;
  difficulty:Difficulty;
  shots:number;
  movingShots:number;
  headHits:number;
  bodyHits:number;
  overshoots:number;
  undershoots:number;
  duration:number;
  timeLimit:number;
}

interface Props{
  onBack:()=>void;
  onFinish:(r:BrakingResult)=>void
}

const TIME_LIMIT=30;

const DIFF:Record<Difficulty,{
  label:string;
  tag:string;
  desc:string;
  maxSpeed:number;
  accel:number;
  window:number;
  bodyRadius:number;
  headRadius:number;
}>={
  newbie:{
    label:'응애 나 뉴비에요',
    tag:'ENTRY',
    desc:'넓은 정지 창 · 카운터 스트레이프 감각',
    maxSpeed:360,
    accel:4.2,
    window:14,
    bodyRadius:20,
    headRadius:9
  },

  normal:{
    label:'이제 사람 구실 좀 해볼게요',
    tag:'RANKED',
    desc:'실전 템포 · 짧은 정지 창',
    maxSpeed:500,
    accel:5.4,
    window:9,
    bodyRadius:18,
    headRadius:8
  },

  hard:{
    label:'나 정도면 실력자지',
    tag:'HARD',
    desc:'빠른 이동 · 짧은 발사 창',
    maxSpeed:620,
    accel:6.5,
    window:7,
    bodyRadius:15,
    headRadius:7
  },

  hell:{
    label:'경쟁에서 캐리할게요',
    tag:'HELL',
    desc:'프로 템포 · 극도로 짧은 발사 창',
    maxSpeed:760,
    accel:7.6,
    window:5,
    bodyRadius:12,
    headRadius:5
  }
};

const rand=(a:number,b:number)=>
  a+Math.random()*(b-a);

export default function BrakingGame({
  onBack,
  onFinish
}:Props){

  const [
    difficulty,
    setDifficulty
  ]=useState<Difficulty>('normal');

  const [
    phase,
    setPhase
  ]=useState<'intro'|'live'>('intro');

  const [
    shots,
    setShots
  ]=useState(0);

  const [
    speed,
    setSpeed
  ]=useState(0);

  const [
    timeLeft,
    setTimeLeft
  ]=useState(TIME_LIMIT);

  const [
    player,
    setPlayer
  ]=useState(50);

  const [
    target,
    setTarget
  ]=useState(72);

  const [
    message,
    setMessage
  ]=useState('');

  const [
    shot,
    setShot
  ]=useState<{
    type:'head'|'body'|'miss'|'moving';
    x:number
  }|null>(null);

  const [
    canFire,
    setCanFire
  ]=useState(false);

  const keys=useRef({
    a:false,
    d:false
  });

  const raf=useRef(0);

  const last=useRef(0);

  const pos=useRef(50);

  const vel=useRef(0);

  const targetRef=useRef(72);

  const phaseRef=
    useRef<'intro'|'live'>('intro');

  const brakeStart=useRef(0);

  const stopAt=useRef(0);

  const stableSince=useRef(0);

  const startAt=useRef(0);

  const stats=useRef({
    stops:[] as number[],
    success:0,
    shots:0,
    moving:0,
    head:0,
    body:0,
    over:0,
    under:0
  });

  const cleanup=()=>{
    cancelAnimationFrame(
      raf.current
    );
  };

  const finish=()=>{
    if(
      phaseRef.current!=='live'
    )return;

    cleanup();

    phaseRef.current='intro';

    setPhase('intro');

    const st=stats.current;

    const stops=
      st.stops.length
        ?st.stops
        :[999];

    const avg=
      stops.reduce(
        (a,b)=>a+b,
        0
      )/stops.length;

    const best=
      Math.min(...stops);

    const sd=Math.sqrt(
      stops.reduce(
        (a,b)=>
          a+(b-avg)**2,
        0
      )/stops.length
    );

    const cons=Math.max(
      0,
      Math.min(
        100,
        100-sd*.55
      )
    );

    const acc=
      st.shots
        ?st.success/
          st.shots*
          100
        :0;

    const head=
      st.shots
        ?st.head/
          st.shots*
          100
        :0;

    const movingPenalty=
      st.shots
        ?st.moving/
          st.shots*
          100
        :0;

    const score=Math.round(
      Math.max(
        0,
        Math.min(
          100,
          acc*.45+
          head*.35+
          cons*.2-
          movingPenalty*.12
        )
      )
    );

    onFinish({
      score,
      accuracy:acc,
      avgStopMs:avg,
      bestStopMs:best,
      consistency:cons,
      successes:st.success,
      trials:st.shots,
      difficulty,
      shots:st.shots,
      movingShots:st.moving,
      headHits:st.head,
      bodyHits:st.body,
      overshoots:st.over,
      undershoots:st.under,
      duration:Math.min(
        TIME_LIMIT,
        (performance.now()-
          startAt.current)/
          1000
      ),
      timeLimit:TIME_LIMIT
    });
  };

  /*
   * 타겟 생성
   *
   * 기존에는:
   * 왼쪽 16~32
   * 오른쪽 68~84
   *
   * 변경:
   * 훨씬 넓은 범위에서 랜덤 생성.
   *
   * 이동 방향과 타겟 위치가
   * 매번 조금씩 달라지도록 함.
   */
  const nextTarget=()=>{

    const d=DIFF[difficulty];

    const dir:1|-1=
      Math.random()>.5
        ?1
        :-1;

    let tx:number;

    if(dir>0){

      /*
       * 오른쪽 방향 이동
       * 타겟은 오른쪽 영역에서
       * 넓게 랜덤.
       */
      tx=rand(58,88);

    }else{

      /*
       * 왼쪽 방향 이동
       * 타겟은 왼쪽 영역에서
       * 넓게 랜덤.
       */
      tx=rand(12,42);
    }

    /*
     * 가끔 중앙 근처도 나오게 해서
     * 패턴을 더 깨준다.
     */
    if(Math.random()<0.22){

      if(dir>0){
        tx=rand(48,72);
      }else{
        tx=rand(28,52);
      }
    }

    targetRef.current=tx;

    pos.current=50;

    /*
     * 매번 출발 속도도 조금씩 랜덤.
     */
    const speedRatio=
      0.62+
      Math.random()*
      0.20;

    vel.current=
      dir*
      d.maxSpeed*
      speedRatio;

    setPlayer(50);

    setTarget(tx);

    setSpeed(
      Math.abs(vel.current)
    );

    setShot(null);

    setCanFire(false);

    setMessage(
      dir>0
        ?'D로 이동 → A로 브레이크 → 완전 정지 후 발사'
        :'A로 이동 → D로 브레이크 → 완전 정지 후 발사'
    );

    brakeStart.current=0;

    stopAt.current=0;

    stableSince.current=0;

    last.current=
      performance.now();
  };

  const begin=()=>{

    cleanup();

    phaseRef.current='live';

    stats.current={
      stops:[],
      success:0,
      shots:0,
      moving:0,
      head:0,
      body:0,
      over:0,
      under:0
    };

    setShots(0);

    setTimeLeft(
      TIME_LIMIT
    );

    setPhase('live');

    startAt.current=
      performance.now();

    nextTarget();

    raf.current=
      requestAnimationFrame(
        loop
      );
  };

  const loop=(now:number)=>{

    if(
      phaseRef.current!=='live'
    )return;

    const d=DIFF[difficulty];

    const elapsed=
      (now-startAt.current)/
      1000;

    if(
      elapsed>=TIME_LIMIT
    ){
      finish();
      return;
    }

    setTimeLeft(
      Math.max(
        0,
        Math.ceil(
          TIME_LIMIT-
          elapsed
        )
      )
    );

    const dt=Math.min(
      .025,
      Math.max(
        .004,
        (now-last.current)/
        1000
      )
    );

    last.current=now;

    const input=
      (keys.current.d?1:0)-
      (keys.current.a?1:0);

    const reversing=
      input!==0&&
      vel.current!==0&&
      Math.sign(input)!==
      Math.sign(vel.current);

    /*
     * 키를 떼면 즉시 정지.
     */
    if(input===0){

      vel.current=0;

    }else if(reversing){

      /*
       * 반대 키를 누르면
       * 카운터 스트레이프로 즉시 정지.
       */
      if(
        brakeStart.current===0
      ){
        brakeStart.current=
          now;
      }

      vel.current=0;

    }else{

      /*
       * 정상 이동.
       */
      vel.current+=
        input*
        d.maxSpeed*
        d.accel*
        dt;
    }

    vel.current=Math.max(
      -d.maxSpeed,
      Math.min(
        d.maxSpeed,
        vel.current
      )
    );

    const abs=
      Math.abs(vel.current);

    /*
     * 정지 판정.
     */
    if(
      abs<
      d.maxSpeed*.055
    ){

      if(
        !stableSince.current
      ){
        stableSince.current=
          now;
      }

      if(
        !stopAt.current
      ){
        stopAt.current=now;
      }

    }else{

      stableSince.current=0;

      stopAt.current=0;
    }

    setCanFire(
      abs<
      d.maxSpeed*.055
    );

    pos.current=Math.max(
      8,
      Math.min(
        92,
        pos.current+
        vel.current*
        dt/
        10
      )
    );

    setPlayer(
      pos.current
    );

    setSpeed(abs);

    raf.current=
      requestAnimationFrame(
        loop
      );
  };

  const shoot=()=>{

    if(
      phaseRef.current!=='live'
    )return;

    const d=DIFF[difficulty];

    const lane=
      document.querySelector<HTMLDivElement>(
        '.braking-lane'
      );

    const laneWidth=
      lane?.getBoundingClientRect()
        .width||1000;

    const distPct=
      Math.abs(
        pos.current-
        targetRef.current
      );

    const distPx=
      distPct*
      laneWidth/
      100;

    /*
     * 난이도별 움직이는 상태 판정.
     */
    const moving=
      Math.abs(vel.current)>
      d.maxSpeed*.055;

    /*
     * 난이도별 헤드/몸 판정.
     *
     * NEWBIE
     * BODY ±20 / HEAD ±9
     *
     * NORMAL
     * BODY ±18 / HEAD ±8
     *
     * HARD
     * BODY ±15 / HEAD ±7
     *
     * HELL
     * BODY ±12 / HEAD ±5
     */
    const headRadius=
      d.headRadius;

    const bodyRadius=
      d.bodyRadius;

    const st=stats.current;

    st.shots++;

    setShots(
      st.shots
    );

    /*
     * 움직이는 상태에서 발사.
     */
    if(moving){

      st.moving++;

      setShot({
        type:'moving',
        x:pos.current
      });

      setMessage(
        `MOVING SHOT · ${Math.round(
          Math.abs(
            vel.current
          )
        )}px/s`
      );

    }

    /*
     * 몸 판정 범위 밖.
     */
    else if(
      distPx>
      bodyRadius
    ){

      if(
        pos.current<
        targetRef.current
      ){
        st.under++;
      }else{
        st.over++;
      }

      setShot({
        type:'miss',
        x:pos.current
      });

      setMessage(
        `MISS · 중심 오차 ${Math.round(
          distPx
        )}px`
      );

    }

    /*
     * 정상 적중.
     */
    else{

      const stopMs=
        brakeStart.current&&
        stopAt.current
          ?stopAt.current-
            brakeStart.current
          :0;

      st.stops.push(
        stopMs
      );

      st.success++;

      const head=
        distPx<=
        headRadius;

      if(head){

        st.head++;

      }else{

        st.body++;

      }

      setShot({
        type:
          head
            ?'head'
            :'body',
        x:pos.current
      });

      setMessage(
        head
          ?`HEAD HIT · 오차 ${Math.round(
              distPx
            )}px · ${Math.round(
              stopMs
            )}ms`
          :`BODY HIT · 오차 ${Math.round(
              distPx
            )}px`
      );
    }

    /*
     * 다음 타겟.
     */
    setTimeout(()=>{
      if(
        phaseRef.current===
        'live'
      ){
        nextTarget();
      }
    },260);
  };

  useEffect(()=>{

    const down=(
      e:KeyboardEvent
    )=>{

      const k=
        e.key.toLowerCase();

      if(
        k==='a'||
        k==='d'
      ){

        e.preventDefault();

        keys.current[
          k as 'a'|'d'
        ]=true;
      }
    };

    const up=(
      e:KeyboardEvent
    )=>{

      const k=
        e.key.toLowerCase();

      if(
        k==='a'||
        k==='d'
      ){

        e.preventDefault();

        keys.current[
          k as 'a'|'d'
        ]=false;
      }
    };

    window.addEventListener(
      'keydown',
      down
    );

    window.addEventListener(
      'keyup',
      up
    );

    return()=>{

      window.removeEventListener(
        'keydown',
        down
      );

      window.removeEventListener(
        'keyup',
        up
      );

      cleanup();
    };

  },[]);

  /*
   * INTRO
   */
  if(
    phase==='intro'
  ){

    return(
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
            정해진 시간 동안 얼마나 정확하게 멈추는지 측정해.
          </h2>

          <p className="setup-copy">
            30초 동안 타겟 수 제한 없이 반복합니다.
            A/D로 이동하고 반대 키로 속도를 죽인 뒤,
            정지 상태에서 클릭하세요.
            움직이는 상태에서 쏘면 MOVING SHOT으로 기록됩니다.
          </p>

          <div className="choice-grid difficulty-grid">

            {Object.entries(DIFF).map(
              ([id,d])=>(
                <button
                  key={id}
                  className={`choice-card difficulty-${id} ${
                    difficulty===id
                      ?'selected'
                      :''
                  }`}
                  onClick={()=>
                    setDifficulty(
                      id as Difficulty
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
                    최대 {d.maxSpeed}px/s · 정지창 ±{d.window}px
                  </small>

                </button>
              )
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
   * LIVE
   */
  return(

    <main className="game-page training-live">

      <header className="live-hud">

        <button
          className="back-btn"
          onClick={()=>{
            phaseRef.current='intro';

            cleanup();

            onBack();
          }}
        >
          × 종료
        </button>

        <div>

          <b>
            COUNTER-STRAFE // STOP → AIM → SHOOT
          </b>

          <span>
            {DIFF[difficulty].label}
          </span>

        </div>

        <div className="live-stats">

          <span>
            HIT <b>
              {stats.current.success}
            </b>
          </span>

          <span>
            SHOT <b>
              {shots}
            </b>
          </span>

          <span>
            COMBO <b>
              —
            </b>
          </span>

          <span>
            TIME <b>
              {timeLeft}s
            </b>
          </span>

        </div>

      </header>

      <div className="braking-stage">

        <div className="braking-lane">

          <div className="braking-center"/>
<div
  className={`braking-target ${
    canFire ? 'fire-window' : ''
  }`}
  style={{
    left: `${target}%`,
    width: `${DIFF[difficulty].bodyRadius * 2}px`,
    height: '82px'
  }}
>

            <span>
              ENEMY
            </span>

            <i
  style={{
    width: `${DIFF[difficulty].headRadius * 2}px`,
    height: `${DIFF[difficulty].headRadius * 2}px`
  }}
/>

          </div>

          <div
            className="braking-player"
            style={{
              left:`${player}%`
            }}
          />

        </div>

        <div
          className={`braking-direction ${
            canFire
              ?'stopped'
              :''
          }`}
        >

          {canFire
            ?'STOPPED — FIRE'
            :speed<30
              ?'BRAKE'
              :'STRAFE'}

        </div>

        {shot&&(

          <div
            className={`braking-shot ${shot.type}`}
            style={{
              left:`${shot.x}%`
            }}
          >

            {shot.type==='head'
              ?'HEADSHOT'
              :shot.type==='body'
                ?'BODY HIT'
                :shot.type==='moving'
                  ?'MOVING SHOT'
                  :'MISS'}

          </div>

        )}

        <div
          className="braking-crosshair"
          onClick={shoot}
        >
          +
        </div>

        <h2>
          {message}
        </h2>

        <p>
          A / D 이동 → 반대 키로 브레이크 →{' '}
          <b>
            정지 상태에서 클릭
          </b>{' '}
          · <b>
            30초 무제한 타겟
          </b>
        </p>

      </div>

    </main>
  );
}