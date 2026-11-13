const test=require('node:test');
const assert=require('node:assert/strict');
const {Game,canWalk,findPath,dist}=require('../dist/engine.js');
function random(seed=31415){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function advance(g,seconds,dt=1/60){for(let i=0;i<seconds/dt;i++)g.update(dt);}
test('recorded nursery corner stalls complete at real browser frame rates and turbo speed',()=>{
  const cases=[
    [{x:593.3746301895007,y:406.6380374506116},{x:660.9779734956101,y:295.4840986756608}],
    [{x:579.7791787749156,y:353.9175430312753},{x:764.0562181221321,y:307.0891025988385}],
    [{x:807.2864541178569,y:390.32670352607965},{x:604.7596280323341,y:340.3476998535916}],
    [{x:601.9095320490247,y:350.00000000000006},{x:670,y:290}]
  ];
  const g=new Game({random:random()});
  for(const [start,goal]of cases)for(const dt of [1/60,1/120,.033,.05,.1])for(const speed of [145,245,318.5]){
    const actor={...start,path:findPath(start,goal)};assert.ok(actor.path.length);
    for(let i=0;i<20/dt&&actor.path.length;i++)g.follow(actor,dt,speed);
    assert.equal(actor.path.length,0,JSON.stringify({start,goal,dt,speed,actor}));assert.ok(dist(actor,goal)<30);
  }
});
test('random routes around the nursery finish without entering walls',()=>{
  const rng=random(),g=new Game({random:rng});let completed=0;
  for(let n=0;n<800;n++){
    const start={x:565+rng()*300,y:290+rng()*230},goal={x:565+rng()*300,y:290+rng()*230};
    if(!canWalk(start.x,start.y,10)||!canWalk(goal.x,goal.y,10))continue;
    const actor={...start,path:findPath(start,goal)},dt=[1/60,.033,.05,.1][n%4],speed=n%2?245:145;
    assert.ok(actor.path.length||dist(start,goal)<35,JSON.stringify({start,goal}));
    for(let i=0;i<1200&&actor.path.length;i++){g.follow(actor,dt,speed);assert.ok(canWalk(actor.x,actor.y,10));}
    assert.equal(actor.path.length,0,JSON.stringify({start,goal,dt,speed,actor}));completed++;
  }
  assert.ok(completed>400);
});
test('wife cleans a target that previously pinned her to the upper nursery corner',()=>{
  const g=new Game({random:random()});Object.assign(g.state.wife,{x:593.3746301895007,y:406.6380374506116,path:[]});g.state.children=[];g.state.toys=[{x:660.9779734956101,y:295.4840986756608,id:999,kind:0}];g.timers.mess=100;
  advance(g,10);assert.equal(g.state.toys.length,0);assert.equal(g.state.stats.cleaned,1);
});
test('unreachable task is skipped so the wife can finish accessible chores',()=>{
  const g=new Game({random:random()});Object.assign(g.state.wife,{x:600,y:400,path:[]});g.state.children=[];g.timers.mess=100;
  g.state.toys=[{x:620,y:365,id:999,kind:0},{x:720,y:390,id:1000,kind:0}];
  advance(g,6);assert.ok(g.state.stats.cleaned>=1);assert.ok(!g.state.toys.some(t=>t.id===1000));assert.ok(g.state.toys.some(t=>t.id===999));
});
test('full bottle stock does not leave the wife waiting forever during preparation',()=>{
  const g=new Game({random:random()});Object.assign(g.state.wife,{x:766,y:219,path:[]});g.state.children=[];g.state.toys=[];g.state.bottles=30;g.beginPrep();g.state.prep.clean=g.state.prep.needClean;g.state.prep.work=1;g.state.toys=[];g.timers.mess=100;
  advance(g,5);assert.equal(g.state.kids,3);assert.equal(g.state.prep,null);assert.ok(g.state.bottles<=30);
});
test('wife recovers from an obstructed old route instead of waiting at a wall',()=>{
  const g=new Game({random:random()});Object.assign(g.state.wife,{x:590,y:365,path:[{x:650,y:365}]});g.state.children=[];g.timers.mess=100;g.timers.ally=1;
  const toy={x:680,y:410,id:999,kind:0};g.state.toys=[toy];g.aiTarget={type:'toy',ref:toy,priority:3};g.aiDestination={x:680,y:410};g.aiRepath=0;
  advance(g,8);assert.equal(g.state.toys.length,0);assert.equal(g.state.stats.cleaned,1);
});
test('sustained family chaos does not leave the wife stationary on an assigned route',()=>{
  for(let seed=1;seed<=20;seed++){
    const g=new Game({random:random(seed)});g.state.home=4;g.state.money=100000;g.state.kids=11;
    while(g.state.children.length<11)g.spawnChild();for(const c of g.state.children)c.hunger=70;for(let i=0;i<15;i++)g.spawnToy();let stationary=0;
    for(let i=0;i<2400;i++){
      const before={x:g.state.wife.x,y:g.state.wife.y};g.update(.05);
      stationary=g.aiTarget&&g.state.wife.path.length&&dist(before,g.state.wife)<.001?stationary+.05:0;
      assert.ok(stationary<.65,JSON.stringify({seed,time:g.state.time,wife:g.state.wife,target:g.aiTarget}));
      assert.ok(g.walk(g.state.wife.x,g.state.wife.y,10));
    }
    assert.ok(g.state.stats.cleaned>10,`Seed ${seed}: wife stopped cleaning`);assert.ok(g.state.stats.fed>0,`Seed ${seed}: no feeding`);
  }
});
