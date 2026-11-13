/* Physical floor plans shared by the simulation, renderer and map. */
'use strict';
const FamilyWorld=(()=>{
  function buildWorld(home,base){
    const right=home>=3?1738:home>=1?1318:898,bottom=home>=4?1378:home>=2?958:538;
    const walls=[{x:48,y:111,w:right-30,h:19},{x:48,y:111,w:17,h:bottom-91},{x:right+2,y:111,w:17,h:bottom-91},{x:48,y:bottom+5,w:right-30,h:15},...base.interior];
    const rooms=[{id:'living',name:'Sala da família',kind:'living',x:65,y:134,w:548,h:404,level:0},{id:'kitchen',name:'Cozinha',kind:'kitchen',x:627,y:134,w:271,h:193,level:0},{id:'nursery',name:'Mini herdeiros',kind:'nursery',x:627,y:339,w:271,h:199,level:0}];
    const furniture=[],stations=base.stations.map(t=>({...t,uid:t.id})),doors=[];
    const wall=(x,y,w,h)=>walls.push({x,y,w,h});
    const room=(id,name,kind,x,y,w,h,level)=>{const r={id,name,kind,x,y,w,h,level};rooms.push(r);return r;};
    const item=(r,kind,dx,dy,w,h)=>furniture.push({kind,x:r.x+dx,y:r.y+dy,w,h,room:r.id});
    const station=(id,uid,x,y,label)=>stations.push({id,uid,x,y,label,icon:id==='work'?'⌨':id==='kitchen'?'♜':'⚒'});
    function furnished(r){
      if(r.kind==='suite'||r.kind==='dorm'){
        item(r,'bed',30,35,74,70);item(r,'bed',r.w-106,35,74,70);
        if(r.h>250){item(r,'bed',30,r.h-109,74,70);item(r,'bed',r.w-106,r.h-109,74,70);}
      }else if(r.kind==='dining'){
        item(r,'table',30,58,78,52);item(r,'table',r.w-112,58,78,52);item(r,'table',30,r.h-108,78,52);item(r,'table',r.w-112,r.h-108,78,52);
      }else if(r.kind==='laundry'){
        item(r,'washer',27,32,53,48);item(r,'washer',92,32,53,48);item(r,'shelf',r.w-93,34,64,37);
      }else if(r.kind==='classroom'){
        for(let i=0;i<3;i++)item(r,'desk',28+i*110,42,68,39);
        if(r.h>260)for(let i=0;i<3;i++)item(r,'desk',28+i*110,r.h-92,68,39);
      }else if(r.kind==='clinic'){
        item(r,'bed',30,40,74,70);item(r,'bed',r.w-106,40,74,70);item(r,'shelf',30,r.h-80,85,36);
      }else if(r.kind==='townhall'){
        item(r,'desk',32,40,90,45);item(r,'desk',r.w-126,40,90,45);item(r,'shelf',35,r.h-76,75,30);
      }else if(r.kind==='playroom'||r.kind==='daycare'){
        item(r,'toybox',28,50,55,34);item(r,'toybox',r.w-88,50,55,34);
      }else if(r.kind==='playground'){
        item(r,'slide',35,50,65,70);item(r,'toybox',r.w-91,55,55,34);
      }
    }
    if(home>=1){
      wall(900,111,17,139);wall(900,390,17,168);doors.push({x:898,y:250,w:22,h:140,level:1});
      wall(917,327,123,12);wall(1190,327,130,12);
      furnished(room('suite','Suíte do casal','suite',918,134,400,193,1));
      furnished(room('playroom','Brinquedoteca','playroom',918,339,400,199,1));
      station('kitchen','playroom-bottles',1230,490,'Mamadeiras da brinquedoteca');
    }
    if(home>=2){
      wall(58,540,372,17);wall(570,540,333,17);wall(917,540,123,17);wall(1180,540,140,17);
      doors.push({x:430,y:538,w:140,h:22,level:2},{x:1040,y:538,w:140,h:22,level:2});
      const types=[['dorm','Dormitório coletivo'],['dining','Refeitório'],['daycare','Berçário ampliado'],['laundry','Lavanderia']];
      for(let i=0;i<4;i++){
        const x=65+i*314,r=room('south-'+i,types[i][1],types[i][0],x,632,310,326,2);furnished(r);
        wall(x,620,80,12);wall(x+230,620,84,12);doors.push({x:x+80,y:620,w:150,h:12,level:2});
        if(i){wall(x-6,632,12,108);wall(x-6,860,12,100);}
      }
      station('kitchen','daycare-bottles',850,796,'Mamadeiras do berçário');station('work','dining-work',570,810,'Trabalhar no refeitório');station('repair','south-repair',1230,845,'Reparar a ala sul');
    }
    if(home>=3){
      wall(1320,111,17,139);wall(1320,390,17,340);wall(1320,870,17,108);
      doors.push({x:1318,y:250,w:22,h:140,level:3},{x:1318,y:730,w:22,h:140,level:3});
      for(const y of [400,680]){wall(1337,y,123,12);wall(1620,y,120,12);doors.push({x:1460,y,w:160,h:12,level:3});}
      furnished(room('classroom','Escolinha dos Gringos','classroom',1338,134,400,266,3));
      furnished(room('playground','Parquinho coberto','playground',1338,412,400,268,3));
      furnished(room('gym','Quadra da família','gym',1338,692,400,266,3));
      station('kitchen','school-bottles',1690,360,'Lanche da escolinha');
    }
    if(home>=4){
      wall(48,960,772,17);wall(980,960,760,17);doors.push({x:820,y:958,w:160,h:22,level:4});
      const specs=[['classroom','Escola da dinastia'],['playground','Praça dos herdeiros'],['townhall','Prefeitura Paim de Araujo'],['clinic','Enfermaria da família']];
      for(let i=0;i<4;i++){
        const x=65+i*419,r=room('city-'+i,specs[i][1],specs[i][0],x,1052,414,326,4);furnished(r);
        wall(x,1040,130,12);wall(x+290,1040,129,12);doors.push({x:x+130,y:1040,w:160,h:12,level:4});
        if(i){wall(x-6,1052,12,88);wall(x-6,1280,12,100);}
      }
      station('work','city-work',1100,1220,'Trabalhar na prefeitura');station('kitchen','clinic-bottles',1540,1220,'Mamadeiras da enfermaria');station('repair','city-repair',700,1210,'Reparar a cidade');
    }
    return {home,width:right+62,height:bottom+62,bounds:{left:65,top:134,right,bottom},walls,rooms,furniture,doors,stations,
      obstacles:[...walls,...base.furniture,...furniture],messRate:[1,1.4,1.85,2.3,2.8][home],maintenance:[0,4,9,15,24][home],messLimit:[65,95,130,170,220][home]};
  }
  return {buildWorld};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FamilyWorld;
if(typeof globalThis!=='undefined')globalThis.FamilyWorld=FamilyWorld;
