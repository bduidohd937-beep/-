import {useEffect,useRef,useState} from 'react';
import type {Difficulty} from '../utils/storage';
export interface ReactionResult{score:number;averageMs:number;bestMs:number;worstMs:number;consistency:number;falseStarts:number;trials:number;difficulty:Difficulty}
interface Props{onExit:()=>void;onComplete:(r:ReactionResult)=>void}
type Phase='intro'|'waiting'|'ready'|'result';
const TRIALS=7;
const calc=(v:number[],f:number,difficulty:Difficulty):ReactionResult=>{const avg=v.reduce((a,b)=>a+b,0)/v.length,best=Math.min(...v),worst=Math.max(...v);const sd=Math.sqrt(v.reduce((s,x)=>s+(x-avg)**2,0)/v.length);const consistency=Math.max(0,Math.min(100,100-sd*.72));const speedScore=Math.max(0,Math.min(100,100-(avg-140)*0.32));const score=Math.round(Math.max(0,Math.min(100,speedScore*0.7+consistency*0.3-f*4+DIFF[difficulty].bonus)));return{score,averageMs:avg,bestMs:best,worstMs:worst,consistency,falseStarts:f,trials:v.length,difficulty}};
const DIFF:Record<Difficulty,{label:string;tag:string;desc:string;bonus:number}>={newbie:{label:'응애 나 뉴비에요',tag:'ENTRY',desc:'긴 준비 구간 · 반응 감각 익히기',bonus:0},normal:{label:'이제 사람 구실 좀 해볼게요',tag:'RANKED',desc:'실전 대기 템포',bonus:0},hard:{label:'나 정도면 실력자지',tag:'HARD',desc:'짧은 대기 · 집중 유지',bonus:2},hell:{label:'경쟁에서 캐리할게요',tag:'HELL',desc:'프로 템포 · 매우 짧은 대기',bonus:4}};
const waitTime=()=>900+Math.random()*2600;
export default function ReactionGame({onExit,onComplete}:Props){
 const [phase,setPhase]=useState<Phase>('intro'),[trial,setTrial]=useState(0),[times,setTimes]=useState<number[]>([]),[falseStarts,setFalseStarts]=useState(0),[last,setLast]=useState(0),[armed,setArmed]=useState(false),[difficulty,setDifficulty]=useState<Difficulty>('normal');
 const readyAt=useRef(0),timer=useRef<number|null>(null),values=useRef<number[]>([]),falseRef=useRef(0),trialRef=useRef(0);
 const clear=()=>{if(timer.current!==null)window.clearTimeout(timer.current);timer.current=null};
 useEffect(()=>()=>clear(),[]);
 const schedule=()=>{clear();setArmed(false);setPhase('waiting');timer.current=window.setTimeout(()=>{readyAt.current=performance.now();setArmed(true);setPhase('ready')},waitTime())};
 const begin=()=>{values.current=[];falseRef.current=0;trialRef.current=1;setTimes([]);setFalseStarts(0);setLast(0);setTrial(1);schedule()};
 const click=()=>{
  if(phase==='intro'){begin();return}
  if(phase==='waiting'){clear();falseRef.current++;setFalseStarts(falseRef.current);setArmed(false);setPhase('intro');return}
  if(phase!=='ready'||!armed)return;
  const ms=performance.now()-readyAt.current;setLast(ms);const next=[...values.current,ms];values.current=next;setTimes(next);setArmed(false);
  if(next.length>=TRIALS){setPhase('result');onComplete(calc(next,falseRef.current,difficulty));return}
  trialRef.current=next.length+1;setTrial(trialRef.current);schedule();
 };
 const report=times.length?calc(times,falseStarts,difficulty):null;
 if(phase==='result'&&report)return <main className="result-page"><div className="result-card panel"><p className="eyebrow">SESSION COMPLETE // VISUAL RESPONSE</p><h1>{Math.round(report.averageMs)} <small>ms</small></h1><div className="result-grid reaction-result-grid"><div><small>BEST</small><strong>{Math.round(report.bestMs)}ms</strong></div><div><small>WORST</small><strong>{Math.round(report.worstMs)}ms</strong></div><div><small>CONSISTENCY</small><strong>{Math.round(report.consistency)}%</strong></div><div><small>FALSE STARTS</small><strong>{report.falseStarts}</strong></div></div><div className="roast">{report.averageMs<210?'반응이 상당히 빠릅니다. 이제 정확도와 함께 묶어보자.':report.averageMs<250?'좋아. 시각 신호를 꽤 빠르게 잡고 있습니다.':report.averageMs<300?'실전 에임에 연결하기 좋은 구간입니다.':'신호를 본 다음 한 박자 쉬고 있네요. 시작 신호를 보자마자 반응하는 연습이 필요합니다.'}</div><div className="result-actions"><button className="primary-btn" onClick={begin}>다시 측정</button><button className="secondary-btn" onClick={onExit}>기록 확인</button></div></div></main>;
 return <main className="game-page reaction-page"><header className="game-header"><button className="back-btn" onClick={onExit}>← EXIT</button><div><p className="eyebrow">VISUAL RESPONSE // REACTION SPEED</p><h1>시각반응</h1></div><div className="game-help">{trial?`${trial} / ${TRIALS}`:'7 TRIALS'}</div></header><section className={`reaction-board reaction-${phase}`} onPointerDown={click}><div className="reaction-center">{phase==='intro'&&<><span className="reaction-mark">⚡</span><h2>{times.length?'다시 준비':'반응속도 테스트'}</h2><p>화면이 초록색으로 바뀌는 순간 <b>즉시 클릭</b>하세요.</p>{falseStarts>0&&<small className="false-start">성급한 클릭 {falseStarts}회 · 이번 시도는 재시작됩니다.</small>}<div className="reaction-random-note"><b>랜덤 대기</b><span>매번 다른 타이밍에 신호가 떠. 외워서 누르는 거 못 하게 해놨어.</span></div><div className="reaction-rules"><span>총 7회</span><span>랜덤 대기시간</span><span>오발 감점</span></div><button className="primary-btn" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();begin()}}>테스트 시작</button></>}{phase==='waiting'&&<><small className="reaction-phase-label">WAIT FOR GREEN</small><h2>WAIT</h2><p>지금 클릭하면 성급한 반응으로 기록됩니다.</p><span className="wait-dot"/></>}{phase==='ready'&&<><small className="reaction-phase-label">GO — CLICK NOW</small><h2>CLICK!</h2><p>신호가 나타났습니다.</p><span className="ready-dot"/></>}</div></section><div className="reaction-footer"><span>TRIALS <b>{times.length} / {TRIALS}</b></span><span>FALSE STARTS <b>{falseStarts}</b></span><span>LAST <b>{last?`${Math.round(last)}ms`:'—'}</b></span></div></main>
}
