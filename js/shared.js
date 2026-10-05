/* The Signature Flight School — shared: nav, tabs, read-aloud, pilot profiles */
(function(){
"use strict";
var BASE="https://justinahiggins614-cmyk.github.io/";
/* ---------- network nav (37 sites; 27 = YOU ARE HERE) ---------- */
var SITES=[
["signature-math/","1 Signature Math"],
["jah-calculator/","2 Signature Universal Paradox Immune Calculator"],
["jah-dictionary/","3 The Signature Dictionary"],
["jah-wiki/","4 JAH Wiki"],
["jah-n-wiki-leaks/","5 JAH-N Wiki Leaks"],
["signature-llama/","6 Signature Llama"],
["jah-ai-models/","7 The Signature AI Phone Book"],
["cyber-patent-catalog/","8 Globally Rejustered Patent Catalog"],
["signature-one-archive/specs.html","9 Signature Spec Catalog Pending Patents"],
["jah-computer-systems/","10 The Signature PC System Depository"],
["signature-books/","11 The Signature Book Depository"],
["signature-comics/","12 The Signature Comic Store"],
["signature-newspapers/","13 The Signature Global Newspaper Archive"],
["signature-backend/","14 The Signature AI Mix and Match Generator"],
["signature-boundless-generators/","15 The Signature Boundless Generator Archive"],
["signature-ai-mixlab/","16 The Signature AI Mix Lab"],
["signature-ai-olypics/","17 AI Olympics"],
["signature-chip-maker/","18 The Signature Computer Chip Maker and Archive"],
["signature-app-archive/","19 The Signature App Archive"],
["signature-ai-robot-matcher/","20 The Signature AI to Robot Matcher"],
["signature-experiment-solver/","21 The Signature Experiment Solver"],
["signature-ai-image-video-maker/","22 Signature AI Pixel"],
["signature-ai-song-maker/","23 Signature Music Studio"],
["signature-fixit/","24 The Signature Mr Fix-It"],
["signature-university/","25 Signature University"],
["signature-earth/","26 Signature Earth"],
["signature-game-store/","28 The Signature Game Store"],
["signature-website-creator/","29 The Signature Website Creator"],
["signature-antivirus/","30 The Signature Antivirus"],
["signature-os-updater/","31 The Signature OS Updater"],
["signature-space-mapping/","32 Signature Space Mapping"],
["signature-cookbook/","33 The Signature Cookbook"],
["signature-spell-check/","34 The Signature Spell Check"],
["signature-image-grid-measure/","35 The Signature Image Grid and Measure"],
["signature-cyber-mega-mall/","36 The Signature Cyber Mega-Mall"],
["signature-3d-print/","37 The Signature 3D Print Mega Mall"]];
window.SFNAV=function(){
  var h='<div class="jahnet"><span class="t">THE JAH NETWORK</span><br>';
  for(var i=0;i<SITES.length;i++) h+='<a href="'+BASE+SITES[i][0]+'">'+SITES[i][1]+'</a>';
  h+='<br><span class="here">27 The Signature Flight School — YOU ARE HERE</span></div>';
  var el=document.getElementById("jahnet"); if(el) el.innerHTML=h;
};
/* ---------- tab bar active state ---------- */
window.SFTABS=function(active){
  var map={main:"index.html",aircraft:"aircraft.html",sim:"sim.html",paths:"paths.html"};
  var bar=document.getElementById("tabbar"); if(!bar) return;
  var links=bar.getElementsByTagName("a");
  for(var i=0;i<links.length;i++){
    var href=links[i].getAttribute("href")||"";
    links[i].classList.toggle("on",href===map[active]);
  }
};
/* ---------- global audio controller (play kills everything first) ---------- */
if(!window.__JAHREAD){
  var R={cur:null,
    stopAll:function(){try{if(R.cur){R.cur.pause();R.cur.currentTime=0;R.cur=null;}}catch(e){}
      try{speechSynthesis.cancel();}catch(e){} try{responsiveVoice.cancel();}catch(e){}},
    playGuard:function(){return true;}
  };
  window.__JAHREAD=R;
}
/* ---------- tiered read-aloud: ResponsiveVoice -> Google TTS -> speechSynthesis ---------- */
var chunks=[],ci=0,speaking=false;
function googleTTSUrl(t){return "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q="+encodeURIComponent(t);}
function playChunk(){
  if(ci>=chunks.length){speaking=false;return;}
  var t=chunks[ci];
  var done=function(){ci++;setTimeout(playChunk,150);};
  try{
    if(window.responsiveVoice){responsiveVoice.speak(t,"UK English Female",{onend:done,onerror:step2});return;}
    step2();
  }catch(e){step2();}
  function step2(){
    try{
      var a=new Audio(); window.__JAHREAD.cur=a;
      a.src=googleTTSUrl(t); a.onended=done;
      a.onerror=function(){step3();};
      var p=a.play(); if(p&&p.catch)p.catch(function(){step3();});
    }catch(e){step3();}
  }
  function step3(){
    try{
      var u=new SpeechSynthesisUtterance(t); u.lang="en-US";
      u.onend=done; u.onerror=done; speechSynthesis.speak(u);
    }catch(e){done();}
  }
}
window.SFRead=function(text){
  try{if(window.__JAHREAD)window.__JAHREAD.stopAll();}catch(e){}
  speaking=false;
  var clean=String(text).replace(/[#*`>|]/g," ").replace(/\s+/g," ").trim();
  chunks=[];var cur="";
  clean.split(/(?<=[.!?])\s+/).forEach(function(s){
    if((cur+" "+s).length>180){chunks.push(cur);cur=s;}else cur=(cur?cur+" ":"")+s;
  });
  if(cur)chunks.push(cur);
  ci=0;speaking=true;playChunk();
};
window.SFStop=function(){try{if(window.__JAHREAD)window.__JAHREAD.stopAll();}catch(e){}speaking=false;};
window.sfReadCard=function(el){var t=el.getAttribute("data-read");if(t)window.SFRead(t);};
/* ---------- pilot profiles (device-local) ---------- */
var PKEY="sf_pilots_v1",CKEY="sf_current_pilot";
/* JAHProfile storage wrapper (JAHPS): public visitors pass keys through unprefixed (behavior unchanged); signed-in profiles get per-profile namespaced storage. */
var JAHPS=(function(){try{return (typeof JAHProfile!=="undefined")&&JAHProfile.store?JAHProfile.store:localStorage;}catch(e){return localStorage;}})();
function loadPilots(){try{return JSON.parse(JAHPS.get(PKEY))||{};}catch(e){return{};}}
function savePilots(p){try{JAHPS.set(PKEY,JSON.stringify(p));}catch(e){}}
window.SFpilots={
  all:function(){return loadPilots();},
  current:function(){var p=loadPilots();var n=null;try{n=JAHPS.get(CKEY);}catch(e){}
    if(n&&p[n])return n;var ks=Object.keys(p);return ks.length?ks[0]:null;},
  get:function(name){var p=loadPilots();return p[name]||null;},
  signin:function(name){
    name=String(name).trim().slice(0,40);if(!name)return null;
    var p=loadPilots();
    if(!p[name])p[name]={name:name,hours:0,flights:0,lessons:[],created:Date.now()};
    savePilots(p);try{JAHPS.set(CKEY,name);}catch(e){}
    return p[name];
  },
  signout:function(){try{JAHPS.remove(CKEY);}catch(e){}},
  logFlight:function(seconds,note){
    var n=window.SFpilots.current();if(!n)return 0;
    var p=loadPilots();if(!p[n])return 0;
    var hrs=seconds/3600;p[n].hours=Math.round((p[n].hours+hrs)*100)/100;
    p[n].flights=(p[n].flights||0)+1;savePilots(p);return hrs;
  },
  markLesson:function(i){var n=window.SFpilots.current();if(!n)return;var p=loadPilots();
    if(p[n]){p[n].lessons=p[n].lessons||[];if(p[n].lessons.indexOf(i)<0)p[n].lessons.push(i);savePilots(p);}}
};
/* pilot chip in tab bar */
window.SFchip=function(){
  var el=document.querySelector(".pilotchip");if(!el)return;
  var n=window.SFpilots.current();
  if(n){var p=window.SFpilots.get(n);
    el.innerHTML='🧑‍✈️ <b>'+esc(n)+'</b> · '+p.hours.toFixed(1)+'h · '+p.flights+' flights';
  }else el.innerHTML='🧑‍✈️ <b>Guest pilot</b> — <a href="index.html#pilot" style="color:var(--gold)">sign in</a>';
};
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
/* copy + download helpers */
window.SFcopy=function(text,btn){
  function done(){if(btn){var o=btn.textContent;btn.textContent="✓ Copied!";setTimeout(function(){btn.textContent=o;},1500);}}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,done);}
  else{var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);done();}
};
window.SFdownload=function(filename,text){
  var b=new Blob([text],{type:"text/plain"});var u=URL.createObjectURL(b);
  var a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(u);},800);
};
})();
