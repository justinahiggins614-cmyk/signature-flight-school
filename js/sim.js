/* The Signature Flight School — canvas flight simulator engine.
   Pseudo-3D: projected ground grid, runway, hills, clouds, HUD.
   Used by sim.html (interactive) and demo mode (AI autopilot). */
(function(){
"use strict";
/* craft physics, keyed by aircraft id (speeds m/s) */
var CRAFTS={
 t1:{max:42,stall:18,accel:5.5,turn:26,pitchK:2.4,rollK:3.2,name:"Skyhopper T-1 Trainer",acc:"#e23b3b",wing:"straight",size:1.0,prop:1},
 c2:{max:48,stall:20,accel:6.0,turn:26,pitchK:2.4,rollK:3.2,name:"Cloudrunner C-2",acc:"#3aa0ff",wing:"straight",size:1.0,prop:1},
 g1:{max:32,stall:14,accel:0.0,turn:22,pitchK:2.0,rollK:2.8,name:"Albatross G-1 Glider",acc:"#f2f2f2",wing:"glider",size:1.25,prop:0},
 h4:{max:55,stall:8,accel:7.0,turn:34,pitchK:2.8,rollK:3.6,name:"Whirlybird H-4",acc:"#ffaa00",wing:"rotor",size:0.9,prop:0},
 r3:{max:75,stall:26,accel:9.0,turn:38,pitchK:3.0,rollK:4.0,name:"Dart Racer R-3",acc:"#ff3344",wing:"swept",size:0.9,prop:1},
 c9:{max:150,stall:55,accel:11,turn:22,pitchK:2.0,rollK:2.6,name:"Comet Cruiser C-9",acc:"#88eeff",wing:"swept",size:1.3,prop:0},
 a6:{max:52,stall:22,accel:6.5,turn:26,pitchK:2.4,rollK:3.2,name:"Sunseeker A-6 Amphibian",acc:"#ffcc33",wing:"straight",size:1.05,prop:1},
 j7:{max:260,stall:80,accel:22,turn:34,pitchK:3.2,rollK:4.2,name:"Thunderbolt J-7",acc:"#aab3c0",wing:"swept",size:1.1,prop:0},
 g800:{max:175,stall:65,accel:9.0,turn:16,pitchK:1.6,rollK:2.0,name:"Sky Giant G-800",acc:"#4488ff",wing:"heavy",size:1.7,prop:0},
 s5:{max:300,stall:90,accel:26,turn:36,pitchK:3.4,rollK:4.4,name:"Stormchaser S-5",acc:"#ff66aa",wing:"delta",size:1.0,prop:0},
 n2:{max:210,stall:70,accel:16,turn:28,pitchK:2.6,rollK:3.4,name:"Night Owl N-2",acc:"#aa66ff",wing:"swept",size:1.15,prop:0},
 x1:{max:420,stall:110,accel:40,turn:30,pitchK:3.6,rollK:4.6,name:"Starhopper X-1 Rocket",acc:"#ffdd55",wing:"rocket",size:1.0,prop:0}};
window.SF_CRAFTS=CRAFTS;
/* graphics era tiers (renderer-only; physics identical at every tier) */
var GFX_TIERS=["16-BIT","32-BIT","PLAYSTATION","64","PS3","BEYOND"];
window.SF_GFX_TIERS=GFX_TIERS;
var PART_CAP=[0,30,60,110,140,180];
var CLOUD_N=[10,18,24,33,33,33];

function FlightSim(canvas,opts){
  opts=opts||{};
  var S=this;
  S.cv=canvas; S.ctx=canvas.getContext("2d");
  S.W=960; S.H=540; canvas.width=960; canvas.height=540;
  S.craft=CRAFTS[opts.craft]||CRAFTS.t1;
  S.onEvent=opts.onEvent||function(){};
  S.ai=opts.ai!==false; S.demo=opts.demo||null; // demo = {waypoints:[[x,z,alt]..], name}
  S.gfx=(typeof opts.gfx==="number")?Math.max(0,Math.min(5,opts.gfx)):4; /* PS3 default */
  S.view=opts.view||0; /* 0=nose, 1=cockpit, 2=chase */
  S.terr={ready:false,grid:{},z:8,cx:133,cy:90};
  S.rollRate=0;S._prevRoll=0;
  S.reset();
  loadTerrain(S);
}
FlightSim.prototype.reset=function(){
  var S=this;
  S.x=0;S.z=0;S.alt=0;S.hdg=0;S.pitch=0;S.roll=0;S.speed=0;S.throttle=0;
  S.onGround=true;S.airborne=false;S.crashed=false;S.frozen=false;S.landedOK=false;
  S.flaps=false;S.gear=true;S.brakes=false;S.smoke=false;S.mapView=false;S.paused=false;
  S.time=0;S.vy=0;S.stick={x:0,y:0};S.demoIdx=0;S.demoDone=false;S.trail=[];
  S.rollRate=0;S._prevRoll=0;
  S.clouds=[];for(var i=0;i<24;i++)S.clouds.push({x:(Math.random()-0.5)*8000,z:Math.random()*8000-1000,y:400+Math.random()*900,s:60+Math.random()*120});
  S.cloudsHi=[];for(var ci=0;ci<9;ci++)S.cloudsHi.push({x:(Math.random()-0.5)*9000,z:Math.random()*9000-1500,y:1500+Math.random()*900,s:90+Math.random()*130});
  S.stars=[];for(var sti=0;sti<90;sti++)S.stars.push({x:Math.random()*960,y:Math.random()*380,r:0.6+Math.random()*1.4,tw:Math.random()*6.28});
  S.parts=[];S.tod=0.32;S.fxT=0; /* fx state: hi clouds, stars, exhaust particles, time-of-day, fx clock */
  S.ev("reset",{});
};
FlightSim.prototype.ev=function(n,d){try{this.onEvent(n,d||{});}catch(e){}};
FlightSim.prototype.button=function(n){ /* buttons 1-11 */
  var S=this;if(S.paused&&n!==10&&n!==11&&n!==7)return; /* 7 = map is view-only, safe while paused */
  switch(n){
    case 1:S.throttle=Math.min(1,S.throttle+0.15);break;
    case 2:S.throttle=Math.max(0,S.throttle-0.15);break;
    case 3:S.flaps=!S.flaps;S.ev("note",{t:S.flaps?"Flaps down — slower stall, more drag.":"Flaps up."});break;
    case 4:S.gear=!S.gear;S.ev("note",{t:S.gear?"Landing gear DOWN.":"Landing gear UP."});break;
    case 5:S.brakes=!S.brakes;S.ev("note",{t:S.brakes?"Brakes on.":"Brakes off."});break;
    case 6:S.ai=!S.ai;S.ev("note",{t:S.ai?"Captain Siggy is coaching you.":"Solo mode — no AI helper. Good luck, pilot!"});S.ev("aimode",{ai:S.ai});break;
    case 7:S.mapView=!S.mapView;break;
    case 8:S.smoke=!S.smoke;break;
    case 9:S.ev("askpal",{});break;
    case 10:S.paused=!S.paused;S.ev("note",{t:S.paused?"Paused.":"Back in the air!"});break;
    case 11:S.reset();S.ev("note",{t:"Fresh flight — you're back at the runway."});break;
  }
};
FlightSim.prototype.step=function(dt){
  var S=this;if(S.paused||S.crashed&&S.frozen)return;
  if(S.demo&&!S.demoDone)S.autopilot(dt);
  var C=S.craft;
  /* throttle -> speed */
  var stall=C.stall*(S.flaps?0.8:1);
  var drag=0.0009*S.speed*S.speed+(S.flaps?1.2:0)+(S.gear&&!S.onGround?0.8:0)+(S.brakes&&S.onGround?14:0);
  var acc=S.throttle*C.accel;
  if(C.accel<0.5&&S.throttle>0.3&&S.onGround)acc=9*S.throttle; /* aerotow takeoff */
  if(S.demo&&C.accel<0.5&&!S.onGround)acc=Math.max(acc,9*S.throttle); /* demo aerotow: tow plane keeps the glider on the route */
  S.speed+=(acc-drag)*dt;
  if(S.speed<0)S.speed=0; if(S.speed>C.max*1.15)S.speed=C.max*1.15;
  /* stick -> pitch/roll ease */
  var pT=S.stick.y*24, rT=S.stick.x*55;
  var prevR=S.roll;
  S.pitch+=(pT-S.pitch)*Math.min(1,C.pitchK*dt);
  S.roll+=(rT-S.roll)*Math.min(1,C.rollK*dt);
  S.rollRate=dt>0?(S.roll-prevR)/dt:0; S._prevRoll=S.roll;
  if(S.onGround){S.pitch*=0.9;S.roll*=0.9;}
  /* heading from bank */
  var hr=S.hdg*Math.PI/180;
  S.hdg+=(S.roll*C.turn*(S.speed/C.max))*dt*0.9;
  S.hdg=((S.hdg%360)+360)%360; hr=S.hdg*Math.PI/180;
  /* vertical */
  var stalled=S.alt>1&&S.speed<stall;
  var vy=Math.sin(S.pitch*Math.PI/180)*S.speed*0.95;
  if(stalled){vy-=(stall-S.speed)*0.9;S.pitch-=8*dt;}
  if(!S.onGround&&S.alt<2.5&&S.gear&&S.speed<stall*1.7)vy=Math.min(vy,-1.2); /* landing settle: low + slow + gear down = she wants to land */
  if(S.onGround&&S.speed<5)vy=0;
  S.vy=vy;S.alt+=vy*dt;
  /* horizontal */
  S.x+=Math.sin(hr)*S.speed*dt; S.z+=Math.cos(hr)*S.speed*dt;
  /* flight time */
  if(!S.onGround||S.speed>5)S.time+=dt;
  /* takeoff */
  if(S.onGround&&S.alt>3&&S.speed>stall){S.onGround=false;S.airborne=true;S.ev("takeoff",{});}
  /* touchdown (0.6m threshold: the sim's vertical asymptote can hover just above 0) */
  if(!S.onGround&&S.alt<=0.6&&S.vy<=0.6){
    S.alt=0;S.onGround=true;S.airborne=false;
    var onRwy=Math.abs(S.x)<25&&S.z>-60&&S.z<700;
    var gentle=S.vy>-(1.5+S.speed*0.04)&&Math.abs(S.roll)<12;
    if(onRwy&&gentle&&S.gear){S.ev("landed",{});S.landedOK=true;}
    else if(onRwy&&gentle&&!S.gear){S.crash("Belly landing! Next time put the GEAR down (button 4).");}
    else if(!onRwy&&S.speed<35&&gentle){S.ev("rough",{});}
    else S.crash(onRwy?"Too hard! Come down gently — ease the nose up just before touching.":"You crashed! Line up with the runway and descend gently.");
    S.pitch=0;S.roll=0;
  }
  /* trail */
  if(S.smoke&&!S.onGround){S.trail.push({t:0});if(S.trail.length>40)S.trail.shift();}
  S.trail.forEach(function(p){p.t+=dt;});
  S.fxUpdate(dt);
  S.coachT=(S.coachT||0)+dt;
  if(S.coachT>1.6&&S.ai&&!S.demo){S.coachT=0;S.coach();}
};
FlightSim.prototype.crash=function(msg){
  var S=this;S.crashed=true;S.frozen=true;S.speed=0;S.throttle=0;S.ev("crash",{msg:msg});
  if(S.demo){S.demoTries=(S.demoTries||0)+1;
    if(S.demoTries<3){S.ev("demorestart",{n:S.demoTries});S.button(11);}
    else{S.demo=null;S.paused=true;S.ev("demofail",{});}}
};
/* ---- AI pal coaching ---- */
FlightSim.prototype.coach=function(){
  var S=this,C=S.craft,stall=C.stall*(S.flaps?0.8:1),m=null;
  var dRwy=Math.sqrt(S.x*S.x+S.z*S.z);
  if(S.onGround&&S.speed<stall&&S.throttle<0.7&&!S.crashed)m="Push the throttle up — button 1 (or hold Shift) — to start your takeoff roll!";
  else if(!S.onGround&&S.speed<stall*1.15)m="Too slow! Add throttle or you'll stall. Nose down a touch to gain speed.";
  else if(!S.onGround&&S.alt<70&&S.vy<-4)m="Pull up gently — the ground is close!";
  else if(Math.abs(S.roll)>48)m="Easy on the bank! Roll back toward level.";
  else if(!S.onGround&&dRwy<1600&&S.alt<450&&S.alt>5)m="Runway ahead — line up straight, gear down (button 4), and come down gently.";
  else if(!S.onGround&&S.alt>2500)m="High up! The view is great — watch your speed in the thin air.";
  if(m)S.ev("coach",{t:m});
};
FlightSim.prototype.askPal=function(){
  var tips=["The stick works like this: push UP to climb, DOWN to descend, LEFT and RIGHT to bank and turn.",
  "Buttons 1 and 2 are your throttle. More throttle = more speed = more lift.",
  "To take off: full throttle, wait for speed, then gently pull UP on the stick.",
  "To land: slow down, line up with the runway, descend gently, and flare — tiny pull up — right before touching.",
  "Banking (LEFT/RIGHT) turns the plane. Small banks make gentle turns; big banks turn fast but lose lift.",
  "If you get lost, button 7 shows the map. The runway is the gray strip at the start."];
  this.ev("coach",{t:tips[Math.floor(Math.random()*tips.length)]});
};
/* ---- demo autopilot: fly waypoints, then a stabilized landing ---- */
FlightSim.prototype.autopilot=function(dt){
  var S=this,wp=S.demo.waypoints;
  var target=null,tAlt=0;
  if(S.demoIdx<wp.length){
    target=wp[S.demoIdx];
    tAlt=Math.min(wp[S.demoIdx][2],900); /* demo scenic-altitude cap: same route, watchable */
    if(S.demoIdx>=wp.length-2)tAlt=Math.min(tAlt,400); /* arrival: start coming down */
  }
  else{target=[0,-4500,200];tAlt=200;} // final approach fix: 4.5km out
  if(S.demoIdx>=wp.length+1){target=[0,500,0];tAlt=0;} // runway: aim down the strip, not at a point
  var dx=target[0]-S.x,dz=target[1]-S.z;
  var dist=Math.sqrt(dx*dx+dz*dz);
  var capR=S.craft.max>120?600:350; /* fast jets get a wider waypoint capture */
  if(S.demoIdx<wp.length&&dist<capR){S.demoIdx++;S.ev("demowp",{i:S.demoIdx,n:wp.length});return;}
  if(S.demoIdx>=wp.length&&dist<600){
    if(S.demoIdx===wp.length){S.demoIdx++;}
    else if(S.onGround&&S.speed<3){S.demoDone=true;S.ev("demodone",{});return;}
  }
  var wantH=Math.atan2(dx,dz)*180/Math.PI;wantH=((wantH%360)+360)%360;
  var dh=wantH-S.hdg;while(dh>180)dh-=360;while(dh<-180)dh+=360;
  S.stick.x=Math.max(-1,Math.min(1,dh/30));
  var altErr=tAlt-S.alt;
  S.stick.y=Math.max(-0.6,Math.min(0.6,altErr/120));
  if(S.onGround){
    if(S.craft.accel<0.5){S.throttle=1;} /* glider aerotow */
    else S.throttle=1;
    if(S.speed>S.craft.stall*1.05)S.stick.y=0.5;
  }
  else S.throttle=S.speed<S.craft.max*0.55?0.85:0.45;
  if(S.demoIdx>wp.length){ /* final leg: stabilized approach */
    S.gear=true;S.flaps=true;
    if(S.onGround){
      if(S.speed<3&&!S.crashed){S.demoDone=true;S.ev("demodone",{rough:true});return;} /* safe but off-runway: still counts */
      S.throttle=0;S.brakes=true;S.stick.x=0;S.stick.y=0;
    }
    else{
      var vApp=S.craft.stall*1.35;
      S.throttle=Math.max(0.05,Math.min(0.7,0.25+(vApp-S.speed)*0.03)); /* chase approach speed */
      /* centerline tracking: kill lateral offset, not just heading */
      S.stick.x=Math.max(-1,Math.min(1,S.stick.x+Math.max(-0.7,Math.min(0.7,-S.x/150))));
      var distT=Math.sqrt(S.x*S.x+(S.z-100)*(S.z-100));
      var glideAlt=Math.max(0,(distT-100)*0.045); /* ~2.6° glidepath to the threshold */
      var gErr=glideAlt-S.alt;
      S.stick.y=Math.max(-0.5,Math.min(0.4,gErr/50));
    }
  }
};
/* ---- cinematic effects helpers (client-side canvas, phone-friendly) ---- */
function hexA(hex,a){ /* "#rrggbb" + alpha -> rgba() */
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return "rgba("+r+","+g+","+b+","+a.toFixed(3)+")";
}
function mixc(a,b,k){
  var ar=parseInt(a.slice(1,3),16),ag=parseInt(a.slice(3,5),16),ab=parseInt(a.slice(5,7),16);
  var br=parseInt(b.slice(1,3),16),bg=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
  function hx(v){v=Math.round(Math.max(0,Math.min(255,v)));return (v<16?"0":"")+v.toString(16);}
  return "#"+hx(ar+(br-ar)*k)+hx(ag+(bg-ag)*k)+hx(ab+(bb-ab)*k);
}
/* sky keyframes by sun elevation (radians): night -> dusk -> morning -> day */
var SKYPALS=[
 {e:-1.2, sky:["#020610","#0a1430","#16244a"], gnd:["#0c1f14","#060f08"], star:1},
 {e:-0.10,sky:["#1a1440","#4a2a5a","#c96a3a"], gnd:["#2a3a22","#101a0e"], star:0.3},
 {e:0.10, sky:["#2a4a8a","#6a9ad5","#ffd9a0"], gnd:["#4a8f4a","#1d4a1d"], star:0},
 {e:0.45, sky:["#0a2352","#3a7bd5","#9fd0ff"], gnd:["#4a8f4a","#1d4a1d"], star:0}
];
function skyPal(e){
  var p=SKYPALS,i;
  if(e<=p[0].e)return [p[0].sky,p[0].gnd,p[0].star];
  for(i=0;i<p.length-1;i++){if(e<=p[i+1].e)break;}
  if(i>=p.length-1)return [p[p.length-1].sky,p[p.length-1].gnd,p[p.length-1].star];
  var a=p[i],b=p[i+1],k=(e-a.e)/(b.e-a.e);
  return [[mixc(a.sky[0],b.sky[0],k),mixc(a.sky[1],b.sky[1],k),mixc(a.sky[2],b.sky[2],k)],
          [mixc(a.gnd[0],b.gnd[0],k),mixc(a.gnd[1],b.gnd[1],k)],
          a.star+(b.star-a.star)*k];
}
/* shaded, volumetric-looking cloud puffs (flat=true: 16-BIT simple) */
function drawClouds(ctx,S,list,hi,proj,F,H,flat){
  for(var i=0;i<list.length;i++){var c=list[i];
    var p=proj(c.x,c.z,c.y);if(!p)continue;
    if(p[1]<-180||p[1]>H+180)continue;
    var s2=Math.min(c.s*F/Math.max(60,Math.hypot(c.x-S.x,c.z-S.z)),hi?170:260);
    if(flat){ ctx.fillStyle="rgba(255,255,255,.85)";
      ctx.beginPath();ctx.ellipse(p[0],p[1],s2,s2*0.42,0,0,7);ctx.fill();continue; }
    var a=hi?0.5:0.88;
    ctx.fillStyle="rgba(150,170,198,"+(a*0.55).toFixed(3)+")";
    ctx.beginPath();ctx.ellipse(p[0],p[1]+s2*0.22,s2,s2*0.40,0,0,7);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,"+a.toFixed(3)+")";
    ctx.beginPath();ctx.ellipse(p[0],p[1],s2,s2*0.42,0,0,7);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,"+Math.min(1,a+0.12).toFixed(3)+")";
    ctx.beginPath();ctx.ellipse(p[0]-s2*0.15,p[1]-s2*0.18,s2*0.55,s2*0.24,0,0,7);ctx.fill();
  }
}
/* per-frame effect state: dt-driven so AI demo (4x steps) stays correct */
FlightSim.prototype.fxUpdate=function(dt){
  var S=this;
  S.fxT+=dt;
  S.tod=(S.tod+dt/1500)%1; /* ~25-minute day cycle */
  var want=S.crashed?0:Math.round(S.throttle*30);
  var pcap=PART_CAP[S.gfx]||0;
  for(var i=0;i<want;i++){
    if(S.parts.length<pcap&&Math.random()<dt*36){
      var side=Math.random()<0.5?-1:1;
      S.parts.push({x:S.W/2+side*(26+Math.random()*34),y:S.H*0.92,
        vx:side*(18+Math.random()*44),vy:110+Math.random()*130,
        t:0,life:0.35+Math.random()*0.3,s:2+Math.random()*3});
    }
  }
  for(var j=S.parts.length-1;j>=0;j--){var p=S.parts[j];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.t>=p.life)S.parts.splice(j,1);}
};
/* ---- real-imagery terrain: slippy-map tiles, same z/x/y Web Mercator scheme
   as Signature Earth (assets/tiles/sig/{z}/{x}/{y}.png). Training area is
   centered at lat 46.5, lon 8.0. Tiles live at assets/terrain/sig/{z}/{x}/{y}.jpg
   (code/make_terrain_tiles.py, public-domain NASA Blue Marble source).
   At init the z8 3x3 around the field is stitched and per-quad average colors
   are sampled; missing tiles -> procedural training terrain (never blank). */
var TERR_LAT=46.5, TERR_LON=8.0;
function terrLonLat(gx,gz){ /* sim meters -> [lon,lat] */
  return [TERR_LON+gx/(111320*Math.cos(TERR_LAT*Math.PI/180)), TERR_LAT+gz/110540];
}
function terrTileXY(lon,lat,z){
  var n=Math.pow(2,z);
  var x=Math.floor((lon+180)/360*n);
  var lr=lat*Math.PI/180;
  var y=Math.floor((1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n);
  return [x,y];
}
function terrTileURL(z,x,y){ return "assets/terrain/sig/"+z+"/"+x+"/"+y+".jpg"; }
function loadTerrain(S){
  if(typeof Image==="undefined"||typeof document==="undefined")return; /* node harness */
  var z=S.terr.z, c=terrTileXY(TERR_LON,TERR_LAT,z);
  S.terr.cx=c[0]; S.terr.cy=c[1];
  var imgs=[], done=0;
  function fin(){ if(++done>=9) stitchTerrain(S,imgs,z,c); }
  for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){
    (function(x,y,ox,oy){
      var im=new Image();
      im.onload=function(){imgs.push({dx:ox,dy:oy,im:im});fin();};
      im.onerror=function(){fin();};
      im.src=terrTileURL(z,x,y);
    })(c[0]+dx,c[1]+dy,dx,dy);
  }
}
function stitchTerrain(S,imgs,z,c){
  try{
    if(!imgs.length)return; /* all failed -> procedural fallback, never blank */
    var cv=document.createElement("canvas");cv.width=768;cv.height=768;
    var c2=cv.getContext("2d");
    imgs.forEach(function(t){c2.drawImage(t.im,(t.dx+1)*256,(t.dy+1)*256);});
    var px=c2.getImageData(0,0,768,768).data;
    function pix(ax,ay){
      ax=Math.max(0,Math.min(767,ax|0));ay=Math.max(0,Math.min(767,ay|0));
      var o=(ay*768+ax)*4;return [px[o],px[o+1],px[o+2]];
    }
    var n=Math.pow(2,z);
    for(var gx=-6000;gx<6000;gx+=400)for(var gz=-6000;gz<6000;gz+=400){
      var ll=terrLonLat(gx+200,gz+200);
      var gxp=(((ll[0]+180)/360*n)-(c[0]-1))*256;
      var lr=ll[1]*Math.PI/180;
      var gyp=((1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n-(c[1]-1))*256;
      var r=0,g=0,b=0,k=0;
      for(var ox=-1;ox<=1;ox++)for(var oy=-1;oy<=1;oy++){
        var cc=pix(gxp+ox*3,gyp+oy*3);r+=cc[0];g+=cc[1];b+=cc[2];k++;
      }
      S.terr.grid[gx+","+gz]=[Math.round(r/k),Math.round(g/k),Math.round(b/k)];
    }
    S.terr.ready=true;
  }catch(e){/* terrain must never break the sim */}
}
function terrColor(S,gx,gz){ return S.terr.grid[gx+","+gz]||null; }
/* ---- rendering: cockpit view, modern jet-game-grade effects ----
   Physics, controls, lessons, AI instructor and demo autopilot are untouched;
   this function only paints. Effects: sun-position sky + day cycle + stars,
   shaded two-layer clouds, procedural training terrain + river, afterburner
   glow + heat shimmer, wingtip vapor, exhaust particles, camera shake,
   speed lines. Cockpit-attached effects (reticle, AB glow) skip the shake. */
FlightSim.prototype.render=function(){
  var S=this,ctx=S.ctx,W=S.W,H=S.H;
  var T=S.gfx; if(!(T>=0&&T<=5))T=S.gfx=4;
  var F=H*1.15,cx=W/2;
  var pitchR=S.pitch*Math.PI/180,rollR=S.roll*Math.PI/180;
  /* chase camera: behind + above the aircraft, looking at it */
  var camX=S.x, camZ=S.z, camAlt=S.alt;
  if(S.view===2){
    var chr=S.hdg*Math.PI/180;
    camX=S.x-Math.sin(chr)*40; camZ=S.z-Math.cos(chr)*40; camAlt=S.alt+14;
  }
  var horY=H/2+S.pitch*7;
  var spdK=S.craft.max>0?S.speed/S.craft.max:0;
  var abOn=S.craft.max>=150&&S.throttle>0.8&&!S.crashed;
  /* sun + palette from time of day */
  var sunEl=Math.sin((S.tod-0.25)*2*Math.PI)*1.05;
  var pal=skyPal(sunEl),starA=pal[2];
  /* camera shake from speed + afterburner (world only, never the overlays) */
  var shk=(S.paused||S.crashed||T===0)?0:(spdK*spdK*5+(abOn?S.throttle*4:0));
  ctx.save();
  ctx.translate((Math.random()-0.5)*2*shk,(Math.random()-0.5)*2*shk);
  /* sky */
  var g=ctx.createLinearGradient(0,-60,0,H);
  g.addColorStop(0,pal[0][0]);g.addColorStop(0.55,pal[0][1]);g.addColorStop(1,pal[0][2]);
  ctx.fillStyle=g;ctx.fillRect(-20,-60,W+40,H+120);
  /* stars at night (tier 2+) */
  if(starA>0.02&&T>=2){
    for(var si=0;si<S.stars.length;si++){var st=S.stars[si];
      ctx.fillStyle="rgba(255,255,255,"+(starA*(0.35+0.4*Math.abs(Math.sin(S.fxT*1.5+st.tw)))).toFixed(3)+")";
      ctx.fillRect(st.x,st.y,st.r,st.r);}
  }
  /* sun with glow + flare, positioned by heading/pitch */
  var relB=(60-S.hdg)*Math.PI/180;
  while(relB>Math.PI)relB-=2*Math.PI;while(relB<-Math.PI)relB+=2*Math.PI;
  var sunX=cx+Math.tan(Math.max(-1.2,Math.min(1.2,relB)))*F*0.9;
  var sunY=horY-Math.tan(sunEl-pitchR)*F;
  if(Math.abs(relB)<1.2&&sunY>-90&&sunY<H+90){
    var sg=ctx.createRadialGradient(sunX,sunY,8,sunX,sunY,130);
    sg.addColorStop(0,"rgba(255,244,200,.95)");sg.addColorStop(0.25,"rgba(255,220,150,.55)");sg.addColorStop(1,"rgba(255,200,120,0)");
    ctx.fillStyle=sg;ctx.fillRect(sunX-130,sunY-130,260,260);
    ctx.fillStyle="rgba(255,246,205,.95)";ctx.beginPath();ctx.arc(sunX,sunY,30,0,7);ctx.fill();
    var fg=ctx.createLinearGradient(sunX-220,0,sunX+220,0);
    fg.addColorStop(0,"rgba(255,220,160,0)");fg.addColorStop(0.5,"rgba(255,220,160,.35)");fg.addColorStop(1,"rgba(255,220,160,0)");
    ctx.fillStyle=fg;ctx.fillRect(sunX-220,sunY-3,440,6);
  }
  /* rotated world */
  ctx.save();ctx.translate(cx,horY);ctx.rotate(-rollR);ctx.translate(-cx,-horY);
  /* ground base */
  var gg=ctx.createLinearGradient(0,horY,0,H+200);
  gg.addColorStop(0,pal[1][0]);gg.addColorStop(1,pal[1][1]);
  ctx.fillStyle=gg;ctx.fillRect(-W,horY,W*3,H*2);
  var h=S.hdg*Math.PI/180,fx=Math.sin(h),fz=Math.cos(h),rx=Math.cos(h),rz=-Math.sin(h);
  function proj(wx,wz,wy){
    var dx=wx-camX,dz=wz-camZ;
    var fwd=dx*fx+dz*fz,lat=dx*rx+dz*rz;
    if(fwd<8)return null;
    return [cx+(lat/fwd)*F, horY+((camAlt-(wy||0))/fwd)*F];
  }
  /* procedural training-terrain patchwork (decorative, deterministic) */
  var TS=400,gx0=Math.floor((camX-1400)/TS)*TS;
  var FIELDS=["#5a9a4a","#7aa04c","#a08a4a","#4a7a3a","#8a9a5a","#6a8a42"];
  for(var gx=gx0;gx<camX+1400;gx+=TS){
    for(var gz=Math.floor(camZ/TS)*TS;gz<camZ+1800;gz+=TS){
      var q0=proj(gx,gz,0),q1=proj(gx+TS,gz,0),q2=proj(gx+TS,gz+TS,0),q3=proj(gx,gz+TS,0);
      if(!q0||!q1||!q2||!q3)continue;
      var hh=Math.abs(Math.sin(gx*12.9898+gz*78.233)*43758.5453)%1;
      if(hh>0.88)continue;
      var da=Math.max(0.18,0.6-Math.abs((q0[1]+q2[1])/2-horY)/900);
      var tc=(T>=4)?terrColor(S,gx,gz):null;
      if(tc){ /* real aerial-imagery ground color (tier PS3+) */
        var dk=0.55+0.45*Math.min(1,Math.max(0,(sunEl+0.3)/0.8));
        ctx.fillStyle="rgba("+Math.round(tc[0]*dk)+","+Math.round(tc[1]*dk)+","+Math.round(tc[2]*dk)+","+da.toFixed(3)+")";
      }else if(T===0){ /* 16-BIT: flat */
        ctx.fillStyle=FIELDS[Math.floor(hh*6)%6];
      }else if(T===2){ /* PLAYSTATION: quantized 15-bit-ish */
        var qc=FIELDS[Math.floor(hh*6)%6];
        var qr=Math.round(parseInt(qc.slice(1,3),16)/8)*8, qg=Math.round(parseInt(qc.slice(3,5),16)/8)*8, qb=Math.round(parseInt(qc.slice(5,7),16)/8)*8;
        ctx.fillStyle=hexA("#"+((qr<16?"0":"")+qr.toString(16))+((qg<16?"0":"")+qg.toString(16))+((qb<16?"0":"")+qb.toString(16)),da);
      }else{
        ctx.fillStyle=hexA(FIELDS[Math.floor(hh*6)%6],da);
      }
      ctx.beginPath();ctx.moveTo(q0[0],q0[1]);ctx.lineTo(q1[0],q1[1]);ctx.lineTo(q2[0],q2[1]);ctx.lineTo(q3[0],q3[1]);ctx.closePath();ctx.fill();
    }
  }
  /* training nav grid */
  ctx.strokeStyle=T===0?"rgba(255,255,255,.35)":"rgba(255,255,255,.22)";ctx.lineWidth=1;
  for(var lat=-600;lat<=600;lat+=120){
    ctx.beginPath();var started=false;
    for(var d=20;d<2600;d+=60){
      var wx3=camX+lat*rx+d*fx, wz3=camZ+lat*rz+d*fz;
      var r2=proj(wx3,wz3,0);
      if(r2){if(!started){ctx.moveTo(r2[0],r2[1]);started=true;}else ctx.lineTo(r2[0],r2[1]);}
    }
    ctx.stroke();
  }
  for(var dd=120;dd<2600;dd+=160){
    ctx.beginPath();var st2=false;
    for(var la=-600;la<=600;la+=60){
      var wx4=camX+la*rx+dd*fx, wz4=camZ+la*rz+dd*fz;
      var r3=proj(wx4,wz4,0);
      if(r3){if(!st2){ctx.moveTo(r3[0],r3[1]);st2=true;}else ctx.lineTo(r3[0],r3[1]);}
    }
    ctx.stroke();
  }
  /* runway: |x|<20, -60<z<700 */
  var rc=[[-20,-60],[20,-60],[20,700],[-20,700]].map(function(c){return proj(c[0],c[1],0);});
  if(rc[0]&&rc[3]){
    ctx.fillStyle="#3d3d3d";ctx.beginPath();
    ctx.moveTo(rc[0][0],rc[0][1]);
    for(var ri=1;ri<4;ri++)if(rc[ri])ctx.lineTo(rc[ri][0],rc[ri][1]);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle="#fff";ctx.setLineDash([14,10]);ctx.lineWidth=3;
    var c1=proj(0,-40,0),c2=proj(0,680,0);
    if(c1&&c2){ctx.beginPath();ctx.moveTo(c1[0],c1[1]);ctx.lineTo(c2[0],c2[1]);ctx.stroke();}
    ctx.setLineDash([]);
  }
  /* river (decorative) */
  ctx.fillStyle="rgba(80,150,210,.8)";
  for(var rvx=Math.floor((camX-2000)/200)*200;rvx<camX+2000;rvx+=200){
    var rvz=2200+500*Math.sin(rvx*0.0009)+180*Math.sin(rvx*0.0027+1.3);
    var rp=proj(rvx,rvz,0);
    if(rp){var rr=Math.min(60,F*36/Math.max(60,Math.hypot(rvx-camX,rvz-camZ)));
      ctx.beginPath();ctx.arc(rp[0],rp[1],rr,0,7);ctx.fill();}
  }
  /* cloud layers (tier-gated count) */
  var cn=CLOUD_N[T]||0;
  if(T===0){ drawClouds(ctx,S,S.clouds.slice(0,10),false,proj,F,H,true); }
  else{ drawClouds(ctx,S,S.clouds.slice(0,Math.min(cn,S.clouds.length)),false,proj,F,H,false);
    if(T>=1)drawClouds(ctx,S,S.cloudsHi,true,proj,F,H,false); }
  /* smoke trail (button 8) */
  if(S.smoke&&!S.onGround){
    S.trail.forEach(function(p,i){
      ctx.fillStyle="rgba(255,255,255,"+(0.5*(1-p.t/3))+")";
      ctx.beginPath();ctx.arc(cx+(i-S.trail.length)*2,H*0.52-p.t*30,10,0,7);ctx.fill();
    });
  }
  ctx.restore();
  /* night dim over the world */
  if(starA>0.02){ctx.fillStyle="rgba(6,10,28,"+(starA*0.45).toFixed(3)+")";ctx.fillRect(-20,-60,W+40,H+120);}
  /* hills silhouette (unrotated) */
  ctx.fillStyle="rgba(20,60,40,.85)";ctx.beginPath();ctx.moveTo(-20,horY);
  for(var hx=-20;hx<=W+20;hx+=20){
    var hhl=Math.sin((hx+S.hdg*4)*0.02)*26+Math.sin((hx+S.hdg*9)*0.05)*10;
    ctx.lineTo(hx,horY+hhl-14);
  }
  ctx.lineTo(W+20,horY);ctx.closePath();ctx.fill();
  ctx.restore(); /* end camera shake */
  /* god rays (PS3+) + BEYOND light streaks */
  if(T>=4&&Math.abs(relB)<1.2&&sunY>-90&&sunY<H+90&&sunEl>0&&!S.paused){
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(var gr=-2;gr<=2;gr++){
      var grg=ctx.createLinearGradient(sunX,sunY,sunX+gr*160,H);
      grg.addColorStop(0,"rgba(255,230,170,"+(T>=5?0.10:0.06).toFixed(3)+")");
      grg.addColorStop(1,"rgba(255,230,170,0)");
      ctx.fillStyle=grg;
      ctx.beginPath();ctx.moveTo(sunX,sunY);ctx.lineTo(sunX+gr*40-14,sunY);
      ctx.lineTo(sunX+gr*160,H);ctx.lineTo(sunX+gr*160+40,H);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  if(T>=5&&!S.paused&&!S.crashed){
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(var ls=0;ls<3;ls++){
      var lx=((S.fxT*70*(ls+1))%(W+400))-200, lo=0.05+0.02*Math.sin(S.fxT*2+ls);
      var lg=ctx.createLinearGradient(lx,0,lx+120,H);
      lg.addColorStop(0,"rgba(160,220,255,0)");
      lg.addColorStop(0.5,"rgba(160,220,255,"+lo.toFixed(3)+")");
      lg.addColorStop(1,"rgba(160,220,255,0)");
      ctx.fillStyle=lg;ctx.fillRect(lx,0,120,H);
    }
    ctx.restore();
  }
  /* chase view: draw our aircraft */
  if(S.view===2&&!S.crashed){
    var ap=proj(S.x,S.z,S.alt);
    if(ap)drawAircraft(ctx,S,ap[0],ap[1],T);
  }
  /* ---- cockpit-attached effects (no shake) ---- */
  var pi,pt;
  for(pi=0;pi<S.parts.length;pi++){pt=S.parts[pi];
    ctx.fillStyle="rgba(200,200,200,"+(0.32*(1-pt.t/pt.life)).toFixed(3)+")";
    ctx.beginPath();ctx.arc(pt.x,pt.y,Math.max(0.5,pt.s*(1-pt.t/pt.life*0.5)),0,7);ctx.fill();}
  /* afterburner glow + heat shimmer */
  if(abOn){
    var fl=0.7+0.3*Math.sin(S.fxT*43)+0.15*Math.sin(S.fxT*29+1);
    var by=H*0.99;
    var rg=ctx.createRadialGradient(cx,by,10,cx,by,150*Math.max(0.4,fl));
    rg.addColorStop(0,"rgba(255,200,120,.85)");rg.addColorStop(0.4,"rgba(255,120,40,.45)");rg.addColorStop(1,"rgba(255,80,20,0)");
    ctx.fillStyle=rg;ctx.fillRect(cx-160,by-170,320,180);
    ctx.fillStyle="rgba(180,220,255,.9)";
    ctx.beginPath();ctx.ellipse(cx,by-24,26*fl,44*fl,0,0,7);ctx.fill();
    ctx.fillStyle="rgba(255,240,200,.95)";
    ctx.beginPath();ctx.ellipse(cx,by-20,13*fl,30*fl,0,0,7);ctx.fill();
    for(var shi=0;shi<3;shi++){
      ctx.fillStyle="rgba(255,255,255,.06)";
      var swy=by-90-shi*46+Math.sin(S.fxT*9+shi*2)*8;
      ctx.fillRect(cx-120+Math.sin(S.fxT*7+shi)*10,swy,240,16);
    }
  }
  /* wingtip vapor at high G */
  var gLd=Math.abs(S.roll)/55*spdK;
  if(gLd>0.45&&!S.onGround&&!S.paused&&!S.crashed){
    var va=Math.min(0.5,(gLd-0.45)*1.4);
    for(var vs=-1;vs<=1;vs+=2){
      var vg=ctx.createLinearGradient(vs<0?0:W,0,vs<0?W*0.35:W*0.65,0);
      vg.addColorStop(0,"rgba(255,255,255,"+va.toFixed(3)+")");vg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=vg;
      ctx.fillRect(vs<0?0:W*0.65,H*0.30,W*0.35,H*0.44);
    }
  }
  /* speed lines (tier 1+) */
  if(spdK>0.6&&T>=1&&!S.paused&&!S.crashed){
    ctx.strokeStyle="rgba(255,255,255,"+(0.08+0.14*(spdK-0.6)).toFixed(3)+")";ctx.lineWidth=2;
    for(var sl=0;sl<16;sl++){
      var ang=(sl/16)*Math.PI*2+S.fxT*0.3;
      var r0=Math.min(W,H)*0.42, r1=r0+40+80*(spdK-0.6);
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(ang)*r0,H*0.52+Math.sin(ang)*r0);
      ctx.lineTo(cx+Math.cos(ang)*r1,H*0.52+Math.sin(ang)*r1);
      ctx.stroke();
    }
  }
  /* nose reticle (not in chase view — you can see the aircraft) */
  if(S.view!==2){
  ctx.strokeStyle="#ffdf5a";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(cx,H*0.52,16,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-26,H*0.52);ctx.lineTo(cx-10,H*0.52);ctx.moveTo(cx+10,H*0.52);ctx.lineTo(cx+26,H*0.52);ctx.stroke();
  }
  /* map view */
  if(S.mapView){
    ctx.fillStyle="rgba(4,12,26,.92)";ctx.fillRect(W-216,54,200,200);
    ctx.strokeStyle="#4da6ff";ctx.strokeRect(W-216,54,200,200);
    var mx=function(x){return W-116+x*0.06;},mz=function(z){return 154+z*0.06;};
    ctx.fillStyle="#3d3d3d";ctx.fillRect(mx(-20),mz(-60),40*0.06,760*0.06);
    ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.arc(mx(S.x),mz(S.z),5,0,7);ctx.fill();
    ctx.strokeStyle="#ffdf5a";ctx.beginPath();ctx.moveTo(mx(S.x),mz(S.z));
    ctx.lineTo(mx(S.x)+Math.sin(h)*24,mz(S.z)+Math.cos(h)*24);ctx.stroke();
    if(S.demo)S.demo.waypoints.forEach(function(w){
      ctx.fillStyle="#37d67a";ctx.fillRect(mx(w[0])-3,mz(w[1])-3,6,6);});
    ctx.fillStyle="#9db4d8";ctx.font="12px Arial";ctx.fillText("MAP — runway gray",W-208,72);
  }
  /* working cockpit (view 1) — drawn before the paused overlay */
  if(S.view===1&&!S.crashed)drawCockpit(ctx,S,W,H,T);
  /* paused / crashed overlays */
  if(S.paused){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";ctx.font="bold 40px Arial";ctx.textAlign="center";ctx.fillText("PAUSED",cx,H/2);ctx.textAlign="left";}
}
/* ---- working cockpit: live instrument panel (tier-gated steam/glass) ---- */
function gaugeFace(ctx,x,y,r){
  ctx.fillStyle="#0b0e15";ctx.beginPath();ctx.arc(x,y,r+7,0,7);ctx.fill();
  var g=ctx.createRadialGradient(x-r*0.3,y-r*0.35,r*0.1,x,y,r);
  g.addColorStop(0,"#f7f9fc");g.addColorStop(1,"#c4cede");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
}
function gaugeLabel(ctx,x,y,t){
  ctx.fillStyle="#e8ecf4";ctx.font="bold 11px Arial";ctx.textAlign="center";
  ctx.fillText(t,x,y);ctx.textAlign="left";
}
function needle(ctx,x,y,r,ang,color){
  ctx.strokeStyle=color||"#d23b3b";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x+Math.cos(ang)*r*0.88,y+Math.sin(ang)*r*0.88);ctx.stroke();
  ctx.fillStyle="#222";ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();
}
function drawSteam(ctx,S,W,H,py,iasKt,altFt,vsiFpm){
  var xs=[82,222,362,598,738,878], y=py+102, r=56, i;
  var vmax=Math.ceil(S.craft.max*1.944*1.15/50)*50;
  for(i=0;i<6;i++)gaugeFace(ctx,xs[i],y,r);
  /* 0: airspeed */
  (function(x){
    ctx.fillStyle="#333";ctx.font="9px Arial";ctx.textAlign="center";
    for(var v=0;v<=vmax;v+=20){var a=Math.PI*0.75+v/vmax*Math.PI*1.5;
      ctx.fillText(v%40?"":v,x+Math.cos(a)*r*0.78,y+Math.sin(a)*r*0.78+3);}
    needle(ctx,x,y,r,Math.PI*0.75+Math.min(1,iasKt/vmax)*Math.PI*1.5);
    gaugeLabel(ctx,x,y+r+22,"AIRSPEED kt");
    ctx.fillStyle="#0b0e15";ctx.fillRect(x-26,y+r+28,52,16);
    ctx.fillStyle="#7dff9a";ctx.font="bold 12px Arial";ctx.fillText(Math.round(iasKt),x,y+r+41);
    ctx.textAlign="left";
  })(xs[0]);
  /* 1: attitude indicator */
  (function(x){
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.clip();
    ctx.translate(x,y);ctx.rotate(-S.roll*Math.PI/180);ctx.translate(0,S.pitch*1.7);
    ctx.fillStyle="#3f7fe0";ctx.fillRect(-r,-r*2,r*2,r*2);
    ctx.fillStyle="#8a5a28";ctx.fillRect(-r,0,r*2,r*2);
    ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=1;
    for(var p=-20;p<=20;p+=10){if(!p)continue;
      ctx.beginPath();ctx.moveTo(-22,p*1.7);ctx.lineTo(22,p*1.7);ctx.stroke();}
    ctx.restore();
    ctx.strokeStyle="#ffdf5a";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(x-34,y);ctx.lineTo(x-10,y);ctx.lineTo(x-10,y+7);ctx.moveTo(x+34,y);ctx.lineTo(x+10,y);ctx.lineTo(x+10,y+7);ctx.stroke();
    ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();
    gaugeLabel(ctx,x,y+r+22,"ATTITUDE");
  })(xs[1]);
  /* 2: altimeter */
  (function(x){
    ctx.fillStyle="#333";ctx.font="9px Arial";ctx.textAlign="center";
    for(var d=0;d<10;d++){var a=Math.PI*0.75+d/10*Math.PI*1.5;
      ctx.fillText(d,x+Math.cos(a)*r*0.78,y+Math.sin(a)*r*0.78+3);}
    var th=(altFt/1000)%10, hd=(altFt/100)%10;
    needle(ctx,x,y,r,Math.PI*0.75+th/10*Math.PI*1.5,"#333");
    needle(ctx,x,y,r*0.62,Math.PI*0.75+hd/10*Math.PI*1.5);
    gaugeLabel(ctx,x,y+r+22,"ALTITUDE ft");
    ctx.fillStyle="#0b0e15";ctx.fillRect(x-30,y+r+28,60,16);
    ctx.fillStyle="#7dff9a";ctx.font="bold 12px Arial";ctx.fillText(Math.round(altFt),x,y+r+41);
    ctx.textAlign="left";
  })(xs[2]);
  /* 3: turn coordinator */
  (function(x){
    var bank=Math.max(-30,Math.min(30,S.rollRate*10));
    ctx.save();ctx.translate(x,y);ctx.rotate(bank*Math.PI/180);
    ctx.fillStyle="#333";
    ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(26,10);ctx.lineTo(8,10);ctx.lineTo(8,22);ctx.lineTo(-8,22);ctx.lineTo(-8,10);ctx.lineTo(-26,10);ctx.closePath();ctx.fill();
    ctx.restore();
    var ball=Math.max(-18,Math.min(18,S.rollRate*14));
    ctx.fillStyle="#222";ctx.fillRect(x-20,y+r*0.55,40,8);
    ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.arc(x+ball,y+r*0.55+4,5,0,7);ctx.fill();
    gaugeLabel(ctx,x,y+r+22,"TURN");
  })(xs[3]);
  /* 4: heading indicator */
  (function(x){
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.clip();
    ctx.translate(x,y);ctx.rotate(-S.hdg*Math.PI/180);
    ctx.fillStyle="#1c2333";ctx.fillRect(-r,-r,r*2,r*2);
    ctx.fillStyle="#fff";ctx.font="bold 11px Arial";ctx.textAlign="center";
    var pts=[["N",0],["E",90],["S",180],["W",270]];
    for(var i=0;i<4;i++){var a=pts[i][1]*Math.PI/180;
      ctx.fillText(pts[i][0],Math.sin(a)*r*0.72,-Math.cos(a)*r*0.72+4);}
    for(var dg=0;dg<360;dg+=30){var b=dg*Math.PI/180;
      ctx.fillRect(Math.sin(b)*r*0.9-1,-Math.cos(b)*r*0.9-1,2,2);}
    ctx.restore();
    ctx.fillStyle="#ffdf5a";ctx.beginPath();
    ctx.moveTo(x-7,y-r+4);ctx.lineTo(x+7,y-r+4);ctx.lineTo(x,y-r+14);ctx.closePath();ctx.fill();
    gaugeLabel(ctx,x,y+r+22,"HEADING");
  })(xs[4]);
  /* 5: vertical speed */
  (function(x){
    ctx.fillStyle="#333";ctx.font="9px Arial";ctx.textAlign="center";
    var marks=[[-2000,"2"],[-1000,"1"],[0,"0"],[1000,"1"],[2000,"2"]];
    for(var i=0;i<marks.length;i++){var a=Math.PI*0.75+(marks[i][0]+2000)/4000*Math.PI*1.5;
      ctx.fillText(marks[i][1],x+Math.cos(a)*r*0.78,y+Math.sin(a)*r*0.78+3);}
    var k=Math.max(-2000,Math.min(2000,vsiFpm));
    needle(ctx,x,y,r,Math.PI*0.75+(k+2000)/4000*Math.PI*1.5);
    gaugeLabel(ctx,x,y+r+22,"VERT SPEED");
  })(xs[5]);
}
function drawGlass(ctx,S,W,H,py,iasKt,altFt,vsiFpm){
  /* left: speed tape */
  (function(){
    var x0=36,x1=116,y0=py+8,y1=H-8,mid=(y0+y1)/2;
    ctx.fillStyle="rgba(8,12,22,.85)";ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.fillStyle="#fff";ctx.font="10px Arial";ctx.textAlign="left";
    for(var v=Math.floor((iasKt-60)/10)*10;v<iasKt+70;v+=10){if(v<0)continue;
      var yy=mid-(v-iasKt)*2.2;if(yy<y0+6||yy>y1-6)continue;
      ctx.fillStyle=v%20?"#8fa0bd":"#fff";
      ctx.fillRect(x0+6,yy,v%20?8:14,1);
      if(v%20===0)ctx.fillText(v,x0+24,yy+3);}
    ctx.fillStyle="#0b0e15";ctx.fillRect(x0-8,mid-11,x1-x0+8,22);
    ctx.strokeStyle="#37d67a";ctx.strokeRect(x0-8,mid-11,x1-x0+8,22);
    ctx.fillStyle="#7dff9a";ctx.font="bold 15px Arial";ctx.fillText(Math.round(iasKt),x0+2,mid+5);
    gaugeLabel(ctx,(x0+x1)/2,y1+14,"KNOTS");ctx.textAlign="left";
  })();
  /* center: big attitude */
  (function(){
    var x0=140,x1=820,y0=py+8,y1=H-52;
    ctx.save();ctx.beginPath();ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip();
    ctx.translate((x0+x1)/2,(y0+y1)/2);ctx.rotate(-S.roll*Math.PI/180);
    ctx.translate(0,S.pitch*2.4);
    var g=ctx.createLinearGradient(0,-300,0,300);
    g.addColorStop(0,"#2f6fe4");g.addColorStop(0.5,"#2f6fe4");g.addColorStop(0.5,"#7a4d20");g.addColorStop(1,"#4a2d12");
    ctx.fillStyle=g;ctx.fillRect(-400,-300,800,600);
    ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-400,0);ctx.lineTo(400,0);ctx.stroke();
    ctx.lineWidth=1.5;ctx.font="11px Arial";ctx.fillStyle="#fff";ctx.textAlign="left";
    for(var p=-30;p<=30;p+=10){if(!p)continue;
      ctx.beginPath();ctx.moveTo(-40,p*2.4);ctx.lineTo(40,p*2.4);ctx.stroke();
      ctx.fillText(Math.abs(p),46,p*2.4+4);}
    ctx.restore();
    /* roll pointer */
    ctx.save();ctx.translate((x0+x1)/2,y0+16);ctx.rotate(-S.roll*Math.PI/180);
    ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(-7,-4);ctx.lineTo(7,-4);ctx.closePath();ctx.fill();
    ctx.restore();
    /* fixed wings */
    ctx.strokeStyle="#ffdf5a";ctx.lineWidth=5;
    var wy=(y0+y1)/2;
    ctx.beginPath();ctx.moveTo((x0+x1)/2-90,wy);ctx.lineTo((x0+x1)/2-30,wy);ctx.lineTo((x0+x1)/2-30,wy+10);
    ctx.moveTo((x0+x1)/2+90,wy);ctx.lineTo((x0+x1)/2+30,wy);ctx.lineTo((x0+x1)/2+30,wy+10);ctx.stroke();
    ctx.strokeStyle="#37d67a";ctx.strokeRect(x0,y0,x1-x0,y1-y0);
  })();
  /* right: altitude tape + VSI */
  (function(){
    var x0=844,x1=924,y0=py+8,y1=H-8,mid=(y0+y1)/2;
    ctx.fillStyle="rgba(8,12,22,.85)";ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.font="10px Arial";ctx.textAlign="left";
    for(var a=Math.floor((altFt-600)/100)*100;a<altFt+700;a+=100){if(a<0)continue;
      var yy=mid-(a-altFt)*0.09;if(yy<y0+6||yy>y1-6)continue;
      ctx.fillStyle=a%500?"#8fa0bd":"#fff";
      ctx.fillRect(x1-20,yy,a%500?8:14,1);
      if(a%500===0){ctx.fillStyle="#fff";ctx.fillText(a,x0+4,yy+3);}}
    ctx.fillStyle="#0b0e15";ctx.fillRect(x0,mid-11,x1-x0,22);
    ctx.strokeStyle="#37d67a";ctx.strokeRect(x0,mid-11,x1-x0,22);
    ctx.fillStyle="#7dff9a";ctx.font="bold 15px Arial";ctx.fillText(Math.round(altFt),x0+6,mid+5);
    /* VSI bar */
    var vk=Math.max(-1,Math.min(1,vsiFpm/2000));
    ctx.fillStyle="#222a3a";ctx.fillRect(x1+4,mid-60,8,120);
    ctx.fillStyle=vk>=0?"#37d67a":"#ff9a3d";
    ctx.fillRect(x1+4,vk>=0?mid-vk*60:mid,vk>=0?vk*60:-vk*60,8);
    ctx.fillStyle="#fff";ctx.font="10px Arial";ctx.fillText(Math.round(vsiFpm)+" fpm",x1-52,y1-4);
  })();
  /* bottom: heading strip */
  (function(){
    var y0=H-44,y1=H-8,cx=W/2;
    ctx.fillStyle="rgba(8,12,22,.9)";ctx.fillRect(cx-190,y0,380,y1-y0);
    ctx.font="bold 12px Arial";ctx.textAlign="center";
    for(var h=-60;h<=60;h+=10){
      var hh=((Math.round(S.hdg+h)+360)%360), xx=cx+h*3;
      if(xx<cx-180||xx>cx+180)continue;
      ctx.fillStyle=hh%30?"#8fa0bd":"#fff";
      ctx.fillText(hh%30?"·":hh,xx,y0+16);
      if(hh%30===0){ctx.fillRect(xx-1,y0+20,2,8);}}
    ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.moveTo(cx-7,y0);ctx.lineTo(cx+7,y0);ctx.lineTo(cx,y0+9);ctx.closePath();ctx.fill();
    ctx.fillStyle="#7dff9a";ctx.font="bold 13px Arial";ctx.fillText(Math.round(S.hdg)+"°",cx,y1-6);
    ctx.textAlign="left";
  })();
}
function drawGpsInset(ctx,S,W,H,py){
  var w=176,h2=132,x0=W-w-14,y0=py-h2-12;
  ctx.fillStyle="rgba(6,10,20,.88)";ctx.fillRect(x0,y0,w,h2);
  ctx.strokeStyle="#37d67a";ctx.lineWidth=2;ctx.strokeRect(x0,y0,w,h2);
  var sc=0.09, mx=function(x){return x0+w/2+x*sc;}, mz=function(z){return y0+h2/2+z*sc;};
  ctx.strokeStyle="rgba(120,255,160,.25)";
  for(var r2=20;r2<70;r2+=20){ctx.beginPath();ctx.arc(x0+w/2,y0+h2/2,r2,0,7);ctx.stroke();}
  ctx.fillStyle="#555";ctx.fillRect(mx(-20),mz(-60),40*sc,760*sc);
  ctx.fillStyle="#7dff9a";ctx.fillText("N",x0+w/2-3,y0+12);
  var hr=S.hdg*Math.PI/180;
  ctx.save();ctx.translate(mx(S.x),mz(S.z));ctx.rotate(hr);
  ctx.fillStyle="#ffdf5a";ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,7);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();
  ctx.restore();
  ctx.fillStyle="#9db4d8";ctx.font="10px Arial";ctx.fillText("GPS",x0+6,y0+12);
}
function drawCockpit(ctx,S,W,H,T){
  var iasKt=S.speed*1.944, altFt=S.alt*3.281, vsiFpm=S.vy*196.85;
  S._gauges={iasKt:iasKt,altFt:altFt,vsiFpm:vsiFpm,hdg:S.hdg,roll:S.roll,pitch:S.pitch,
    thr:S.throttle,gear:S.gear,flaps:S.flaps};
  var py=H-196;
  var pg=ctx.createLinearGradient(0,py,0,H);
  pg.addColorStop(0,"#1c2333");pg.addColorStop(0.1,"#2c3550");pg.addColorStop(1,"#0e121b");
  ctx.fillStyle=pg;ctx.fillRect(0,py,W,H-py);
  ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,py,W,9);
  /* window pillars */
  ctx.fillStyle="#131824";
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(56,0);ctx.lineTo(30,py);ctx.lineTo(0,py);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(W-56,0);ctx.lineTo(W-30,py);ctx.lineTo(W,py);ctx.closePath();ctx.fill();
  if(T>=3)drawGlass(ctx,S,W,H,py,iasKt,altFt,vsiFpm);
  else drawSteam(ctx,S,W,H,py,iasKt,altFt,vsiFpm);
  drawGpsInset(ctx,S,W,H,py);
  /* annunciators */
  ctx.font="bold 11px Arial";ctx.textAlign="left";
  var ax=14,ay=py+22;
  function lamp(t,on,c){ctx.fillStyle=on?c:"#2a2f3a";ctx.fillRect(ax,ay-11,58,15);
    ctx.fillStyle=on?"#06121a":"#69707f";ctx.fillText(t,ax+5,ay+1);ax+=64;}
  lamp("GEAR",S.gear,"#37d67a");lamp("FLAPS",S.flaps,"#37d67a");
  lamp("BRK",S.brakes,"#ff9a3d");lamp("STALL",S.alt>1&&S.speed<S.craft.stall,"#ff4444");
  ctx.textAlign="left";
}
/* ---- 2.5D chase-view aircraft (tier-gated detail) ---- */
function drawAircraft(ctx,S,ax,ay,T){
  var C=S.craft, sz=54*(C.size||1), flat=T===0;
  var acc=C.acc||"#cccccc", wing=C.wing||"straight";
  ctx.save();ctx.translate(ax,ay);
  ctx.rotate(-S.roll*Math.PI/180*0.85);
  function poly(pts,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(pts[0],pts[1]);
    for(var i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.closePath();ctx.fill();}
  if(flat){ /* 16-BIT: flat silhouette */
    ctx.fillStyle="#e8eef7";
    if(wing==="rotor"){ctx.fillRect(-sz*0.95,-5,sz*1.9,10);ctx.fillRect(-8,-sz*0.45,16,sz*0.9);}
    else{
      var sw=wing==="glider"?1.5:wing==="delta"?0.8:1.0;
      poly([-sz*0.85*sw,-sz*0.1, -sz*0.2,-sz*0.42, sz*0.2,-sz*0.42, sz*0.85*sw,-sz*0.1,
             sz*0.2,sz*0.12, -sz*0.2,sz*0.12],"#e8eef7");
      poly([-sz*0.12,-sz*0.72, sz*0.12,-sz*0.72, sz*0.2,sz*0.3, -sz*0.2,sz*0.3],"#cfd8e8");
    }
    ctx.restore();return;
  }
  var dk=T===2; /* PLAYSTATION: flatter shading */
  /* wings */
  var span=sz*0.9*(wing==="glider"?1.6:wing==="delta"?0.75:wing==="heavy"?1.15:1.0);
  var sweep=wing==="swept"?0.35:wing==="delta"?0.55:wing==="rocket"?0.15:0.08;
  var wg=ctx.createLinearGradient(0,-sz*0.3,0,sz*0.25);
  if(dk){wg.addColorStop(0,"#b9c4d6");wg.addColorStop(1,"#7d8aa0");}
  else{wg.addColorStop(0,"#f4f8ff");wg.addColorStop(0.5,"#c3cede");wg.addColorStop(1,"#8b98ad");}
  poly([-span,-sz*0.05+span*sweep*0.3, -sz*0.14,-sz*0.3, sz*0.14,-sz*0.3, span,-sz*0.05+span*sweep*0.3,
         span*0.9,sz*0.18, -span*0.9,sz*0.18],wg);
  /* livery wingtip accents */
  ctx.fillStyle=acc;
  poly([-span,-sz*0.05+span*sweep*0.3, -span*0.82,-sz*0.05+span*sweep*0.3*0.9, -span*0.82,sz*0.1, -span*0.94,sz*0.14],acc);
  poly([span,-sz*0.05+span*sweep*0.3, span*0.82,-sz*0.05+span*sweep*0.3*0.9, span*0.82,sz*0.1, span*0.94,sz*0.14],acc);
  if(wing==="delta"){ /* delta: big triangle wing */
    poly([-sz*0.14,-sz*0.55, sz*0.14,-sz*0.55, span,sz*0.25, -span,sz*0.25],wg);
  }
  if(wing==="heavy"){ /* 4 engine nacelles */
    for(var e=-1.5;e<=1.5;e++){ if(e===0)continue;
      ctx.fillStyle=dk?"#6a7488":"#9aa6bb";
      ctx.beginPath();ctx.ellipse(e*span*0.42,sz*0.02,sz*0.09,sz*0.16,0,0,7);ctx.fill(); }
  }
  /* fuselage: nose away (up-screen), tail toward camera */
  var fg=ctx.createLinearGradient(-sz*0.2,0,sz*0.2,0);
  if(dk){fg.addColorStop(0,"#aeb9cc");fg.addColorStop(1,"#78849a");}
  else{fg.addColorStop(0,"#ffffff");fg.addColorStop(0.45,"#d7e0ef");fg.addColorStop(1,"#93a0b5");}
  poly([-sz*0.13,-sz*0.62, sz*0.13,-sz*0.62, sz*0.22,sz*0.34, -sz*0.22,sz*0.34],fg);
  /* livery cheatline */
  ctx.fillStyle=acc;ctx.fillRect(-sz*0.145,-sz*0.3,sz*0.29,sz*0.09);
  /* canopy */
  var cg=ctx.createLinearGradient(0,-sz*0.5,0,-sz*0.28);
  cg.addColorStop(0,"#0e1a2e");cg.addColorStop(1,"#3d5a80");
  ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(0,-sz*0.4,sz*0.085,sz*0.13,0,0,7);ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.55)";
  ctx.beginPath();ctx.ellipse(-sz*0.03,-sz*0.44,sz*0.028,sz*0.07,-0.3,0,7);ctx.fill();
  /* tailplane + fin */
  poly([-sz*0.34,sz*0.3, -sz*0.1,sz*0.2, sz*0.1,sz*0.2, sz*0.34,sz*0.3,
         sz*0.3,sz*0.44, -sz*0.3,sz*0.44],dk?"#8b96ab":"#b3bfd3");
  poly([-sz*0.05,sz*0.28, sz*0.05,sz*0.28, sz*0.09,sz*0.62, -sz*0.09,sz*0.62],
        dk?"#8b96ab":"#aeb9cc");
  ctx.fillStyle=acc;ctx.fillRect(-sz*0.09,sz*0.5,sz*0.18,sz*0.07);
  if(wing==="rotor"){ /* helicopter rotor disc */
    ctx.fillStyle="rgba(30,34,44,.35)";
    ctx.beginPath();ctx.ellipse(0,-sz*0.15,sz*1.05,sz*0.16,0,0,7);ctx.fill();
    ctx.fillStyle="#2c3340";ctx.fillRect(-4,-sz*0.5,8,sz*0.4);
  }
  if(wing==="rocket"){ /* rocket fins */
    poly([-sz*0.13,sz*0.1, -sz*0.3,sz*0.5, -sz*0.1,sz*0.42],acc);
    poly([sz*0.13,sz*0.1, sz*0.3,sz*0.5, sz*0.1,sz*0.42],acc);
  }
  if(C.prop){ /* prop blur */
    ctx.fillStyle="rgba(200,210,225,.4)";
    ctx.beginPath();ctx.ellipse(0,-sz*0.66,sz*0.3,sz*0.05,0,0,7);ctx.fill();
  }
  /* nav lights (tier 3+) */
  if(T>=3){
    var bl=Math.sin(S.fxT*6)>0?1:0.25;
    ctx.fillStyle="rgba(255,60,60,"+bl+")";ctx.beginPath();ctx.arc(-span*0.96,sz*0.05,4,0,7);ctx.fill();
    ctx.fillStyle="rgba(60,255,120,"+bl+")";ctx.beginPath();ctx.arc(span*0.96,sz*0.05,4,0,7);ctx.fill();
  }
  /* afterburner flame (jets) */
  if(S.craft.max>=150&&S.throttle>0.8&&!S.crashed&&T>=1){
    var fl=0.7+0.3*Math.sin(S.fxT*43);
    ctx.fillStyle="rgba(120,180,255,.85)";
    ctx.beginPath();ctx.ellipse(0,sz*0.42,10*fl,26*fl,0,0,7);ctx.fill();
    ctx.fillStyle="rgba(255,220,150,.9)";
    ctx.beginPath();ctx.ellipse(0,sz*0.4,5*fl,15*fl,0,0,7);ctx.fill();
  }
  ctx.restore();
}
window.FlightSim=FlightSim;
})();
