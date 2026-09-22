import type { FlickResult } from './games/FlickGame';
import type { ReactionResult } from './games/ReactionGame';
import type { TrackingResult } from './games/TrackingGame';
import type { BrakingResult } from './games/BrakingGame';
import type { SwitchingResult } from './games/SwitchingGame';
import type { MicroFlickResult } from './games/MicroFlickGame';

type Last =
  | {type:'flick';data:FlickResult}
  | {type:'reaction';data:ReactionResult}
  | {type:'tracking';data:TrackingResult}
  | {type:'braking';data:BrakingResult}
  | {type:'switching';data:SwitchingResult}
  | {type:'micro';data:MicroFlickResult}
  | null;

type Props={last:Last;onHome:()=>void;onRetry:()=>void};

const grade=(score:number)=>score>=95?'S+':score>=90?'S':score>=80?'A':score>=70?'B':score>=60?'C':score>=50?'D':'F';
const score100=(n:number)=>Math.max(0,Math.min(100,n>100?n/100:n));
const pct=(n:number)=>`${n.toFixed(1)}%`;

export default function Result({last,onHome,onRetry}:Props){
  if(!last)return null;
  const {title,subtitle,score,primary,details,feedback}=build(last);
  const s=score100(score),g=grade(s);
  return <main className="result-page">
    <div className="result-card panel">
      <p className="eyebrow">SESSION COMPLETE // AIM PERFORMANCE</p>
      <h1 style={{margin:'8px 0 0',fontSize:28}}>{title}</h1>
      <p style={{color:'#778590',fontSize:10,margin:'6px 0 0',letterSpacing:'.08em'}}>{subtitle}</p>
      <div className="result-score-main">
        <div><div className="result-score-number">{s.toFixed(0)}<small>/ 100</small></div><span style={{color:'#788691',fontSize:10}}>SESSION SCORE</span></div>
        <div className="result-grade">{g}</div>
      </div>
      <div className="result-primary-grid">{primary.map((x,i)=><div key={x.label} className={i===0?'focus':''}><small>{x.label}</small><strong>{x.value}</strong></div>)}</div>
      <section className="result-section"><h2>핵심 결과</h2><p>이번 세션에서 가장 먼저 확인할 수치입니다.</p><div className="result-detail-grid">{details.map(x=><div className="result-detail" key={x.label}><b>{x.value}</b><span>{x.label}</span></div>)}</div></section>
      <div className="result-highlight"><b>COACHING</b><br/>{feedback}</div>
      <div className="result-actions" style={{marginTop:18}}><button className="secondary-btn" onClick={onHome}>LAB</button><button className="primary-btn" onClick={onRetry}>다시 훈련</button></div>
    </div>
  </main>;
}

function build(last:Exclude<Last,null>){
  if(last.type==='flick'){
    const d=last.data;
    const weak=d.feedback.weakestPattern?d.patternStats[d.feedback.weakestPattern]:null;
    return {title:'FLICK RESULT',subtitle:`${d.mode.toUpperCase()} · ${d.difficulty.toUpperCase()}`,score:d.score,
      primary:[{label:'ACCURACY',value:pct(d.accuracy)},{label:'AVG REACTION',value:`${d.avgReactionMs.toFixed(1)}ms`},{label:'BEST REACTION',value:`${d.bestReactionMs.toFixed(1)}ms`},{label:'MAX COMBO',value:`${d.maxCombo}`}],
      details:[{label:'HITS / SHOTS',value:`${d.hits} / ${d.shots}`},{label:'OVERSHOOTS',value:`${d.overshoots}`},{label:'WEAKEST PATTERN',value:d.feedback.weakestPattern?.toUpperCase()||'—'},{label:'STRONGEST PATTERN',value:d.feedback.strongestPattern?.toUpperCase()||'—'},{label:'REACTION',value:d.feedback.reactionGrade.toUpperCase()},{label:'AIM ACCURACY',value:d.feedback.accuracyGrade.toUpperCase()}],
      feedback:weak?`${d.feedback.weakestPattern?.toUpperCase()} 패턴에서 ${weak.hits}/${weak.shots} 적중. 다음 세션은 이 패턴의 첫 이동을 더 작고 빠르게 가져가.`:'정확도와 반응을 함께 유지하면서 오버슈트를 줄이는 것이 다음 목표야.'};
  }
  if(last.type==='reaction'){
    const d=last.data;
    return {title:'REACTION RESULT',subtitle:`PURE REACTION · ${d.difficulty.toUpperCase()} · 7 TRIALS`,score:d.score,
      primary:[{label:'AVERAGE',value:`${Math.round(d.averageMs)}ms`},{label:'BEST',value:`${d.bestMs.toFixed(1)}ms`},{label:'CONSISTENCY',value:pct(d.consistency)},{label:'FALSE STARTS',value:`${d.falseStarts}`}],
      details:[{label:'DIFFICULTY',value:d.difficulty.toUpperCase()},{label:'TRIALS',value:`${d.trials}`},{label:'SLOWEST',value:`${d.worstMs.toFixed(1)}ms`},{label:'FASTEST',value:`${d.bestMs.toFixed(1)}ms`},{label:'CONSISTENCY',value:pct(d.consistency)}],
      feedback:d.falseStarts>1?'반응 자체보다 먼저 클릭하는 실수를 줄이는 게 우선이야. 신호 전 대기 시간을 안정화해.':d.averageMs<=190?'반응 속도가 빠른 편이야. 다음은 속도를 유지하면서 편차를 줄이는 단계야.':'속도보다 일정한 반응 리듬을 먼저 만들면 기록이 더 안정적으로 올라갈 수 있어.'};
  }
  if(last.type==='tracking'){
    const d=last.data;
    return {title:'TRACKING RESULT',subtitle:`${d.mode.toUpperCase()} · ${d.difficulty.toUpperCase()}`,score:d.score,
      primary:[{label:'TRACK ACC',value:pct(d.accuracy)},{label:'AVG ERROR',value:`${Math.round(d.avgError)}px`},{label:'TARGET SPEED',value:`${Math.round(d.targetSpeed)}px/s`},{label:'DURATION',value:`${d.duration}s`}],
      details:[{label:'MODE',value:d.mode.toUpperCase()},{label:'PATTERN',value:d.pattern},{label:'DIFFICULTY',value:d.difficulty.toUpperCase()},{label:'ERROR CONTROL',value:d.avgError<=12?'EXCELLENT':d.avgError<=24?'STABLE':'NEEDS WORK'}],
      feedback:d.avgError<=12?'조준점 중심을 타겟 중심에 안정적으로 유지했어. 다음은 더 빠른 방향 전환에 대응해보자.':d.accuracy>=80?'기본 추적은 안정적이야. 타겟이 방향을 바꿀 때 과하게 끌어당기지 않는 게 핵심이야.':'현재는 속도보다 중심 추적을 우선해. 조준선 중앙을 타겟에 붙인 채 작은 보정만 반복해.'};
  }
  if(last.type==='switching'){
    const d=last.data;
    return {title:'SWITCHING RESULT',subtitle:`TARGET SWITCHING · ${d.difficulty.toUpperCase()}`,score:d.score,
      primary:[{label:'ACCURACY',value:pct(d.accuracy)},{label:'AVG SWITCH',value:`${d.avgSwitchMs.toFixed(1)}ms`},{label:'BEST SWITCH',value:`${d.bestSwitchMs.toFixed(1)}ms`},{label:'MAX COMBO',value:`${d.maxCombo}`}],
      details:[{label:'HITS / SHOTS',value:`${d.hits} / ${d.shots}`},{label:'MISSES',value:`${d.misses}`},{label:'AVG SWITCH',value:`${d.avgSwitchMs.toFixed(1)}ms`},{label:'BEST SWITCH',value:`${d.bestSwitchMs.toFixed(1)}ms`},{label:'MAX COMBO',value:`${d.maxCombo}`},{label:'TIME',value:`${d.duration.toFixed(1)}s`}],
      feedback:d.accuracy>=90&&d.avgSwitchMs<450?'전환이 빠른데 정확도도 안 무너졌어. 이 정도면 다음은 헬에서 속도만 더 올려보면 돼.':d.accuracy<75?'속도 올리기 전에 첫 타겟을 정확하게 잡는 게 먼저야. 급하게 다음으로 넘기다가 미스가 나고 있어.':'전환 감각은 괜찮아. 다음은 타겟 하나 잡은 뒤 바로 다음 위치를 읽는 습관을 만들어보자.'};
  }
  if(last.type==='micro'){
    const d=last.data;
    return {title:'MICRO FLICK RESULT',subtitle:`MICRO FLICK · ${d.difficulty.toUpperCase()}`,score:d.score,
      primary:[{label:'ACCURACY',value:pct(d.accuracy)},{label:'AVG REACTION',value:`${d.avgReactionMs.toFixed(1)}ms`},{label:'AVG ERROR',value:`${d.avgDistance.toFixed(1)}px`},{label:'OVERSHOOTS',value:`${d.overshoots}`}],
      details:[{label:'HITS / SHOTS',value:`${d.hits} / ${d.shots}`},{label:'BEST REACTION',value:`${d.bestReactionMs.toFixed(1)}ms`},{label:'AVG ERROR',value:`${d.avgDistance.toFixed(1)}px`},{label:'OVERSHOOTS',value:`${d.overshoots}`},{label:'TIME',value:`${d.duration.toFixed(1)}s`},{label:'DIFFICULTY',value:d.difficulty.toUpperCase()}],
      feedback:d.avgDistance<5&&d.accuracy>=90?'미세조정이 깔끔해. 크게 긁지 않고 필요한 만큼만 움직인 게 잘 나왔어.':d.overshoots>3?'오버슈트가 좀 많아. 첫 플릭을 조금 줄이고 마지막에 작은 보정으로 끝내봐.':'정확도는 괜찮아. 다음은 같은 정확도를 유지하면서 반응을 조금씩 줄여보자.'};
  }
  const d=last.data;
  return {title:'BRAKING RESULT',subtitle:`COUNTER-STRAFE · ${d.difficulty.toUpperCase()}`,score:d.score,
    primary:[{label:'STOP ACC',value:pct(d.accuracy)},{label:'HEAD HITS',value:`${d.headHits}`},{label:'AVG BRAKE',value:`${d.avgStopMs.toFixed(1)}ms`},{label:'MOVING SHOTS',value:`${d.movingShots}`}],
    details:[{label:'TIME LIMIT',value:`${d.duration.toFixed(1)}s / ${d.timeLimit}s`},{label:'SHOTS',value:`${d.shots}`},{label:'MOVING SHOTS',value:`${d.movingShots}`},{label:'OVERSHOOT',value:`${d.overshoots}`},{label:'UNDERSHOOT',value:`${d.undershoots}`},{label:'BODY HITS',value:`${d.bodyHits}`},{label:'BEST BRAKE',value:`${d.bestStopMs.toFixed(1)}ms`},{label:'CONSISTENCY',value:pct(d.consistency)}],
    feedback:d.movingShots>0?`움직이는 상태에서 ${d.movingShots}발을 쐈어. A/D를 놓는 순간 즉시 멈추고, 정지 확인 후 발사하는 루틴을 우선 잡자.`:d.headHits>=8?'브레이크 → 정지 → 헤드 발사 흐름이 안정적이야. 다음은 정지 후 첫 클릭까지의 시간을 더 줄여보자.':'정지는 되고 있어. 이제 목표 중심과 헤드 높이를 맞추는 정확도를 좁혀보자.'};
}
