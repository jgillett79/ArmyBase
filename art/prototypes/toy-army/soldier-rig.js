/* Toy Army style proof. Code-native jointed artwork; not production game art.
   Ground axes are equal, height rises straight up. One identity in every view. */
(function(root){
'use strict';
const W=256,H=384,P={x:128,y:330},D=300/44,STRIDE=18,A=STRIDE*D/4;
const ink='#253628',col={coat:'#728745',shade:'#516534',light:'#a4ad68',pants:'#b5a46e',pantShade:'#8e8257',boot:'#51402c',skin:'#e4b78b',strap:'#785e3c',metal:'#475248'};
const vectors={down:[0,1],up:[0,-1],right:[1,0],left:[-1,0]};
function gait(phase){
 const foot=q=>{q=((q%1)+1)%1;if(q<.5)return{depth:A-4*A*q,lift:0,planted:true};
 const t=(q-.5)*2;return{depth:-A+2*A*(-t+6*t*t-4*t*t*t),lift:Math.sin(Math.PI*t)**2*24,planted:false};};
 return{right:foot(phase),left:foot(phase+.5)};
}
function path(g,pts,fill,width=4){g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);g.closePath();g.fillStyle=fill;g.fill();if(width>0){g.strokeStyle=ink;g.lineWidth=width;g.lineJoin='round';g.stroke();}}
function oval(g,x,y,rx,ry,fill,width=4){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=fill;g.fill();if(width){g.strokeStyle=ink;g.lineWidth=width;g.stroke();}}
function limb(g,a,b,w,fill){g.lineCap='round';for(const [ww,c]of[[w+7,ink],[w,fill]]){g.strokeStyle=c;g.lineWidth=ww;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}}
function basis(direction){const f=vectors[direction]||vectors.down;return{f,r:[-f[1],f[0]]};}
function project(direction,lateral,depth,height){const{f,r}=basis(direction);return[P.x+r[0]*lateral+f[0]*depth,P.y+r[1]*lateral+f[1]*depth-height];}
function head(g,dir,top,accent,mask){
 const side=dir==='right'?1:dir==='left'?-1:0;
 if(mask){path(g,[[77,top+52],[178,top+52],[178,top+63],[77,top+63]],'#fff',0);return;}
 // Rear view shows the same helmet and hair; profile views are drawn separately.
 oval(g,128+side*7,top+76,36,38,col.skin);
 if(dir==='up')path(g,[[92,top+65],[164,top+65],[159,top+89],[97,top+89]],'#6b5033');
 else if(side){path(g,[[128,top+51],[128+side*27,top+65],[128+side*38,top+79],[128+side*20,top+91],[128-side*6,top+96]],col.skin);oval(g,128+side*25,top+74,3,4,ink,0);limb(g,[128+side*20,top+94],[128+side*29,top+93],2,ink);}
 else {oval(g,114,top+75,3.5,4.5,ink,0);oval(g,142,top+75,3.5,4.5,ink,0);g.strokeStyle=ink;g.lineWidth=2;g.beginPath();g.arc(128,top+88,10,.15,Math.PI-.15);g.stroke();}
 const grd=g.createLinearGradient(85,top,162,top+68);grd.addColorStop(0,col.light);grd.addColorStop(.55,col.coat);grd.addColorStop(1,col.shade);
 oval(g,128,top+35,54,34,grd);path(g,[[73,top+53],[179,top+53],[182,top+64],[74,top+67]],col.shade);
 path(g,[[77,top+54],[177,top+54],[177,top+61],[77,top+61]],accent,0);
 if(dir!=='up')oval(g,dir==='left'?104:dir==='right'?152:106,top+28,9,9,'#d8c578',3);
}
function draw(g,opt={}){
 const dir=vectors[opt.direction]?opt.direction:'down',pose=opt.pose||'walk',phase=opt.phase||0,accent=opt.accent||'#dba852',mask=!!opt.maskOnly;
 const idle=pose==='idle',seated=pose==='eat'||pose==='sit'||pose==='rise',feet=(pose!=='walk'&&pose!=='carry')?{right:{depth:0,lift:0},left:{depth:0,lift:0}}:gait(phase);
 const seatBlend=seated?(Number.isFinite(opt.seatBlend)?Math.max(0,Math.min(1,opt.seatBlend)):1):0;
 const moving=pose==='walk'||pose==='carry',angle=phase*2*Math.PI;
 const sway=moving?Math.sin(angle)*4:0,lean=moving?3:0;
 const hipH=114-49*seatBlend,bodyBob=idle?Math.sin(angle)*2:seated?0:moving?-3-Math.cos(angle*2)*5:0;
 const hip=hipH+bodyBob,shoulder=hip+78,headTop=30+56*seatBlend+bodyBob;

 const positions={};
 for(const name of ['left','right']){
  const lat=name==='right'?26:-26,foot=feet[name];
  let depth=foot.depth,lift=foot.lift;
  if(seated){depth=30*seatBlend;lift=0;}
  const ankleH=14+lift,deltaH=ankleH-hip,dist=Math.hypot(depth-lean,deltaH),L=64;
  const theta=Math.atan2(deltaH,depth-lean)+Math.acos(Math.min(1,dist/(2*L)));
  const knee={depth:lean+Math.cos(theta)*L,height:hip+Math.sin(theta)*L};
  positions[name]={lat,depth,lift,H:project(dir,lat+sway,lean,hip),K:project(dir,lat,knee.depth,knee.height),A:project(dir,lat,depth,ankleH),sole:project(dir,lat,depth,lift)};
 }
 if(!mask){
  // Farther leg first. The anatomical left/right identities never flip.
  const order=['left','right'].sort((a,b)=>positions[a].sole[1]-positions[b].sole[1]);
  for(const name of order){const p=positions[name];limb(g,p.H,p.K,29,col.pants);limb(g,p.K,p.A,25,col.pants);const[x,y]=p.sole;
   const s=dir==='right'?1:dir==='left'?-1:0;
   path(g,[[x-13,y-24],[x+12,y-24],[x+16+s*5,y-10],[x+15+s*5,y],[x-15+s*3,y],[x-17,y-7]],col.boot,4);limb(g,[x-10,y-9],[x+10,y-9],2,'#957a52');
  }
 }
 g.save();const offset=project(dir,sway,lean,0);g.translate(offset[0]-P.x,offset[1]-P.y);
 if(!mask){
  // Rifle belongs to anatomical LEFT shoulder in every direction, including left.
  const rifle=project(dir,(dir==='up'||dir==='down')?-60:-43,(dir==='left'||dir==='right')?-55:-8,shoulder);limb(g,[rifle[0],rifle[1]-62],[rifle[0]+8,rifle[1]+76],9,col.strap);limb(g,[rifle[0],rifle[1]-62],[rifle[0]+2,rifle[1]-35],6,col.metal);
 }
 const cy=330-shoulder,side=dir==='right'||dir==='left',half=side?31:43;
 if(!mask){
  const grad=g.createLinearGradient(90,cy,170,cy+100);grad.addColorStop(0,col.light);grad.addColorStop(.3,col.coat);grad.addColorStop(1,col.shade);
  path(g,[[128-half,cy+3],[128+half,cy+3],[128+half-6,330-hip+7],[128-half+6,330-hip+7]],grad);
  if(dir==='up'){limb(g,[100,cy+8],[128,330-hip-12],7,col.strap);limb(g,[156,cy+8],[128,330-hip-12],7,col.strap);}
  else {for(const x of side?[124]:[103,153])limb(g,[x,cy+7],[x,330-hip],7,col.strap);}
  path(g,[[128-half+3,330-hip-6],[128+half-3,330-hip-6],[128+half-3,330-hip+7],[128-half+3,330-hip+7]],col.strap);
  if(dir!=='up'){for(const x of side?[122]:[104,139])path(g,[[x,330-hip-12],[x+18,330-hip-12],[x+18,330-hip+11],[x,330-hip+11]],col.strap,3);}
 }
 for(const name of ['left','right']){
  const lat=name==='right'?46:-46,swing=moving?-Math.cos(angle+(name==='left'?Math.PI:0)-.35)*28:0;
  const S=project(dir,lat,0,shoulder-3),E=project(dir,lat,swing*.4,hip+40+Math.abs(swing)*.12),hand=project(dir,lat,swing,hip-1);
  if(pose==='carry'||pose==='collect'){hand.splice(0,2,...project(dir,lat*.55,24,hip+15));E.splice(0,2,...project(dir,lat,10,hip+24));}
  if(pose==='collect'||pose==='serve'){hand.splice(0,2,...project(dir,lat*.5,88,82));E.splice(0,2,...project(dir,lat,40,130));}
  if(seated){const eating=pose==='eat'?(.5+.5*Math.sin(phase*2*Math.PI)):0;hand.splice(0,2,...project(dir,lat*.45,35,hip+25+eating*34));}
  if(mask){const patch=project(dir,lat*.93,0,shoulder-10);path(g,[[patch[0]-7,patch[1]-4],[patch[0]+7,patch[1]-4],[patch[0]+7,patch[1]+7],[patch[0]-7,patch[1]+7]],'#fff',0);}
  else{limb(g,S,E,23,col.coat);limb(g,E,hand,21,col.coat);oval(g,hand[0],hand[1]+3,10,11,col.skin,3);}
 }
 if(!mask&&['carry','collect','serve'].includes(pose)){const c=pose==='carry'?project(dir,0,24,hip+11):project(dir,0,88,82);path(g,[[c[0]-32,c[1]-3],[c[0]+32,c[1]-3],[c[0]+27,c[1]+9],[c[0]-27,c[1]+9]],'#cbd7c7',3);oval(g,c[0]-5,c[1],15,4,'#f1dcad',2);oval(g,c[0]+17,c[1],5,5,'#bd7950',2);}
 g.save();g.translate(128,headTop+70);g.rotate(moving?Math.sin(angle-.4)*.025:0);g.translate(-128,-headTop-70);
 head(g,dir,headTop,opt.accent||'#dba852',mask);
 g.restore();g.restore();
 return{feet:positions,headTop};
}
function portrait(g,accent){g.save();g.translate(-60,-25);g.scale(1.45,1.45);draw(g,{direction:'down',pose:'idle',phase:0,accent});g.restore();}
const api={W,H,P,D,STRIDE,gait,project,draw,portrait};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ToySoldier=api;
})(typeof globalThis!=='undefined'?globalThis:this);
