(() => {
  "use strict";
  if (window.__ASSEMBLY_TIMESHARP_LOADED__) { window.__ASSEMBLY_TIMESHARP_ENABLE__?.(); return; }
  window.__ASSEMBLY_TIMESHARP_LOADED__ = true;

  const DFPS = 30, POLL = 220, NOTICE_MS = 10000, RESET_KEY = "ats_reset_restore";
  const SPEEDS = [0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3,4,5,10];
  const MODES = ["auto","30","59.94","60"];
  const s = {
    top: window.top === window, enabled: true, selfId: 0, ctlId: 0, ctl: null, pollBusy: false,
    host:null, sh:null, el:{}, lockPlay:true, guard:{}, stepBusy:false, iv:null,
    video:null, cbId:null, lastMeta:null, lastSec:null, fpsSamples:[], rawFps:DFPS, fps:DFPS, mode:"auto", rate:1, decF:null, decT:null, timeLabel:"IGT",
    startMs:null,startF:null,endMs:null,endF:null,pauseMs:null,pauseF:null, segs:[], nextSeg:1, editor:false, notice:"", noticeUntil:0,
    noteAuto:"", noteDirty:false, noteCollapsed:false, redo:null, hideUntil:0, copyTickT:0, skipSaved:false, nativeIv:null
  };

  const sf = (v)=>Number.isFinite(v)&&v>0?v:DFPS;
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
  const tLabel = ()=>s.timeLabel==="LRT"?"LRT":"IGT";
  const yf = ()=>{const h=location.hostname.toLowerCase();return h.includes("youtube.com")||h.includes("youtu.be");};
  const tf = ()=>location.hostname.toLowerCase().includes("twitch.tv");
  const autoFps = (r)=>{r=sf(r); if(r<45) return 30; return yf()&&(Math.abs(r-59.94)<=Math.abs(r-60))?59.94:60;};
  const refps = ()=>{s.fps = s.mode==="auto"?autoFps(s.rawFps):sf(parseFloat(s.mode));};
  const pr = (v,n)=>{const f=10**n,x=v*f;if(!Number.isFinite(x))return v;const sg=x<0?-1:1,a=Math.abs(x),fl=Math.floor(a),d=a-fl,e=1e-12;let r=fl;if(d>0.5+e)r=fl+1;else if(Math.abs(d-0.5)<=e)r=fl%2===0?fl:fl+1;return sg*r/f;};
  const rvm = (v,f)=>{f=sf(f);const n=v<0;let w=Math.abs(Math.trunc(v))+1,u=w-w%1000,fl=1/f,m=w/1000+fl/100;m=m-((m%1)%fl);m=Math.trunc(pr(m%1,3)*1000);let o=u+m; if(n)o=-o; return o;};
  const f2ms = (frames,f=s.fps)=>rvm(Math.max(0,Math.trunc((Math.max(0,Math.trunc(frames))/sf(f))*1000)),sf(f));
  const fmt = (ms)=>{if(!Number.isFinite(ms))return "--:--:--.---";let x=Math.round(ms),sg=x<0?"-":"";x=Math.abs(x);const h=Math.floor(x/3600000);x-=h*3600000;const m=Math.floor(x/60000);x-=m*60000;const s2=Math.floor(x/1000);const z=x-s2*1000;return `${sg}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s2).padStart(2,"0")}.${String(z).padStart(3,"0")}`;};
  const vis = (e)=>{if(!e||!e.isConnected)return false;const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display!=="none"&&cs.visibility!=="hidden"&&r.width>20&&r.height>20;};
  const vScore = (v)=>{if(!vis(v))return -1e18;const r=v.getBoundingClientRect();let sc=r.width*r.height;if(!v.paused&&!v.ended)sc+=1e7;if(document.fullscreenElement&&document.fullscreenElement.contains(v))sc+=5e6;if(v.readyState>=2)sc+=5e5;return sc;};
  const bestVideo = ()=>{const vs=[...document.querySelectorAll("video")];if(!vs.length)return null;let b=null,bs=-1e18;for(const v of vs){const sc=vScore(v);if(sc>bs){bs=sc;b=v;}}return b;};

  function stopCb(){ if(s.video&&s.cbId&&typeof s.video.cancelVideoFrameCallback==="function"){try{s.video.cancelVideoFrameCallback(s.cbId);}catch{}} s.cbId=null;s.lastMeta=null;s.lastSec=null; }
  function pushFps(x){ if(!Number.isFinite(x)||x<5||x>240)return; s.fpsSamples.push(x); if(s.fpsSamples.length>90)s.fpsSamples.shift(); const a=[...s.fpsSamples].sort((p,q)=>p-q); s.rawFps=sf(a[Math.floor(a.length/2)]); refps(); }
  function startCb(v){ if(!v||typeof v.requestVideoFrameCallback!=="function")return; const lp=(_n,m)=>{ if(s.video!==v||!s.enabled)return; if(s.lastMeta){const df=m.presentedFrames-s.lastMeta.presentedFrames,dt=m.mediaTime-s.lastMeta.mediaTime;if(df>0&&dt>0)pushFps(df/dt);} s.lastMeta={presentedFrames:m.presentedFrames,mediaTime:m.mediaTime}; s.lastSec=m.mediaTime; s.cbId=v.requestVideoFrameCallback(lp);}; s.cbId=v.requestVideoFrameCallback(lp);}
  function setVideo(v){ if(s.video===v)return; stopCb(); s.video=v; s.fpsSamples=[]; s.lastMeta=null; s.lastSec=null; refps(); if(s.video){s.video.playbackRate=s.rate; if(s.lockPlay)s.video.pause(); startCb(s.video);} }
  function ensureV(){ if(!s.enabled)return null; if(s.video&&s.video.isConnected)return s.video; setVideo(bestVideo()); return s.video; }
  const rsec = (v=s.video)=>{
    if(!v)return null;
    if(v.paused) return v.currentTime;
    const fw=1.2/sf(s.fps);
    if(Number.isFinite(s.lastSec)&&Math.abs(s.lastSec-v.currentTime)<=fw)return s.lastSec;
    return v.currentTime;
  };
  const snapFromSec = (sec,f=sf(s.fps))=>{
    if(!Number.isFinite(sec))return null;
    const rawMs=Math.max(0,Math.trunc(sec*1000));
    const snappedMs=rvm(rawMs,f);
    const frame=Math.max(0,Math.round((snappedMs/1000)*f));
    return {frame,rawMs,snappedMs};
  };
  const snap = (v=s.video)=>{ if(!v)return null; return snapFromSec(rsec(v),sf(s.fps)); };
  const snapAcc = async (v=s.video)=>{
    if(!v)return null;
    if(typeof v.requestVideoFrameCallback!=="function")return snap(v);
    return await new Promise((res)=>{
      let d=false,id=null,f=sf(s.fps);
      const fin=(sec)=>{
        if(d)return;
        d=true;
        if(id!==null&&typeof v.cancelVideoFrameCallback==="function"){try{v.cancelVideoFrameCallback(id);}catch{}}
        const x=snapFromSec(sec,f)||snap(v);
        res(x);
      };
      id=v.requestVideoFrameCallback((_n,m)=>fin(m.mediaTime));
      setTimeout(()=>fin(rsec(v)),120);
    });
  };
  const lstat = ()=>{const v=ensureV(); if(v&&Number.isFinite(v.webkitDecodedFrameCount)){const n=performance.now(),f=v.webkitDecodedFrameCount; if(Number.isFinite(s.decF)&&Number.isFinite(s.decT)&&n>s.decT){const df=f-s.decF,dt=(n-s.decT)/1000; if(df>0&&dt>0)pushFps(df/dt);} s.decF=f;s.decT=n;} return {hasVideo:!!v, score:v?vScore(v):-1e18, paused:v?v.paused:true, playbackRate:v?v.playbackRate:s.rate, fps:sf(s.fps), rawFps:sf(s.rawFps), autoFps:autoFps(s.rawFps), host:location.hostname, sampleCount:s.fpsSamples.length};};
  const seek = (v,t)=>new Promise((r)=>{let d=false;const fin=()=>{if(d)return;d=true;v.removeEventListener("seeked",on);r();},on=()=>setTimeout(fin,0);v.addEventListener("seeked",on,{once:true});v.currentTime=t;setTimeout(fin,350);});
  async function lStep(dir){ const v=ensureV(); if(!v||s.stepBusy)return {ok:false}; s.stepBusy=true; try{const f=sf(s.fps),sn=await snapAcc(v); if(!sn)return {ok:false}; const cur=sn.frame,dur=Number.isFinite(v.duration)&&v.duration>0?v.duration:null; v.pause(); let tf=cur+dir; if(dur!==null)tf=clamp(tf,0,Math.max(0,Math.floor(dur*f))); else tf=Math.max(0,tf); await seek(v,tf/f); let a=0; while(a<4){const m=snap(v); if(!m)break; const bad=dir>0?m.frame<=cur:m.frame>=cur; if(!bad)break; tf+=dir; if(dur!==null)tf=clamp(tf,0,Math.max(0,Math.floor(dur*f))); else tf=Math.max(0,tf); await seek(v,tf/f); a++; } return {ok:true}; } finally{ s.stepBusy=false; } }
  async function lPlay(user=false){ const v=ensureV(); if(!v)return {ok:false}; if(v.paused){ if(user)s.lockPlay=false; await v.play().catch(()=>{});} else v.pause(); return {ok:true}; }
  async function lPlayOnly(){ const v=ensureV(); if(!v)return {ok:false}; s.lockPlay=false; await v.play().catch(()=>{}); return {ok:true}; }
  async function lPauseOnly(){ const v=ensureV(); if(!v)return {ok:false}; v.pause(); return {ok:true}; }
  async function lSeek(frame){ const v=ensureV(); if(!v)return {ok:false}; const f=sf(s.fps); let tf=Math.max(0,Math.trunc(frame)); if(Number.isFinite(v.duration)&&v.duration>0)tf=clamp(tf,0,Math.max(0,Math.floor(v.duration*f))); v.pause(); await seek(v,tf/f); return {ok:true}; }
  function lRate(r){ s.rate=r; const v=ensureV(); if(v)v.playbackRate=r; return {ok:true}; }
  function lMode(m){ if(!MODES.includes(m))return {ok:false}; s.mode=m; refps(); return {ok:true}; }
  async function runLocal(cmd,p={}){ switch(cmd){ case "GET_STATUS": return {ok:true,status:lstat()}; case "GET_PERSIST_KEY": return {ok:true,key:normKey(location.href)}; case "STEP_FRAME": return await lStep(p.direction||1); case "TOGGLE_PLAY_PAUSE": return await lPlay(!!p.userInitiated); case "PLAY": return await lPlayOnly(); case "PAUSE": return await lPauseOnly(); case "SEEK_TO_FRAME": return await lSeek(p.frame); case "SET_PLAYBACK_RATE": return lRate(Number(p.rate)); case "SET_FPS_MODE": return lMode(String(p.mode||"auto")); case "CAPTURE_SNAPSHOT_ACCURATE": { const x=await snapAcc(ensureV()); return {ok:!!x,snapshot:x}; } case "ENABLE_PAUSE_LOCK": s.lockPlay=true; return {ok:true}; default:return {ok:false}; } }

  async function reg(){ try{const r=await chrome.runtime.sendMessage({type:"ATS_FRAME_REGISTER"}); if(r?.ok&&Number.isInteger(r.frameId))s.selfId=r.frameId;}catch{} }
  async function qstat(){ try{const r=await chrome.runtime.sendMessage({type:"ATS_QUERY_FRAMES_STATUS"}); return r?.ok&&Array.isArray(r.frames)?r.frames:[];}catch{return [];} }
  async function getLabelMode(){ try{const r=await chrome.runtime.sendMessage({type:"ATS_GET_LABEL_MODE"}); if(r?.ok&&typeof r.mode==="string")s.timeLabel=r.mode==="LRT"?"LRT":"IGT";}catch{} }
  async function fcmd(id,cmd,p={}){ if(id===s.selfId)return await runLocal(cmd,p); try{return await chrome.runtime.sendMessage({type:"ATS_RUN_FRAME_COMMAND",frameId:id,command:cmd,payload:p})||{ok:false};}catch{return {ok:false};} }
  async function ctlCmd(cmd,p={}){ let id=Number.isInteger(s.ctlId)?s.ctlId:s.selfId; let r=await fcmd(id,cmd,p); if(r?.ok)return r; await refreshCtl(); id=Number.isInteger(s.ctlId)?s.ctlId:s.selfId; r=await fcmd(id,cmd,p); if(r?.ok)return r; return await fcmd(s.selfId,cmd,p); }
  async function getPersistKey(){ const r=await ctlCmd("GET_PERSIST_KEY"); if(r?.ok&&r.key)return r.key; return normKey(location.href); }
  function buildPersistState(){ return {version:1,timeLabel:tLabel(),mode:s.mode,rawFps:sf(s.rawFps),startMs:s.startMs,startF:s.startF,endMs:s.endMs,endF:s.endF,pauseMs:s.pauseMs,pauseF:s.pauseF,segs:s.segs,nextSeg:s.nextSeg}; }
  function applyPersistState(d){ if(!d||typeof d!=="object")return false; s.timeLabel=d.timeLabel==="LRT"?"LRT":"IGT"; s.mode=MODES.includes(d.mode)?d.mode:"auto"; s.rawFps=sf(d.rawFps); refps(); s.startMs=Number.isFinite(d.startMs)?d.startMs:null; s.startF=Number.isFinite(d.startF)?Math.trunc(d.startF):null; s.endMs=Number.isFinite(d.endMs)?d.endMs:null; s.endF=Number.isFinite(d.endF)?Math.trunc(d.endF):null; s.pauseMs=Number.isFinite(d.pauseMs)?d.pauseMs:null; s.pauseF=Number.isFinite(d.pauseF)?Math.trunc(d.pauseF):null; s.segs=Array.isArray(d.segs)?d.segs.map(z=>({id:Number.isFinite(z.id)?z.id:s.nextSeg++,startMs:Math.min(z.startMs,z.endMs),endMs:Math.max(z.startMs,z.endMs),startF:Number.isFinite(z.startF)?Math.trunc(z.startF):null,endF:Number.isFinite(z.endF)?Math.trunc(z.endF):null,durationMs:Number.isFinite(z.durationMs)?z.durationMs:0,enabled:z.enabled!==false})):[]; s.nextSeg=Number.isFinite(d.nextSeg)?Math.max(1,Math.trunc(d.nextSeg)):Math.max(1,s.segs.length+1); return true; }
  async function loadSavedForCurrent(){ if(!s.top||s.skipSaved)return; const key=await getPersistKey(); if(!key)return; try{const r=await chrome.runtime.sendMessage({type:"ATS_GET_SAVED_RETIME",key}); if(r?.ok&&r.state&&applyPersistState(r.state)){ await ctlCmd("SET_FPS_MODE",{mode:s.mode}); render(); }}catch{} }
  function bestFrame(fr){ let b=null,bs=-1e18,bc=-1; for(const i of fr){ if(!i?.status?.hasVideo)continue; const sc=Number(i.status.score),c=Number(i.status.sampleCount||0); if(sc>bs||(sc===bs&&c>bc)){bs=sc;bc=c;b=i;}} return b; }
  function guard(k,fn,m=100){ const n=performance.now(),l=s.guard[k]||0; if(n-l<m)return; s.guard[k]=n; fn(); }

  chrome.runtime.onMessage.addListener((msg,_se,send)=>{ (async()=>{ if(!msg?.type){send({ok:false});return;} if(msg.type==="ATS_FRAME_GET_STATUS"){send({ok:true,status:lstat()});return;} if(msg.type==="ATS_FRAME_COMMAND"){send(await runLocal(msg.command,msg.payload||{}));return;} if(msg.type==="ATS_SET_LABEL_MODE"){s.timeLabel=msg.mode==="LRT"?"LRT":"IGT"; save(); if(s.top)render(); send({ok:true}); return;} if(msg.type==="ATS_COLLECT_STATE_FOR_SAVE"){ if(!s.top){send({ok:false,error:"not_top"});return;} const key=await getPersistKey(); send({ok:true,key,state:buildPersistState(),title:document.title||""}); return;} send({ok:false}); })().catch(e=>send({ok:false,error:String(e)})); return true; });
  document.addEventListener("play",(e)=>{ if(!(e.target instanceof HTMLVideoElement))return; if(s.video!==e.target)setVideo(e.target); if(s.lockPlay){ if(e.isTrusted)s.lockPlay=false; else e.target.pause(); } },true);
  document.addEventListener("ratechange",(e)=>{ if(!(e.target instanceof HTMLVideoElement))return; if(s.video!==e.target)setVideo(e.target); s.rate=e.target.playbackRate; },true);

  const gKey = ()=>{const u=new URL(location.href);return `${u.hostname}:${u.pathname}:${u.search}`;};
  const save = ()=>{ if(!s.top) return; try{sessionStorage.setItem("ats_state",JSON.stringify({key:gKey(),rate:s.rate,mode:s.mode,rawFps:s.rawFps,timeLabel:tLabel(),startMs:s.startMs,startF:s.startF,endMs:s.endMs,endF:s.endF,pauseMs:s.pauseMs,pauseF:s.pauseF,segs:s.segs,nextSeg:s.nextSeg}));}catch{} };
  const load = ()=>{ if(!s.top)return; try{const x=sessionStorage.getItem("ats_state"); if(!x)return; const d=JSON.parse(x); if(!d||d.key!==gKey())return; s.rate=Number.isFinite(d.rate)?d.rate:1; s.mode=MODES.includes(d.mode)?d.mode:"auto"; s.rawFps=sf(d.rawFps); s.timeLabel=d.timeLabel==="LRT"?"LRT":"IGT"; refps(); s.startMs=Number.isFinite(d.startMs)?d.startMs:null; s.startF=Number.isFinite(d.startF)?Math.trunc(d.startF):null; s.endMs=Number.isFinite(d.endMs)?d.endMs:null; s.endF=Number.isFinite(d.endF)?Math.trunc(d.endF):null; s.pauseMs=Number.isFinite(d.pauseMs)?d.pauseMs:null; s.pauseF=Number.isFinite(d.pauseF)?Math.trunc(d.pauseF):null; s.segs=Array.isArray(d.segs)?d.segs.map(z=>({id:Number.isFinite(z.id)?z.id:s.nextSeg++,startMs:Math.min(z.startMs,z.endMs),endMs:Math.max(z.startMs,z.endMs),startF:Number.isFinite(z.startF)?Math.trunc(z.startF):null,endF:Number.isFinite(z.endF)?Math.trunc(z.endF):null,durationMs:Number.isFinite(z.durationMs)?z.durationMs:0,enabled:z.enabled!==false})):[]; if(Number.isFinite(d.nextSeg))s.nextSeg=Math.max(1,Math.trunc(d.nextSeg));}catch{} };
  const remTotal=()=>s.segs.reduce((t,g)=>g.enabled?t+Math.max(0,Number(g.durationMs)||0):t,0);
  const noticeLabel=()=>{ const n=performance.now(); if(s.notice&&n<s.noticeUntil) return `${s.notice} - Open Editor`; return "Open Editor"; };
  const calcTimes=()=>{ if(!Number.isFinite(s.startF)||!Number.isFinite(s.endF))return null; const fd=s.endF-s.startF,sg=fd>=0?1:-1,rta=sg*f2ms(Math.abs(fd)),removed=Math.max(0,Math.trunc(remTotal())),adj=rta-sg*removed; return {rta,adj,removed,hasRemoved:removed>0}; };
  const yfmt=(sec)=>{sec=Number(sec); if(!Number.isFinite(sec))return "0:00.000"; const n=sec<0?"-":""; sec=Math.abs(sec); const h=Math.floor(sec/3600); sec-=h*3600; const m=Math.floor(sec/60); sec-=m*60; const s2=Math.floor(sec); const ms=Math.floor((sec-s2)*1000+1e-6); if(h>0)return `${n}${h}:${String(m).padStart(2,"0")}:${String(s2).padStart(2,"0")}.${String(ms).padStart(3,"0")}`; return `${n}${m}:${String(s2).padStart(2,"0")}.${String(ms).padStart(3,"0")}`; };
  const frameSec=(v,isDuration=false)=>{
    if(!v)return null;
    const f=sf(s.fps);
    if(isDuration){
      if(!Number.isFinite(v.duration))return null;
      return rvm(Math.max(0,Math.trunc(v.duration*1000)),f)/1000;
    }
    const sn=snap(v);
    if(!sn)return null;
    return sn.snappedMs/1000;
  };
  const pickTimer=(root,sel)=>{ if(!sel||!root)return null; const items=root.querySelectorAll(sel); for(const n of items){ if(n instanceof HTMLElement&&vis(n)) return n; } const first=items[0]; return first instanceof HTMLElement?first:null; };
  const playerRoot=(v)=>v?.closest?.(".html5-video-player,.ytp-chrome-bottom,.video-player,[data-a-target='video-player'],.player-video,.persistent-player")||document;
  const setNativeMs=(curSel,durSel)=>{
    const v=s.video||ensureV();
    if(!v)return;
    const root=playerRoot(v);
    const c=pickTimer(root,curSel)||pickTimer(document,curSel);
    const d=pickTimer(root,durSel)||pickTimer(document,durSel);
    if(v.paused){
      if(c&&typeof c.dataset.atsOrig!=="string")c.dataset.atsOrig=c.textContent||"";
      if(d&&typeof d.dataset.atsOrig!=="string")d.dataset.atsOrig=d.textContent||"";
      const cs=frameSec(v,false),ds=frameSec(v,true);
      if(c&&Number.isFinite(cs))c.textContent=yfmt(cs);
      if(d&&Number.isFinite(ds))d.textContent=yfmt(ds);
    } else {
      if(c&&typeof c.dataset.atsOrig==="string"){c.textContent=c.dataset.atsOrig; delete c.dataset.atsOrig;}
      if(d&&typeof d.dataset.atsOrig==="string"){d.textContent=d.dataset.atsOrig; delete d.dataset.atsOrig;}
    }
  };
  const nativeMs=()=>{
    if(!s.enabled)return;
    if(yf()){
      setNativeMs(".ytp-time-current",".ytp-time-duration");
      return;
    }
    if(tf()){
      const cur='[data-a-target="player-seekbar-current-time"],[data-a-target="player-current-time"],.player-seekbar__time-elapsed,.video-player__time-elapsed,[data-test-selector="seekbar-current-time"]';
      const dur='[data-a-target="player-seekbar-duration"],[data-a-target="player-duration"],.player-seekbar__time-duration,.video-player__time-duration,[data-test-selector="seekbar-duration"]';
      setNativeMs(cur,dur);
    }
  };
  const normKey=(u)=>{ try{const x=new URL(u,location.href),h=x.hostname.toLowerCase().replace(/^www\./,""),p=x.pathname||"/",q=x.searchParams; if(h==="youtu.be"){const id=p.split("/").filter(Boolean)[0]; if(id)return `youtube:${id}`;} if(h.includes("youtube.com")){const v=q.get("v"); if(v)return `youtube:${v}`; const e=p.match(/\/embed\/([^/?#]+)/i); if(e)return `youtube:${e[1]}`; const s2=p.match(/\/shorts\/([^/?#]+)/i); if(s2)return `youtube:${s2[1]}`;} if(h.includes("twitch.tv")){const m=p.match(/\/videos\/(\d+)/i); if(m)return `twitch:${m[1]}`; const qv=q.get("video")||q.get("v"); if(qv){const n=String(qv).replace(/^v/i,""); if(/^\d+$/.test(n))return `twitch:${n}`;}} return `url:${h}${p}`;}catch{return `url:${location.hostname}${location.pathname}`;} };

  function mount(){ if(!s.top||!s.enabled||!s.host)return; const p=document.fullscreenElement||document.documentElement; if(s.host.parentNode!==p)p.appendChild(s.host); s.host.style.display=""; }
  function syncSel(){ const es=s.el; if(!es.speed||!es.fps||!s.ctl)return; let r=s.ctl.playbackRate??s.rate,b=SPEEDS[0],d=Math.abs(r-b); for(const v of SPEEDS){const m=Math.abs(v-r);if(m<d){d=m;b=v;}} es.speed.value=b.toFixed(2); const ao=es.fps.querySelector('option[value="auto"]'); if(ao) ao.textContent=`FPS: Auto (${autoFps(s.rawFps).toFixed(2)})`; es.fps.value=s.mode; }
  function drawEditor(){
    const p=s.el.editor;
    if(!p) return;
    if(!s.editor){ p.classList.add("hidden"); p.innerHTML=""; return; }
    p.classList.remove("hidden");
    const rows=[...s.segs].sort((a,b)=>{const af=Number.isFinite(a.startF)?a.startF:a.startMs,bf=Number.isFinite(b.startF)?b.startF:b.startMs; return af-bf;});
    const rowsHtml = rows.length
      ? rows.map(g=>`<div class="row"><span class="pill">F: ${Number.isFinite(g.startF)?g.startF:"?"} -> F: ${Number.isFinite(g.endF)?g.endF:"?"}</span><span class="pill">${fmt(g.durationMs)}</span><button class="sbtn" data-a="redo" data-id="${g.id}">Redo</button><button class="sbtn" data-a="toggle" data-id="${g.id}">${g.enabled?"Remove":"Add Back"}</button><button class="sbtn" data-a="delete" data-id="${g.id}">Delete</button></div>`).join("")
      : `<div class="empty">No load removals yet.</div>`;
    p.innerHTML = `<div class="panel"><div class="head"><span class="ttl">Pause Time Editor</span></div><div class="list">${rowsHtml}</div><div class="foot"><button class="sbtn danger" data-a="reset-all">Reset All</button></div></div>`;
  }
  function render(){
    if(!s.top||!s.enabled||!s.el.play) return;
    const st=s.ctl||{hasVideo:false,paused:true,host:location.hostname};
    const hv=!!st.hasVideo, e=s.el, lbl=tLabel(),tm=calcTimes();
    const hideUi=performance.now()<s.hideUntil;
    e.wrap.style.visibility=hideUi?"hidden":"visible";
    e.prev.disabled=!hv; e.next.disabled=!hv; e.cStart.disabled=!hv; e.cEnd.disabled=!hv; e.speed.disabled=!hv; e.play.disabled=!hv;
    e.play.textContent=hv?(st.paused?"\u25b6":"\u275a\u275a"):"\u25b6";
    e.site.textContent=hv?(st.host&&st.host!==location.hostname?`Site: ${location.hostname} (embed: ${st.host})`:`Site: ${location.hostname}`):"Site: searching <video>";
    e.cStart.textContent=s.startMs===null?"Confirm Start":"Undo Start";
    e.cEnd.textContent=s.endMs===null?"Confirm End":"Undo End";
    e.pause.textContent=s.pauseMs===null?"Pause Time":"Unpause Time";
    e.pause.disabled=!hv;
    e.cancelRedo.classList.toggle("hiddenCtl",!s.redo);
    e.editorBtn.textContent=noticeLabel();
    e.start.textContent=Number.isFinite(s.startMs)?`Start: ${fmt(s.startMs)} (F: ${Number.isFinite(s.startF)?s.startF:"?"})`:"Start: --:--:--.---";
    e.end.textContent=Number.isFinite(s.endMs)?`End: ${fmt(s.endMs)} (F: ${Number.isFinite(s.endF)?s.endF:"?"})`:"End: --:--:--.---";
    if(tm){ e.rta.textContent=`RTA: ${fmt(tm.rta)}`; e.igt.textContent=`${lbl}: ${fmt(tm.adj)}`; } else { e.rta.textContent="RTA: --:--:--.---"; e.igt.textContent=`${lbl}: --:--:--.---`; }
    const bh=Math.ceil((e.wrap?.getBoundingClientRect().height)||40);
    if(e.noteWrap) e.noteWrap.style.bottom=`${bh+10}px`;
    if(e.editor){ e.editor.style.setProperty("--ats-ed-bottom",`${bh+10}px`); }
    if(hideUi){
      e.noteWrap.classList.add("hidden");
    } else if(Number.isFinite(s.endMs)&&tm){
      const auto=tm.hasRemoved?`Mod Note: Retimed to ${fmt(tm.rta)} RTA, ${fmt(tm.adj)} ${lbl}.`:`Mod Note: Retimed to ${fmt(tm.rta)} RTA.`;
      if(auto!==s.noteAuto){
        s.noteAuto=auto;
        if(!s.noteDirty || !e.noteText.matches(":focus")){
          e.noteText.value=auto;
          s.noteDirty=false;
        }
      }
      if(!e.noteText.value){
        e.noteText.value=auto;
        s.noteDirty=false;
      }
      e.noteWrap.classList.remove("hidden");
      e.noteWrap.classList.toggle("collapsed",s.noteCollapsed);
      e.toggleNote.textContent=s.noteCollapsed?"Show Mod Note":"Hide Mod Note";
      e.copyNote.disabled=s.noteCollapsed;
      if(e.editor){ const nw=Math.ceil(e.noteWrap.getBoundingClientRect().width)||0; e.editor.style.setProperty("--ats-ed-right",`${nw+18}px`); }
    } else {
      s.noteAuto=""; s.noteDirty=false; e.noteText.value="";
      e.noteWrap.classList.add("hidden");
      s.noteCollapsed=false;
      if(e.editor){ e.editor.style.setProperty("--ats-ed-right","10px"); }
    }
    syncSel(); drawEditor(); nativeMs();
  }

  async function refreshCtl(){ if(!s.top||!s.enabled||s.pollBusy)return; s.pollBusy=true; try{const fs=await qstat(),b=bestFrame(fs); if(b){s.ctlId=b.frameId; s.ctl=b.status; s.rawFps=sf(b.status.rawFps); refps();} else {s.ctlId=s.selfId; s.ctl=lstat();}} finally{s.pollBusy=false;} }
  const cap = async ()=>{ const r=await ctlCmd("CAPTURE_SNAPSHOT_ACCURATE"); return r?.ok?r.snapshot:null; };
  async function tStart(){ if(s.startMs===null){const x=await cap(); if(!x)return; s.startMs=x.snappedMs; s.startF=x.frame;} else {s.startMs=null;s.startF=null;s.pauseMs=null;s.pauseF=null;} save(); render(); }
  async function tEnd(){ if(s.endMs===null){const x=await cap(); if(!x)return; s.endMs=x.snappedMs; s.endF=x.frame;} else {s.endMs=null;s.endF=null;s.pauseMs=null;s.pauseF=null;} save(); render(); }
  async function tPause(){ const x=await cap(); if(!x)return; if(s.pauseMs===null){s.pauseMs=x.snappedMs;s.pauseF=x.frame;} else {const a=Math.min(s.pauseMs,x.snappedMs),b=Math.max(s.pauseMs,x.snappedMs),af=Number.isFinite(s.pauseF)?Math.min(s.pauseF,x.frame):null,bf=Number.isFinite(s.pauseF)?Math.max(s.pauseF,x.frame):null; let d=Math.max(0,b-a); if(Number.isFinite(af)&&Number.isFinite(bf))d=f2ms(Math.abs(bf-af)); if(d>0){if(s.redo){const old=s.redo.old; s.segs.push({id:old.id,startMs:a,endMs:b,startF:af,endF:bf,durationMs:d,enabled:old.enabled!==false}); s.redo=null;} else {s.segs.push({id:s.nextSeg++,startMs:a,endMs:b,startF:af,endF:bf,durationMs:d,enabled:true});} s.notice=`Removed ${fmt(d)}`; s.noticeUntil=performance.now()+NOTICE_MS;} else if(s.redo){s.segs.push(s.redo.old); s.redo=null;} s.pauseMs=null;s.pauseF=null;} save(); render(); }
  async function startRedo(id){
    if(s.redo)return;
    const i=s.segs.findIndex(g=>g.id===id);
    if(i<0)return;
    const old={...s.segs[i]};
    s.segs.splice(i,1);
    s.redo={id,old};
    s.pauseMs=old.startMs;
    s.pauseF=Number.isFinite(old.startF)?old.startF:null;
    s.editor=false;
    s.hideUntil=performance.now()+900;
    save(); render();
    if(Number.isFinite(old.startF)){
      let ok=false;
      for(let a=0;a<6;a++){
        const r=await ctlCmd("SEEK_TO_FRAME",{frame:old.startF});
        if(r?.ok){ ok=true; break; }
        await refreshCtl();
        await new Promise(z=>setTimeout(z,90));
      }
      if(!ok){
        s.segs.push(old); s.redo=null; s.pauseMs=null; s.pauseF=null; s.hideUntil=0;
        save(); render();
        return;
      }
    }
    s.hideUntil=0;
    render();
  }
  function cancelRedo(){
    if(!s.redo)return;
    s.segs.push(s.redo.old);
    s.redo=null;
    s.pauseMs=null; s.pauseF=null;
    save(); render();
  }
  function showCopyTick(){
    const k=s.el.copyTick;
    if(!k)return;
    clearTimeout(s.copyTickT);
    k.classList.remove("show");
    void k.offsetWidth;
    k.classList.add("show");
    s.copyTickT=setTimeout(()=>k.classList.remove("show"),1800);
  }
  function clearState(){
    s.rate=1; s.mode="auto"; s.rawFps=DFPS; refps();
    s.startMs=null; s.startF=null; s.endMs=null; s.endF=null; s.pauseMs=null; s.pauseF=null;
    s.segs=[]; s.nextSeg=1; s.editor=false; s.notice=""; s.noticeUntil=0; s.noteAuto=""; s.noteDirty=false; s.noteCollapsed=false; s.redo=null; s.hideUntil=0;
  }
  async function resetAll(){
    const ok=window.confirm("Reset all ATS data on this page and reload?");
    if(!ok) return;
    const snapNow=await cap();
    const restoreFrame=Number.isFinite(snapNow?.frame)?Math.trunc(snapNow.frame):null;
    clearState();
    try{sessionStorage.removeItem("ats_state");}catch{}
    try{sessionStorage.setItem(RESET_KEY,JSON.stringify({key:gKey(),frame:restoreFrame,skipSaved:true}));}catch{}
    try{await ctlCmd("SET_PLAYBACK_RATE",{rate:1});}catch{}
    try{await ctlCmd("SET_FPS_MODE",{mode:"auto"});}catch{}
    location.reload();
  }
  async function applyResetRestore(){
    try{
      const raw=sessionStorage.getItem(RESET_KEY);
      if(!raw)return;
      sessionStorage.removeItem(RESET_KEY);
      const d=JSON.parse(raw);
      if(!d||d.key!==gKey()||!Number.isFinite(d.frame))return;
      s.skipSaved=!!d.skipSaved;
      const f=Math.max(0,Math.trunc(d.frame));
      let ok=false;
      for(let i=0;i<10;i++){
        const seekRes=await ctlCmd("SEEK_TO_FRAME",{frame:f});
        if(seekRes?.ok){ ok=true; break; }
        await new Promise(r=>setTimeout(r,180));
        await refreshCtl();
      }
      if(!ok)return;
      await ctlCmd("PLAY");
      await new Promise(r=>setTimeout(r,70));
      await ctlCmd("PAUSE");
    }catch{}
  }

  function ui(){
    const fontUrl = chrome.runtime.getURL("assets/aller.regular.ttf");
    const logoUrl = chrome.runtime.getURL("assets/icons/icon128.png");
    const h=document.createElement("div");
    h.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;font-family:'ATSAller','Segoe UI',Tahoma,sans-serif";
    const sh=h.attachShadow({mode:"open"});
    sh.innerHTML=`<style>
      @font-face{font-family:'ATSAller';src:url('${fontUrl}') format('truetype');font-weight:400;font-style:normal}
      .w{pointer-events:auto;box-sizing:border-box;width:100%;max-width:100vw;background:rgba(8,12,18,.97);border-top:1px solid rgba(85,120,156,.42);color:#ffffff;padding:6px 8px;display:grid;grid-template-columns:auto minmax(220px,1fr);gap:8px;align-items:center}
      .c{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      .logo{width:clamp(40px,3.0vw,52px);height:clamp(40px,3.0vw,52px);display:block;object-fit:contain;flex:0 0 auto}
      .b,.s{background:#162333;border:1px solid #35506c;color:#ffffff;border-radius:6px;height:28px;padding:0 9px;font-size:clamp(10px,.7vw,12px);line-height:28px}
      .b{cursor:pointer}.b:hover:enabled{background:#21344c}.b:disabled,.s:disabled{opacity:.55;cursor:default}
      .ib{min-width:42px;padding:0 8px;font-size:16px;line-height:26px}
      .hiddenCtl{display:none}
      .s{min-width:108px;cursor:pointer}
      #sp{min-width:96px}
      .st{display:grid;grid-template-columns:auto auto minmax(80px,1fr);gap:6px 12px;align-items:center;font-size:clamp(10px,.72vw,13px);color:#ffffff}
      .sk{display:grid;grid-template-rows:auto auto;gap:2px;white-space:nowrap}
      .site{text-align:right;color:#dbe9f7;white-space:nowrap}
      .ed{pointer-events:auto;position:fixed;inset:0;background:transparent}
      .mn,.mn *{box-sizing:border-box}
      .mn{pointer-events:auto;position:fixed;right:10px;bottom:54px;width:min(560px,94vw);background:rgba(9,14,22,.985);border:1px solid #38587a;border-radius:10px;padding:10px;color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.45);display:grid;gap:8px;z-index:2147483647}
      .mnT{font-size:12px;color:#d9e7f7}
      .mnBox{display:block;width:100%;min-height:96px;max-height:220px;resize:vertical;background:#0f1a29;color:#fff;border:1px solid #35506c;border-radius:8px;padding:8px;font-size:12px;line-height:1.35;font-family:'ATSAller','Segoe UI',Tahoma,sans-serif}
      .mnRow{display:flex;justify-content:flex-end;gap:6px}
      .copyOk{display:inline-block;opacity:0;transform:translateY(4px) scale(.95);color:#84e2aa;font-size:12px;pointer-events:none}
      .copyOk.show{animation:copied 1.8s ease forwards}
      @keyframes copied{0%{opacity:0;transform:translateY(4px) scale(.95)}18%{opacity:1;transform:translateY(0) scale(1)}82%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-3px) scale(.98)}}
      .mn.collapsed{width:auto;min-width:170px;justify-items:end}
      .mn.collapsed .mnT,.mn.collapsed .mnBox,.mn.collapsed #mcp,.mn.collapsed #mok{display:none}
      .hidden{display:none}
      .panel{position:absolute;right:var(--ats-ed-right,10px);bottom:var(--ats-ed-bottom,54px);width:min(660px,92vw);max-height:min(72vh,640px);overflow:auto;background:rgba(9,14,22,.985);border:1px solid #38587a;border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.5);padding:12px}
      .head{display:flex;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:10px}
      .ttl{font-size:14px;font-weight:600;color:#fff}
      .list{display:grid;gap:6px}
      .row{display:grid;grid-template-columns:minmax(132px,1fr) minmax(96px,auto) auto auto auto;gap:6px;align-items:center}
      .pill{background:#132133;border:1px solid #2f4b69;border-radius:6px;padding:4px 8px;white-space:nowrap;color:#fff}
      .sbtn{background:#20344b;border:1px solid #44658a;color:#fff;border-radius:6px;height:26px;padding:0 8px;cursor:pointer;font-size:11px}
      .sbtn:hover{background:#29435f}
      .danger{background:#472329;border-color:#8d4a56}
      .danger:hover{background:#60313a}
      .foot{display:flex;justify-content:flex-end;margin-top:10px}
      .empty{color:#c9d7e8;background:#132133;border:1px solid #2f4b69;border-radius:8px;padding:8px 10px}
    </style>
    <div class="w" id="wr"><div class="c">
      <img class="logo" id="lg" alt="" src="${logoUrl}" />
      <button class="b ib" id="p" title="Frame -1">&#8592;</button><button class="b ib" id="pp" title="Play/Pause">&#9654;</button><button class="b ib" id="n" title="Frame +1">&#8594;</button>
      <select class="s" id="sp"></select><select class="s" id="fm"></select>
      <button class="b" id="cs">Confirm Start</button><button class="b" id="ce">Confirm End</button><button class="b" id="pt">Pause Time</button><button class="b hiddenCtl" id="cr">Cancel Redo</button><button class="b" id="eb">Open Editor</button>
    </div><div class="st">
      <div class="sk"><span id="st">Start: --:--:--.---</span><span id="en">End: --:--:--.---</span></div>
      <div class="sk"><span id="rt">RTA: --:--:--.---</span><span id="ig">IGT: --:--:--.---</span></div>
      <span class="site" id="si">Site: searching <video></span>
    </div></div><div class="ed hidden" id="ed"></div><div class="mn hidden" id="mn"><div class="mnT">Mod Note</div><textarea id="mnt" class="mnBox" spellcheck="false"></textarea><div class="mnRow"><span class="copyOk" id="mok">&#10003; Copied</span><button class="sbtn" id="mcp">Copy Mod Note</button><button class="sbtn" id="mth">Hide Mod Note</button></div></div>`;

    s.host=h; s.sh=sh;
    const sp=sh.getElementById("sp");
    for(const v of SPEEDS){const o=document.createElement("option"); o.value=v.toFixed(2); o.textContent=`${v.toFixed(2)}x`; sp.appendChild(o);}
    const fm=sh.getElementById("fm");
    const labs={auto:"FPS: Auto",30:"FPS: 30","59.94":"FPS: 59.94",60:"FPS: 60"};
    for(const m of MODES){const o=document.createElement("option"); o.value=m; o.textContent=labs[m]; fm.appendChild(o);}

    s.el={wrap:sh.getElementById("wr"),logo:sh.getElementById("lg"),prev:sh.getElementById("p"),play:sh.getElementById("pp"),next:sh.getElementById("n"),speed:sp,fps:fm,cStart:sh.getElementById("cs"),cEnd:sh.getElementById("ce"),pause:sh.getElementById("pt"),cancelRedo:sh.getElementById("cr"),editorBtn:sh.getElementById("eb"),editor:sh.getElementById("ed"),noteWrap:sh.getElementById("mn"),noteText:sh.getElementById("mnt"),copyTick:sh.getElementById("mok"),copyNote:sh.getElementById("mcp"),toggleNote:sh.getElementById("mth"),site:sh.getElementById("si"),start:sh.getElementById("st"),end:sh.getElementById("en"),rta:sh.getElementById("rt"),igt:sh.getElementById("ig")};
    s.el.logo.onerror=()=>{ const f=chrome.runtime.getURL("ATS.png"); if(s.el.logo.src!==f){ s.el.logo.src=f; return; } s.el.logo.style.display="none"; };
    s.el.prev.onclick=()=>guard("p",async()=>{await ctlCmd("STEP_FRAME",{direction:-1}); await refreshCtl(); render();},70);
    s.el.next.onclick=()=>guard("n",async()=>{await ctlCmd("STEP_FRAME",{direction:1}); await refreshCtl(); render();},70);
    s.el.play.onclick=()=>guard("pp",async()=>{await ctlCmd("TOGGLE_PLAY_PAUSE",{userInitiated:true}); await refreshCtl(); render();},100);
    s.el.speed.onchange=(e)=>{const v=parseFloat(e.target.value); if(Number.isFinite(v)){s.rate=v; void ctlCmd("SET_PLAYBACK_RATE",{rate:v}); save();}};
    s.el.fps.onchange=(e)=>{const m=String(e.target.value); if(MODES.includes(m)){s.mode=m; refps(); void ctlCmd("SET_FPS_MODE",{mode:m}); save(); render();}};
    s.el.cStart.onclick=()=>guard("cs",()=>void tStart(),100);
    s.el.cEnd.onclick=()=>guard("ce",()=>void tEnd(),100);
    s.el.pause.onclick=()=>guard("pt",()=>void tPause(),100);
    s.el.cancelRedo.onclick=()=>void cancelRedo();
    s.el.editorBtn.onclick=()=>{s.editor=!s.editor; render();};
    s.el.noteText.addEventListener("input",()=>{s.noteDirty=true;});
    s.el.noteText.addEventListener("keydown",(ev)=>{ev.stopImmediatePropagation();ev.stopPropagation();});
    s.el.noteText.addEventListener("keyup",(ev)=>{ev.stopImmediatePropagation();ev.stopPropagation();});
    s.el.noteText.addEventListener("keypress",(ev)=>{ev.stopImmediatePropagation();ev.stopPropagation();});
    s.el.copyNote.onclick=async()=>{const txt=s.el.noteText.value||""; if(!txt)return; try{await navigator.clipboard.writeText(txt);}catch{ s.el.noteText.focus(); s.el.noteText.select(); try{document.execCommand("copy");}catch{} } showCopyTick(); };
    s.el.toggleNote.onclick=()=>{s.noteCollapsed=!s.noteCollapsed; render();};
    const isTypingNote=()=>document.activeElement===s.el.noteText||s.sh?.activeElement===s.el.noteText;
    const swallow=(ev)=>{ if(isTypingNote()){ ev.stopImmediatePropagation(); ev.stopPropagation(); } };
    window.addEventListener("keydown",swallow,true);
    window.addEventListener("keyup",swallow,true);
    window.addEventListener("keypress",swallow,true);
    s.el.editor.onclick=(ev)=>{const t=ev.target;if(!(t instanceof HTMLElement))return; if(t===s.el.editor){s.editor=false; render(); return;} const a=t.dataset.a,id=Number(t.dataset.id); if(a==="reset-all"){void resetAll(); return;} if(!a||!Number.isFinite(id))return; const i=s.segs.findIndex(g=>g.id===id); if(i<0)return; if(a==="delete"){s.segs.splice(i,1);} else if(a==="toggle"){s.segs[i].enabled=!s.segs[i].enabled;} else if(a==="redo"){void startRedo(id); return;} save(); render();};
    document.addEventListener("fullscreenchange",mount); mount();
  }

  function enable(){ s.enabled=true; s.lockPlay=true; if(s.top)mount(); setVideo(bestVideo()); render(); }
  function disable(){ s.enabled=false; stopCb(); setVideo(null); if(s.top&&s.host&&s.host.isConnected)s.host.remove(); }

  async function init(){
    await reg();
    setVideo(bestVideo());
    if(!s.top)return;
    load();
    await getLabelMode();
    ui();
    render();
    s.iv=setInterval(async()=>{ if(!s.enabled)return; await refreshCtl(); render(); },POLL);
    s.nativeIv=setInterval(()=>{ try{ nativeMs(); }catch{} },90);
    await refreshCtl();
    await applyResetRestore();
    await loadSavedForCurrent();
    render();
  }
  window.__ASSEMBLY_TIMESHARP_ENABLE__=enable; window.__ASSEMBLY_TIMESHARP_DISABLE__=disable; window.__ASSEMBLY_TIMESHARP_OPEN_PANEL__=enable;
  void init();
})();
