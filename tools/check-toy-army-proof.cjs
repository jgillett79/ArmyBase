// Numerical contact checks and native-canvas integration renders for the
// isolated style prototype. Does not promote the game's walking release gate.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const{createCanvas}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),R=require(path.join(root,'art/prototypes/toy-army/soldier-rig.js'));
for(const dir of ['down','up','right','left'])for(const foot of ['right','left']){
 const base=foot==='right'?0:.5,lat=foot==='right'?26:-26;let previous;
 for(let i=0;i<45;i++){
  const p=base+i*.49/44,f=R.gait(p)[foot],point=R.project(dir,lat,f.depth,f.lift),basis=dir==='down'?[0,1]:dir==='up'?[0,-1]:dir==='right'?[1,0]:[-1,0];
  const world=[point[0]+basis[0]*p*R.STRIDE*R.D,point[1]+basis[1]*p*R.STRIDE*R.D];
  assert(f.planted);if(previous)assert(Math.hypot(world[0]-previous[0],world[1]-previous[1])<1e-8,'stance foot drifts');previous=world;
 }
}
console.log('Four directions: both stance feet cancel continuous body travel exactly');
function harness(width,height){
 const elements={},colours=['#dba852','#b95b4b','#5185a5','#e4e6d3'];
 function el(id){return elements[id]||=(id==='scene'||id==='portrait'?createCanvas(id==='portrait'?256:width,id==='portrait'?256:height):{textContent:'',value:'Kestrel',dataset:{},events:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(k,f){this.events[k]=f;}});}
 el('scene').getBoundingClientRect=()=>({width,height});const buttons=colours.map(colour=>({...el('colour-'+colour),dataset:{colour}}));
 const document={getElementById:el,querySelectorAll:()=>buttons};let callback;
 const ctx={document,ToySoldier:R,devicePixelRatio:1,requestAnimationFrame:f=>{callback=f;},console};ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(root,'art/prototypes/toy-army/preview.js'),'utf8'),ctx);callback(0);
 return{ctx,elements,buttons,canvas:el('scene'),portrait:el('portrait')};
}
const folder=process.argv[2]||path.join(root,'art/review/toy-army');fs.mkdirSync(folder,{recursive:true});
for(const [name,w,h]of[['desktop',800,490],['phone',343,440]]){
 const app=harness(w,h);let seen=new Set();
 for(const stage of app.ctx.ToyPreview.stages){app.ctx.ToyPreview.seek(stage.start+stage[0]/2);seen.add(app.ctx.ToyPreviewState.stage);const image=app.canvas.toBuffer('image/png');assert(image.length>5000);}
 for(const pose of ['walk','queue','collect','carry','sit','eat','rise'])assert(seen.has(pose));
 app.elements.callsign.events.input({target:{value:'Scout'}});assert.equal(app.elements.name.textContent,'“Scout”');app.buttons[2].events.click();assert.equal(app.buttons[2]['aria-pressed'],'true');
 app.elements.meal.events.click();assert.equal(app.ctx.ToyPreviewState.stage,'queue');app.elements.walk.events.click();assert.equal(app.ctx.ToyPreviewState.direction,'up');
 app.elements.routine.events.click();
 for(const t of [1,18,26]){app.ctx.ToyPreview.seek(t);fs.writeFileSync(path.join(folder,`${name}-${t}.png`),app.canvas.toBuffer('image/png'));}
 fs.writeFileSync(path.join(folder,`${name}-portrait.png`),app.portrait.toBuffer('image/png'));
 console.log(`${name}: all seven routine states render; callsign, accent and scene controls work`);
}
if(fs.readFileSync(path.join(root,'js/asset-manifest.js'),'utf8').includes('toy-army'))throw Error('prototype registered in real game');
console.log('Real game manifest remains untouched');
module.exports={harness,R};
