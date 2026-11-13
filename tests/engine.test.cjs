const test = require('node:test');
const assert = require('node:assert/strict');
const {Game,STATIONS,MILESTONES,STAGES,DOORWAYS,findPath,canWalk,dist} = require('../dist/engine.js');
function make(){let seed=12345;return new Game({random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});}
function advance(game,seconds){for(let i=0;i<Math.ceil(seconds*20);i++)game.update(.05);}

test('Sabrina leaves a short pause between nearby cleaning tasks',()=>{
  const g=make();
  g.state.children=[];g.timers.mess=100;
  g.state.toys=[5,7,9].map((offset,i)=>({x:g.state.wife.x+offset,y:g.state.wife.y,id:900+i,kind:0}));
  advance(g,.05);assert.equal(g.state.stats.cleaned,1);
  advance(g,.65);assert.equal(g.state.stats.cleaned,1);
  advance(g,.3);assert.equal(g.state.stats.cleaned,2);
});
function finishPrep(game){const s=game.state,p=s.prep;assert.ok(p);while(s.prep&&s.prep.clean<s.prep.needClean){if(!s.toys.length)game.spawnToy();game.clean(s.toys[0]);}game.stationCooldown=0;while(s.prep&&s.prep.bottles<s.prep.needBottles){s.bottles=0;game.stationCooldown=0;game.station('kitchen');}game.workCooldown=0;game.station('work');}
test('new family has two children and all stations are reachable',()=>{const g=make();assert.equal(g.state.kids,2);assert.equal(g.state.children.length,2);for(const station of STATIONS){const path=findPath(g.state.player,station);assert.ok(path.length,station.id);for(const p of path)assert.ok(canWalk(p.x,p.y,10));}assert.ok(findPath({x:150,y:224},{x:766,y:219}).some(p=>p.x>610));});
test('baby requires cleaning, bottles AND work and awards only one birth',()=>{const g=make(),before=g.state.money;assert.ok(g.beginPrep());assert.equal(g.state.money,before-28);assert.equal(g.state.kids,2);finishPrep(g);assert.equal(g.state.kids,3);assert.equal(g.state.round,2);assert.equal(g.state.prep,null);assert.ok(g.state.earned.includes(3));assert.equal(g.birth(),false);assert.equal(g.state.kids,3);assert.ok(g.state.score>300);});
test('challenge expires without adding a child or taking payment twice',()=>{const g=make();g.beginPrep();const spent=g.state.money;g.state.prep.time=.02;g.update(.05);assert.equal(g.state.prep,null);assert.equal(g.state.kids,2);assert.equal(g.state.money,spent);assert.ok(g.drainEvents().some(e=>e.type==='prepFailed'));});
test('insufficient funds cannot start preparation or buy upgrades',()=>{const g=make();g.state.money=1;assert.equal(g.beginPrep(),false);assert.equal(g.state.prep,null);assert.equal(g.upgrade('robot'),false);assert.equal(g.state.upgrades.robot,0);assert.equal(g.state.money,1);});
test('power unlocks, cooldown and temporary protection actually work',()=>{const g=make();assert.equal(g.usePower('first'),false);g.state.kids=3;g.state.chaos=99;g.state.toys=[];for(let i=0;i<50;i++)g.spawnToy();assert.ok(g.usePower('first'));assert.equal(g.usePower('first'),false);const hp=g.state.integrity;advance(g,1);assert.equal(g.state.integrity,hp);advance(g,11);assert.equal(g.effect('first'),false);assert.ok(g.state.cooldowns.first>0);});
test('expansion discount lowers expenses, baby cost and improvement costs',()=>{const g=make();g.state.kids=7;const normal={baby:g.babyCost,expense:g.expense};g.usePower('plan');assert.ok(g.babyCost<normal.baby);assert.ok(g.expense<=normal.expense/2+1);assert.equal(g.discount(90),45);});
test('wife cleans and repairs autonomously',()=>{const g=make();g.state.toys=[{x:g.state.wife.x+5,y:g.state.wife.y,id:999,kind:0}];advance(g,1);assert.ok(g.state.stats.cleaned>=1);g.state.money=100;g.state.integrity=40;g.state.wife.x=523;g.state.wife.y=185;g.timers.ally=0;g.stationCooldown=0;advance(g,.1);assert.ok(g.state.integrity>=62);});
test('close cooperation activates all three couple combos',()=>{const g=make();for(let combo=0;combo<3;combo++){g.state.combo=80;g.lastAction.wife=g.state.time;g.actionDone('player','clean',300,300);assert.equal(g.state.combo,0);}assert.equal(g.state.comboCount,3);for(const id of ['love','super','mutirao'])assert.ok(g.effect(id));assert.deepEqual(g.drainEvents().filter(e=>e.type==='combo').map(e=>e.text),['Amor Infinito','Super Pais','Mutirão da Família']);});
test('robot removes mess, home upgrades replenish the house and income scales',()=>{const g=make();g.state.money=1000;const initial=g.income;assert.ok(g.upgrade('income'));assert.ok(g.income>initial);assert.ok(g.upgrade('robot'));g.timers.robot=0;const count=g.state.toys.length;g.update(.05);assert.ok(g.state.toys.length<count);g.state.integrity=30;assert.ok(g.upgrade('home'));assert.equal(g.state.home,1);assert.equal(g.state.integrity,100);});
test('100 child finale fires once and 500 finishes civilization without unbounded actor count',()=>{const g=make();g.state.money=1e7;while(g.state.kids<500){assert.ok(g.beginPrep());finishPrep(g);}const events=g.drainEvents();assert.equal(events.filter(e=>e.type==='victory').length,1);assert.equal(events.filter(e=>e.type==='civilization').length,1);assert.ok(g.state.children.length<=72);assert.equal(g.beginPrep(),false);for(const[n]of MILESTONES)assert.ok(g.state.earned.includes(n));});
test('bankruptcy and structural failure end the run',()=>{const g=make();g.state.money=-61;g.update(.05);assert.ok(g.state.ended);const h=make();h.state.integrity=0;h.update(.05);assert.ok(h.state.ended);});
test('saved games restore without stale movement and preserve monotonic object ids',()=>{const g=make();g.beginPrep();g.state.player.path=[{x:1,y:1}];const save=g.snapshot(),h=make();assert.ok(h.restore(save));assert.equal(h.state.kids,2);assert.ok(h.state.prep);assert.deepEqual(h.state.player.path,[]);const ids=[...h.state.toys,...h.state.children].map(x=>x.id);h.spawnToy();assert.ok(h.state.toys.at(-1).id>Math.max(...ids));assert.equal(h.restore({kids:9999}),false);});
test('long simulation stays finite with capped scene population',()=>{const g=make();g.state.home=4;g.state.money=1e6;g.state.upgrades={robot:5,income:5};g.state.kids=100;for(let i=0;i<100;i++)g.spawnChild();advance(g,300);for(const field of ['money','chaos','integrity','time','score'])assert.ok(Number.isFinite(g.state[field]),field);assert.ok(g.state.toys.length<=g.world.messLimit);assert.ok(g.state.children.length<=72);assert.equal(STAGES.length,5);});
test('nursery doorway remains clear across the width of a full adult and keyboard movement crosses it',()=>{
  const g=make(),door=DOORWAYS.nurserySide;assert.ok(door.h>=100);assert.ok(DOORWAYS.nurseryKitchen.w>=150);
  for(let y=door.y+25;y<door.y+door.h-25;y+=5)for(let x=590;x<652;x+=4)assert.ok(canWalk(x,y,16),`${x},${y}`);
  g.state.player.x=570;g.state.player.y=430;for(let i=0;i<30;i++)g.move(g.state.player,1,0,.025,190);assert.ok(g.state.player.x>680);for(let i=0;i<30;i++)g.move(g.state.player,-1,0,.025,190);assert.ok(g.state.player.x<600);
});
test('parents follow complete routes into the nursery from both rooms and do not catch on corners',()=>{
  const g=make();
  for(const [start,goal]of [[{x:589,y:367},{x:690,y:430}],[{x:768,y:219},{x:710,y:510}],[{x:680,y:430},{x:550,y:420}],[{x:710,y:510},{x:768,y:219}]]){
    const actor={...start,dir:'down',path:findPath(start,goal)};assert.ok(actor.path.length);for(let i=0;i<600&&actor.path.length;i++)g.follow(actor,.025,190);assert.ok(dist(actor,goal)<20,JSON.stringify({start,goal,actor}));
  }
});
test('wife can reach and clean a toy inside the nursery',()=>{
  const g=make();g.state.wife.x=550;g.state.wife.y=430;g.state.toys=[{x:690,y:430,id:999,kind:0}];advance(g,3);assert.ok(g.state.stats.cleaned>=1);
});
test('old saves keep progress and safely relocate actors where a bed moved',()=>{
  const g=make();g.state.kids=11;g.state.player.x=756;g.state.player.y=450;const save=g.snapshot(),restored=make();assert.ok(restored.restore(save));assert.equal(restored.state.kids,11);assert.ok(canWalk(restored.state.player.x,restored.state.player.y,10));
});
