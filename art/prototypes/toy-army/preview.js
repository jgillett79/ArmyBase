'use strict';
(()=>{
const R=ToySoldier,scene=document.getElementById('scene'),g=scene.getContext('2d'),portrait=document.getElementById('portrait'),pg=portrait.getContext('2d');
const names={walk:'Exploring the base',queue:'Waiting for a meal',collect:'Collecting lunch',carry:'Carrying a tray',sit:'Taking a seat',eat:'Enjoying lunch',rise:'Ready for the afternoon'};
const stages=[
 [2,[105,250],[105,180],'walk','up'],[3,[105,180],[210,180],'walk','right'],[2,[210,180],[210,235],'walk','down'],[2,[210,235],[155,235],'walk','left'],
 [3,[155,235],[270,235],'walk','right'],[2,[270,235],[270,235],'queue','up'],[2,[270,235],[325,235],'walk','right'],[1,[325,235],[325,195],'walk','up'],
 [2,[325,195],[325,195],'collect','up'],[2,[325,195],[325,265],'carry','down'],[2,[325,265],[450,265],'carry','right'],[1,[450,265],[450,265],'sit','up'],
 [5,[450,265],[450,265],'eat','up'],[1,[450,265],[450,265],'rise','up'],[2,[450,265],[450,310],'walk','down'],[3,[450,310],[105,310],'walk','left'],[2,[105,310],[105,250],'walk','up']
];
// A consistent 26 world px/s avoids hurried, mechanical steps on long legs.
for(const s of stages)if(s[3]==='walk'||s[3]==='carry')s[0]=Math.hypot(s[2][0]-s[1][0],s[2][1]-s[1][1])/26+.3;
let cursor=0,distance=0;for(const s of stages){s.start=cursor;s.distance=distance;s.travel=Math.hypot(s[2][0]-s[1][0],s[2][1]-s[1][1]);cursor+=s[0];distance+=s.travel;}const duration=cursor,mealStart=stages[5].start,mealEnd=stages[14].start,walkEnd=stages[4].start;
let time=0,last=null,paused=false,mode='routine',accent='#dba852',callsign='Kestrel';
function stateAt(t){let lo=mode==='walk'?0:mode==='meal'?mealStart:0,hi=mode==='walk'?walkEnd:mode==='meal'?mealEnd:duration;
 t=lo+((t-lo)%(hi-lo)+(hi-lo))%(hi-lo);const i=stages.findIndex(s=>t<s.start+s[0]);const s=stages[i],elapsed=Math.max(0,Math.min(s[0],t-s.start)),ramp=.3;
 const moving=s.travel>0,total=s[0]-ramp;
 const covered=elapsed<ramp?elapsed*elapsed/(2*ramp):elapsed>s[0]-ramp?total-(s[0]-elapsed)**2/(2*ramp):elapsed-ramp/2;
 const u=moving?Math.max(0,Math.min(1,covered/total)):elapsed/s[0];
 return{x:s[1][0]+(s[2][0]-s[1][0])*u,y:s[1][1]+(s[2][1]-s[1][1])*u,pose:s[3],direction:s[4],phase:((s.distance+s.travel*u)/R.STRIDE)%1,u,index:i,time:t};}
function round(x,y,w,h,r,fill,stroke='#55694b',line=1.5){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=line;g.stroke();}}
function ellipse(x,y,rx,ry,fill,stroke){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke();}}
function tree(x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);ellipse(0,6,24,8,'#6f855659');round(-4,-4,8,24,3,'#8c7250');for(const[a,b,r,c]of[[-15,-17,16,'#607d4b'],[14,-19,17,'#6c8950'],[0,-37,21,'#789857']])ellipse(a,b,r,r,c,'#405c3b');g.restore();}
function ground(t){
 g.fillStyle='#aabd7b';g.fillRect(-100,-100,800,600);
 // Quiet terrain; path and clearing carry the visual structure.
 g.strokeStyle='#e0cca1';g.lineWidth=45;g.lineCap='round';g.beginPath();g.moveTo(45,320);g.lineTo(180,290);g.lineTo(270,235);g.lineTo(325,235);g.stroke();
 g.strokeStyle='#d3b98b';g.lineWidth=2;g.beginPath();g.moveTo(45,332);g.lineTo(180,302);g.lineTo(260,248);g.stroke();
 for(const[x,y]of[[52,80],[203,85],[552,95],[552,275],[68,285],[240,310]]){for(let k=0;k<3;k++){g.strokeStyle='#739757';g.lineWidth=2;g.beginPath();g.moveTo(x+k*5,y);g.lineTo(x+k*5-2,y-5-(k%2)*3);g.stroke();}}
 // Small brook and rocks echo the original natural base layout.
 g.fillStyle='#6caba9';g.beginPath();g.moveTo(-20,340);g.quadraticCurveTo(50,310,96,350);g.quadraticCurveTo(145,390,220,374);g.lineTo(220,430);g.lineTo(-20,430);g.closePath();g.fill();
 g.strokeStyle='#c8e2cf';g.lineWidth=2;for(let i=0;i<5;i++){const x=((t*10+i*37)%190)-10;g.beginPath();g.moveTo(x,365+(i%2)*10);g.lineTo(x+14,365+(i%2)*10);g.stroke();}
 for(const[x,y,s]of[[48,344,1],[108,366,.8],[194,371,.7]]){ellipse(x,y,14*s,8*s,'#879485','#54685a');ellipse(x-3*s,y-2*s,7*s,3*s,'#aab4a1');}
 tree(38,115,1.1);tree(215,90,.9);tree(539,117,1);tree(548,308,.9);
 // Open-front mess hall. No roof obscures the stations.
 round(268,109,252,190,13,'#e1c995');round(268,93,252,53,6,'#a6aa78');round(278,99,232,33,4,'#d5dbaf');
 g.strokeStyle='#c2aa7d';g.lineWidth=1;for(let x=280;x<515;x+=20){g.beginPath();g.moveTo(x,146);g.lineTo(x,295);g.stroke();}
 round(277,136,8,160,2,'#8d9263');round(505,136,8,160,2,'#8d9263');
 round(363,121,126,30,5,'#eee5c5');g.fillStyle='#536b42';g.font='bold 12px Trebuchet MS';g.textAlign='center';g.fillText('MESS HALL',426,141);
 round(296,174,96,11,3,'#dfb987');round(296,166,96,9,3,'#efe4c5');
 // Tables and seats, back layer.
 for(const x of [415,475]){round(x-8,264,16,12,3,'#879867');round(x-10,252,20,10,3,'#b1bd80');}
 for(const x of [402,485])round(x,249,7,29,2,'#896d47');round(394,251,100,14,4,'#c3a578');round(389,245,110,10,5,'#f1d9a4');
 round(256,218,42,35,8,'#c6c994',null);g.strokeStyle='#7b8a61';g.setLineDash([3,4]);g.lineWidth=1.5;g.strokeRect(263,224,25,20);g.setLineDash([]);
 // Kitchen supplies deliberately simple.
 round(280,151,16,14,2,'#9fa783');ellipse(288,150,8,3,'#cad1b0','#61704e');round(457,160,35,28,5,'#c4cca2');round(464,163,10,13,2,'#ede8ca');
}
function person(x,y,direction,pose,phase,colour,seatBlend){
 ellipse(x,y+2,9,3,'#53634b29');g.save();g.translate(x,y);g.scale(1/R.D,1/R.D);g.translate(-R.P.x,-R.P.y);R.draw(g,{direction,pose,phase,accent:colour,seatBlend});g.restore();
}
function render(){const st=stateAt(time),css=scene.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);if(scene.width!==Math.round(css.width*ratio)||scene.height!==Math.round(css.height*ratio)){scene.width=Math.round(css.width*ratio);scene.height=Math.round(css.height*ratio);}
 g.setTransform(ratio,0,0,ratio,0,0);g.fillStyle='#aabd7b';g.fillRect(0,0,css.width,css.height);const mobile=css.width<500,scale=mobile?css.width/360:Math.min(css.width/580,css.height/370),camera=mobile?Math.max(0,Math.min(220,st.x-180)):0;
 g.save();g.translate(mobile?0:(css.width-580*scale)/2,mobile?0:(css.height-370*scale)/2);g.scale(scale,scale);g.translate(-camera,0);ground(st.time);
 const chefServing=st.pose==='collect';person(325,169,'down',chefServing?'serve':'idle',chefServing?st.u:st.time*.25,'#e4e6d3');
 // The counter is behind applicants on its near side.
 round(296,181,96,15,2,'#89946a');round(300,182,88,3,1,'#b7c58c',null);
 // Another recruit finishes service as Omar joins the queue.
 let nx=325,ny=195,np='idle',nd='up',ph=0;
 if(st.time>=mealStart&&st.time<mealStart+2){const p=(st.time-mealStart)/2;ny=195+70*p;np='carry';nd='down';ph=70*p/R.STRIDE;}
 else if(st.time>=mealStart+2&&st.time<mealStart+4){const p=(st.time-mealStart-2)/2;nx=325+90*p;ny=265;np='carry';nd='right';ph=(70+90*p)/R.STRIDE;}
 else if(st.time>=mealStart+4){nx=415;ny=265;np='eat';nd='up';ph=st.time*.4;}
 if(ny<st.y)person(nx,ny,nd,np,ph,'#5185a5');
 const pose=st.pose==='queue'?'idle':st.pose,seat=st.pose==='sit'?st.u:st.pose==='rise'?1-st.u:undefined;
 person(st.x,st.y,st.direction,pose,pose==='eat'?st.time*.55:st.phase,accent,seat);
 if(ny>=st.y)person(nx,ny,nd,np,ph,'#5185a5');
 // Tabletop front overlaps seated legs.
 round(389,253,110,7,2,'#b4986a');
 if(st.pose==='eat'||st.pose==='sit'||st.pose==='rise'){round(438,243,23,7,2,'#d2ddcb');ellipse(446,245,5,2,'#e9c675');}
 g.restore();
 // Close-up exposes weight shifts while the scene preserves game-size scale.
 if(!mobile){g.save();g.translate(18,18);round(0,0,148,177,12,'#f0e7cf','#879867');g.fillStyle='#536b42';g.font='bold 11px Trebuchet MS';g.textAlign='center';g.fillText('MOVEMENT STUDY',74,20);g.translate(74,163);g.scale(.43,.43);g.translate(-R.P.x,-R.P.y);R.draw(g,{direction:st.direction,pose,phase:pose==='eat'?st.time*.55:st.phase,accent,seatBlend:seat});g.restore();}
 const label=names[st.pose]||names.walk;document.getElementById('step').textContent=(callsign||'Omar')+' · '+label;document.getElementById('record').textContent=label;
 document.getElementById('detail').textContent=st.pose==='queue'?'Waiting for the person ahead to finish.':st.pose==='eat'?'A proper meal, a little rest, then back to training.':st.pose==='collect'?'The cook hands over a tray.':st.pose==='carry'?'Taking lunch to an available seat.':'Same face, same kit, wherever they go.';
 pg.clearRect(0,0,256,256);R.portrait(pg,accent);
 window.ToyPreviewState={time:st.time,stage:st.pose,direction:st.direction,x:st.x,y:st.y,paused,mode};
}
function frame(now){if(last!==null&&!paused)time+=Math.min(.1,(now-last)/1000);last=now;render();requestAnimationFrame(frame);}
const controls=['routine','walk','meal'];function select(m){mode=m;time=m==='meal'?mealStart:0;for(const id of controls){const b=document.getElementById(id),yes=id===m;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));}render();}
for(const id of controls)document.getElementById(id).addEventListener('click',()=>select(id));
document.getElementById('play').addEventListener('click',()=>{paused=!paused;const b=document.getElementById('play');b.textContent=paused?'Play':'Pause';b.setAttribute('aria-pressed',String(paused));});
document.getElementById('restart').addEventListener('click',()=>{time=mode==='meal'?mealStart:0;render();});
document.getElementById('callsign').addEventListener('input',e=>{callsign=e.target.value.trim().slice(0,12);document.getElementById('name').textContent=callsign?'“'+callsign+'”':'';render();});
for(const b of document.querySelectorAll('[data-colour]'))b.addEventListener('click',()=>{accent=b.dataset.colour;for(const c of document.querySelectorAll('[data-colour]'))c.setAttribute('aria-pressed',String(c===b));render();});
// Read-only deterministic capture hook. Never connected to the real game save.
window.ToyPreview={seek(t){time=t;paused=true;document.getElementById('play').textContent='Play';document.getElementById('play').setAttribute('aria-pressed','true');render();},duration,stages};
requestAnimationFrame(frame);
})();
