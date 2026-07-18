(() => {
  "use strict";
  if (window.__ASSEMBLY_TIMESHARP_LOADED__) { window.__ASSEMBLY_TIMESHARP_ENABLE__?.(); return; }
  window.__ASSEMBLY_TIMESHARP_LOADED__ = true;

  const DFPS = 30, POLL = 220, NOTICE_MS = 10000, RESET_KEY = "SNR_reset_restore";
  const SPEEDS = [0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3,4,5,10];
  const MODES = ["auto","30","59.94","60"];
  const s = {
    top: window.top === window, enabled: true, selfId: 0, ctlId: 0, ctl: null, pollBusy: false,
    host:null, sh:null, el:{}, lockPlay:true, guard:{}, stepBusy:false, iv:null,
    specialLayout:false, frames:[], reinjectAt:0, pageKey:"", routeBusy:false,
    video:null, cbId:null, lastMeta:null, lastSec:null, fpsSamples:[], rawFps:DFPS, fps:DFPS, mode:"auto", rate:1, decF:null, decT:null, timeLabel:"IGT",
    startMs:null,startF:null,endMs:null,endF:null,pauseMs:null,pauseF:null, segs:[], nextSeg:1, editor:false, notice:"", noticeUntil:0,
    noteAuto:"", noteDirty:false, noteCollapsed:false, redo:null, hideUntil:0, copyTickT:0, skipSaved:false, nativeIv:null, srSaved:{},
    sr:{style:false,mounts:new Map(),states:new Map(),editors:new Map(),editorHost:null,editorHostAt:0}
  };

  const sf = (v)=>Number.isFinite(v)&&v>0?v:DFPS;
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
  const tLabel = ()=>s.timeLabel==="LRT"?"LRT":"IGT";
  const yf = ()=>{const h=location.hostname.toLowerCase();return h.includes("youtube.com")||h.includes("youtu.be");};
  const tf = ()=>location.hostname.toLowerCase().includes("twitch.tv");
  const srh = ()=>location.hostname.toLowerCase().replace(/^www\./,"")==="speedrun.com";
  const parseSrRunPath=(pathname)=>{
    const seg=String(pathname||"/").split("/").filter(Boolean);
    if(!seg.length) return null;
    const hasLocale=/^[a-z]{2}(?:-[a-z]{2})?$/i.test(seg[0]||"");
    const start=hasLocale?1:0;
    const i=seg.findIndex((x,idx)=>idx>=start&&String(x).toLowerCase()==="runs");
    if(i<=start||i>=seg.length-1) return null;
    const game=seg[i-1],run=seg[i+1],extra=seg.slice(i+2);
    if(!game||!run||extra.length>0) return null;
    return {game,run};
  };
  const isSrRunPage = ()=>srh()&&!!parseSrRunPath(location.pathname);
  const srRunInfo=(urlString=location.href)=>{
    try{
      const u=new URL(urlString,location.href);
      const h=u.hostname.toLowerCase().replace(/^www\./,"");
      if(h!=="speedrun.com") return null;
      const p=parseSrRunPath(u.pathname);
      if(p?.game&&p?.run) return {game:p.game,run:p.run,key:`speedrun:${p.game}:${p.run}`};
    }catch{}
    return null;
  };
  const autoFps = (r)=>{r=sf(r); if(r<45) return 30; return yf()&&(Math.abs(r-59.94)<=Math.abs(r-60))?59.94:60;};
  const fpsShort = (v)=>{ const x=Number(v); if(!Number.isFinite(x)) return "30"; if(Math.abs(x-59.94)<0.2) return "59"; return String(Math.round(x)); };
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
  const lstat = ()=>{const v=ensureV(); if(v&&Number.isFinite(v.webkitDecodedFrameCount)){const n=performance.now(),f=v.webkitDecodedFrameCount; if(Number.isFinite(s.decF)&&Number.isFinite(s.decT)&&n>s.decT){const df=f-s.decF,dt=(n-s.decT)/1000; if(df>0&&dt>0)pushFps(df/dt);} s.decF=f;s.decT=n;} const sn=v?snap(v):null; return {hasVideo:!!v, score:v?vScore(v):-1e18, paused:v?v.paused:true, playbackRate:v?v.playbackRate:s.rate, fps:sf(s.fps), rawFps:sf(s.rawFps), autoFps:autoFps(s.rawFps), host:location.hostname, url:location.href, sampleCount:s.fpsSamples.length,currentFrame:Number.isFinite(sn?.frame)?sn.frame:null,currentMs:Number.isFinite(sn?.snappedMs)?sn.snappedMs:null};};
  const seek = (v,t)=>new Promise((r)=>{let d=false;const fin=()=>{if(d)return;d=true;v.removeEventListener("seeked",on);r();},on=()=>setTimeout(fin,0);v.addEventListener("seeked",on,{once:true});v.currentTime=t;setTimeout(fin,350);});
  async function lStep(dir){ const v=ensureV(); if(!v||s.stepBusy)return {ok:false}; s.stepBusy=true; try{const f=sf(s.fps),sn=await snapAcc(v); if(!sn)return {ok:false}; const cur=sn.frame,dur=Number.isFinite(v.duration)&&v.duration>0?v.duration:null; v.pause(); let tf=cur+dir; if(dur!==null)tf=clamp(tf,0,Math.max(0,Math.floor(dur*f))); else tf=Math.max(0,tf); await seek(v,tf/f); let a=0; while(a<4){const m=snap(v); if(!m)break; const bad=dir>0?m.frame<=cur:m.frame>=cur; if(!bad)break; tf+=dir; if(dur!==null)tf=clamp(tf,0,Math.max(0,Math.floor(dur*f))); else tf=Math.max(0,tf); await seek(v,tf/f); a++; } return {ok:true}; } finally{ s.stepBusy=false; } }
  async function lPlay(user=false){ const v=ensureV(); if(!v)return {ok:false}; if(v.paused){ if(user)s.lockPlay=false; await v.play().catch(()=>{});} else v.pause(); return {ok:true}; }
  async function lPlayOnly(){ const v=ensureV(); if(!v)return {ok:false}; s.lockPlay=false; await v.play().catch(()=>{}); return {ok:true}; }
  async function lPauseOnly(){ const v=ensureV(); if(!v)return {ok:false}; v.pause(); return {ok:true}; }
  async function lSeek(frame){ const v=ensureV(); if(!v)return {ok:false}; const f=sf(s.fps); let tf=Math.max(0,Math.trunc(frame)); if(Number.isFinite(v.duration)&&v.duration>0)tf=clamp(tf,0,Math.max(0,Math.floor(v.duration*f))); v.pause(); await seek(v,tf/f); return {ok:true}; }
  function lRate(r){ s.rate=r; const v=ensureV(); if(v)v.playbackRate=r; return {ok:true}; }
  function lMode(m){ if(!MODES.includes(m))return {ok:false}; s.mode=m; refps(); return {ok:true}; }
  async function runLocal(cmd,p={}){ switch(cmd){ case "GET_STATUS": return {ok:true,status:lstat()}; case "GET_PERSIST_KEY": return {ok:true,key:normKey(location.href)}; case "STEP_FRAME": return await lStep(p.direction||1); case "TOGGLE_PLAY_PAUSE": return await lPlay(!!p.userInitiated); case "PLAY": return await lPlayOnly(); case "PAUSE": return await lPauseOnly(); case "SEEK_TO_FRAME": return await lSeek(p.frame); case "SET_PLAYBACK_RATE": return lRate(Number(p.rate)); case "SET_FPS_MODE": return lMode(String(p.mode||"auto")); case "CAPTURE_SNAPSHOT_ACCURATE": { const x=await snapAcc(ensureV()); return {ok:!!x,snapshot:x}; } case "ENABLE_PAUSE_LOCK": s.lockPlay=true; return {ok:true}; default:return {ok:false}; } }

  async function reg(){ try{const r=await chrome.runtime.sendMessage({type:"SNR_FRAME_REGISTER"}); if(r?.ok&&Number.isInteger(r.frameId))s.selfId=r.frameId;}catch{} }
  async function qstat(){ try{const r=await chrome.runtime.sendMessage({type:"SNR_QUERY_FRAMES_STATUS"}); return r?.ok&&Array.isArray(r.frames)?r.frames:[];}catch{return [];} }
  async function getLabelMode(){ try{const r=await chrome.runtime.sendMessage({type:"SNR_GET_LABEL_MODE"}); if(r?.ok&&typeof r.mode==="string")s.timeLabel=r.mode==="LRT"?"LRT":"IGT";}catch{} }
  async function getSpecialLayout(){ try{const r=await chrome.runtime.sendMessage({type:"SNR_GET_SPECIAL_LAYOUT"}); if(r?.ok)s.specialLayout=!!r.enabled;}catch{} }
  async function fcmd(id,cmd,p={}){ if(id===s.selfId)return await runLocal(cmd,p); try{return await chrome.runtime.sendMessage({type:"SNR_RUN_FRAME_COMMAND",frameId:id,command:cmd,payload:p})||{ok:false};}catch{return {ok:false};} }
  async function ctlCmd(cmd,p={}){ let id=Number.isInteger(s.ctlId)?s.ctlId:s.selfId; let r=await fcmd(id,cmd,p); if(r?.ok)return r; await refreshCtl(); id=Number.isInteger(s.ctlId)?s.ctlId:s.selfId; r=await fcmd(id,cmd,p); if(r?.ok)return r; return await fcmd(s.selfId,cmd,p); }
  async function getPersistKey(){ const sr=srRunInfo(location.href); if(sr?.key) return sr.key; const r=await ctlCmd("GET_PERSIST_KEY"); if(r?.ok&&r.key)return r.key; return normKey(location.href); }
  function buildPersistState(){
    const base={version:2,timeLabel:tLabel(),mode:s.mode,rawFps:sf(s.rawFps),startMs:s.startMs,startF:s.startF,endMs:s.endMs,endF:s.endF,pauseMs:s.pauseMs,pauseF:s.pauseF,segs:s.segs,nextSeg:s.nextSeg};
    const srPanels={};
    for(const [k,p] of s.sr.states){
      if(!p)continue;
      if(!Number.isFinite(p.startMs)&&!Number.isFinite(p.endMs)&&!(Array.isArray(p.segs)&&p.segs.length)&&!Number.isFinite(p.pauseMs))continue;
      srPanels[k]={mode:MODES.includes(p.mode)?p.mode:"auto",rate:Number.isFinite(p.rate)?p.rate:1,startMs:p.startMs,startF:p.startF,endMs:p.endMs,endF:p.endF,pauseMs:p.pauseMs,pauseF:p.pauseF,segs:Array.isArray(p.segs)?p.segs:[],nextSeg:Number.isFinite(p.nextSeg)?p.nextSeg:1};
    }
    if(Object.keys(srPanels).length>0) base.srPanels=srPanels;
    return base;
  }
  function applyPersistState(d){
    if(!d||typeof d!=="object")return false;
    s.timeLabel=d.timeLabel==="LRT"?"LRT":"IGT";
    s.mode=MODES.includes(d.mode)?d.mode:"auto";
    s.rawFps=sf(d.rawFps);
    refps();
    s.startMs=Number.isFinite(d.startMs)?d.startMs:null;
    s.startF=Number.isFinite(d.startF)?Math.trunc(d.startF):null;
    s.endMs=Number.isFinite(d.endMs)?d.endMs:null;
    s.endF=Number.isFinite(d.endF)?Math.trunc(d.endF):null;
    s.pauseMs=Number.isFinite(d.pauseMs)?d.pauseMs:null;
    s.pauseF=Number.isFinite(d.pauseF)?Math.trunc(d.pauseF):null;
    s.segs=Array.isArray(d.segs)?d.segs.map(z=>({id:Number.isFinite(z.id)?z.id:s.nextSeg++,startMs:Math.min(z.startMs,z.endMs),endMs:Math.max(z.startMs,z.endMs),startF:Number.isFinite(z.startF)?Math.trunc(z.startF):null,endF:Number.isFinite(z.endF)?Math.trunc(z.endF):null,durationMs:Number.isFinite(z.durationMs)?z.durationMs:0,enabled:z.enabled!==false})):[];    
    s.nextSeg=Number.isFinite(d.nextSeg)?Math.max(1,Math.trunc(d.nextSeg)):Math.max(1,s.segs.length+1);
    s.srSaved=(d.srPanels&&typeof d.srPanels==="object")?d.srPanels:{};
    s.sr.states.clear();
    return true;
  }
  async function loadSavedForCurrent(){ if(!s.top||s.skipSaved)return; const key=await getPersistKey(); if(!key)return; try{const r=await chrome.runtime.sendMessage({type:"SNR_GET_SAVED_RETIME",key}); if(r?.ok&&r.state&&applyPersistState(r.state)){ await ctlCmd("SET_FPS_MODE",{mode:s.mode}); render(); }}catch{} }
  function bestFrame(fr){ let b=null,bs=-1e18,bc=-1; for(const i of fr){ if(!i?.status?.hasVideo)continue; const sc=Number(i.status.score),c=Number(i.status.sampleCount||0); if(sc>bs||(sc===bs&&c>bc)){bs=sc;bc=c;b=i;}} return b; }
  function guard(k,fn,m=100){ const n=performance.now(),l=s.guard[k]||0; if(n-l<m)return; s.guard[k]=n; fn(); }

  chrome.runtime.onMessage.addListener((msg,_se,send)=>{
    (async()=>{
      if(!msg?.type){send({ok:false});return;}
      const rawType=String(msg.type||"");
      const type=rawType.startsWith("ATS_")?`SNR_${rawType.slice(4)}`:rawType;
      if(type==="SNR_FRAME_GET_STATUS"){send({ok:true,status:lstat()});return;}
      if(type==="SNR_FRAME_COMMAND"){send(await runLocal(msg.command,msg.payload||{}));return;}
      if(type==="SNR_SET_LABEL_MODE"){
        s.timeLabel=msg.mode==="LRT"?"LRT":"IGT";
        save();
        if(s.top)render();
        send({ok:true});
        return;
      }
      if(type==="SNR_SET_SPECIAL_LAYOUT"){
        s.specialLayout=!!msg.enabled;
        if(!s.specialLayout) srClear();
        save();
        if(s.top)render();
        send({ok:true});
        return;
      }
      if(type==="SNR_COLLECT_STATE_FOR_SAVE"){
        if(!s.top){send({ok:false,error:"not_top"});return;}
        const key=await getPersistKey();
        send({ok:true,key,state:buildPersistState(),title:document.title||""});
        return;
      }
      send({ok:false});
    })().catch(e=>send({ok:false,error:String(e)}));
    return true;
  });
  document.addEventListener("play",(e)=>{ if(!(e.target instanceof HTMLVideoElement))return; if(s.video!==e.target)setVideo(e.target); if(s.lockPlay){ if(e.isTrusted)s.lockPlay=false; else e.target.pause(); } },true);
  document.addEventListener("ratechange",(e)=>{ if(!(e.target instanceof HTMLVideoElement))return; if(s.video!==e.target)setVideo(e.target); s.rate=e.target.playbackRate; },true);

  const gKey = ()=>`k:${normKey(location.href)}`;
  const save = ()=>{
    if(!s.top) return;
    try{
      const srPacked={};
      for(const [k,p] of s.sr.states){
        srPacked[k]={mode:p.mode,rate:p.rate,startMs:p.startMs,startF:p.startF,endMs:p.endMs,endF:p.endF,pauseMs:p.pauseMs,pauseF:p.pauseF,segs:p.segs,nextSeg:p.nextSeg};
      }
      sessionStorage.setItem("SNR_state",JSON.stringify({
        key:gKey(),rate:s.rate,mode:s.mode,rawFps:s.rawFps,timeLabel:tLabel(),specialLayout:!!s.specialLayout,
        startMs:s.startMs,startF:s.startF,endMs:s.endMs,endF:s.endF,pauseMs:s.pauseMs,pauseF:s.pauseF,segs:s.segs,nextSeg:s.nextSeg,
        srSaved:srPacked
      }));
    }catch{}
  };
  const load = ()=>{
    if(!s.top)return;
    try{
      const x=sessionStorage.getItem("SNR_state");
      if(!x)return;
      const d=JSON.parse(x);
      if(!d||d.key!==gKey())return;
      s.rate=Number.isFinite(d.rate)?d.rate:1;
      s.mode=MODES.includes(d.mode)?d.mode:"auto";
      s.rawFps=sf(d.rawFps);
      s.timeLabel=d.timeLabel==="LRT"?"LRT":"IGT";
      s.specialLayout=typeof d.specialLayout==="boolean"?d.specialLayout:s.specialLayout;
      refps();
      s.startMs=Number.isFinite(d.startMs)?d.startMs:null;
      s.startF=Number.isFinite(d.startF)?Math.trunc(d.startF):null;
      s.endMs=Number.isFinite(d.endMs)?d.endMs:null;
      s.endF=Number.isFinite(d.endF)?Math.trunc(d.endF):null;
      s.pauseMs=Number.isFinite(d.pauseMs)?d.pauseMs:null;
      s.pauseF=Number.isFinite(d.pauseF)?Math.trunc(d.pauseF):null;
      s.segs=Array.isArray(d.segs)?d.segs.map(z=>({id:Number.isFinite(z.id)?z.id:s.nextSeg++,startMs:Math.min(z.startMs,z.endMs),endMs:Math.max(z.startMs,z.endMs),startF:Number.isFinite(z.startF)?Math.trunc(z.startF):null,endF:Number.isFinite(z.endF)?Math.trunc(z.endF):null,durationMs:Number.isFinite(z.durationMs)?z.durationMs:0,enabled:z.enabled!==false})):[];
      if(Number.isFinite(d.nextSeg))s.nextSeg=Math.max(1,Math.trunc(d.nextSeg));
      s.srSaved=(d.srSaved&&typeof d.srSaved==="object")?d.srSaved:{};
    }catch{}
  };
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
      ytEmbedCleanup();
      setNativeMs(".ytp-time-current",".ytp-time-duration");
      return;
    }
    if(tf()){
      const cur='[data-a-target="player-seekbar-current-time"],[data-a-target="player-current-time"],.player-seekbar__time-elapsed,.video-player__time-elapsed,[data-test-selector="seekbar-current-time"]';
      const dur='[data-a-target="player-seekbar-duration"],[data-a-target="player-duration"],.player-seekbar__time-duration,.video-player__time-duration,[data-test-selector="seekbar-duration"]';
      setNativeMs(cur,dur);
    }
  };
  const ytEmbedCleanup=()=>{
    if(!yf()||s.top) return;
    if(document.getElementById("ats-yt-embed-clean")) return;
    const st=document.createElement("style");
    st.id="ats-yt-embed-clean";
    st.textContent=`
      .ytp-pause-overlay,
      .ytp-ce-element,
      .ytp-cards-teaser,
      .ytp-endscreen-content,
      .ytp-videowall-still{display:none !important}
    `;
    (document.head||document.documentElement).appendChild(st);
  };
  const normKey=(u)=>{ try{const x=new URL(u,location.href),h=x.hostname.toLowerCase().replace(/^www\./,""),p=x.pathname||"/",q=x.searchParams; if(h==="youtu.be"){const id=p.split("/").filter(Boolean)[0]; if(id)return `youtube:${id}`;} if(h.includes("youtube.com")){const v=q.get("v"); if(v)return `youtube:${v}`; const e=p.match(/\/embed\/([^/?#]+)/i); if(e)return `youtube:${e[1]}`; const s2=p.match(/\/shorts\/([^/?#]+)/i); if(s2)return `youtube:${s2[1]}`;} if(h.includes("twitch.tv")){const m=p.match(/\/videos\/(\d+)/i); if(m)return `twitch:${m[1]}`; const qv=q.get("video")||q.get("v"); if(qv){const n=String(qv).replace(/^v/i,""); if(/^\d+$/.test(n))return `twitch:${n}`;}} if(h==="speedrun.com"){const r=parseSrRunPath(p); if(r?.game&&r?.run)return `speedrun:${r.game}:${r.run}`;} return `url:${h}${p}`;}catch{return `url:${location.hostname}${location.pathname}`;} };
  const srMode = ()=>s.top&&s.enabled&&s.specialLayout&&isSrRunPage();
  const f2msAt=(frames,fps)=>rvm(Math.max(0,Math.trunc((Math.max(0,Math.trunc(frames))/sf(fps))*1000)),sf(fps));
  const safeSend=(msg)=>{
    try{
      if(!chrome?.runtime?.id) return Promise.resolve({ok:false});
      const p=chrome.runtime.sendMessage(msg);
      if(p&&typeof p.then==="function") return p.catch(()=>({ok:false}));
      return Promise.resolve({ok:false});
    }catch{
      return Promise.resolve({ok:false});
    }
  };
  const srEnsureStyle=()=>{
    if(s.sr.style)return;
    if(document.getElementById("ats-sr-style")){s.sr.style=true;return;}
    const st=document.createElement("style");
    st.id="ats-sr-style";
    st.textContent=`
      .ats-sr-panel{margin:0 0 14px 0;position:relative;z-index:5;pointer-events:auto}
      .ats-sr-head svg{width:16px;height:16px;fill:currentColor;opacity:.96}
      .ats-sr-head{display:flex;align-items:center;gap:8px}
      .ats-sr-head-left{display:flex;align-items:center;gap:8px;min-width:0}
      .ats-sr-head-title{color:var(--ats-title,#fff)}
      .ats-sr-head-stats{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:14px;font-size:12px;white-space:nowrap;color:#fff !important;margin-left:auto}
      .ats-sr-head-stats *{color:#fff !important}
      .ats-sr-body{margin-top:8px;display:flex;flex-direction:column;gap:8px;padding:0}
      .ats-sr-top{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;align-items:center;gap:10px;min-height:30px}
      .ats-sr-btns{display:flex;flex-wrap:nowrap;gap:6px;align-items:center}
      .ats-sr-right{display:flex;align-items:center;gap:6px;justify-self:end}
      .ats-sr-mid{display:flex;align-items:center;justify-content:center}
      .ats-sr-btn,.ats-sr-fps,.ats-sr-speed{height:30px;min-height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--ats-outline,rgba(180,190,200,.4))!important;background:transparent !important;background-color:transparent !important;color:var(--ats-muted,#b6bec8)!important;font-size:12px;line-height:28px;box-shadow:none !important;appearance:none}
      .ats-sr-fps,.ats-sr-speed{padding-right:18px;color-scheme:dark;min-width:0 !important;max-width:none;flex:0 0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ats-sr-speed{width:70px}
      .ats-sr-fps{width:124px}
      .ats-sr-btn{cursor:pointer}
      .ats-sr-btn:hover:enabled,.ats-sr-fps:hover:enabled,.ats-sr-speed:hover:enabled{background:rgba(255,255,255,.025)!important}
      .ats-sr-btn:disabled,.ats-sr-fps:disabled,.ats-sr-speed:disabled{opacity:.55;cursor:default}
      .ats-sr-btn:focus-visible,.ats-sr-fps:focus-visible,.ats-sr-speed:focus-visible{outline:1px solid rgba(255,255,255,.24);outline-offset:1px}
      .ats-sr-fps option,.ats-sr-speed option{background:#111a24;color:var(--ats-muted,#b6bec8)}
      .ats-sr-icon{min-width:30px;width:30px;padding:0;text-align:center;font-size:13px}
      .ats-sr-item{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff !important;min-width:max-content}
      .ats-sr-editor{margin-top:10px;position:relative;z-index:4}
      .ats-sr-ed-head{}
      .ats-sr-ed-title{margin:0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ats-sr-ed-reset{height:22px;padding:0 8px;border-radius:6px;border:1px solid rgba(200,92,92,.65)!important;background:rgba(130,28,28,.22)!important;color:#ffd9d9 !important;font-size:10px;line-height:20px;font-weight:700;letter-spacing:.02em;text-transform:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
      .ats-sr-ed-reset:hover{background:rgba(150,34,34,.30)!important}
      .ats-sr-ed-list{display:grid;gap:7px;padding:8px 2px 2px}
      .ats-sr-ed-item{border:1px solid var(--ats-outline,rgba(180,190,200,.35));border-radius:6px;padding:7px 8px;background:rgba(0,0,0,.14)}
      .ats-sr-ed-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#fff}
      .ats-sr-ed-frames{font-size:12px}
      .ats-sr-ed-time{font-size:12px;font-weight:700}
      .ats-sr-ed-actions{display:flex;gap:6px;margin-top:6px}
      .ats-sr-ed-btn{height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--ats-outline,rgba(180,190,200,.35));background:transparent;color:var(--ats-muted,#b6bec8);font-size:11px;cursor:pointer}
      .ats-sr-ed-btn:hover{background:rgba(255,255,255,.03)}
      .ats-sr-ed-empty{font-size:12px;color:var(--ats-muted,#b6bec8);padding:8px 2px;text-align:center}
      @media (max-width:980px){.ats-sr-head-stats{justify-content:flex-start}.ats-sr-head{flex-direction:column;align-items:flex-start}.ats-sr-top{display:flex;flex-wrap:wrap;justify-content:flex-start}.ats-sr-btns{flex-wrap:wrap}}
    `;
    document.documentElement.appendChild(st);
    s.sr.style=true;
  };
  const srThemeRef=(anchor)=>{
    const pool=[...document.querySelectorAll("div")].filter((el)=>el instanceof HTMLElement&&!el.classList.contains("ats-sr-panel"));
    const ar=anchor.getBoundingClientRect();
    const scored=[];
    for(const el of pool){
      const rect=el.getBoundingClientRect();
      if(rect.width<300||rect.height<36||rect.height>3200) continue;
      const cls=String(el.className||"");
      if(!cls.includes("bg-black/20")||!cls.includes("rounded")||!cls.includes("text-sm")) continue;
      const head=el.firstElementChild;
      const body=el.children?.[1];
      if(!(head instanceof HTMLElement)||!(body instanceof HTMLElement)) continue;
      if(head.children.length<2) continue;
      const iconWrap=head.children[0];
      const title=head.children[1];
      if(!(iconWrap instanceof HTMLElement)||!(title instanceof HTMLElement)) continue;
      if(!title.classList.contains("font-bold")) continue;
      const icon=iconWrap.querySelector("svg");
      if(!(icon instanceof SVGElement)) continue;
      const txt=(title.textContent||"").trim().toLowerCase();
      if(txt!=="description") continue;
      const sameColumn=Math.abs(rect.left-ar.left)<=Math.max(64,ar.width*0.12);
      if(!sameColumn) continue;
      const dy=Math.abs(rect.top-ar.bottom);
      const dx=Math.abs(rect.left-ar.left);
      scored.push({el,score:dy*2+dx});
    }
    scored.sort((a,b)=>a.score-b.score);
    if(scored[0]?.el) return scored[0].el;
    return null;
  };
  const srDetectTheme=(anchor)=>{
    const cardRef=srThemeRef(anchor);
    const rootClass=cardRef?.className||"flex w-full flex-col gap-1 rounded p-2 text-sm bg-black/20";
    const headRef=cardRef?.firstElementChild;
    const bodyRef=cardRef?.children?.[1];
    const iconRef=headRef?.children?.[0];
    const titleRef=headRef?.children?.[1];
    const titleColor=titleRef instanceof HTMLElement?getComputedStyle(titleRef).color:"#ffffff";
    const bodyColor=bodyRef instanceof HTMLElement?getComputedStyle(bodyRef).color:"#b6bec8";
    return {
      ref:cardRef,
      rootClass,
      headClass:headRef?.className||"flex flex-row items-center justify-start gap-2",
      iconClass:iconRef?.className||"flex-none",
      titleClass:titleRef?.className||"flex-auto truncate font-bold",
      bodyClass:bodyRef?.className||"text-secondary space-y-1",
      titleColor,
      bodyColor
    };
  };
  const srCandidateIframes=()=>{
    const isVideo=(src)=>{
      try{
        const u=new URL(src,location.href),h=u.hostname.toLowerCase();
        return h.includes("youtube.com")||h.includes("youtu.be")||h.includes("twitch.tv");
      }catch{return false;}
    };
    return [...document.querySelectorAll("iframe[src]")]
      .filter((i)=>{
        if(!(i instanceof HTMLIFrameElement)) return false;
        if(!isVideo(i.src)) return false;
        if(!vis(i)) return false;
        const r=i.getBoundingClientRect();
        return r.width>=240&&r.height>=130;
      })
      .sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
  };
  const srMapTargets=()=>{
    const findRunCardAnchor=(iframe)=>{
      let cur=iframe instanceof HTMLElement?iframe:null;
      let best=null,bestScore=1e18;
      const ir=iframe.getBoundingClientRect();
      const chain=[];
      while(cur&&cur!==document.body){
        chain.push(cur);
        cur=cur.parentElement;
      }
      for(const el of chain){
        const r=el.getBoundingClientRect();
        const cls=String(el.className||"");
        const hasPanelClass=cls.includes("bg-black/20")&&cls.includes("rounded");
        if(!hasPanelClass) continue;
        if(!el.contains(iframe)) continue;
        if(r.width<260||r.width>1600||r.height<120||r.height>Math.max(ir.height+460,960)) continue;
        if(r.bottom>ir.bottom+240) continue;
        if(r.top>ir.top+40) continue;
        const nearWidth=Math.abs(r.width-ir.width)<=Math.max(160,ir.width*0.24);
        const nearLeft=Math.abs(r.left-ir.left)<=70;
        if(!nearWidth||!nearLeft) continue;
        const hPenalty=Math.abs(r.height-(ir.height+96));
        const tPenalty=Math.abs(r.top-ir.top);
        const score=hPenalty+tPenalty*0.85;
        if(score<bestScore){bestScore=score;best=el;}
      }
      cur=iframe instanceof HTMLElement?iframe:null;
      while(!best&&cur&&cur!==document.body){
        const r=cur.getBoundingClientRect();
        const cls=String(cur.className||"");
        const hasPanelClass=cls.includes("bg-black/20")&&cls.includes("rounded");
        const sizeOk=r.width>=260&&r.height>=120&&r.width<=1600&&r.height<=Math.max(ir.height+420,920);
        const rightSide=r.left<window.innerWidth*0.65;
        if(hasPanelClass&&sizeOk&&rightSide&&r.bottom<=ir.bottom+240&&r.top<=ir.top+40){
          const nearWidth=Math.abs(r.width-ir.width)<=Math.max(120,ir.width*0.18);
          const nearLeft=Math.abs(r.left-ir.left)<=58;
          if(!nearWidth||!nearLeft){ cur=cur.parentElement; continue; }
          const dw=Math.abs(r.width-ir.width);
          const dt=Math.abs(r.top-ir.top);
          const dh=Math.abs(r.height-(ir.height+96));
          const score=dw+dt*0.9+dh*0.85;
          if(score<bestScore){bestScore=score;best=cur;}
        }
        cur=cur.parentElement;
      }
      if(best instanceof HTMLElement) return best;
      return (iframe.parentElement&&iframe.parentElement!==document.body)?iframe.parentElement:iframe;
    };
    const iframes=srCandidateIframes();
    const pool=(s.frames||[]).filter((x)=>x?.status?.hasVideo);
    const unused=[...pool];
    const out=[];
    for(let i=0;i<iframes.length;i++){
      const iframe=iframes[i],k=normKey(iframe.src||""),host=(()=>{try{return new URL(iframe.src,location.href).hostname.toLowerCase().replace(/^www\./,"");}catch{return "";}})();
      let pickIndex=unused.findIndex((x)=>normKey(x.status?.url||"")===k);
      if(pickIndex<0)pickIndex=unused.findIndex((x)=>String(x.status?.host||"").toLowerCase().replace(/^www\./,"")===host);
      if(pickIndex<0&&unused.length>0) pickIndex=0;
      const pick=pickIndex>=0?unused.splice(pickIndex,1)[0]:null;
      const anchor=findRunCardAnchor(iframe);
      const stableKey=`embed:${i+1}`;
      out.push({key:stableKey,frameId:pick?.frameId??null,anchor});
    }
    return out;
  };
  const srPanelState=(key,frameId)=>{
    let p=s.sr.states.get(key);
    if(!p){
      p={key,frameId,anchorEl:null,mode:"auto",rate:1,startMs:null,startF:null,endMs:null,endF:null,pauseMs:null,pauseF:null,segs:[],nextSeg:1,guard:{},saveUntil:0,saveOk:false};
      const sv=s.srSaved?.[key];
      if(sv&&typeof sv==="object"){
        p.mode=MODES.includes(sv.mode)?sv.mode:"auto";
        p.rate=Number.isFinite(sv.rate)?Math.max(0.25,sv.rate):1;
        p.startMs=Number.isFinite(sv.startMs)?sv.startMs:null;
        p.startF=Number.isFinite(sv.startF)?Math.trunc(sv.startF):null;
        p.endMs=Number.isFinite(sv.endMs)?sv.endMs:null;
        p.endF=Number.isFinite(sv.endF)?Math.trunc(sv.endF):null;
        p.pauseMs=Number.isFinite(sv.pauseMs)?sv.pauseMs:null;
        p.pauseF=Number.isFinite(sv.pauseF)?Math.trunc(sv.pauseF):null;
        p.segs=Array.isArray(sv.segs)?sv.segs:[];
        p.nextSeg=Number.isFinite(sv.nextSeg)?Math.max(1,Math.trunc(sv.nextSeg)):Math.max(1,p.segs.length+1);
      }
      s.sr.states.set(key,p);
    } else {
      p.frameId=frameId;
    }
    return p;
  };
  const srFps=(p,st)=>p.mode==="auto"?autoFps(st?.rawFps):sf(parseFloat(p.mode));
  const nearSpeed=(r)=>{const x=Number.isFinite(r)?r:1; let b=SPEEDS[0],d=Math.abs(x-b); for(const v of SPEEDS){const m=Math.abs(x-v); if(m<d){d=m;b=v;}} return b;};
  const srAutoLabel=()=>{
    const txt=(document.body?.innerText||"").slice(0,120000);
    if(/Load Removed Time|\\bLRT\\b/i.test(txt)) return "LRT";
    if(/In-Game Time|\\bIGT\\b/i.test(txt)) return "IGT";
    return null;
  };
  const srTimes=(p,st)=>{
    const fps=srFps(p,st);
    if(!Number.isFinite(p.startF)||!Number.isFinite(p.endF))return null;
    const fd=p.endF-p.startF,sg=fd>=0?1:-1,rta=sg*f2msAt(Math.abs(fd),fps),removed=p.segs.reduce((t,g)=>g.enabled!==false?t+Math.max(0,Number(g.durationMs)||0):t,0),lrt=rta-sg*removed;
    return {rta,lrt};
  };
  const srDur=(ms)=>{
    let x=Math.max(0,Math.round(Number(ms)||0));
    const h=Math.floor(x/3600000); x-=h*3600000;
    const m=Math.floor(x/60000); x-=m*60000;
    const s2=Math.floor(x/1000); const z=x-s2*1000;
    if(h>0) return `${h}:${String(m).padStart(2,"0")}:${String(s2).padStart(2,"0")}.${String(z).padStart(3,"0")}`;
    if(m>0) return `${m}:${String(s2).padStart(2,"0")}.${String(z).padStart(3,"0")}`;
    return `${s2}.${String(z).padStart(3,"0")}`;
  };
  const srStatus=(frameId)=>s.frames.find((x)=>x.frameId===frameId)?.status||null;
  const srAnyFrameId=()=>{
    const b=bestFrame(s.frames||[]);
    if(b&&Number.isInteger(b.frameId)) return b.frameId;
    if(Number.isInteger(s.ctlId)) return s.ctlId;
    if(Number.isInteger(s.selfId)) return s.selfId;
    return null;
  };
  const srResolveFrameId=(p)=>{
    if(Number.isInteger(p?.frameId)) return p.frameId;
    const id=srAnyFrameId();
    if(Number.isInteger(id)&&p) p.frameId=id;
    return Number.isInteger(id)?id:null;
  };
  const srEffectiveStatus=(p)=>{
    const id=srResolveFrameId(p);
    const st=srStatus(id);
    if(st?.hasVideo) return {frameId:id,status:st};
    const b=bestFrame(s.frames||[]);
    if(b?.status?.hasVideo){
      if(p&&Number.isInteger(b.frameId)) p.frameId=b.frameId;
      return {frameId:b.frameId,status:b.status};
    }
    if(s.ctl?.hasVideo){
      if(p&&Number.isInteger(s.ctlId)) p.frameId=s.ctlId;
      return {frameId:s.ctlId,status:s.ctl};
    }
    return {frameId:id,status:st||null};
  };
  const srSnapFromStatus=(p)=>{
    const eff=srEffectiveStatus(p);
    const st=eff?.status;
    if(Number.isFinite(st?.currentFrame)&&Number.isFinite(st?.currentMs)){
      return {frame:Math.trunc(st.currentFrame),snappedMs:st.currentMs,rawMs:st.currentMs};
    }
    return null;
  };
  const srGuard=(p,k,fn,m=100)=>{const n=performance.now(),l=p.guard[k]||0;if(n-l<m)return;p.guard[k]=n;fn();};
  const srCap=async(p)=>{
    const id=srResolveFrameId(p);
    if(!Number.isInteger(id))return null;
    const r=await fcmd(id,"CAPTURE_SNAPSHOT_ACCURATE");
    if(r?.ok&&r.snapshot&&Number.isFinite(r.snapshot.frame)&&Number.isFinite(r.snapshot.snappedMs)) return r.snapshot;
    const stRes=await fcmd(id,"GET_STATUS");
    const st=stRes?.ok?stRes.status:null;
    if(Number.isFinite(st?.currentFrame)&&Number.isFinite(st?.currentMs)){
      return {frame:Math.trunc(st.currentFrame),snappedMs:st.currentMs,rawMs:st.currentMs};
    }
    return null;
  };
  const srStep=async(p,dir)=>{ const id=srResolveFrameId(p); if(!Number.isInteger(id))return; await fcmd(id,"STEP_FRAME",{direction:dir}); await refreshCtl(); render(); };
  const srPlay=async(p)=>{ const id=srResolveFrameId(p); if(!Number.isInteger(id))return; await fcmd(id,"TOGGLE_PLAY_PAUSE",{userInitiated:true}); await refreshCtl(); render(); };
  const srRateSet=async(p,r)=>{ const v=nearSpeed(r); p.rate=v; const id=srResolveFrameId(p); if(Number.isInteger(id)) await fcmd(id,"SET_PLAYBACK_RATE",{rate:v}); save(); await refreshCtl(); render(); };
  const srSaveRun=async(p)=>{
    save();
    let r={ok:false};
    if(s.top){
      const key=await getPersistKey();
      if(key){
        r=await safeSend({type:"SNR_SAVE_RETIME_STATE",key,state:buildPersistState(),title:document.title||""});
      }
    } else {
      r=await safeSend({type:"SNR_SAVE_CURRENT_RETIME"});
    }
    if(!r?.ok){
      r=await safeSend({type:"SNR_SAVE_CURRENT_RETIME"});
    }
    p.saveUntil=performance.now()+1700; p.saveOk=!!r?.ok; render();
  };
  const srStart=async(p)=>{
    if(p.startMs!==null){
      p.startMs=null; p.startF=null; save(); render(); return;
    }
    const x=(await srCap(p))||srSnapFromStatus(p);
    if(!x)return;
    p.startMs=x.snappedMs; p.startF=x.frame; save(); render();
  };
  const srEnd=async(p)=>{
    if(p.endMs!==null){
      p.endMs=null; p.endF=null; save(); render(); return;
    }
    const x=(await srCap(p))||srSnapFromStatus(p);
    if(!x)return;
    p.endMs=x.snappedMs; p.endF=x.frame; save(); render();
  };
  const srPause=async(p)=>{
    const x=(await srCap(p))||srSnapFromStatus(p); if(!x)return;
    if(p.pauseMs===null){p.pauseMs=x.snappedMs;p.pauseF=x.frame;save();render();return;}
    const st=srStatus(p.frameId),fps=srFps(p,st),a=Math.min(p.pauseMs,x.snappedMs),b=Math.max(p.pauseMs,x.snappedMs),af=Number.isFinite(p.pauseF)?Math.min(p.pauseF,x.frame):null,bf=Number.isFinite(p.pauseF)?Math.max(p.pauseF,x.frame):null;
    let d=Math.max(0,b-a); if(Number.isFinite(af)&&Number.isFinite(bf))d=f2msAt(Math.abs(bf-af),fps);
    if(d>0)p.segs.push({id:p.nextSeg++,startMs:a,endMs:b,startF:af,endF:bf,durationMs:d,enabled:true});
    p.pauseMs=null;p.pauseF=null; save(); render();
  };
  const srCreatePanel=(key)=>{
    const el=document.createElement("div");
    el.className="ats-sr-panel";
    el.dataset.key=key;
    el.innerHTML=`<div class="ats-sr-head"><div class="ats-sr-head-left"><div class="ats-sr-head-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v2h-1v2.2A8 8 0 1 1 5 14a8 8 0 0 1 5-7.8V4h-1V2Zm2 6a1 1 0 0 0-1 1v4.4l3.2 1.9a1 1 0 1 0 1-1.8L13 12.2V9a1 1 0 0 0-1-1Z"/></svg></div><div class="ats-sr-head-title">Retime</div></div><div class="ats-sr-head-stats"><span class="ats-sr-item" data-v="start">Start:</span><span class="ats-sr-item" data-v="end">End:</span><span class="ats-sr-item" data-v="rta">RTA:</span><span class="ats-sr-item" data-v="lrt">LRT:</span></div></div>
    <div class="ats-sr-body">
    <div class="ats-sr-top"><div class="ats-sr-btns">
      <button class="ats-sr-btn ats-sr-icon" data-a="stepb10" title="Frame -10">&#171;</button>
      <button class="ats-sr-btn ats-sr-icon" data-a="stepb" title="Frame -1">&#8249;</button>
      <button class="ats-sr-btn ats-sr-icon" data-a="play" title="Play/Pause">&#9654;</button>
      <button class="ats-sr-btn ats-sr-icon" data-a="stepf" title="Frame +1">&#8250;</button>
      <button class="ats-sr-btn ats-sr-icon" data-a="stepf10" title="Frame +10">&#187;</button>
      <button class="ats-sr-btn" data-a="start">Start Run</button>
      <button class="ats-sr-btn" data-a="end">End Run</button>
      <button class="ats-sr-btn" data-a="pause">Start Load Removal</button>
    </div><div class="ats-sr-mid"><button class="ats-sr-btn" data-a="save">Save Retime</button></div><div class="ats-sr-right"><select class="ats-sr-speed" data-a="speed"></select><select class="ats-sr-fps" data-a="fps"></select></div></div></div>`;
    const speedSel=el.querySelector('select[data-a="speed"]');
    if(speedSel instanceof HTMLSelectElement){
      for(const v of SPEEDS){
        const o=document.createElement("option");
        o.value=v.toFixed(2);
        o.textContent=`${v.toFixed(2)}x`;
        speedSel.appendChild(o);
      }
    }
    const fpsSel=el.querySelector('select[data-a="fps"]');
    if(fpsSel instanceof HTMLSelectElement){
      for(const m of MODES){
        const o=document.createElement("option");
        o.value=m;
        o.textContent=m==="auto"?`FPS: ${fpsShort(DFPS)} (Auto)`:`FPS: ${fpsShort(parseFloat(m))}`;
        fpsSel.appendChild(o);
      }
    }
    return el;
  };
  const srPaint=(el,p,st,anchor)=>{
    const hv=!!st?.hasVideo,tm=srTimes(p,st),lbl=srAutoLabel()||tLabel();
    const th=srDetectTheme(anchor);
    el.className=`ats-sr-panel ${th.rootClass||""}`.trim();
    el.style.boxSizing="border-box";
    if(th.ref instanceof HTMLElement){
      const cs=getComputedStyle(th.ref);
      el.style.marginTop=cs.marginTop||"";
      el.style.marginRight=cs.marginRight||"";
      el.style.marginBottom=cs.marginBottom||"";
      el.style.marginLeft=cs.marginLeft||"";
      el.style.width="";
      el.style.maxWidth="";
    } else {
      el.style.marginTop="10px";
      el.style.marginRight="8px";
      el.style.marginBottom="12px";
      el.style.marginLeft="8px";
      el.style.width="calc(100% - 16px)";
      el.style.maxWidth="calc(100% - 16px)";
    }
    el.style.setProperty("--ats-title","#ffffff");
    el.style.setProperty("--ats-muted",th.bodyColor||"#b6bec8");
    const bc=String(th.bodyColor||"rgba(180,190,200,.8)").trim();
    const outline = bc.startsWith("rgb(")?bc.replace("rgb(","rgba(").replace(")",", 0.42)"):bc.startsWith("rgba(")?bc.replace(/,\s*[\d.]+\s*\)/,", 0.42)"):bc;
    el.style.setProperty("--ats-outline",outline);
    const q=(s)=>el.querySelector(s);
    const hd=q(".ats-sr-head"),hl=q(".ats-sr-head-left"),hi=q(".ats-sr-head-icon"),ht=q(".ats-sr-head-title"),hs=q(".ats-sr-head-stats"),bd=q(".ats-sr-body");
    if(hd) hd.className="ats-sr-head";
    if(hl) hl.className="ats-sr-head-left";
    if(hs) hs.className="ats-sr-head-stats";
    if(hi) hi.className=`ats-sr-head-icon ${th.iconClass||""}`.trim();
    if(ht) ht.className=`ats-sr-head-title ${th.titleClass||""}`.trim();
    if(bd) bd.className=`ats-sr-body ${th.bodyClass||""}`.trim();
    const bStepB10=q('button[data-a="stepb10"]'),bStepB=q('button[data-a="stepb"]'),bPlay=q('button[data-a="play"]'),bStepF=q('button[data-a="stepf"]'),bStepF10=q('button[data-a="stepf10"]'),bStart=q('button[data-a="start"]'),bEnd=q('button[data-a="end"]'),bPause=q('button[data-a="pause"]'),bSave=q('button[data-a="save"]');
    for(const b of [bStepB10,bStepB,bPlay,bStepF,bStepF10,bStart,bEnd,bPause,bSave]){ if(b instanceof HTMLButtonElement) b.disabled=!hv; }
    if(bPlay instanceof HTMLButtonElement) bPlay.textContent=st?.paused?"\u25B6":"\u275A\u275A";
    if(bStart instanceof HTMLButtonElement) bStart.textContent=p.startMs===null?"Start Run":"Undo Start";
    if(bEnd instanceof HTMLButtonElement) bEnd.textContent=p.endMs===null?"End Run":"Undo End";
    if(bPause instanceof HTMLButtonElement) bPause.textContent=p.pauseMs===null?"Start Load Removal":"End Load Removal";
    if(bSave instanceof HTMLButtonElement){ const active=performance.now()<(p.saveUntil||0); bSave.textContent=active?(p.saveOk?"Saved":"Save Failed"):"Save Retime"; }
    const sStart=q('[data-v="start"]'),sEnd=q('[data-v="end"]'),sRta=q('[data-v="rta"]'),sLrt=q('[data-v="lrt"]');
    if(sStart) sStart.textContent=Number.isFinite(p.startMs)?`Start: ${fmt(p.startMs)} (F: ${p.startF})`:"Start:";
    if(sEnd) sEnd.textContent=Number.isFinite(p.endMs)?`End: ${fmt(p.endMs)} (F: ${p.endF})`:"End:";
    if(sRta) sRta.textContent=tm?`RTA: ${fmt(tm.rta)}`:"RTA:";
    if(sLrt) sLrt.textContent=tm?`${lbl}: ${fmt(tm.lrt)}`:`${lbl}:`;
    const fpsSel=q('select[data-a="fps"]');
    if(fpsSel instanceof HTMLSelectElement){
      fpsSel.disabled=!hv;
      if(document.activeElement!==fpsSel){
        const autoOpt=fpsSel.querySelector('option[value="auto"]');
        if(autoOpt) autoOpt.textContent=`FPS: ${fpsShort(autoFps(st?.rawFps||DFPS))} (Auto)`;
        fpsSel.value=MODES.includes(p.mode)?p.mode:"auto";
      }
    }
    const speedSel=q('select[data-a="speed"]');
    if(speedSel instanceof HTMLSelectElement){
      speedSel.disabled=!hv;
      if(document.activeElement!==speedSel){
        const cur=nearSpeed(Number.isFinite(st?.playbackRate)?st.playbackRate:p.rate);
        speedSel.value=cur.toFixed(2);
      }
    }
  };
  const srBind=(el,p)=>{
    if(el.dataset.bound==="1")return;
    el.dataset.bound="1";
    el.addEventListener("mousedown",(ev)=>{ev.stopPropagation();},true);
    el.addEventListener("click",(ev)=>{
      const t=ev.target; if(!(t instanceof HTMLElement))return;
      const btn=t.closest("button[data-a]");
      if(!(btn instanceof HTMLButtonElement))return;
      ev.preventDefault();
      ev.stopPropagation();
      const a=btn.dataset.a; if(!a)return;
      if(a==="fps")return;
      if(a==="stepb10"){srGuard(p,"sb10",()=>void srStep(p,-10),70);return;}
      if(a==="stepb"){srGuard(p,"sb",()=>void srStep(p,-1),70);return;}
      if(a==="stepf"){srGuard(p,"sf",()=>void srStep(p,1),70);return;}
      if(a==="stepf10"){srGuard(p,"sf10",()=>void srStep(p,10),70);return;}
      if(a==="play"){srGuard(p,"pl",()=>void srPlay(p),100);return;}
      if(a==="start"){srGuard(p,"st",()=>void srStart(p),100);return;}
      if(a==="end"){srGuard(p,"en",()=>void srEnd(p),100);return;}
      if(a==="pause"){srGuard(p,"pa",()=>void srPause(p),100);return;}
      if(a==="save"){srGuard(p,"sv",()=>void srSaveRun(p),140);return;}
    });
    el.addEventListener("change",(ev)=>{
      const t=ev.target; if(!(t instanceof HTMLSelectElement))return;
      if(t.dataset.a==="fps"){
        const m=String(t.value); if(!MODES.includes(m))return; p.mode=m;
        if(Number.isInteger(p.frameId)) void fcmd(p.frameId,"SET_FPS_MODE",{mode:m});
        save();
        render();
        return;
      }
      if(t.dataset.a==="speed"){
        const v=parseFloat(String(t.value)); if(!Number.isFinite(v)) return;
        void srRateSet(p,v);
      }
    });
  };
  const srEditorHost=(items)=>{
    const tx=(v)=>String(v||"").replace(/\s+/g," ").trim().toLowerCase();
    const baseRect=items?.[0]?.anchor instanceof HTMLElement?items[0].anchor.getBoundingClientRect():null;
    const isGameStatsCard=(el)=>{
      if(!(el instanceof HTMLElement)) return false;
      if(el.classList.contains("ats-sr-panel")||el.classList.contains("ats-sr-editor")) return false;
      const r=el.getBoundingClientRect();
      if(r.left<window.innerWidth*0.48||r.width<180||r.width>540||r.height<54||r.height>420) return false;
      if(r.top<40||r.top>window.innerHeight+1200) return false;
      const headEl=el.firstElementChild;
      const bodyEl=el.children?.[1];
      if(!(headEl instanceof HTMLElement)||!(bodyEl instanceof HTMLElement)) return false;
      const headTx=tx(headEl.textContent||"");
      if(!/\bgame\s*stats\b/.test(headTx)) return false;
      const bodyTx=tx(bodyEl.textContent||"");
      if(!(bodyTx.includes("followers")&&bodyTx.includes("runs")&&bodyTx.includes("players"))) return false;
      if(bodyTx.length>180) return false;
      if(baseRect){
        if(r.left<baseRect.right-130) return false;
        if(r.top<baseRect.top-500||r.top>baseRect.bottom+620) return false;
      }
      return true;
    };
    const now=performance.now();
    if(s.sr.editorHost instanceof HTMLElement&&document.contains(s.sr.editorHost)){
      const r=s.sr.editorHost.getBoundingClientRect();
      if(isGameStatsCard(s.sr.editorHost)&&r.width>120&&r.left>window.innerWidth*0.5&&now-(s.sr.editorHostAt||0)<1200){
        return s.sr.editorHost;
      }
    }
    const all=[...document.querySelectorAll("aside,section,article,div")].filter((el)=>isGameStatsCard(el));
    all.sort((a,b)=>{
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      if(baseRect){
        const as=Math.abs(ar.top-baseRect.top)+Math.abs(ar.left-(baseRect.right+24))*0.65;
        const bs=Math.abs(br.top-baseRect.top)+Math.abs(br.left-(baseRect.right+24))*0.65;
        return as-bs;
      }
      return ar.top-br.top;
    });
    const best=all[0]||null;
    s.sr.editorHost=best;
    s.sr.editorHostAt=now;
    return best;
  };
  const srEditorState=(items)=>{
    if(!Array.isArray(items)||!items.length) return null;
    const it=items[0];
    if(!it) return null;
    return srPanelState(it.key,it.frameId);
  };
  const srResetPanel=async(p)=>{
    const ok=window.confirm("Reset this run retime data?");
    if(!ok) return;
    p.mode="auto"; p.rate=1;
    p.startMs=null; p.startF=null; p.endMs=null; p.endF=null; p.pauseMs=null; p.pauseF=null;
    p.segs=[]; p.nextSeg=1;
    const id=srResolveFrameId(p);
    if(Number.isInteger(id)){
      await fcmd(id,"SET_FPS_MODE",{mode:"auto"});
      await fcmd(id,"SET_PLAYBACK_RATE",{rate:1});
    }
    save();
    await refreshCtl();
    render();
  };
  const srRedoSeg=async(p,id)=>{
    const i=p.segs.findIndex((g)=>g.id===id);
    if(i<0) return;
    const old={...p.segs[i]};
    p.segs.splice(i,1);
    p.pauseMs=old.startMs;
    p.pauseF=Number.isFinite(old.startF)?old.startF:null;
    const fid=srResolveFrameId(p);
    if(Number.isInteger(old.startF)&&Number.isInteger(fid)){
      await fcmd(fid,"SEEK_TO_FRAME",{frame:old.startF});
    }
    save();
    await refreshCtl();
    render();
  };
  const srCreateEditor=(key)=>{
    const el=document.createElement("div");
    el.className="ats-sr-editor";
    el.dataset.key=key;
    el.innerHTML=`<div class="ats-sr-ed-head"></div><div class="ats-sr-ed-list"></div>`;
    return el;
  };
  const srBindEditor=(el,p)=>{
    if(el.dataset.bound==="1") return;
    el.dataset.bound="1";
    el.addEventListener("click",(ev)=>{
      const t=ev.target; if(!(t instanceof HTMLElement)) return;
      const btn=t.closest("button[data-a]");
      if(!(btn instanceof HTMLButtonElement)) return;
      ev.preventDefault(); ev.stopPropagation();
      const a=btn.dataset.a||"";
      if(a==="reset"){ void srResetPanel(p); return; }
      const id=Number(btn.dataset.id);
      if(!Number.isFinite(id)) return;
      const i=p.segs.findIndex((g)=>g.id===id);
      if(i<0) return;
      if(a==="delete"){ p.segs.splice(i,1); save(); render(); return; }
      if(a==="toggle"){ p.segs[i].enabled=p.segs[i].enabled===false?true:false; save(); render(); return; }
      if(a==="redo"){ void srRedoSeg(p,id); }
    });
  };
const srPaintEditor=(el,p,host)=>{
    if(!(host instanceof HTMLElement)) return;
    try{
    const tx=(v)=>String(v||"").replace(/\s+/g," ").trim().toLowerCase();
    const clone=host.cloneNode(true);
    if(!(clone instanceof HTMLElement)) return;
    clone.classList.add("ats-sr-editor");
    clone.dataset.key=el.dataset.key||"";
    const head=clone.firstElementChild instanceof HTMLElement?clone.firstElementChild:null;
    let body=clone.children?.[1];
    if(!(body instanceof HTMLElement)){
      body=document.createElement("div");
      clone.appendChild(body);
    }
    if(head instanceof HTMLElement){
      const srcHead=host.firstElementChild instanceof HTMLElement?host.firstElementChild:null;
      const srcDirect=srcHead?[...srcHead.children].filter((n)=>n instanceof HTMLElement):[];
      let titleNode=null;
      if(srcHead){
        titleNode=srcDirect.find((n)=>/^\s*game\s*stats\s*$/i.test(String(n.textContent||"").trim()))||null;
        if(!(titleNode instanceof HTMLElement)){
          titleNode=srcDirect.find((n)=>{
            const cls=String(n.className||"").toLowerCase();
            return cls.includes("font-title");
          })||null;
        }
        if(!(titleNode instanceof HTMLElement)){
          titleNode=[...srcHead.querySelectorAll("*")].find((n)=>n instanceof HTMLElement&&/^\s*game\s*stats\s*$/i.test(String(n.textContent||"").trim()))||null;
        }
      }
      titleNode = titleNode instanceof HTMLElement ? titleNode.cloneNode(true) : null;
      if(!(titleNode instanceof HTMLElement)){
        titleNode=document.createElement("div");
      }
      titleNode.textContent="LOAD REMOVAL EDITOR";

      let actionNode=null;
      if(srcHead){
        actionNode=srcDirect.find((n)=>{
          const cls=String(n.className||"").toLowerCase();
          if(cls.includes("flex-none")) return true;
          return !!n.querySelector("svg");
        })||null;
        if(!(actionNode instanceof HTMLElement)){
          actionNode=srcDirect.find((n)=>{
            const cls=String(n.className||"").toLowerCase();
            return cls.includes("flex-none");
          })||null;
        }
        if(!(actionNode instanceof HTMLElement)){
          const srcAction=srcHead.querySelector("svg");
          if(srcAction instanceof SVGElement){
            let cur=srcAction.parentElement;
            while(cur && cur.parentElement!==srcHead) cur=cur.parentElement;
            if(cur instanceof HTMLElement) actionNode=cur;
          }
        }
      }
      actionNode = actionNode instanceof HTMLElement ? actionNode.cloneNode(true) : document.createElement("div");
      if(!(actionNode.className||"")) actionNode.className="flex-none";
      actionNode.replaceChildren();
      actionNode.style.display="flex";
      actionNode.style.alignItems="center";
      actionNode.style.justifyContent="flex-end";
      actionNode.style.marginLeft="auto";
      actionNode.style.paddingRight="2px";
      const resetBtn=document.createElement("button");
      resetBtn.className="ats-sr-ed-reset";
      resetBtn.dataset.a="reset";
      resetBtn.textContent="Reset All";
      actionNode.appendChild(resetBtn);

      head.replaceChildren();
      if(srcHead instanceof HTMLElement) head.className=srcHead.className;
      head.style.display="flex";
      head.style.flexDirection="row";
      head.style.flexWrap="nowrap";
      head.style.alignItems="center";
      head.style.justifyContent="space-between";
      head.appendChild(titleNode);
      head.appendChild(actionNode);
    }
    const list=document.createElement("div");
    list.className="ats-sr-ed-list";
    const segs=[...p.segs].sort((a,b)=>{
      const af=Number.isFinite(a.startF)?a.startF:a.startMs;
      const bf=Number.isFinite(b.startF)?b.startF:b.startMs;
      return af-bf;
    });
    if(!segs.length){
      const empty=document.createElement("div");
      empty.className="ats-sr-ed-empty";
      empty.textContent="No Load Removals Yet.";
      list.appendChild(empty);
    } else {
      for(const g of segs){
        const item=document.createElement("div");
        item.className="ats-sr-ed-item";
        const meta=document.createElement("div");
        meta.className="ats-sr-ed-meta";
        const frames=document.createElement("span");
        frames.className="ats-sr-ed-frames";
        frames.textContent=`F: ${Number.isFinite(g.startF)?g.startF:"?"} -> F: ${Number.isFinite(g.endF)?g.endF:"?"}`;
        const time=document.createElement("span");
        time.className="ats-sr-ed-time";
        time.textContent=`Removed Time: ${srDur(g.durationMs)}`;
        const actions=document.createElement("div");
        actions.className="ats-sr-ed-actions";
        for(const [action,label] of [["redo","Redo"],["toggle",g.enabled===false?"Add Back":"Remove"],["delete","Delete"]]){
          const button=document.createElement("button");
          button.className="ats-sr-ed-btn";
          button.dataset.a=action;
          button.dataset.id=String(g.id);
          button.textContent=label;
          actions.appendChild(button);
        }
        meta.append(frames,time);
        item.append(meta,actions);
        list.appendChild(item);
      }
    }
    body.replaceChildren(list);
    el.className=clone.className;
    el.replaceChildren(...[...clone.childNodes].map((node)=>node.cloneNode(true)));
    }catch{}
  };
const srRenderEditor=(items)=>{
    const host=srEditorHost(items);
    const st=srEditorState(items);
    for(const [k,el] of s.sr.editors){ if(!st||k!==st.key){try{el.remove();}catch{} s.sr.editors.delete(k);} }
    if(!host||!st) return;
    let el=s.sr.editors.get(st.key);
    if(!el){
      el=srCreateEditor(st.key);
      s.sr.editors.set(st.key,el);
      srBindEditor(el,st);
    }
    srPaintEditor(el,st,host);
    const container=host.parentElement;
    if(!(container instanceof HTMLElement)) return;
    try{
      if(el.parentElement!==container||el.previousElementSibling!==host){
        container.insertBefore(el,host.nextSibling);
      }
    }catch{}
  };
  const srClear=()=>{
    for(const el of s.sr.mounts.values()){try{el.remove();}catch{}}
    s.sr.mounts.clear();
    for(const el of s.sr.editors.values()){try{el.remove();}catch{}}
    s.sr.editors.clear();
    s.sr.editorHost=null;
    s.sr.editorHostAt=0;
  };
  const srRender=()=>{
    srEnsureStyle();
    const items=srMapTargets(),seen=new Set(items.map((x)=>x.key));
    if(items.some((x)=>!Number.isInteger(x.frameId))){
      const now=performance.now();
      if(now>(s.reinjectAt||0)){
        s.reinjectAt=now+2200;
        void safeSend({type:"SNR_REINJECT_TAB"});
      }
    }
    for(const [k,el] of s.sr.mounts){ if(!seen.has(k)){try{el.remove();}catch{} s.sr.mounts.delete(k);} }
    for(const it of items){
      if(!(it.anchor instanceof HTMLElement)||!document.contains(it.anchor)) continue;
      const p=srPanelState(it.key,it.frameId);
      const eff=srEffectiveStatus(p);
      const st=eff.status;
      if(!(p.anchorEl instanceof HTMLElement)||!document.contains(p.anchorEl)){
        p.anchorEl=it.anchor;
      } else if(p.anchorEl.contains(it.anchor)||it.anchor.contains(p.anchorEl)){
        // Keep a stable anchor while DOM mutates.
      } else {
        p.anchorEl=it.anchor;
      }
      const anchor=p.anchorEl instanceof HTMLElement?p.anchorEl:it.anchor;
      let el=s.sr.mounts.get(it.key);
      if(!el){
        el=srCreatePanel(it.key);
        s.sr.mounts.set(it.key,el);
        srBind(el,p);
      }
      srPaint(el,p,st,anchor);
      const descRef=srThemeRef(anchor);
      let parent=(descRef instanceof HTMLElement?descRef.parentElement:null)||anchor.parentElement;
      if(!parent) continue;
      let marker=descRef instanceof HTMLElement && descRef.parentElement===parent?descRef:null;
      if(!(marker instanceof HTMLElement)){
        const descriptionSibling=(()=>{
        let n=anchor.nextElementSibling;
        while(n){
          if(n instanceof HTMLElement){
            const cls=String(n.className||"");
            const txt=String(n.textContent||"").toLowerCase();
            if(cls.includes("bg-black/20")&&cls.includes("rounded")&&txt.includes("description")) return n;
          }
          n=n.nextElementSibling;
        }
        return null;
        })();
        const nextAfterAnchor=anchor.nextSibling===el?el.nextSibling:anchor.nextSibling;
        marker=descriptionSibling||nextAfterAnchor;
      }
      try{
        if(el.parentElement!==parent||el.nextSibling!==marker) parent.insertBefore(el,marker);
      }catch{}
    }
    srRenderEditor(items);
  };

  function mount(){ if(!s.top||!s.enabled||!s.host)return; const p=document.fullscreenElement||document.documentElement; if(s.host.parentNode!==p)p.appendChild(s.host); s.host.style.display=""; }
  function syncSel(){ const es=s.el; if(!es.speed||!es.fps||!s.ctl)return; let r=s.ctl.playbackRate??s.rate,b=SPEEDS[0],d=Math.abs(r-b); for(const v of SPEEDS){const m=Math.abs(v-r);if(m<d){d=m;b=v;}} es.speed.value=b.toFixed(2); const ao=es.fps.querySelector('option[value="auto"]'); if(ao) ao.textContent=`FPS: ${fpsShort(autoFps(s.rawFps))} (Auto)`; es.fps.value=s.mode; }
  function drawEditor(){
    const p=s.el.editor;
    if(!p) return;
    if(!s.editor){ p.classList.add("hidden"); p.replaceChildren(); return; }
    p.classList.remove("hidden");
    const rows=[...s.segs].sort((a,b)=>{const af=Number.isFinite(a.startF)?a.startF:a.startMs,bf=Number.isFinite(b.startF)?b.startF:b.startMs; return af-bf;});
    const panel=document.createElement("div"); panel.className="panel";
    const head=document.createElement("div"); head.className="head";
    const title=document.createElement("span"); title.className="ttl"; title.textContent="Pause Time Editor"; head.appendChild(title);
    const list=document.createElement("div"); list.className="list";
    if(!rows.length){
      const empty=document.createElement("div"); empty.className="empty"; empty.textContent="No load removals yet."; list.appendChild(empty);
    } else {
      for(const g of rows){
        const row=document.createElement("div"); row.className="row";
        const frames=document.createElement("span"); frames.className="pill"; frames.textContent=`F: ${Number.isFinite(g.startF)?g.startF:"?"} -> F: ${Number.isFinite(g.endF)?g.endF:"?"}`;
        const duration=document.createElement("span"); duration.className="pill"; duration.textContent=fmt(g.durationMs);
        row.append(frames,duration);
        for(const [action,label] of [["redo","Redo"],["toggle",g.enabled?"Remove":"Add Back"],["delete","Delete"]]){
          const button=document.createElement("button"); button.className="sbtn"; button.dataset.a=action; button.dataset.id=String(g.id); button.textContent=label; row.appendChild(button);
        }
        list.appendChild(row);
      }
    }
    const foot=document.createElement("div"); foot.className="foot";
    const reset=document.createElement("button"); reset.className="sbtn danger"; reset.dataset.a="reset-all"; reset.textContent="Reset All"; foot.appendChild(reset);
    panel.append(head,list,foot);
    p.replaceChildren(panel);
  }
  function render(){
    if(!s.top||!s.enabled) return;
    if(srh()&&!isSrRunPage()){
      if(s.host) s.host.style.display="none";
      srClear();
      return;
    }
    if(srMode()){
      if(s.host) s.host.style.display="none";
      srRender();
      return;
    }
    srClear();
    if(!s.el.play) return;
    if(s.host) s.host.style.display="";
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

  async function onPersistKeyChanged(){
    if(s.routeBusy) return;
    s.routeBusy=true;
    try{
      clearState();
      s.srSaved={};
      s.sr.states.clear();
      srClear();
      await refreshCtl();
      await loadSavedForCurrent();
    } finally {
      s.routeBusy=false;
    }
    render();
  }

  async function refreshCtl(){ if(!s.top||!s.enabled||s.pollBusy)return; s.pollBusy=true; try{const fs=await qstat(); s.frames=Array.isArray(fs)?fs:[]; const b=bestFrame(fs); if(b){s.ctlId=b.frameId; s.ctl=b.status; s.rawFps=sf(b.status.rawFps); refps();} else {s.ctlId=s.selfId; s.ctl=lstat();}} finally{s.pollBusy=false;} }
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
    const ok=window.confirm("Reset all SNR data on this page and reload?");
    if(!ok) return;
    const snapNow=await cap();
    const restoreFrame=Number.isFinite(snapNow?.frame)?Math.trunc(snapNow.frame):null;
    clearState();
    try{sessionStorage.removeItem("SNR_state");}catch{}
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
    h.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;font-family:'SNRAller','Segoe UI',Tahoma,sans-serif";
    const sh=h.attachShadow({mode:"open"});
    sh.innerHTML=`<style>
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
      .mnBox{display:block;width:100%;min-height:96px;max-height:220px;resize:vertical;background:#0f1a29;color:#fff;border:1px solid #35506c;border-radius:8px;padding:8px;font-size:12px;line-height:1.35;font-family:'SNRAller','Segoe UI',Tahoma,sans-serif}
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
      <img class="logo" id="lg" alt="" />
      <button class="b ib" id="p" title="Frame -1">&#8592;</button><button class="b ib" id="pp" title="Play/Pause">&#9654;</button><button class="b ib" id="n" title="Frame +1">&#8594;</button>
      <select class="s" id="sp"></select><select class="s" id="fm"></select>
      <button class="b" id="cs">Confirm Start</button><button class="b" id="ce">Confirm End</button><button class="b" id="pt">Pause Time</button><button class="b hiddenCtl" id="cr">Cancel Redo</button><button class="b" id="eb">Open Editor</button>
    </div><div class="st">
      <div class="sk"><span id="st">Start: --:--:--.---</span><span id="en">End: --:--:--.---</span></div>
      <div class="sk"><span id="rt">RTA: --:--:--.---</span><span id="ig">IGT: --:--:--.---</span></div>
      <span class="site" id="si">Site: searching <video></span>
    </div></div><div class="ed hidden" id="ed"></div><div class="mn hidden" id="mn"><div class="mnT">Mod Note</div><textarea id="mnt" class="mnBox" spellcheck="false"></textarea><div class="mnRow"><span class="copyOk" id="mok">&#10003; Copied</span><button class="sbtn" id="mcp">Copy Mod Note</button><button class="sbtn" id="mth">Hide Mod Note</button></div></div>`;

    const fontStyle=document.createElement("style");
    fontStyle.textContent=`@font-face{font-family:'SNRAller';src:url('${fontUrl}') format('truetype');font-weight:400;font-style:normal}`;
    sh.prepend(fontStyle);
    s.host=h; s.sh=sh;
    const sp=sh.getElementById("sp");
    for(const v of SPEEDS){const o=document.createElement("option"); o.value=v.toFixed(2); o.textContent=`${v.toFixed(2)}x`; sp.appendChild(o);}
    const fm=sh.getElementById("fm");
    const labs={auto:`FPS: ${fpsShort(DFPS)} (Auto)`,30:"FPS: 30","59.94":"FPS: 59",60:"FPS: 60"};
    for(const m of MODES){const o=document.createElement("option"); o.value=m; o.textContent=labs[m]; fm.appendChild(o);}

    s.el={wrap:sh.getElementById("wr"),logo:sh.getElementById("lg"),prev:sh.getElementById("p"),play:sh.getElementById("pp"),next:sh.getElementById("n"),speed:sp,fps:fm,cStart:sh.getElementById("cs"),cEnd:sh.getElementById("ce"),pause:sh.getElementById("pt"),cancelRedo:sh.getElementById("cr"),editorBtn:sh.getElementById("eb"),editor:sh.getElementById("ed"),noteWrap:sh.getElementById("mn"),noteText:sh.getElementById("mnt"),copyTick:sh.getElementById("mok"),copyNote:sh.getElementById("mcp"),toggleNote:sh.getElementById("mth"),site:sh.getElementById("si"),start:sh.getElementById("st"),end:sh.getElementById("en"),rta:sh.getElementById("rt"),igt:sh.getElementById("ig")};
    s.el.logo.src=logoUrl;
    s.el.logo.onerror=()=>{ s.el.logo.style.display="none"; };
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
  function disable(){ s.enabled=false; stopCb(); setVideo(null); srClear(); if(s.top&&s.host&&s.host.isConnected)s.host.remove(); }

  async function init(){
    await reg();
    setVideo(bestVideo());
    s.pageKey=normKey(location.href);
    if(!s.top){
      s.nativeIv=setInterval(()=>{ if(!s.enabled)return; setVideo(bestVideo()); try{ nativeMs(); }catch{} },90);
      s.iv=setInterval(()=>{ if(!s.enabled)return; setVideo(bestVideo()); },450);
      return;
    }
    load();
    await getLabelMode();
    await getSpecialLayout();
    ui();
    render();
    s.iv=setInterval(async()=>{
      if(!s.enabled)return;
      const k=normKey(location.href);
      if(k!==s.pageKey){
        s.pageKey=k;
        await onPersistKeyChanged();
        return;
      }
      await refreshCtl();
      render();
    },POLL);
    s.nativeIv=setInterval(()=>{ try{ nativeMs(); }catch{} },90);
    await refreshCtl();
    await applyResetRestore();
    await loadSavedForCurrent();
    render();
  }
  window.__ASSEMBLY_TIMESHARP_ENABLE__=enable; window.__ASSEMBLY_TIMESHARP_DISABLE__=disable; window.__ASSEMBLY_TIMESHARP_OPEN_PANEL__=enable;
  void init();
})();
