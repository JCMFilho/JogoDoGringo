const test=require('node:test'),assert=require('node:assert/strict');
const {Game,getWorld,dist}=require('../dist/engine.js');
function make(seed=7){return new Game({random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});}
test('all five floor plans grow in physical size, rooms, mess and maintenance',()=>{
  let area=0,rooms=0,mess=0,maintenance=-1;
  for(let home=0;home<5;home++){const w=getWorld(home);assert.ok(w.width*w.height>area);assert.ok(w.rooms.length>rooms);assert.ok(w.messRate>mess);assert.ok(w.maintenance>maintenance);area=w.width*w.height;rooms=w.rooms.length;mess=w.messRate;maintenance=w.maintenance;}
  assert.deepEqual([0,1,2,3,4].map(i=>getWorld(i).rooms.length),[3,5,9,12,16]);
});
test('every new room and service station has a real route from the original living room',()=>{
  const g=make();
  for(let home=0;home<5;home++){g.state.home=home;
    for(const r of g.world.rooms)for(let attempt=0;attempt<3;attempt++){const point=g.point(r),path=g.route(g.state.player,point);assert.ok(path.length,`${home}: ${r.name}`);const actor={...g.state.player,path};for(let i=0;i<3000&&actor.path.length;i++)g.follow(actor,.05,240);assert.equal(actor.path.length,0,`${home}: ${r.name}`);assert.ok(dist(actor,point)<45);assert.ok(g.walk(actor.x,actor.y,10));}
    for(const t of g.stations){assert.ok(g.walk(t.x,t.y,10),t.uid);assert.ok(g.route(g.state.player,t).length,t.uid);}
  }
});
test('buying a home expansion opens rooms, seeds their mess and raises running costs',()=>{
  const g=make();g.state.money=100000;
  for(let home=1;home<=4;home++){const before={cost:g.expense,mess:g.state.toys.length,chaos:g.state.chaos};assert.ok(g.upgrade('home'));assert.equal(g.state.home,home);assert.ok(g.expense>before.cost);assert.ok(g.state.toys.length>before.mess);assert.ok(g.state.chaos>=before.chaos);assert.equal(g.state.integrity,100);for(const r of g.world.rooms.filter(r=>r.level===home))assert.ok(g.state.toys.some(t=>t.x>=r.x&&t.x<r.x+r.w&&t.y>=r.y&&t.y<r.y+r.h),r.name);}
});
test('the wife reaches toys and uses service stations in the new wings',()=>{
  const g=make();g.state.home=4;g.state.children=[];g.state.money=10000;g.timers.mess=1000;
  const r=g.world.rooms.find(r=>r.kind==='clinic'),point=g.point(r);g.state.toys=[{...point,id:999,kind:4}];
  for(let i=0;i<1000&&g.state.toys.length;i++)g.update(.05);assert.equal(g.state.toys.length,0);assert.equal(g.state.stats.cleaned,1);
  const station=g.stations.find(s=>s.uid==='clinic-bottles');Object.assign(g.state.player,{x:station.x,y:station.y});g.state.bottles=0;g.stationCooldown=0;assert.ok(g.interact());assert.equal(g.state.bottles,3);
});
test('expanded save restores positions and mess outside the old map',()=>{
  const g=make();g.state.home=4;const room=g.world.rooms.at(-1),p=g.point(room);Object.assign(g.state.player,p);g.state.toys=[{...g.point(room),id:999,kind:4}];const h=make();assert.ok(h.restore(g.snapshot()));assert.equal(h.state.home,4);assert.equal(h.world.rooms.length,16);assert.equal(h.state.toys.length,1);assert.ok(h.state.player.x>960);assert.ok(h.state.player.y>600);assert.ok(h.walk(h.state.player.x,h.state.player.y,10));
});
