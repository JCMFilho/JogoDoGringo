const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const root = path.resolve(__dirname,'../dist');
function boot(initialStorage={}){
  const {window,document}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  const frames=[],listeners={},store=new Map(Object.entries(initialStorage));let time=100,focus=document.body;
  Object.defineProperty(document,'activeElement',{get:()=>focus});
  window.HTMLElement.prototype.focus=function(){focus=this;};
  const context=new Proxy({},{get:(target,key)=>key in target?target[key]:(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  document.getElementById('game').getContext=()=>context;
  document.getElementById('game').getBoundingClientRect=()=>({left:0,top:0,width:960,height:600});
  class MockImage{constructor(){this.complete=true;this.naturalWidth=1254;}set src(value){this._src=value;this.onload?.();}get src(){return this._src;}}
  let randomSeed=12345;const seededMath=Object.create(Math);seededMath.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  const sandbox={document,Image:MockImage,console,Math:seededMath,JSON,Promise,setTimeout:()=>1,clearTimeout:()=>{},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},requestAnimationFrame:fn=>frames.push(fn),addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)};
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  for(const file of ['atlas.js','world.js','engine.js','music.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  function tick(seconds){for(let i=0;i<Math.ceil(seconds*20);i++){time+=50;const callbacks=frames.splice(0);for(const cb of callbacks)cb(time);}}
  function click(id){const el=document.getElementById(id);assert.ok(el,`Missing ${id}`);assert.ok(!el.disabled,`${id} disabled`);el.onclick();tick(.1);}
  function point(x,y){const event=new window.Event('pointerdown',{bubbles:true});Object.assign(event,{clientX:x,clientY:y});document.getElementById('game').dispatchEvent(event);}
  return {document,sandbox,store,tick,click,point,key:(key)=>listeners.keydown.forEach(fn=>fn({key,repeat:false,preventDefault(){}})),snapshot:()=>sandbox.GringoGame.snapshot()};
}
test('interface boots, draws frames, loads all sprite URLs and starts from intro',()=>{
  const ui=boot();ui.tick(.1);assert.match(ui.document.getElementById('modal').textContent,/COMEÇAR A DINASTIA/);ui.click('start-game');assert.equal(ui.document.getElementById('modal-backdrop').hidden,true);assert.equal(ui.snapshot().kids,2);ui.tick(1);assert.ok(ui.snapshot().time>.9);assert.ok(ui.store.has('gringo-save-v1'));
});
test('click movement completes an actual new-baby round through the UI',()=>{
  const ui=boot();ui.click('start-game');ui.click('more-baby');assert.ok(ui.snapshot().prep);assert.equal(ui.document.getElementById('prep').hidden,false);ui.point(150,224);ui.tick(5);assert.ok(ui.snapshot().kids>=3||ui.snapshot().prep?.work>=1,JSON.stringify(ui.snapshot().player));ui.point(766,219);ui.tick(10);assert.ok(ui.snapshot().kids>=3,JSON.stringify(ui.snapshot().prep));assert.match(ui.document.getElementById('kids').textContent,/3/);assert.equal(ui.document.getElementById('prep').hidden,true);
});
test('pause, help and achievements stop simulation, and resume restores it',()=>{
  const ui=boot();ui.click('start-game');ui.click('pause');const before=ui.snapshot().time;ui.tick(3);assert.equal(ui.snapshot().time,before);ui.click('resume-game');ui.tick(1);assert.ok(ui.snapshot().time>before);ui.click('pause');ui.click('help');assert.match(ui.document.getElementById('modal').textContent,/MANUAL DE SOBREVIVÊNCIA/);const t=ui.snapshot().time;ui.tick(2);assert.equal(ui.snapshot().time,t);ui.click('close-help');ui.click('pause');ui.click('achievements');assert.equal(ui.document.querySelectorAll('.milestones li').length,9);ui.click('close-achievements');
});
test('power buttons respect cooldowns and upgrades update the interface',()=>{
  const ui=boot();ui.click('start-game');ui.click('power-brazil');assert.ok(ui.snapshot().active.brazil>0);assert.equal(ui.document.getElementById('power-brazil').disabled,true);ui.click('open-upgrades');ui.click('upgrade-income');assert.equal(ui.snapshot().upgrades.income,1);assert.match(ui.document.getElementById('income-level').textContent,/Nível 1/);assert.equal(ui.document.getElementById('power-first').disabled,true);ui.click('close-upgrades');
});
test('save, resume, restart cancellation and confirmation preserve record',()=>{
  const ui=boot();ui.click('start-game');ui.tick(6);const saved=ui.store.get('gringo-save-v1');const next=boot({'gringo-save-v1':saved,'gringo-best-v1':'11'});assert.match(next.document.getElementById('start-game').textContent,/CONTINUAR/);next.click('start-game');assert.ok(next.snapshot().time>=5);next.click('pause');next.click('restart');next.click('cancel-restart');assert.ok(next.snapshot().time>=5);next.click('pause');next.click('restart');next.click('confirm-restart');assert.ok(next.snapshot().time<1);next.click('pause');assert.equal(next.document.getElementById('best-kids').textContent,'11');
});
test('distributed HTML refers only to files present in the distribution',()=>{
  const {document}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8'));for(const el of document.querySelectorAll('script[src],link[href],img[src]')){const rel=el.getAttribute('src')||el.getAttribute('href');if(rel.startsWith('http'))continue;assert.ok(fs.existsSync(path.join(root,rel.split('?')[0])),rel);}
});
test('all persistent controls belong to the in-game HUD and upgrades open only on demand',()=>{
  const ui=boot(),hud=ui.document.querySelector('.hud');assert.ok(hud);assert.equal(ui.document.querySelector('.sidebar'),null);assert.equal(ui.document.querySelector('.page-heading'),null);for(const id of ['kids','money','pause','powers','more-baby','prep'])assert.ok(hud.contains(ui.document.getElementById(id)),id);assert.equal(ui.document.getElementById('upgrade-income'),null);ui.click('start-game');ui.key('m');ui.tick(.1);assert.ok(ui.document.getElementById('upgrade-income'));const t=ui.snapshot().time;ui.tick(1);assert.equal(ui.snapshot().time,t);ui.key('Escape');ui.tick(.5);assert.ok(ui.snapshot().time>t);
});
test('click-to-move can enter and exit the nursery through the living room',()=>{
  const {Game}=require('../dist/engine.js');const save=new Game({random:()=>.5}).snapshot();save.player={x:550,y:430,dir:'right',path:[]};save.toys=[];
  const ui=boot({'gringo-save-v1':JSON.stringify(save)});ui.click('start-game');ui.point(690,430);ui.tick(2);let p=ui.snapshot().player;assert.ok(p.x>627&&p.y>374,JSON.stringify(p));ui.point(550,430);ui.tick(2);p=ui.snapshot().player;assert.ok(p.x<613,JSON.stringify(p));
});
test('music toggle is independent from effects and its disabled preference survives reload',()=>{
  const ui=boot();assert.equal(ui.document.getElementById('music').getAttribute('aria-pressed'),'true');ui.click('music');assert.equal(ui.document.getElementById('music').getAttribute('aria-pressed'),'false');assert.equal(ui.store.get('gringo-music-v1'),'false');const next=boot({'gringo-music-v1':'false'});next.click('start-game');assert.equal(next.document.getElementById('music').getAttribute('aria-pressed'),'false');next.click('music');assert.equal(next.document.getElementById('music').getAttribute('aria-pressed'),'true');assert.equal(next.store.get('gringo-music-v1'),'true');
});
test('home purchase shows the expanded floor plan and overview clicks reach its new rooms',()=>{
  const {Game}=require('../dist/engine.js'),save=new Game({random:()=>.5}).snapshot();save.money=5000;
  const ui=boot({'gringo-save-v1':JSON.stringify(save)});ui.click('start-game');ui.click('open-upgrades');assert.match(ui.document.getElementById('home-level').textContent,/3 → 5 cômodos/);ui.click('upgrade-home');assert.equal(ui.document.getElementById('modal-backdrop').hidden,true);const view=ui.sandbox.GringoGame.view();assert.equal(view.rooms.length,5);assert.equal(view.overview,true);assert.ok(view.camera.zoom<1);assert.equal(ui.document.getElementById('view-map').hidden,false);
  const target={x:1120,y:285};ui.point((target.x-view.camera.x)*view.camera.zoom,(target.y-view.camera.y)*view.camera.zoom);ui.tick(7);assert.ok(ui.snapshot().player.x>960,JSON.stringify(ui.snapshot().player));ui.click('view-map');assert.equal(ui.sandbox.GringoGame.view().overview,false);assert.ok(ui.sandbox.GringoGame.view().camera.x>0);
});
