/* Simulation shared by the browser and the Node test suite. No DOM dependency. */
'use strict';
const FamilyGame = (() => {
  const {buildWorld}=typeof module!=="undefined"&&module.exports?require("./world.js"):globalThis.FamilyWorld;
  const W = 960, H = 600;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const MILESTONES = [
    [2,'Família inicial'],[3,'O Gringo quer mais'],[5,'Quinteto titular'],[7,'A minivan já era'],
    [11,'Gringo Futebol Clube'],[20,'Excursão escolar permanente'],[50,'Bairro dos Gringos'],
    [100,'Gringolândia'],[500,'Uma nova civilização']
  ];
  const STAGES = [
    {name:'Casa pequena',title:'Lar, doce caos',cost:180,capacity:7},
    {name:'Mansão',title:'Mansão dos Gringos',cost:480,capacity:20},
    {name:'Condomínio',title:'Condomínio da família',cost:1250,capacity:50},
    {name:'Bairro',title:'Bairro dos Gringos',cost:2800,capacity:100},
    {name:'Cidade',title:'Cidade Paim de Araujo',cost:0,capacity:500}
  ];
  const POWERS = [
    {id:'brazil',name:'Made in Brazil',icon:'ϟ',desc:'Todo mundo no modo turbo.',duration:10,cooldown:32,unlock:2},
    {id:'daddy',name:'International Daddy',icon:'⚑',desc:'“LET’S GO, KIDS!” Ordem por 12s.',duration:12,cooldown:38,unlock:2},
    {id:'first',name:'Family First',icon:'♥',desc:'Proteção total para o casal.',duration:10,cooldown:45,unlock:3},
    {id:'crowd',name:'Pai de Multidões',icon:'♟',desc:'A criançada entra no mutirão.',duration:9,cooldown:42,unlock:5},
    {id:'plan',name:'Plano de Expansão',icon:'↗',desc:'Metade dos custos por 15s.',duration:15,cooldown:48,unlock:7}
  ];
  // Shared with the renderer so visible openings always match collision geometry.
  const INTERIOR_WALLS = [{x:613,y:130,w:14,h:124},{x:613,y:360,w:14,h:14},{x:613,y:486,w:14,h:57},{x:627,y:327,w:65,h:12},{x:850,y:327,w:49,h:12}];
  const DOORWAYS = {nurserySide:{x:613,y:374,w:14,h:112},nurseryKitchen:{x:692,y:327,w:158,h:12}};
  const OBSTACLES = [
    {x:58,y:111,w:845,h:19}, {x:45,y:111,w:17,h:442}, {x:900,y:111,w:17,h:442},
    {x:58,y:540,w:845,h:17}, ...INTERIOR_WALLS,
    {x:89,y:157,w:119,h:43}, {x:356,y:163,w:147,h:43},
    {x:88,y:361,w:111,h:54}, {x:290,y:395,w:99,h:43},
    {x:656,y:153,w:223,h:43}, {x:739,y:250,w:81,h:34},
    {x:733,y:419,w:62,h:67},{x:823,y:419,w:64,h:65}
  ];
  const STATIONS = [
    {id:'work',x:150,y:224,label:'Trabalhar',detail:'Renda +R$ 22',icon:'⌨'},
    {id:'kitchen',x:766,y:219,label:'Preparar mamadeiras',detail:'3 mamadeiras · R$ 5',icon:'♜'},
    {id:'repair',x:523,y:177,label:'Reparar a casa',detail:'+22 integridade · R$ 12',icon:'⚒'}
  ];
  const worlds=new Map();
  function getWorld(home=0){home=clamp(Math.floor(home)||0,0,4);if(!worlds.has(home))worlds.set(home,buildWorld(home,{interior:INTERIOR_WALLS,furniture:OBSTACLES.slice(4+INTERIOR_WALLS.length),stations:STATIONS}));return worlds.get(home);}
  function canWalk(x,y,r=11,world=getWorld()){
    const b=world.bounds;
    return x>b.left+r&&x<b.right-r&&y>b.top+r&&y<b.bottom-r&&!world.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);
  }
  const ACTOR_RADIUS=10,NAV_RADIUS=14;
  function clearSegment(a,b,r=ACTOR_RADIUS,world=getWorld()){
    const steps=Math.max(1,Math.ceil(dist(a,b)/3));
    for(let i=0;i<=steps;i++){const t=i/steps;if(!canWalk(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r,world))return false;}return true;
  }
  function navigation(world){
    if(world.nav)return world.nav;
    const cols=Math.ceil(world.width/20),rows=Math.ceil(world.height/20),nodes=[],mask=new Uint8Array(cols*rows),links=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(canWalk(x*20+10,y*20+10,NAV_RADIUS,world)){const id=y*cols+x;mask[id]=1;nodes.push({x:x*20+10,y:y*20+10,id});}
    for(const n of nodes){const edges=[];for(const off of [1,-1,cols,-cols]){const id=n.id+off;if(mask[id]&&Math.abs(id%cols-n.id%cols)<=1){const p={x:id%cols*20+10,y:Math.floor(id/cols)*20+10};if(clearSegment(n,p,NAV_RADIUS,world))edges.push(id);}}links[n.id]=edges;}
    world.nav={cols,rows,nodes,links};return world.nav;
  }
  function findPath(start,goal,world=getWorld()){
    const nav=navigation(world),{cols,rows,nodes,links}=nav;
    const nearest=(p,line)=>{let result=null,best=Infinity;for(const n of nodes){const d=(n.x-p.x)**2+(n.y-p.y)**2;if(d<best&&(!line||clearSegment(p,n,ACTOR_RADIUS,world))){best=d;result=n;}}return result;};
    const a=nearest(start,true),b=nearest(goal,false);if(!a||!b)return [];
    const costs=new Float64Array(cols*rows).fill(Infinity),parents=new Int32Array(cols*rows).fill(-1),closed=new Uint8Array(cols*rows),heap=[];
    const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};};
    const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first.id;};
    const heuristic=id=>Math.abs(id%cols-b.id%cols)+Math.abs(Math.floor(id/cols)-Math.floor(b.id/cols));
    costs[a.id]=0;push(a.id,heuristic(a.id));
    while(heap.length){const n=pop();if(closed[n])continue;if(n===b.id){const path=[];let cur=n;while(parents[cur]>=0){path.unshift({x:cur%cols*20+10,y:Math.floor(cur/cols)*20+10});cur=parents[cur];}if(dist(start,a)>2)path.unshift({x:a.x,y:a.y});return path;}closed[n]=1;for(const next of links[n]){const g=costs[n]+1;if(!closed[next]&&g<costs[next]){costs[next]=g;parents[next]=n;push(next,g+heuristic(next));}}}
    return [];
  }
  class Game {
    constructor(options={}) {
      this.random=options.random||Math.random;
      this.events=[];this.nextId=1;
      this.state={kids:2,money:120,integrity:100,chaos:12,score:0,time:0,bottles:3,combo:0,
        round:1,home:0,upgrades:{robot:0,income:0},active:{},cooldowns:{},comboCount:0,
        tasks:0,prep:null,ended:false,ending:null,victorySeen:false,record:2,allyMode:0,
        wifeStatus:'De olho na bagunça.',stats:{cleaned:0,fed:0,born:0},
        player:{x:310,y:325,dir:'down',path:[],moving:false},wife:{x:467,y:298,dir:'down',path:[],moving:false},
        children:[],toys:[],earned:[2]};
      this.timers={mess:4,hunger:7,economy:10,ally:0,robot:5,crowd:1,action:0,comboDecay:5};
      this.lastAction={player:-100,wife:-100};this.aiTarget=null;this.aiRepath=0;this.aiStall=0;this.aiAvoid=new Map();this.aiDestination=null;this.workCooldown=0;this.stationCooldown=0;
      this.spawnChild();this.spawnChild();for(let i=0;i<5;i++)this.spawnToy();
    }
    emit(type,data={}){this.events.push({type,...data});}
    drainEvents(){return this.events.splice(0);}
    get world(){return getWorld(this.state.home);}
    get stations(){return this.world.stations;}
    walk(x,y,r=11){return canWalk(x,y,r,this.world);}
    route(a,b){return findPath(a,b,this.world);}
    clear(a,b,r=ACTOR_RADIUS){return clearSegment(a,b,r,this.world);}
    point(room){
      if(!room&&this.state.home)room=this.world.rooms[Math.floor(this.random()*this.world.rooms.length)];
      for(let i=0;i<150;i++){const p=room?{x:room.x+24+this.random()*(room.w-48),y:room.y+24+this.random()*(room.h-48)}:{x:95+this.random()*780,y:228+this.random()*285};if(this.walk(p.x,p.y,17))return p;}return{x:460,y:320};
    }
    spawnChild(){if(this.state.children.length>=72)return;const p=this.point();this.state.children.push({...p,id:this.nextId++,kind:this.state.children.length%2?'filha':'filho',dir:'down',hunger:6+this.random()*15,nextMove:this.random()*3,goal:this.point(),moving:false});}
    spawnToy(near){if(this.state.toys.length>=this.world.messLimit)return;let p=near?{x:near.x+(this.random()-.5)*44,y:near.y+(this.random()-.5)*35}:this.point();if(!this.walk(p.x,p.y,8))p=this.point();const room=this.world.rooms.find(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h);const kind=room?.kind==='laundry'?4:room?.kind==='dining'?5:['classroom','townhall'].includes(room?.kind)?6:room?.kind==='playground'?7:Math.floor(this.random()*4);this.state.toys.push({...p,id:this.nextId++,kind});}
    get babyCost(){return Math.round((22+this.state.kids*3)*(this.effect('plan')?.5:1));}
    get income(){return 5+this.state.upgrades.income*8+this.state.home*9+Math.floor(this.state.kids/10)*3;}
    get expense(){return Math.round((2+this.state.kids*.65+this.world.maintenance)*(this.effect('plan')?.5:1));}
    get robotCost(){return 90*(this.state.upgrades.robot+1);}
    get incomeCost(){return 70*(this.state.upgrades.income+1);}
    effect(id){return (this.state.active[id]||0)>0;}
    discount(value){return Math.ceil(value*(this.effect('plan')?.5:1));}
    spend(value){if(this.state.money<value){this.emit('toast',{text:'O caixa pediu socorro. Hora de trabalhar!',tone:'warn'});return false;}this.state.money-=value;return true;}
    beginPrep(){
      const s=this.state;
      if(s.ended||s.prep)return false;
      if(s.kids>=500){this.emit('toast',{text:'Uma civilização inteira. O cartório pediu férias.'});return false;}
      if(!this.spend(this.babyCost))return false;
      const clean=Math.min(7,2+Math.floor(s.kids/10)),bottles=Math.min(4,1+Math.floor(s.kids/30));
      s.prep={time:60,clean:0,bottles:0,work:0,needClean:clean,needBottles:bottles,needWork:1};
      while(s.toys.length<clean+1)this.spawnToy();
      this.emit('toast',{text:'Operação bebê: limpe, prepare mamadeiras e faça uma renda!'});this.emit('prep');return true;
    }
    checkPrep(){const p=this.state.prep;if(p&&p.clean>=p.needClean&&p.bottles>=p.needBottles&&p.work>=p.needWork)this.birth();}
    birth(){
      const s=this.state;if(!s.prep)return false;
      s.prep=null;s.kids++;s.round++;s.stats.born++;s.record=Math.max(s.record,s.kids);
      s.score+=150+s.kids*25;s.money+=20+s.home*12;s.chaos=clamp(s.chaos+5,0,100);s.integrity=clamp(s.integrity+5,0,100);this.spawnChild();
      const m=MILESTONES.find(([n])=>n===s.kids);
      if(m&&!s.earned.includes(s.kids)){s.earned.push(s.kids);s.score+=s.kids*100;s.money+=Math.min(650,s.kids*14);this.emit('milestone',{kids:s.kids,text:m[1]});}
      this.emit('birth',{kids:s.kids,text:s.kids===7?'A minivan pediu demissão.':s.kids===11?'Já dá para escalar o time!':`Chegou mais um! Agora são ${s.kids} herdeiros.`});
      if(s.kids===100&&!s.victorySeen){s.victorySeen=true;this.emit('victory');}
      if(s.kids===500)this.emit('civilization');
      return true;
    }
    actionDone(actor,kind,x,y){
      const s=this.state;s.tasks++;s.score+=kind==='clean'?12:20;
      this.lastAction[actor]=s.time;
      const other=actor==='player'?'wife':'player';
      const together=Math.abs(s.time-this.lastAction[other])<7;
      s.combo=clamp(s.combo+(together?22:6),0,100);
      this.emit('action',{actor,kind,x,y,together});
      if(s.combo>=100){s.combo=0;s.comboCount++;const index=(s.comboCount-1)%3;
        const names=['Amor Infinito','Super Pais','Mutirão da Família'];
        const ids=['love','super','mutirao'];s.active[ids[index]]=12;s.money+=18;s.score+=100;
        if(index===2){const removed=s.toys.length;s.toys=[];if(s.prep)s.prep.clean+=removed;s.chaos=Math.max(0,s.chaos-20);}
        this.emit('combo',{text:names[index]});
      }
      this.checkPrep();
    }
    clean(toy,actor='player'){
      const s=this.state;if(!toy||!s.toys.includes(toy)||s.ended)return false;
      s.toys.splice(s.toys.indexOf(toy),1);s.stats.cleaned++;s.chaos=Math.max(0,s.chaos-3);s.money+=1;
      if(s.prep)s.prep.clean++;this.actionDone(actor,'clean',toy.x,toy.y);return true;
    }
    feed(child,actor='player'){
      const s=this.state;if(!child||child.hunger<45||s.bottles<1||s.ended)return false;
      s.bottles--;child.hunger=0;s.stats.fed++;s.chaos=Math.max(0,s.chaos-5);s.integrity=clamp(s.integrity+1,0,100);
      this.actionDone(actor,'feed',child.x,child.y);return true;
    }
    station(id,actor='player',location){
      const s=this.state;if(s.ended)return false;
      const at=location||this.stations.find(t=>t.id===id)||this.stations[0];
      if(id==='work'){
        if(actor!=='player'||this.workCooldown>0)return false;
        this.workCooldown=2.6;
        const amount=(22+s.upgrades.income*10+s.home*8)*(this.effect('super')?2:1);
        s.money+=amount;if(s.prep)s.prep.work++;
        this.emit('float',{x:at.x,y:at.y-27,text:`+R$ ${amount}`,color:'#bfea91'});this.actionDone(actor,'work',at.x,at.y);return true;
      }
      if(this.stationCooldown>0)return false;
      if(id==='kitchen'){
        if(s.bottles>=30){
          if(s.prep&&s.prep.bottles<s.prep.needBottles){this.stationCooldown=1.5;s.prep.bottles++;this.actionDone(actor,'bottles',at.x,at.y);return true;}
          if(actor==='player')this.emit('toast',{text:'Despensa cheia: 30 mamadeiras prontas.'});return false;
        }
        if(!this.spend(this.discount(5)))return false;
        this.stationCooldown=1.5;s.bottles=Math.min(30,s.bottles+3);if(s.prep)s.prep.bottles++;
        this.emit('float',{x:at.x,y:at.y-22,text:'+3 mamadeiras',color:'#f7e7ad'});this.actionDone(actor,'bottles',at.x,at.y);return true;
      }
      if(id==='repair'){
        if(s.integrity>98){if(actor==='player')this.emit('toast',{text:'Casa inteirinha! Aproveite esse raro momento.'});return false;}
        if(!this.spend(this.discount(12)))return false;
        this.stationCooldown=1.5;s.integrity=clamp(s.integrity+22,0,100);this.actionDone(actor,'repair',at.x,at.y);this.emit('float',{x:at.x,y:at.y-20,text:'+22 integridade',color:'#bfea91'});return true;
      }
      return false;
    }
    nearby(){
      const s=this.state,player=s.player;
      const choices=[...s.toys.map(t=>({type:'toy',ref:t,...t,label:'Recolher brinquedo'})),...s.children.filter(c=>c.hunger>=45).map(c=>({type:'child',ref:c,...c,label:'Dar mamadeira'})),...this.stations.map(t=>({type:'station',ref:t,...t}))];
      return choices.filter(c=>dist(player,c)<58).sort((a,b)=>dist(player,a)-dist(player,b))[0]||null;
    }
    interact(target){
      if(this.state.ended||this.timers.action>0)return false;
      const n=target||this.nearby();if(!n)return false;
      if(dist(this.state.player,n.ref||n)>65)return false;
      this.timers.action=.28;
      if(n.type==='toy')return this.clean(n.ref);
      if(n.type==='child'){
        if(this.state.bottles<1){this.emit('toast',{text:'Acabaram as mamadeiras! Prepare mais na cozinha.'});return false;}
        return this.feed(n.ref);
      }
      return this.station(n.id||n.ref.id,'player',n.ref||n);
    }
    usePower(id){
      const s=this.state,p=POWERS.find(p=>p.id===id);
      if(!p||s.ended||s.kids<p.unlock||(s.cooldowns[id]||0)>0)return false;
      s.active[id]=p.duration;s.cooldowns[id]=p.cooldown;
      if(id==='daddy')s.chaos=Math.max(0,s.chaos-10);
      if(id==='crowd')this.timers.crowd=0;
      this.emit('power',{id,text:id==='daddy'?"LET’S GO, KIDS!":p.name});return true;
    }
    upgrade(id){
      const s=this.state;if(s.ended)return false;
      if(id==='home'){
        if(s.home>=STAGES.length-1)return false;
        if(!this.spend(this.discount(STAGES[s.home].cost)))return false;
        s.home++;s.integrity=100;s.chaos=clamp(s.chaos+8+s.home*2,0,100);s.score+=250*s.home;
        const newRooms=this.world.rooms.filter(r=>r.level===s.home);
        for(const room of newRooms)for(let i=0;i<3+s.home;i++)this.spawnToy(this.point(room));
        for(let i=0;i<s.children.length;i++){const child=s.children[i];child.goal=this.point(newRooms[i%newRooms.length]);child.path=this.route(child,child.goal);child.nextMove=60;}
        s.player.path=[];s.wife.path=[];this.aiTarget=null;this.aiAvoid.clear();this.timers.ally=0;this.timers.mess=Math.min(this.timers.mess,1);
        this.emit('upgrade',{home:s.home,rooms:newRooms.map(r=>r.name),text:`${STAGES[s.home].name}: +${newRooms.length} cômodos. A bagunça ganhou território!`});return true;
      }
      if(!['robot','income'].includes(id))return false;
      if(s.upgrades[id]>=5)return false;
      if(!this.spend(this.discount(id==='robot'?this.robotCost:this.incomeCost)))return false;
      s.upgrades[id]++;this.emit('upgrade',{text:id==='robot'?'Robô de limpeza contratado. Sem direito a férias.':'Seu pai aumentou a carga de trabalho. O boleto que lute!'});return true;
    }
    move(actor,dx,dy,dt,speed=170){
      const n=Math.hypot(dx,dy);actor.moving=false;if(n<.05)return;
      actor.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
      const before={x:actor.x,y:actor.y},step=speed*dt,steps=Math.max(1,Math.ceil(step/4)),rx=dx/n*step/steps,ry=dy/n*step/steps;
      for(let i=0;i<steps;i++){
        if(this.walk(actor.x+rx,actor.y,ACTOR_RADIUS))actor.x+=rx;
        if(this.walk(actor.x,actor.y+ry,ACTOR_RADIUS))actor.y+=ry;
      }
      actor.moving=dist(before,actor)>.00001;
    }
    follow(actor,dt,speed){
      const before={x:actor.x,y:actor.y};let budget=speed*dt;actor.moving=false;actor.navBlocked=false;
      // Finish each turn exactly. Skipping a point by a few pixels clips corners and
      // leaves tiny coordinate errors pressed against an inflated wall indefinitely.
      while(actor.path?.length&&budget>0){
        const p=actor.path[0],d=dist(actor,p);
        if(d<.000001){actor.x=p.x;actor.y=p.y;actor.path.shift();continue;}
        const step=Math.min(d,budget),next=step===d?{x:p.x,y:p.y}:{x:actor.x+(p.x-actor.x)*step/d,y:actor.y+(p.y-actor.y)*step/d};
        if(!this.clear(actor,next)){actor.navBlocked=true;break;}
        actor.dir=Math.abs(p.x-actor.x)>Math.abs(p.y-actor.y)?(p.x>actor.x?'right':'left'):(p.y>actor.y?'down':'up');
        actor.x=next.x;actor.y=next.y;budget-=step;if(step===d)actor.path.shift();
      }
      actor.moving=dist(before,actor)>.00001;
    }
    goTo(x,y){this.state.player.path=this.route(this.state.player,{x,y});}
    wifeTaskKey(task){return `${task.type}:${task.ref?task.ref.id:task.uid||task.id}`;}
    wifeTaskValid(task){
      if(!task)return false;
      const s=this.state;
      if(task.type==='toy')return s.toys.includes(task.ref);
      if(task.type==='child')return s.children.includes(task.ref)&&task.ref.hunger>=45&&s.bottles>0;
      if(task.id==='repair')return s.integrity<65&&s.money>=this.discount(12)&&this.stationCooldown<=0;
      if(task.id==='kitchen'){
        const prep=s.prep&&s.prep.bottles<s.prep.needBottles;
        const hungry=s.children.some(c=>c.hunger>=45)&&s.bottles===0;
        const reserve=s.bottles<Math.min(6,Math.max(2,Math.ceil(s.kids/4)))&&s.money>=20;
        return this.stationCooldown<=0&&(prep||hungry||reserve)&&(s.bottles>=30?!!prep:s.money>=this.discount(5));
      }
      return false;
    }
    planWifeTask(task){
      const s=this.state,p=task.ref||task,key=this.wifeTaskKey(task);
      if(!this.walk(p.x,p.y,0)){this.aiAvoid.set(key,s.time+2);return false;}
      const near=dist(s.wife,p)<48&&this.clear(s.wife,p,0);
      const path=near?[]:this.route(s.wife,p),end=path[path.length-1]||s.wife;
      if(!near&&(!path.length||dist(end,p)>=48||!this.clear(end,p,0))){this.aiAvoid.set(key,s.time+2);return false;}
      this.aiTarget=task;this.aiDestination={x:p.x,y:p.y};s.wife.path=path;this.aiRepath=.25;this.aiStall=0;return true;
    }
    updateWife(dt){
      const s=this.state,wife=s.wife;this.timers.ally-=dt;this.aiRepath-=dt;
      if(this.timers.ally<=0){
        this.timers.ally=.25;
        for(const [key,until]of this.aiAvoid)if(until<=s.time)this.aiAvoid.delete(key);
        if(!this.wifeTaskValid(this.aiTarget)||this.aiTarget&&this.aiAvoid.has(this.wifeTaskKey(this.aiTarget))){this.aiTarget=null;wife.path=[];}
        const prep=s.prep&&s.prep.bottles<s.prep.needBottles;
        const candidates=[
          ...this.stations.filter(t=>t.id==='repair').map(t=>({type:'station',...t,priority:0})),
          ...s.toys.map(ref=>({type:'toy',ref,priority:s.allyMode===1?1:3})),
          ...s.children.map(ref=>({type:'child',ref,priority:2})),
          ...this.stations.filter(t=>t.id==='kitchen').map(t=>({type:'station',...t,priority:prep||s.bottles===0?2:4}))
        ].filter(t=>this.wifeTaskValid(t)&&!this.aiAvoid.has(this.wifeTaskKey(t)))
          .sort((a,b)=>a.priority-b.priority||dist(wife,a.ref||a)-dist(wife,b.ref||b));
        // Keep a valid assignment; switching to the Euclidean-nearest task each
        // tick makes the ally reverse direction repeatedly near a dividing wall.
        for(const task of candidates){
          if(this.aiTarget&&task.priority>=this.aiTarget.priority)break;
          if(this.planWifeTask(task))break;
        }
        const target=this.aiTarget;
        s.wifeStatus=target?target.type==='toy'?'Organizando a bagunça.':target.type==='child'?'Cuidando dos pequenos.':target.id==='repair'?'Reparando a casa.':'Preparando mamadeiras.':'Sem tarefas pendentes. De olho na família.';
      }
      if(!this.aiTarget){wife.moving=false;this.aiStall=0;return;}
      let p=this.aiTarget.ref||this.aiTarget;
      if(this.aiRepath<=0&&this.aiTarget.type==='child'&&dist(p,this.aiDestination)>18){
        if(!this.planWifeTask(this.aiTarget)){this.aiTarget=null;wife.path=[];this.timers.ally=0;wife.moving=false;return;}
      }
      const before={x:wife.x,y:wife.y},hadPath=wife.path.length>0;
      const speed=(this.effect('brazil')?245:145)*(1+s.home*.14)*(this.effect('super')?1.3:1);this.follow(wife,dt,speed);
      this.aiStall=hadPath&&dist(before,wife)<.01?this.aiStall+dt:0;
      const arrived=dist(wife,p)<48&&this.clear(wife,p,0);
      if(!arrived&&this.aiRepath<=0&&(wife.navBlocked||this.aiStall>.35||!wife.path.length)){
        if(!this.planWifeTask(this.aiTarget)){this.aiTarget=null;wife.path=[];this.timers.ally=0;wife.moving=false;}
        return;
      }
      if(arrived){const t=this.aiTarget;let done=false;
        if(t.type==='toy')done=this.clean(t.ref,'wife');else if(t.type==='child')done=this.feed(t.ref,'wife');else done=this.station(t.id,'wife',t);
        if(!done)this.aiAvoid.set(this.wifeTaskKey(t),s.time+.5);
        this.aiTarget=null;wife.path=[];wife.moving=false;this.aiStall=0;this.timers.ally=done?.08:0;
      }
    }
    update(dt,input={}){
      const s=this.state;if(s.ended)return;dt=clamp(dt,0,.1);s.time+=dt;
      for(const id of Object.keys(s.active))s.active[id]=Math.max(0,s.active[id]-dt);
      for(const id of Object.keys(s.cooldowns))s.cooldowns[id]=Math.max(0,s.cooldowns[id]-dt);
      this.workCooldown=Math.max(0,this.workCooldown-dt);this.stationCooldown=Math.max(0,this.stationCooldown-dt);this.timers.action=Math.max(0,this.timers.action-dt);
      const speed=(this.effect('brazil')?285:190)*(1+s.home*.12);
      if(input.dx||input.dy){s.player.path=[];this.move(s.player,input.dx||0,input.dy||0,dt,speed);}else this.follow(s.player,dt,speed);
      if(input.interact)this.interact();
      this.updateWife(dt);
      const orderly=this.effect('daddy'),care=this.effect('love'),crowd=this.effect('crowd')||this.effect('mutirao');
      for(const child of s.children){
        child.hunger=clamp(child.hunger+dt*(care?.05:.65+Math.min(s.kids,100)*.006),0,100);child.nextMove-=dt;
        if(orderly){child.moving=false;child.dir='down';continue;}
        if(child.nextMove<=0&&!child.path?.length){child.goal=this.point();child.path=this.route(child,child.goal);child.nextMove=2+this.random()*5;}
        this.follow(child,dt,(this.effect('brazil')?82:48)*(1+s.home*.1)*(child.hunger>65?.55:1));
        if(child.navBlocked){child.path=[];child.nextMove=0;}
      }
      this.timers.mess-=dt;
      const pressure=Math.min(8,1+Math.log2(s.kids/2+1)*.65)*this.world.messRate;
      if(this.timers.mess<=0){this.timers.mess=Math.max(.5,5/pressure);if(!orderly&&!crowd)for(let i=0;i<1+Math.floor(s.home/2);i++)this.spawnToy(this.random()<.5?s.children[Math.floor(this.random()*s.children.length)]:null);}
      this.timers.economy-=dt;
      if(this.timers.economy<=0){this.timers.economy=10;s.money+=this.income-this.expense;if(s.money<0){s.integrity=Math.max(0,s.integrity-2);}}
      const hungry=s.children.filter(c=>c.hunger>65).length;
      const overcrowd=Math.max(0,s.kids-STAGES[s.home].capacity);
      const targetChaos=clamp(6+s.toys.length*3.2/(1+s.home*.24)+hungry*2.7+Math.log2(s.kids)*2+s.home*3+Math.min(18,overcrowd*.35),0,100);
      s.chaos=clamp(s.chaos+(targetChaos-s.chaos)*dt*.35,0,100);
      if(!this.effect('first')&&!this.effect('super')){
        const damage=Math.max(0,s.chaos-36)*.016+Math.max(0,s.chaos-75)*.055;
        s.integrity=clamp(s.integrity-damage*dt,0,100);
      }
      this.timers.robot-=dt;if(s.upgrades.robot&&this.timers.robot<=0){this.timers.robot=Math.max(.7,5/s.upgrades.robot);const toy=s.toys[0];if(toy){s.toys.shift();s.chaos=Math.max(0,s.chaos-2);s.score+=5;if(s.prep)s.prep.clean++;this.emit('robot',{x:toy.x,y:toy.y});this.checkPrep();}}
      this.timers.crowd-=dt;if(crowd&&this.timers.crowd<=0){this.timers.crowd=.65;for(let i=0;i<3;i++){const toy=s.toys[0];if(toy)this.clean(toy,'wife');}for(const c of s.children)c.hunger=Math.max(0,c.hunger-4);}
      if(s.prep){s.prep.time-=dt;if(s.prep.time<=0){s.prep=null;s.integrity=Math.max(0,s.integrity-6);this.emit('prepFailed',{text:'O cantinho não ficou pronto. Respire e tente de novo!'});}}
      if(s.money<=-60||s.integrity<=0){s.ended=true;s.ending=s.integrity<=0?'A casa pediu um tempo.':'O orçamento foi comprar cigarro.';this.emit('gameover',{text:s.ending});}
    }
    snapshot(){return JSON.parse(JSON.stringify(this.state));}
    restore(data){
      if(!data||!Number.isFinite(data.kids)||data.kids<2||data.kids>500||!Number.isFinite(data.money)||!data.player||!Array.isArray(data.children)||!data.upgrades||!Array.isArray(data.toys)||data.ended)return false;
      const fresh=this.state;this.state={...fresh,...data,active:{...data.active},cooldowns:{...data.cooldowns},stats:{...fresh.stats,...data.stats},upgrades:{...fresh.upgrades,...data.upgrades},wife:{...fresh.wife,...data.wife,path:[]},player:{...fresh.player,...data.player,path:[]}};
      this.state.home=clamp(Math.floor(Number(data.home)||0),0,4);
      this.state.children=this.state.children.slice(0,72);this.state.toys=this.state.toys.slice(0,this.world.messLimit);
      for(const actor of [this.state.player,this.state.wife,...this.state.children])if(!this.walk(actor.x,actor.y,10))Object.assign(actor,this.point());
      this.state.toys=this.state.toys.filter(toy=>this.walk(toy.x,toy.y,8));
      this.state.integrity=clamp(Number(data.integrity)||100,1,100);this.state.home=clamp(Math.floor(Number(data.home)||0),0,4);
      this.state.chaos=clamp(Number(data.chaos)||0,0,100);this.state.earned=Array.isArray(data.earned)?data.earned:[2];
      this.nextId=Math.max(1,...this.state.children.map(c=>Number(c.id)||0),...this.state.toys.map(t=>Number(t.id)||0))+1;
      this.aiTarget=null;this.aiAvoid.clear();this.aiStall=0;this.aiDestination=null;this.timers.ally=0;this.events=[];return true;
    }
  }
  return {Game,MILESTONES,STAGES,POWERS,STATIONS,OBSTACLES,INTERIOR_WALLS,DOORWAYS,canWalk,findPath,getWorld,clamp,dist,W,H};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FamilyGame;
if(typeof globalThis!=='undefined')globalThis.FamilyGame=FamilyGame;
