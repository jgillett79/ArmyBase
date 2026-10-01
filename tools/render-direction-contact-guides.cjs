// Full-body anatomical paint guides, NOT game art. Never added to the manifest.
// Run with @napi-rs/canvas installed: node tools/render-direction-contact-guides.cjs
const fs = require('node:fs');
const path = require('node:path');
const {createCanvas} = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'art/rig/brief09'); fs.mkdirSync(out,{recursive:true});
const INK='#22251b', C={olive:'#727b45',shade:'#505b32',khaki:'#b29a69',dark:'#897445',boot:'#4b3527',skin:'#d9ab82',strap:'#82613c'};
// Ground stance width is 52 source px in both views (equal ground axes).
// Passing-foot lift is 8 source px: right above its ground row; up above
// the passing/contact ground row 343. Down master measured passing lift is 8.
const tracks={
 right:[[[165,356,true],[91,296,false]],[[140,356,true],[103,292,false]],[[115,356,true],[115,296,false]],[[91,348,false],[165,304,true]],[[103,344,false],[140,304,true]],[[115,348,false],[115,304,true]]],
 // Up is a BACK view: the soldier's right leg is on screen-right (x 154) and
 // plants in frames 1-3, as in the front-view down master (screen-left there)
 // and the right view, so a turn never swaps the planted leg (Claude review,
 // 1 Oct: the first version mirrored this view).
 up:[[[154,293,true],[102,359,false]],[[154,318,true],[102,343,false]],[[154,343,true],[102,335,false]],[[154,359,false],[102,293,true]],[[154,343,false],[102,318,true]],[[154,335,false],[102,343,true]]]
};
function segment(g,a,b,w,colour){g.lineCap='round';for(const [width,fill] of [[w+7,INK],[w,colour]]){g.strokeStyle=fill;g.lineWidth=width;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}}
function ellipse(g,x,y,rx,ry,colour){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=colour;g.fill();g.lineWidth=4;g.strokeStyle=INK;g.stroke();}
function polygon(g,pts,colour){g.beginPath();g.moveTo(...pts[0]);pts.slice(1).forEach(p=>g.lineTo(...p));g.closePath();g.fillStyle=colour;g.fill();g.strokeStyle=INK;g.lineWidth=4;g.stroke();}
// Solve knees in forward-depth / vertical-height space, then project.
// Screen row differences contain both ground depth and height; solving in
// screen space incorrectly turns a small foot lift into a high knee march.
function leg(g,dir,foot,side,frame,idle=false){
 const [x,y,planted]=foot;
 const lift=planted||idle?0:frame%3===1?12:8;
 const lateral=side==='right'?26:-26;
 const depth=dir==='right'?x-128:330-y-lift;
 const hipHeight=114,ankleHeight=14+lift;
 const dz=depth,dh=ankleHeight-hipHeight,L=60,d=Math.hypot(dz,dh);
 if(d>=2*L)throw Error('unreachable ankle');
 const a=Math.acos(d/(2*L)),theta=Math.atan2(dh,dz)+a;
 const kneeDepth=Math.cos(theta)*L,kneeHeight=hipHeight+Math.sin(theta)*L;
 const project=(forward,height)=>dir==='right'?[128+forward,330+lateral-height]:[128+lateral,330-forward-height];
 const hip=project(0,hipHeight),k=project(kneeDepth,kneeHeight),ankle=project(depth,ankleHeight);
 segment(g,hip,k,31,side==='right'?C.khaki:C.dark);segment(g,k,ankle,25,side==='right'?C.khaki:C.dark);
 if(dir==='right')polygon(g,[[x-13,y-27],[x+9,y-27],[x+18,y-10],[x+22,y-4],[x+20,y],[x-15,y],[x-17,y-6]],C.boot);
 else polygon(g,[[x-13,y-26],[x+13,y-26],[x+16,y-6],[x+13,y],[x-13,y],[x-16,y-6]],C.boot);
}
function body(g,dir,frame,idle=false){const breath=idle?frame:(frame%3===1?2:0); const y=120+breath;
 // Rifle is fixed to torso and stays identical in every frame. It is slung
 // on the soldier's LEFT shoulder (screen-right in the front-view down
 // master): the far shoulder in the right view, screen-left in the up view.
 if(dir==='up')segment(g,[84,54],[104,225],8,C.boot);else segment(g,[86,54],[94,225],8,C.boot);
 if(dir==='right'){
  polygon(g,[[105,207],[145,207],[150,239],[112,248],[98,228]],C.khaki);
  polygon(g,[[101,y],[143,y-8],[158,155+breath],[148,219],[111,219],[96,165]],C.olive);
  polygon(g,[[128,100],[147,103],[160,88],[171,81],[160,72],[159,50],[129,55],[119,77]],C.skin);
  ellipse(g,128,57,37,27,C.olive);polygon(g,[[96,68],[149,66],[167,71],[159,79],[100,80]],C.shade);
  ellipse(g,147,53,8,7,C.shade);ellipse(g,155,86,2,2,INK);
  const swing=idle?0:frame<3?[-16,-2,15][frame]:[16,2,-15][frame-3];segment(g,[112,y+15],[104,166+swing/2],24,C.olive);segment(g,[104,166+swing/2],[111,202+swing],21,C.olive);ellipse(g,111,207+swing,10,11,C.skin);
  segment(g,[129,y],[122,209],6,C.strap);polygon(g,[[107,210],[148,210],[146,225],[108,225]],C.strap);
 }else{
  polygon(g,[[86,y],[170,y],[160,220],[96,220]],C.olive);
  const swing=idle?0:frame<3?[-16,-2,15][frame]:[16,2,-15][frame-3];
  for(const [x,s] of [[83,swing],[173,-swing]]){segment(g,[x,y+12],[x+(x<128?-5:5),167+s/2],24,C.olive);segment(g,[x+(x<128?-5:5),167+s/2],[x,200+s],21,C.olive);ellipse(g,x,205+s,10,11,C.skin);}
  polygon(g,[[112,99],[144,99],[144,123],[112,123]],C.skin);ellipse(g,128,59,43,29,C.olive);ellipse(g,128,82,43,8,C.shade);
  segment(g,[102,y],[128,181],7,C.strap);segment(g,[154,y],[128,181],7,C.strap);segment(g,[128,181],[128,216],7,C.strap);polygon(g,[[96,210],[160,210],[160,224],[96,224]],C.strap);
 }
}
function draw(g,dir,feet,i,idle=false){ // Fixed near/far order preserves anatomical identity.
 leg(g,dir,feet[1],'left',i,idle);leg(g,dir,feet[0],'right',i,idle);body(g,dir,i,idle);
}
const meta={status:'anatomical paint guide only; not approved art',cell:[256,384],pivot:[128,330],sourcePxPerWorld:300/44,strideWorld:22,frames:6,stanceWidthSourcePx:52,passingLiftSourcePx:8};
for(const dir of ['up','right']){
 const canvas=createCanvas(1536,384),g=canvas.getContext('2d');
 tracks[dir].forEach((feet,i)=>{g.save();g.translate(i*256,0);draw(g,dir,feet,i);g.restore();});
 fs.writeFileSync(path.join(out,`soldier_walk_${dir}_anatomical_guide.png`),canvas.toBuffer('image/png'));
 const track=tracks[dir].map(([right,left])=>Object.fromEntries([['right',right],['left',left]].map(([name,[x,y,planted]])=>[name,{x,y,planted}])));
 fs.writeFileSync(path.join(out,`soldier_walk_${dir}_anatomical_guide.json`),JSON.stringify({...meta,direction:dir,track},null,2)+'\n');
 // Full stance transitions are represented by planted intervals 1→2→3 and 4→5→6.
 const width=dir==='right'?track[0].right.y-track[3].left.y:track[0].right.x-track[0].left.x;
 const lift=dir==='right'?track[3].left.y-track[2].left.y:track[2].right.y-track[2].left.y;
 if(width!==52||lift!==8)throw Error(`${dir}: inconsistent stance width/lift ${width}/${lift}`);
 if(dir==='up'&&track.some(t=>t.right.x<=128||t.left.x>=128))throw Error('rear anatomical legs mirrored');
 const axis=dir==='right'?'x':'y',bodyDelta=dir==='right'?25:-25;
 for(const [a,b,foot] of [[0,1,'right'],[1,2,'right'],[3,4,'left'],[4,5,'left']]){
  const cancellation=track[b][foot][axis]-track[a][foot][axis]+bodyDelta;
  if(cancellation!==0)throw Error(`${dir} ${a+1}→${b+1} slip ${cancellation}`);
 }
 const leading=dir==='right'?((t)=>t.right.x>t.left.x?'right':'left'):((t)=>t.right.y<t.left.y?'right':'left');
 if(leading(track[0])===leading(track[3]))throw Error('same leg leads');
 const idleFeet=dir==='right'?[[132,356,true],[124,304,true]]:[[154,330,true],[102,330,true]];
 const idleCanvas=createCanvas(512,384),ig=idleCanvas.getContext('2d');
 for(let i=0;i<2;i++){ig.save();ig.translate(i*256,0);draw(ig,dir,idleFeet,i,true);ig.restore();}
 fs.writeFileSync(path.join(out,`soldier_idle_${dir}_anatomical_guide.png`),idleCanvas.toBuffer('image/png'));
 fs.writeFileSync(path.join(out,`soldier_idle_${dir}_anatomical_guide.json`),JSON.stringify({...meta,frames:2,direction:dir,feet:idleFeet},null,2)+'\n');
 console.log(`${dir}: stance cancellation exact; contact leg alternates; PNG source guide written`);
}
