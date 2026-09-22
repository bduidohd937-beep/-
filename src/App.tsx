import Result from "./Result";
import {useState} from 'react';
import FlickGame,{type FlickResult} from './games/FlickGame';
import ReactionGame,{type ReactionResult} from './games/ReactionGame';
import TrackingGame,{type TrackingResult} from './games/TrackingGame';
import BrakingGame,{type BrakingResult} from './games/BrakingGame';
import SwitchingGame,{type SwitchingResult} from './games/SwitchingGame';
import MicroFlickGame,{type MicroFlickResult} from './games/MicroFlickGame';
import SensitivityLab from './utils/SensitivityLab';
import {loadHistory,saveResult,type TrainingRecord,type TrainingType} from './utils/storage';
import {CROSSHAIR_PRESETS,loadCrosshair,saveCrosshair,type CrosshairConfig,parseValorantCrosshairCode} from './utils/crosshair';
import CrosshairView from './utils/CrosshairView';
import {loadSensitivity,saveSensitivity,type SensitivityConfig} from './utils/sensitivity';
import {getRank,RANKS} from './assets/ranks';

type View='home'|'flick'|'reaction'|'tracking'|'braking'|'switching'|'micro'|'result'|'sensitivity'|'growth'|'crosshair';

type Last=
  |{type:'flick';data:FlickResult}
  |{type:'reaction';data:ReactionResult}
  |{type:'tracking';data:TrackingResult}
  |{type:'braking';data:BrakingResult}
  |{type:'switching';data:SwitchingResult}
  |{type:'micro';data:MicroFlickResult}
  |null;

const TIER_COLORS=[
  '#7f8a94',
  '#8d98a3',
  '#b87956',
  '#c7cbd1',
  '#f2c94c',
  '#59b8ff',
  '#7f8cff',
  '#b16cff',
  '#ff6b6b',
  '#ff4b7a',
];

const getProgress=(history:TrainingRecord[])=>{
  const total=history.reduce(
    (sum,r)=>
      sum+
      Math.max(
        0,
        Math.min(
          100,
          r.score>100?r.score/100:r.score
        )
      ),
    0
  );

  const level=Math.max(
    1,
    Math.floor(total/100)+1
  );

  /*
   * 랭크 구조
   *
   * 0  언랭
   * 1  아이언 1
   * 2  아이언 2
   * 3  아이언 3
   * 4  브론즈 1
   * 5  브론즈 2
   * 6  브론즈 3
   * 7  실버 1
   * 8  실버 2
   * 9  실버 3
   * 10 골드 1
   * 11 골드 2
   * 12 골드 3
   * 13 플래티넘 1
   * 14 플래티넘 2
   * 15 플래티넘 3
   *
   * 현재는 플래티넘 3까지만 이미지가 있으므로
   * 이후 점수는 플래티넘 3에 고정.
   */
  const rankIndex=Math.min(
    RANKS.length-1,
    Math.floor((level-1)/5)
  );

  const rank=getRank(rankIndex);

  const rankStart=rankIndex*500;
  const rankEnd=(rankIndex+1)*500;

  const rankProgress=Math.min(
    100,
    Math.max(
      0,
      ((total-rankStart)/(rankEnd-rankStart))*100
    )
  );

  return{
    total,
    level,
    rankIndex,
    rank,
    tier:rank.name,
    next:Math.max(
      0,
      rankEnd-total
    ),
    rankProgress,
  };
};

export default function App(){
  const[view,setView]=useState<View>('home');
  const[last,setLast]=useState<Last>(null);
  const[history,setHistory]=useState<TrainingRecord[]>(
    ()=>loadHistory()
  );
  const[crosshair,setCrosshair]=useState(
    ()=>loadCrosshair()
  );
  const[sens,setSens]=useState<SensitivityConfig>(
    ()=>loadSensitivity()
  );

  const finish=(r:TrainingRecord,l:Last)=>{
    saveResult(r);
    setHistory(loadHistory());
    setLast(l);
    setView('result');
  };

  const flick=(d:FlickResult)=>
    finish(
      {
        id:crypto.randomUUID(),
        timestamp:Date.now(),
        type:'flick',
        score:d.score,
        accuracy:d.accuracy,
        reactionMs:d.avgReactionMs,
        hits:d.hits,
        shots:d.shots,
        bestMs:d.bestReactionMs,
        overshoots:d.overshoots,
        mode:d.mode,
        difficulty:d.difficulty
      },
      {type:'flick',data:d}
    );

  const reaction=(d:ReactionResult)=>
    finish(
      {
        id:crypto.randomUUID(),
        timestamp:Date.now(),
        type:'reaction',
        score:d.score,
        accuracy:d.consistency,
        reactionMs:d.averageMs,
        hits:d.trials,
        shots:d.trials,
        bestMs:d.bestMs,
        consistency:d.consistency,
        falseStarts:d.falseStarts,
        mode:'PURE REACTION',
        difficulty:d.difficulty
      },
      {type:'reaction',data:d}
    );

  const tracking=(d:TrackingResult)=>
    finish(
      {
        id:crypto.randomUUID(),
        timestamp:Date.now(),
        type:'tracking',
        score:d.score,
        accuracy:d.accuracy,
        reactionMs:0,
        hits:0,
        shots:0,
        avgError:d.avgError,
        targetSpeed:d.targetSpeed,
        mode:d.mode,
        difficulty:d.difficulty
      },
      {type:'tracking',data:d}
    );

  const switching=(d:SwitchingResult)=>
    finish(
      {
        id:crypto.randomUUID(),
        timestamp:Date.now(),
        type:'switching',
        score:d.score,
        accuracy:d.accuracy,
        reactionMs:d.avgSwitchMs,
        hits:d.hits,
        shots:d.shots,
        bestMs:d.bestSwitchMs,
        overshoots:d.misses,
        mode:'TARGET SWITCHING',
        difficulty:d.difficulty
      },
      {type:'switching',data:d}
    );

  const micro=(d:MicroFlickResult)=>
    finish(
      {
        id:crypto.randomUUID(),
        timestamp:Date.now(),
        type:'micro',
        score:d.score,
        accuracy:d.accuracy,
        reactionMs:d.avgReactionMs,
        avgError:d.avgDistance,
        hits:d.hits,
        shots:d.shots,
        bestMs:d.bestReactionMs,
        overshoots:d.overshoots,
        mode:'MICRO FLICK',
        difficulty:d.difficulty
      },
      {type:'micro',data:d}
    );

  const braking=(d:BrakingResult)=>{
    const r={
      id:crypto.randomUUID(),
      timestamp:Date.now(),
      type:'braking' as any,
      score:d.score,
      accuracy:d.accuracy,
      reactionMs:d.avgStopMs,
      hits:d.successes,
      shots:d.trials,
      bestMs:d.bestStopMs,
      consistency:d.consistency,
      mode:'COUNTER-STRAFE',
      difficulty:d.difficulty
    };

    saveResult(r as any);
    setHistory(loadHistory());
    setLast({type:'braking',data:d});
    setView('result');
  };

  const go=(v:View)=>setView(v);

  const progress=getProgress(history);

  return(
    <div className="app-shell">

      <header className="topbar">

        <button
          className="brand"
          onClick={()=>go('home')}
        >
          <span className="brand-mark">Y</span>

          <span>
            <strong>SANGHYEON AIM LAB</strong>
            <small>VALORANT AIM TRAINING</small>
          </span>
        </button>

        <nav>

          <button
            className={view==='home'?'active':''}
            onClick={()=>go('home')}
          >
            🧪 LAB
          </button>

          <button
            className={view==='sensitivity'?'active':''}
            onClick={()=>go('sensitivity')}
          >
            🖱️ 감도 찾기
          </button>

          <button
            className={view==='growth'?'active':''}
            onClick={()=>go('growth')}
          >
            📈 성장 기록
          </button>

        </nav>

        <div className="player">
          <i/>
          SANGHYEON
          <b>{progress.rank.name}</b>
          <em>LV.{progress.level}</em>
        </div>

      </header>

      {view==='home'&&
        <Home
          history={history}
          go={go}
        />
      }

      {view==='flick'&&
        <FlickGame
          onExit={()=>go('home')}
          onComplete={flick}
          crosshair={crosshair}
        />
      }

      {view==='reaction'&&
        <ReactionGame
          onExit={()=>go('home')}
          onComplete={reaction}
        />
      }

      {view==='tracking'&&
        <TrackingGame
          onBack={()=>go('home')}
          onFinish={tracking}
          crosshair={crosshair}
        />
      }

      {view==='braking'&&
        <BrakingGame
          onBack={()=>go('home')}
          onFinish={braking}
        />
      }

      {view==='switching'&&
        <SwitchingGame
          onBack={()=>go('home')}
          onFinish={switching}
          crosshair={crosshair}
        />
      }

      {view==='micro'&&
        <MicroFlickGame
          onBack={()=>go('home')}
          onFinish={micro}
          crosshair={crosshair}
        />
      }

      {view==='sensitivity'&&
        <SensitivityLab
          value={sens}
          onChange={v=>{
            setSens(v);
            saveSensitivity(v);
          }}
          onBack={()=>go('home')}
        />
      }

      {view==='growth'&&
        <GrowthPage
          history={history}
          onBack={()=>go('home')}
        />
      }

      {view==='crosshair'&&
        <CrosshairPage
          crosshair={crosshair}
          setCrosshair={c=>{
            setCrosshair(c);
            saveCrosshair(c);
          }}
          onBack={()=>go('home')}
        />
      }

      {view==='result'&&last&&
        <Result
          last={last}
          onHome={()=>go('home')}
          onRetry={()=>go(last.type)}
        />
      }

    </div>
  );
}


function Home({
  history,
  go
}:{
  history:TrainingRecord[];
  go:(v:View)=>void
}){
  const progress=getProgress(history);

  const best=history.length
    ?Math.max(
      ...history.map(r=>
        Math.max(
          0,
          Math.min(
            100,
            r.score>100?r.score/100:r.score
          )
        )
      )
    )
    :0;

  return(
    <main className="home">

      <section className="hero panel">

        <div className="hero-main">

          <p className="eyebrow">
            TRAINING PROTOCOL // AIM CONTROL
          </p>

          <h1>상현 에임랩</h1>

          <p className="hero-subtitle">
            경쟁하기 전 손풀기 딱 좋은 상현 에임랩
          </p>

          <p className="hero-copy">
            플릭 · 반응 · 트래킹 · 브레이킹 · 스위칭 · 미세 플릭까지 한 곳에서.
          </p>

          <div className="hero-actions">

            <button
              className="primary-btn hero-btn hero-crosshair-btn"
              onClick={()=>go('crosshair')}
            >
              🎯 조준선 설정
            </button>

            <button
              className="primary-btn hero-btn hero-sensitivity-btn"
              onClick={()=>go('sensitivity')}
            >
              🖱️ 감도 설정
            </button>

            <button
              className="primary-btn hero-btn hero-growth-btn"
              onClick={()=>go('growth')}
            >
              📈 성장 기록
            </button>

          </div>

        </div>

        <div className="hero-stats">

          <div>
            <small>SESSIONS</small>
            <b>{history.length}</b>
          </div>

          <div>
            <small>BEST</small>
            <b>{best?best.toFixed(0):'—'}</b>
          </div>

          <div>
            <small>RANK</small>
            <b>{progress.rank.name}</b>
            <em>LV.{progress.level}</em>
          </div>

        </div>

      </section>


      <section className="section home-training">

        <div className="section-title">

          <div>
            <p className="eyebrow">TRAINING MODULES</p>
            <h2>훈련실</h2>
          </div>

          <span className="phase">
            6 MODULES · PICK ONE
          </span>

        </div>

        <div className="training-grid">

          <button
            className="training-card flick"
            onClick={()=>go('flick')}
          >
            <span>01</span>
            <div>
              <b>🎯 FLICK</b>
              <h3>정밀 전환</h3>
              <p>
                타겟 나오면 바로 끌어가서 맞히는 기본 플릭 훈련.
              </p>
            </div>
            <strong>→</strong>
          </button>


          <button
            className="training-card reaction"
            onClick={()=>go('reaction')}
          >
            <span>02</span>
            <div>
              <b>⚡ 시각반응</b>
              <h3>반응속도</h3>
              <p>
                언제 뜰지 모르는 신호를 보고 얼마나 빨리 반응하는지 확인.
              </p>
            </div>
            <strong>→</strong>
          </button>


          <button
            className="training-card tracking"
            onClick={()=>go('tracking')}
          >
            <span>03</span>
            <div>
              <b>◎ TRACKING</b>
              <h3>움직임 추적</h3>
              <p>
                움직이는 타겟을 놓치지 않고 따라가는 연습.
              </p>
            </div>
            <strong>→</strong>
          </button>


          <button
            className="training-card braking"
            onClick={()=>go('braking')}
          >
            <span>04</span>
            <div>
              <b>↔ BRAKING</b>
              <h3>브레이킹</h3>
              <p>
                A/D 반전으로 멈추고 바로 쏘는 감각을 잡는 훈련.
              </p>
            </div>
            <strong>→</strong>
          </button>


          <button
            className="training-card switching"
            onClick={()=>go('switching')}
          >
            <span>05</span>
            <div>
              <b>⚡ SWITCHING</b>
              <h3>타겟 스위칭</h3>
              <p>
                하나 잡자마자 다음 타겟으로 얼마나 빨리 넘어가는지 본다.
              </p>
            </div>
            <strong>→</strong>
          </button>


          <button
            className="training-card micro"
            onClick={()=>go('micro')}
          >
            <span>06</span>
            <div>
              <b>✦ MICRO FLICK</b>
              <h3>미세 플릭</h3>
              <p>
                짧은 거리에서 오버슈트 없이 딱 붙여 맞히는 연습.
              </p>
            </div>
            <strong>→</strong>
          </button>

        </div>

      </section>

    </main>
  );
}


function CrosshairPage({
  crosshair,
  setCrosshair,
  onBack
}:{
  crosshair:CrosshairConfig;
  setCrosshair:(c:CrosshairConfig)=>void;
  onBack:()=>void;
}){
  return(
    <main className="tool-page crosshair-page">

      <header className="tool-header">

        <button
          className="back-btn"
          onClick={onBack}
        >
          ← LAB
        </button>

        <div>
          <p className="eyebrow">
            CROSSHAIR // SETTINGS
          </p>
          <h1>🎯 조준선 설정</h1>
        </div>

        <div className="game-help">
          VALORANT CODE
        </div>

      </header>


      <section className="crosshair-panel panel">

        <div className="crosshair-preview">

          <div className="crosshair-demo">
            <div className="demo-bg"/>

            <CrosshairView
              config={crosshair}
              className="preview-crosshair-svg"
            />

          </div>

        </div>


        <div className="crosshair-controls">

          <div className="preset-row">

            {Object.entries(CROSSHAIR_PRESETS).map(([n,c])=>
              <button
                key={n}
                className={
                  crosshair.style===c.style
                    ?'preset selected'
                    :'preset'
                }
                onClick={()=>setCrosshair({...c})}
              >
                {n}
              </button>
            )}

            <button
              className={
                crosshair.style==='custom'
                  ?'preset selected custom-preset'
                  :'preset custom-preset'
              }
              onClick={()=>
                setCrosshair({
                  ...crosshair,
                  style:'custom'
                })
              }
            >
              🛠 완전자유
            </button>

          </div>


          <div className="custom-crosshair-note">

            <b>완전자유 설정</b>

            <span>
              색상 · 크기 · 간격 · 두께 · 외곽선 · 중앙점을 직접 조절해서 원하는 조준선을 만들어.
            </span>

          </div>


          <div className="control-row">

            <label>
              색상
              <input
                type="color"
                value={crosshair.color}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    color:e.target.value
                  })
                }
              />
            </label>

            <label>
              크기
              <input
                type="range"
                min="1"
                max="18"
                value={crosshair.size}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    size:+e.target.value
                  })
                }
              />
            </label>

            <label>
              간격
              <input
                type="range"
                min="0"
                max="10"
                value={crosshair.gap}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    gap:+e.target.value
                  })
                }
              />
            </label>

            <label>
              두께
              <input
                type="range"
                min="1"
                max="4"
                value={crosshair.thickness}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    thickness:+e.target.value
                  })
                }
              />
            </label>

          </div>


          <div className="toggle-row">

            <label>
              <input
                type="checkbox"
                checked={crosshair.outline}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    outline:e.target.checked
                  })
                }
              />
              외곽선
            </label>

            <label>
              <input
                type="checkbox"
                checked={crosshair.centerDot}
                onChange={e=>
                  setCrosshair({
                    ...crosshair,
                    centerDot:e.target.checked
                  })
                }
              />
              중앙점
            </label>

          </div>


          <ValorantCrosshairImport
            crosshair={crosshair}
            setCrosshair={setCrosshair}
          />

        </div>

      </section>

    </main>
  );
}


function ValorantCrosshairImport({
  crosshair,
  setCrosshair
}:{
  crosshair:CrosshairConfig;
  setCrosshair:(c:CrosshairConfig)=>void;
}){
  const[code,setCode]=useState('');
  const[msg,setMsg]=useState('');

  const apply=()=>{
    const parsed=parseValorantCrosshairCode(code);

    if(!parsed){
      setMsg(
        '코드 형식이 이상해. VALORANT 공유 코드를 그대로 붙여넣어.'
      );
      return;
    }

    setCrosshair(parsed);
    setMsg(
      '적용됨. 미리보기에서 바로 확인해.'
    );
  };

  return(
    <div className="crosshair-import">

      <div>
        <b>VALORANT 조준선 코드</b>

        <span>
          예: 0;P;u;000000FF;o;1;f;0;0t;3;0l;1;0v;1 ...
        </span>
      </div>

      <div className="crosshair-import-row">

        <input
          value={code}
          onChange={e=>setCode(e.target.value)}
          placeholder="VALORANT 공유 코드 붙여넣기"
        />

        <button
          className="secondary-btn"
          onClick={apply}
        >
          적용
        </button>

      </div>

      {msg&&<small>{msg}</small>}

    </div>
  );
}


function metric(r:TrainingRecord){

  if(r.type==='braking')
    return `${r.accuracy.toFixed(1)}% STOP · HEAD ${r.hits??0} · MOVING ${r.falseStarts??0}`;

  if(r.type==='reaction')
    return `${Math.round(r.reactionMs)}ms · ${Math.round(r.consistency??r.accuracy)}% 일관성`;

  if(r.type==='flick')
    return `${r.accuracy.toFixed(1)}% ACC · ${Math.round(r.reactionMs)}ms`;

  return `${r.accuracy.toFixed(1)}% ACC · ${Math.round(r.avgError??0)}px ERR`;
}


function GrowthPage({
  history,
  onBack
}:{
  history:TrainingRecord[];
  onBack:()=>void;
}){

  const types:TrainingType[]=[
    'flick',
    'reaction',
    'tracking',
    'braking',
    'switching',
    'micro'
  ];

  const progress=getProgress(history);

  const norm=(x:TrainingRecord)=>
    Math.max(
      0,
      Math.min(
        100,
        x.score>100?x.score/100:x.score
      )
    );

  const bestRow=history.length
    ?[...history].sort(
      (a,b)=>norm(b)-norm(a)
    )[0]
    :null;

  const avg=history.length
    ?history.reduce(
      (a,b)=>a+norm(b),
      0
    )/history.length
    :0;

  const rankIndex=progress.rankIndex;

  const rankStart=rankIndex*500;
  const rankEnd=(rankIndex+1)*500;

  const rankProgress=Math.min(
    100,
    Math.max(
      0,
      ((progress.total-rankStart)/
      (rankEnd-rankStart))*100
    )
  );

  const rankColor=
    TIER_COLORS[
      Math.min(
        rankIndex+1,
        TIER_COLORS.length-1
      )
    ];

  return(
    <main className="tool-page growth-page">

      <header className="tool-header">

        <button
          className="back-btn"
          onClick={onBack}
        >
          ← LAB
        </button>

        <div>

          <p className="eyebrow">
            MY AIM RECORD // NO BS
          </p>

          <h1>내 성장 기록</h1>

        </div>

        <div className="game-help">
          {history.length} SESSIONS
        </div>

      </header>


      <section className="growth-hero panel">

        <div
          className="growth-rank-badge"
          style={{
            '--tier-color':rankColor
          } as any}
        >

          <img
            src={progress.rank.image}
            alt={progress.rank.name}
            className="growth-rank-icon"
          />

          <small>현재 랭크</small>

          <strong>
            {progress.rank.name}
          </strong>

          <b>
            LV.{progress.level}
          </b>

        </div>


        <div className="growth-hero-copy">

          <p className="eyebrow">
            내가 지금 어디쯤인지
          </p>

          <h2>
            {progress.rank.name} · LV.{progress.level}
          </h2>

          <p>
            점수 쌓으면 레벨 올라가고, 레벨이 쌓이면 티어 올라가.
            그냥 훈련하고 기록 남기면 됨.
          </p>


          <div className="growth-progress">

            <i
              style={{
                width:`${rankProgress}%`,
                background:rankColor
              }}
            />

          </div>


          <div className="growth-progress-label">

            <span>
              {Math.round(rankProgress)}% 채움
            </span>

            <b>
              {Math.round(progress.next)}점 남음
            </b>

          </div>

        </div>


        <div className="growth-quick">

          <span>
            <small>BEST</small>
            <b>
              {bestRow
                ?norm(bestRow).toFixed(0)
                :'—'}
            </b>
          </span>

          <span>
            <small>AVG</small>
            <b>
              {history.length
                ?avg.toFixed(1)
                :'—'}
            </b>
          </span>

          <span>
            <small>SESSIONS</small>
            <b>{history.length}</b>
          </span>

        </div>

      </section>


      <section className="rank-roadmap panel">

        <div className="section-title">

          <div>

            <p className="eyebrow">
              RANK ROADMAP
            </p>

            <h2>
              여기서 레디언트까지
            </h2>

          </div>

          <span className="phase">
            CURRENT: {progress.rank.name}
          </span>

        </div>


        <div className="rank-track">

          {RANKS.map((rank,i)=>{

            const active=i===rankIndex;
            const done=i<rankIndex;

            const nodeColor=
              TIER_COLORS[
                Math.min(
                  i+1,
                  TIER_COLORS.length-1
                )
              ];

            return(
              <div
                key={rank.id}
                className={
                  `rank-node ${
                    active?'current':''
                  } ${
                    done?'done':''
                  }`
                }
                style={{
                  '--rank-color':nodeColor
                } as any}
              >

                <div className="rank-dot">

                  <img
                    src={rank.image}
                    alt={rank.name}
                  />

                </div>

                <b>{rank.name}</b>

                <small>
                  {
                    done
                      ?'달성'
                      :active
                        ?'지금 여기'
                        :'잠김'
                  }
                </small>

              </div>
            );

          })}

        </div>

      </section>


      <section className="growth-cards">

        {types.map(t=>
          <GrowthModule
            key={t}
            type={t}
            rows={history.filter(
              x=>x.type===t
            )}
            norm={norm}
          />
        )}

      </section>


      {bestRow&&
        <section className="growth-best panel">

          <div>

            <p className="eyebrow">
              PERSONAL BEST
            </p>

            <h2>
              {bestRow.type.toUpperCase()} · {bestRow.mode??'—'}
            </h2>

            <p>
              {new Date(
                bestRow.timestamp
              ).toLocaleString('ko-KR')}
              {' · '}
              {bestRow.difficulty?.toUpperCase()??'—'}
            </p>

          </div>

          <div className="growth-best-score">

            {norm(bestRow).toFixed(0)}

            <small>
              / 100
            </small>

          </div>

        </section>
      }


      <section className="growth-insight panel">

        <div>

          <p className="eyebrow">
            TRAINING INSIGHT
          </p>

          <h3>
            최근 기록에서 보이는 흐름
          </h3>

          <p>
            최근 5판의 점수와 모드 기록을 한눈에 보고
            다음에 뭘 돌릴지 바로 정하는 공간.
          </p>

        </div>


        <div className="insight-grid">

          <div>

            <small>
              최근 5판 평균
            </small>

            <b>
              {
                history.length
                  ?(
                    history
                      .slice(-5)
                      .reduce(
                        (a,r)=>a+norm(r),
                        0
                      )/
                      Math.min(
                        5,
                        history.length
                      )
                    ).toFixed(1)
                  :'—'
              }
            </b>

          </div>


          <div>

            <small>
              최근 최고
            </small>

            <b>
              {
                history.length
                  ?Math.max(
                    ...history
                      .slice(-5)
                      .map(norm)
                  ).toFixed(1)
                  :'—'
              }
            </b>

          </div>


          <div>

            <small>
              가장 많이 한 모드
            </small>

            <b>

              {(()=>{
                const most=types
                  .map(t=>({
                    t,
                    n:history.filter(
                      x=>x.type===t
                    ).length
                  }))
                  .sort(
                    (a,b)=>b.n-a.n
                  )[0];

                if(!most?.n)
                  return '—';

                return({
                  flick:'FLICK',
                  reaction:'REACTION',
                  tracking:'TRACKING',
                  braking:'BRAKING',
                  switching:'SWITCHING',
                  micro:'MICRO'
                } as Record<string,string>)[most.t];

              })()}

            </b>

          </div>

        </div>

      </section>

    </main>
  );
}


function GrowthModule({
  type,
  rows,
  norm
}:{
  type:TrainingType;
  rows:TrainingRecord[];
  norm:(x:TrainingRecord)=>number;
}){

  const best=rows.length
    ?Math.max(...rows.map(norm))
    :0;

  const last=rows.at(-1);
  const first=rows[0];

  const delta=
    last&&first
      ?norm(last)-norm(first)
      :0;

  const bestRow=rows.length
    ?[...rows].sort(
      (a,b)=>norm(b)-norm(a)
    )[0]
    :null;

  return(
    <article
      className={`growth-module panel ${type}`}
    >

      <div className="growth-module-head">

        <span>
          {
            type==='flick'
              ?'🎯 FLICK'
              :type==='reaction'
                ?'⚡ REACTION'
                :type==='tracking'
                  ?'◎ TRACKING'
                  :type==='braking'
                    ?'↔ BRAKING'
                    :type==='switching'
                      ?'⚡ SWITCHING'
                      :'✦ MICRO FLICK'
          }
        </span>

        <b>
          {rows.length}회
        </b>

      </div>


      <div className="growth-main">

        <strong>
          {best?best.toFixed(0):'—'}
        </strong>

        <small>
          BEST / 100
        </small>

      </div>


      <div className="growth-detail-grid">

        <div>
          <small>최근</small>
          <b>
            {last
              ?norm(last).toFixed(0)
              :'—'}
          </b>
        </div>


        <div>
          <small>시작 대비</small>
          <b>
            {
              rows.length>1
                ?`${delta>=0?'+':''}${delta.toFixed(0)}`
                :'—'
            }
          </b>
        </div>


        <div>
          <small>최고 기록 모드</small>
          <b>
            {bestRow?.mode??'—'}
          </b>
        </div>


        {type==='flick'&&
          <div>
            <small>최고 정확도</small>
            <b>
              {
                rows.length
                  ?`${Math.max(
                    ...rows.map(
                      x=>x.accuracy
                    )
                  ).toFixed(1)}%`
                  :'—'
              }
            </b>
          </div>
        }


        {type==='reaction'&&
          <div>
            <small>최고 반응</small>
            <b>
              {
                rows.length
                  ?`${Math.round(
                    Math.min(
                      ...rows.map(
                        x=>x.reactionMs
                      )
                    )
                  )}ms`
                  :'—'
              }
            </b>
          </div>
        }


        {type==='tracking'&&
          <div>
            <small>최저 평균 오차</small>
            <b>
              {
                rows.length
                  ?`${Math.round(
                    Math.min(
                      ...rows.map(
                        x=>x.avgError??999
                      )
                    )
                  )}px`
                  :'—'
              }
            </b>
          </div>
        }


        {type==='braking'&&
          <div>
            <small>최고 정지 정확도</small>
            <b>
              {
                rows.length
                  ?`${Math.max(
                    ...rows.map(
                      x=>x.accuracy
                    )
                  ).toFixed(1)}%`
                  :'—'
              }
            </b>
          </div>
        }


        {type==='switching'&&
          <div>
            <small>최고 전환속도</small>
            <b>
              {
                rows.length
                  ?`${Math.round(
                    Math.min(
                      ...rows.map(
                        x=>x.reactionMs
                      )
                    )
                  )}ms`
                  :'—'
              }
            </b>
          </div>
        }


        {type==='micro'&&
          <div>
            <small>최저 평균 오차</small>
            <b>
              {
                rows.length
                  ?`${Math.round(
                    Math.min(
                      ...rows.map(
                        x=>x.avgError??999
                      )
                    )
                  )}px`
                  :'—'
              }
            </b>
          </div>
        }

      </div>


      <div className="growth-note">

        {
          !rows.length
            ?'아직 기록 없음'
            :`최고 ${best.toFixed(0)} · 최근 ${norm(last!).toFixed(0)} · ${last?.mode??'—'}`
        }

      </div>

    </article>
  );
}