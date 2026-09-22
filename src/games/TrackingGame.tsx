import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {CrosshairConfig} from '../utils/crosshair';
import CrosshairView from '../utils/CrosshairView';
import type {Difficulty} from '../utils/storage';
import {loadSensitivity} from '../utils/sensitivity';
export interface TrackingResult{score:number;accuracy:number;avgError:number;targetSpeed:number;duration:number;pattern:string;mode:string;difficulty:Difficulty}
type Mode='mixed'|'head'|'bot';
type Props={onFinish:(r:TrackingResult)=>void;onBack:()=>void;crosshair:CrosshairConfig};
const DUR=30,TRACK_RADIUS=12,SOFT_RADIUS=48;
const DIFF:Record<Difficulty,{label:string;tag:string;desc:string;speed:number;range:number;accel:number;pause:number}>={newbie:{label:'응애 나 뉴비에요',tag:'ENTRY',desc:'느린 스트레이프 · 움직임 읽기',speed:210,range:.28,accel:3.6,pause:150},normal:{label:'이제 사람 구실 좀 해볼게요',tag:'RANKED',desc:'실전 스트레이프 · 방향 전환',speed:315,range:.34,accel:4.8,pause:105},hard:{label:'나 정도면 실력자지',tag:'HARD',desc:'빠른 스트레이프 · 짧은 정지',speed:430,range:.38,accel:5.8,pause:75},hell:{label:'경쟁에서 캐리할게요',tag:'HELL',desc:'프로 템포 · 고속 방향 전환',speed:560,range:.43,accel:7.0,pause:55}};
const MODES=[{id:'mixed' as Mode,title:'MIXED',sub:'실전형',detail:'부드러운 좌우 스트레이프 + 미세 상하 변화'},{id:'head' as Mode,title:'HEADLINE',sub:'헤드라인',detail:'헤드 높이를 고정하고 좌우만 이동'},{id:'bot' as Mode,title:'STRAFE BOT',sub:'훈련봇',detail:'봇 머리 중심을 따라가는 실전형 스트레이프'}];
const rand=(a:number,b:number)=>a+Math.random()*(b-a);
export default function TrackingGame({onFinish,onBack,crosshair}:Props){
 const sens=loadSensitivity();const stage=useRef<HTMLDivElement>(null),targetEl=useRef<HTMLDivElement>(null),raf=useRef(0),start=useRef(0),last=useRef(0),hudAt=useRef(0),phaseRef=useRef<'intro'|'countdown'|'playing'|'finished'>('intro');
 const p=useRef({x:.5,y:.5}),v=useRef(0),dir=useRef(1),state=useRef<'travel'|'brake'|'pause'>('travel'),until=useRef(0),segmentUntil=useRef(0),cursor=useRef({x:-999,y:-999}),stats=useRef({n:0,weight:0,error:0,speed:0});
 const [phase,setPhase]=useState<'intro'|'countdown'|'playing'>('intro'),[step,setStep]=useState<'difficulty'|'mode'>('difficulty'),[difficulty,setDifficulty]=useState<Difficulty>('newbie'),[mode,setMode]=useState<Mode>('mixed'),[count,setCount]=useState(3),[time,setTime]=useState(30),[hud,setHud]=useState({acc:0,error:0,speed:0}),[mouse,setMouse]=useState({x:-999,y:-999});
 const cleanup=()=>cancelAnimationFrame(raf.current);
 const finish=()=>{if(phaseRef.current!=='playing')return;phaseRef.current='finished';cleanup();const s=stats.current,n=Math.max(1,s.n),acc=s.weight/n*100,err=s.error/n,spd=s.speed/n,score=Math.round(Math.max(0,Math.min(10000,acc*78+Math.max(0,100-Math.min(err/2.8,100))*22)));onFinish({score,accuracy:acc,avgError:err,targetSpeed:spd,duration:DUR,pattern:mode==='bot'?'STRAFE BOT HEAD':mode==='head'?'HEADLINE':'MIXED STRAFE',mode,difficulty})};
 const loop=(now:number)=>{
  const el=stage.current,visual=targetEl.current;
  if(!el||!visual||phaseRef.current!=='playing')return;
  const rect=el.getBoundingClientRect();
  const dt=Math.min(.025,Math.max(.001,(now-last.current)/1000));
  const t=(now-start.current)/1000;
  if(t>=DUR){finish();return}
  const d=DIFF[difficulty];
  const left=.5-d.range,right=.5+d.range;
  const accelPx=d.speed*7.2;
  const brakePx=d.speed*11.5;
  const stopSpeed=d.speed*.035;

  // VALORANT-like strafe model: short movement bursts, hard counter-strafe,
  // tiny settle window, then a new random direction. Same direction can repeat.
  if(state.current==='pause'){
    v.current += (0-v.current)*Math.min(1,dt*24);
    if(Math.abs(v.current)<stopSpeed){
      v.current=0;
      if(now>=until.current){
        state.current='travel';
        dir.current=Math.random()>.5?1:-1;
        segmentUntil.current=now+rand(260,720);
      }
    }
  } else if(state.current==='brake'){
    v.current += (0-v.current)*Math.min(1,dt*18);
    if(Math.abs(v.current)<stopSpeed){
      v.current=0;
      state.current='pause';
      until.current=now+rand(42,d.pause*.72+55);
    }
  } else {
    if(now>=segmentUntil.current){
      // Random sequence: LLL, LRRL, RLR, LRRR...
      dir.current=Math.random()<.50?dir.current:(Math.random()>.5?1:-1);
      state.current='brake';
      segmentUntil.current=now+rand(260,620);
    } else {
      const desired=d.speed*dir.current;
      const delta=desired-v.current;
      const rate=Math.abs(v.current)>Math.abs(desired)*.72?accelPx*.62:accelPx;
      v.current += Math.sign(delta)*Math.min(Math.abs(delta),rate*dt);
    }
  }

  let nx=p.current.x+(v.current/Math.max(rect.width,1))*dt;
  if(nx>=right){
    nx=right-.006;
    v.current=-Math.abs(d.speed*.35);
    dir.current=-1;
    state.current='travel';
    segmentUntil.current=now+rand(260,560);
  } else if(nx<=left){
    nx=left+.006;
    v.current=Math.abs(d.speed*.35);
    dir.current=1;
    state.current='travel';
    segmentUntil.current=now+rand(260,560);
  }

  // Keep the head line stable; MIXED gets only subtle human-like vertical drift.
  const ny=mode==='mixed'
    ? Math.max(.39,Math.min(.61,.5+Math.sin(t*1.7)*.010+Math.sin(t*4.3)*.004))
    : .5;
  p.current={x:nx,y:ny};
  visual.style.left=`${nx*100}%`;
  visual.style.top=`${ny*100}%`;

  const tx=nx*rect.width,ty=ny*rect.height;
  const dist=Math.hypot(cursor.current.x-tx,cursor.current.y-ty);
  // Tracking hit quality is based on the cursor center, never on DOM overlap.
  // The visible crosshair can be large without enlarging the scoring/hit area.
  const follow=dist<=TRACK_RADIUS?1:Math.max(0,1-(dist-TRACK_RADIUS)/SOFT_RADIUS);
  stats.current.n++;
  stats.current.weight+=follow;
  stats.current.error+=dist;
  stats.current.speed+=Math.abs(v.current);
  if(now-hudAt.current>120){
    hudAt.current=now;
    setTime(Math.max(0,Math.ceil(DUR-t)));
    setHud({acc:Math.round(stats.current.weight/stats.current.n*100),error:Math.round(stats.current.error/stats.current.n),speed:Math.round(stats.current.speed/stats.current.n)});
  }
  last.current=now;
  raf.current=requestAnimationFrame(loop);
 };
 const begin=()=>{cleanup();stats.current={n:0,weight:0,error:0,speed:0};v.current=0;dir.current=Math.random()>.5?1:-1;state.current='travel';segmentUntil.current=performance.now()+rand(420,820);p.current={x:.5,y:.5};phaseRef.current='countdown';setPhase('countdown');setCount(3);let n=3;const id=window.setInterval(()=>{n--;setCount(n);if(n<=0){clearInterval(id);phaseRef.current='playing';setPhase('playing');window.setTimeout(()=>{if(phaseRef.current==='playing'){start.current=performance.now();last.current=start.current;hudAt.current=start.current;raf.current=requestAnimationFrame(loop)}},40)}},650)};
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{const r=stage.current?.getBoundingClientRect();if(!r)return;const x=Math.max(0,Math.min(r.width,e.clientX-r.left)),y=Math.max(0,Math.min(r.height,e.clientY-r.top));cursor.current={x,y};setMouse({x,y})};
 useEffect(()=>()=>{phaseRef.current='finished';cleanup()},[]);
 if(phase==='intro')return <main className="game-page"><header className="game-header"><button className="back-btn" onClick={onBack}>← EXIT</button><div><p className="eyebrow">TRACKING // MOVEMENT CONTROL</p><h1>트래킹 훈련</h1></div><div className="game-help">30 SEC</div></header><section className="setup panel"><div className="setup-progress"><span className={step==='difficulty'?'active':'done'}>01 난이도</span><i>→</i><span className={step==='mode'?'active':''}>02 훈련 모드</span></div>{step==='difficulty'?<><p className="eyebrow">01 // TARGET SPEED</p><h2>움직임을 부드럽게 따라가.</h2><p className="setup-copy">가속 → 이동 → 감속 → 짧은 정지 → 반전. 순간이동처럼 끊기지 않도록 프레임 단위로 움직입니다.</p><div className="choice-grid difficulty-grid">{Object.entries(DIFF).map(([id,d])=><button key={id} className={`choice-card difficulty-${id} ${difficulty===id?'selected':''}`} onClick={()=>setDifficulty(id as Difficulty)}><span className="choice-kicker">{d.tag}</span><strong>{d.label}</strong><em>{d.desc}</em><small>평균 이동 {d.speed}px/s</small></button>)}</div><button className="primary-btn wide" onClick={()=>setStep('mode')}>다음 — 훈련 모드 선택</button></>:<><p className="eyebrow">02 // TRAINING MODE</p><h2>무엇을 따라갈지 선택해.</h2><p className="setup-copy">조준선 전체 크기와 무관하게 **조준점 중앙**이 타겟 중심에 얼마나 가까운지를 측정합니다. 봇 모드는 머리 중앙을 기준으로 합니다.</p><div className="choice-grid mode-grid">{MODES.map((m,i)=><button key={m.id} className={`choice-card mode-${m.id} ${mode===m.id?'selected':''}`} onClick={()=>setMode(m.id)}><span className="mode-number">0{i+1}</span><strong>{m.title}</strong><b>{m.sub}</b><em>{m.detail}</em></button>)}</div><div className="setup-summary"><span>난이도 <b>{DIFF[difficulty].label}</b></span><span>현재 감도 <b>{sens.dpi} DPI · {sens.sens.toFixed(3)}</b></span></div><div className="setup-actions"><button className="secondary-btn" onClick={()=>setStep('difficulty')}>← 난이도</button><button className="primary-btn" onClick={begin}>▶ TRACKING 시작</button></div></>}</section></main>;
 if(phase==='countdown')return <main className="game-page"><div className="countdown-screen"><div className="countdown-card clean-countdown"><strong>{count}</strong></div></div></main>;
 return <main className="game-page training-live"><header className="live-hud"><button className="back-btn" onClick={()=>{phaseRef.current='finished';cleanup();onBack()}}>× 종료</button><div><b>{mode==='bot'?'STRAFE BOT HEAD':mode==='head'?'HEADLINE':'MIXED STRAFE'}</b><span>{DIFF[difficulty].label}</span></div><div className="live-stats"><span>HIT <b>{hud.acc}%</b></span><span>SHOT <b>{hud.error}px</b></span><span>COMBO <b>—</b></span><span>TIME <b>{time}s</b></span></div></header><div className={`training-stage tracking-${mode}`} ref={stage} onPointerMove={move} onPointerEnter={move}>{mode==='bot'?<div ref={targetEl} className="bot-anchor bot-live bot-head-anchor tracking-bot" style={{left:'50%',top:'50%'}}><div className="training-bot"><div className="bot-antenna"/><div className="bot-head"><span className="bot-eye"/><span className="bot-eye"/></div><div className="bot-neck"/><div className="bot-shoulder left"/><div className="bot-shoulder right"/><div className="bot-torso"><i/><i/><b/></div><div className="bot-arm left"/><div className="bot-arm right"/><div className="bot-forearm left"/><div className="bot-forearm right"/><div className="bot-leg left"/><div className="bot-leg right"/><div className="bot-foot left"/><div className="bot-foot right"/></div><div className="bot-head-hit"/></div>:<div ref={targetEl} className="aim-target tracking-target" style={{left:'50%',top:'50%'}}/>}<CrosshairView config={crosshair} className="live-crosshair" style={{left:mouse.x,top:mouse.y}}/><div className="training-vignette"/></div></main>;
}
