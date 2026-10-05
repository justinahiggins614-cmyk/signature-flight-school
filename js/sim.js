/* The Signature Flight School — canvas flight simulator engine.
   Pseudo-3D: projected ground grid, runway, hills, clouds, HUD.
   Used by sim.html (interactive) and demo mode (AI autopilot). */
(function(){
"use strict";
/* craft physics, keyed by aircraft id (speeds m/s) */
var CRAFTS={
 t1:{max:42,stall:18,accel:5.5,turn:26,pitchK:2.4,rollK:3.2,name:"Skyhopper T-1 Trainer"},
 c2:{max:48,stall:20,accel:6.0,turn:26,pitchK:2.4,rollK:3.2,name:"Cloudrunner C-2"},
 g1:{max:32,stall:14,accel:0.0,turn:22,pitchK:2.0,rollK:2.8,name:"Albatross G-1 Glider"},
 h4:{max:55,stall:8,accel:7.0,turn:34,pitchK:2.8,rollK:3.6,name:"Whirlybird H-4"},
 r3:{max:75,stall:26,accel:9.0,turn:38,pitchK:3.0,rollK:4.0,name:"Dart Racer R-3"},
 c9:{max:150,stall:55,accel:11,turn:22,pitchK:2.0,rollK:2.6,name:"Comet Cruiser C-9"},
 a6:{max:52,stall:22,accel:6.5,turn:26,pitchK:2.4,rollK:3.2,name:"Sunseeker A-6 Amphibian"},
 j7:{max:260,stall:80,accel:22,turn:34,pitchK:3.2,rollK:4.2,name:"Thunderbolt J-7"},
 g800:{max:175,stall:65,accel:9.0,turn:16,pitchK:1.6,rollK:2.0,name:"Sky Giant G-800"},
 s5:{max:300,stall:90,accel:26,turn:36,pitchK:3.4,rollK:4.4,name:"Stormchaser S-5"},
 n2:{max:210,stall:70,accel:16,turn:28,pitchK:2.6,rollK:3.4,name:"Night Owl N-2"},
 x1:{max:420,stall:110,accel:40,turn:30,pitchK:3.6,rollK:4.6,name:"Starhopper X-1 Rocket"}};
window.SF_CRAFTS=CRAFTS;

function FlightSim(canvas,opts){
  opts=opts||{};
  var S=this;
  S.cv=canvas; S.ctx=canvas.getContext("2d");
  S.W=960; S.H=540; canvas.width=960; canvas.height=540;
  S.craft=CRAFTS[opts.craft]||CRAFTS.t1;
  S.onEvent=opts.onEvent||function(){};
  S.ai=opts.ai!==false; S.demo=opts.demo||null; // demo = {waypoints:[[x,z,alt]..], name}
  S.reset();
}
FlightSim.prototype.reset=function(){
  var S=this;
  S.x=0;S.z=0;S.alt=0;S.hdg=0;S.pitch=0;S.roll=0;S.speed=0;S.throttle=0;
  S.onGround=true;S.airborne=false;S.crashed=false;S.frozen=false;S.landedOK=false;
  S.flaps=false;S.gear=true;S.brakes=false;S.smoke=false;S.mapView=false;S.paused=false;
  S.time=0;S.vy=0;S.stick={x:0,y:0};S.demoIdx=0;S.demoDone=false;S.trail=[];
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
  S.pitch+=(pT-S.pitch)*Math.min(1,C.pitchK*dt);
  S.roll+=(rT-S.roll)*Math.min(1,C.rollK*dt);
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
/* shaded, volumetric-looking cloud puffs */
function drawClouds(ctx,S,list,hi,proj,F,H){
  for(var i=0;i<list.length;i++){var c=list[i];
    var p=proj(c.x,c.z,c.y);if(!p)continue;
    if(p[1]<-180||p[1]>H+180)continue;
    var s2=Math.min(c.s*F/Math.max(60,Math.hypot(c.x-S.x,c.z-S.z)),hi?170:260);
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
  for(var i=0;i<want;i++){
    if(S.parts.length<110&&Math.random()<dt*36){
      var side=Math.random()<0.5?-1:1;
      S.parts.push({x:S.W/2+side*(26+Math.random()*34),y:S.H*0.92,
        vx:side*(18+Math.random()*44),vy:110+Math.random()*130,
        t:0,life:0.35+Math.random()*0.3,s:2+Math.random()*3});
    }
  }
  for(var j=S.parts.length-1;j>=0;j--){var p=S.parts[j];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.t>=p.life)S.parts.splice(j,1);}
};
/* ---- rendering: cockpit view, modern jet-game-grade effects ----
   Physics, controls, lessons, AI instructor and demo autopilot are untouched;
   this function only paints. Effects: sun-position sky + day cycle + stars,
   shaded two-layer clouds, procedural training terrain + river, afterburner
   glow + heat shimmer, wingtip vapor, exhaust particles, camera shake,
   speed lines. Cockpit-attached effects (reticle, AB glow) skip the shake. */
FlightSim.prototype.render=function(){
  var S=this,ctx=S.ctx,W=S.W,H=S.H;
  var F=H*1.15,cx=W/2;
  var pitchR=S.pitch*Math.PI/180,rollR=S.roll*Math.PI/180;
  var horY=H/2+S.pitch*7;
  var spdK=S.craft.max>0?S.speed/S.craft.max:0;
  var abOn=S.craft.max>=150&&S.throttle>0.8&&!S.crashed;
  /* sun + palette from time of day */
  var sunEl=Math.sin((S.tod-0.25)*2*Math.PI)*1.05;
  var pal=skyPal(sunEl),starA=pal[2];
  /* camera shake from speed + afterburner (world only, never the overlays) */
  var shk=(S.paused||S.crashed)?0:(spdK*spdK*5+(abOn?S.throttle*4:0));
  ctx.save();
  ctx.translate((Math.random()-0.5)*2*shk,(Math.random()-0.5)*2*shk);
  /* sky */
  var g=ctx.createLinearGradient(0,-60,0,H);
  g.addColorStop(0,pal[0][0]);g.addColorStop(0.55,pal[0][1]);g.addColorStop(1,pal[0][2]);
  ctx.fillStyle=g;ctx.fillRect(-20,-60,W+40,H+120);
  /* stars at night */
  if(starA>0.02){
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
    var dx=wx-S.x,dz=wz-S.z;
    var fwd=dx*fx+dz*fz,lat=dx*rx+dz*rz;
    if(fwd<8)return null;
    return [cx+(lat/fwd)*F, horY+((S.alt-(wy||0))/fwd)*F];
  }
  /* procedural training-terrain patchwork (decorative, deterministic) */
  var TS=400,gx0=Math.floor((S.x-1400)/TS)*TS;
  var FIELDS=["#5a9a4a","#7aa04c","#a08a4a","#4a7a3a","#8a9a5a","#6a8a42"];
  for(var gx=gx0;gx<S.x+1400;gx+=TS){
    for(var gz=Math.floor(S.z/TS)*TS;gz<S.z+1800;gz+=TS){
      var q0=proj(gx,gz,0),q1=proj(gx+TS,gz,0),q2=proj(gx+TS,gz+TS,0),q3=proj(gx,gz+TS,0);
      if(!q0||!q1||!q2||!q3)continue;
      var hh=Math.abs(Math.sin(gx*12.9898+gz*78.233)*43758.5453)%1;
      if(hh>0.88)continue;
      var da=Math.max(0.18,0.6-Math.abs((q0[1]+q2[1])/2-horY)/900);
      ctx.fillStyle=hexA(FIELDS[Math.floor(hh*6)%6],da);
      ctx.beginPath();ctx.moveTo(q0[0],q0[1]);ctx.lineTo(q1[0],q1[1]);ctx.lineTo(q2[0],q2[1]);ctx.lineTo(q3[0],q3[1]);ctx.closePath();ctx.fill();
    }
  }
  /* training nav grid */
  ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=1;
  for(var lat=-600;lat<=600;lat+=120){
    ctx.beginPath();var started=false;
    for(var d=20;d<2600;d+=60){
      var wx3=S.x+lat*rx+d*fx, wz3=S.z+lat*rz+d*fz;
      var r2=proj(wx3,wz3,0);
      if(r2){if(!started){ctx.moveTo(r2[0],r2[1]);started=true;}else ctx.lineTo(r2[0],r2[1]);}
    }
    ctx.stroke();
  }
  for(var dd=120;dd<2600;dd+=160){
    ctx.beginPath();var st2=false;
    for(var la=-600;la<=600;la+=60){
      var wx4=S.x+la*rx+dd*fx, wz4=S.z+la*rz+dd*fz;
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
  for(var rvx=Math.floor((S.x-2000)/200)*200;rvx<S.x+2000;rvx+=200){
    var rvz=2200+500*Math.sin(rvx*0.0009)+180*Math.sin(rvx*0.0027+1.3);
    var rp=proj(rvx,rvz,0);
    if(rp){var rr=Math.min(60,F*36/Math.max(60,Math.hypot(rvx-S.x,rvz-S.z)));
      ctx.beginPath();ctx.arc(rp[0],rp[1],rr,0,7);ctx.fill();}
  }
  /* cloud layers */
  drawClouds(ctx,S,S.clouds,false,proj,F,H);
  drawClouds(ctx,S,S.cloudsHi,true,proj,F,H);
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
  /* speed lines */
  if(spdK>0.6&&!S.paused&&!S.crashed){
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
  /* nose reticle */
  ctx.strokeStyle="#ffdf5a";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(cx,H*0.52,16,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-26,H*0.52);ctx.lineTo(cx-10,H*0.52);ctx.moveTo(cx+10,H*0.52);ctx.lineTo(cx+26,H*0.52);ctx.stroke();
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
  /* paused / crashed overlays */
  if(S.paused){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";ctx.font="bold 40px Arial";ctx.textAlign="center";ctx.fillText("PAUSED",cx,H/2);ctx.textAlign="left";}
}
window.FlightSim=FlightSim;
})();
