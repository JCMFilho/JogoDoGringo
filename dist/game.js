/* Gringo: Fábrica de Herdeiros. Canvas renderer, input, audio and accessible UI. */
(() => {
  'use strict';
  const {Game,MILESTONES,STAGES,POWERS,STATIONS,INTERIOR_WALLS,DOORWAYS,clamp,dist,W,H}=FamilyGame;
  const ASSET_BASE=document.documentElement.dataset.assetBase||'';
  const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
  const SAVE_KEY='gringo-save-v1',BEST_KEY='gringo-best-v1',SOUND_KEY='gringo-sound-v1',MUSIC_KEY='gringo-music-v1';
  const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}},remove(key){try{localStorage.removeItem(key);}catch{}}};
  let game=new Game(),running=false,modalOpen=true,modalType='',lastFrame=0,uiTimer=0,saveTimer=0,toastTimer=null;
  let keys={},clickTarget=null,particles=[],floaters=[],soundOn=storage.get(SOUND_KEY)==='true',audio=null;
  let best=Number(storage.get(BEST_KEY))||2,loaded=false,previousFocus=null,sceneEnding=false,imagesReady=false;
  let musicOn=storage.get(MUSIC_KEY)!=='false',overview=false,buildFlash=0,audioUnlocked=false,renderDensity=0;
  const camera={x:0,y:0,zoom:1},MINIMAP={x:W-168,y:H-215,w:150,h:108};
  const music=new FamilyMusic.Player(()=>{initAudio();return audio;});
  const images={},atlas=globalThis.FAMILY_ATLAS.characters;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money=n=>`R$ ${Math.floor(n).toLocaleString('pt-BR')}`;
  const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  const loadImage=name=>new Promise(resolve=>{const im=new Image();images[name]=im;im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=`${ASSET_BASE}assets/characters/${name}.png`;});
  Promise.all(['gringo','esposa','filho','filha'].map(loadImage)).then(ok=>{imagesReady=ok.every(Boolean);if(!imagesReady)toast('Uma imagem não carregou. Verifique a pasta assets/characters.','warn');});

  function initAudio(){try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{soundOn=false;}}
  function syncMusic(){music.setPlaying(audioUnlocked&&musicOn&&loaded&&running&&!modalOpen&&!document.hidden);$('music').setAttribute('aria-pressed',String(musicOn));$('music').setAttribute('aria-label',musicOn?'Desativar música de fundo':'Ativar música de fundo');$('music').title=musicOn?'♫ Música ligada — clique para desativar':'♫ Música desligada — clique para ativar';$('music').classList.toggle('selected',musicOn);}
  function unlockAudio(){if(audioUnlocked)return;audioUnlocked=true;syncMusic();}
  addEventListener('pointerup',unlockAudio,{capture:true});
  addEventListener('keydown',unlockAudio,{capture:true});
  function resizeCanvas(){
    const box=canvas.getBoundingClientRect();renderDensity=clamp(window.devicePixelRatio||1,1,3);
    const width=Math.max(1,Math.round((box.width||W)*renderDensity)),height=Math.max(1,Math.round((box.height||H)*renderDensity));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  }
  addEventListener('resize',resizeCanvas);
  function updateCamera(){const world=game.world;if(overview&&game.state.home){camera.zoom=Math.min(W/world.width,H/world.height);camera.x=-(W/camera.zoom-world.width)/2;camera.y=-(H/camera.zoom-world.height)/2;}else{camera.zoom=1;camera.x=clamp(game.state.player.x-W/2,0,Math.max(0,world.width-W));camera.y=clamp(game.state.player.y-H/2,0,Math.max(0,world.height-H));}}
  function toggleOverview(){if(modalOpen||!running||!game.state.home)return;overview=!overview;updateCamera();updateUI();}
  function beep(frequency=440,length=.08,type='square',volume=.035,delay=0){
    if(!soundOn)return;initAudio();if(!audio)return;
    const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;
    osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+length);
  }
  function chime(){[523,659,784,1047].forEach((f,i)=>beep(f,.16,'triangle',.07,i*.09));}
  function toast(text,tone='good'){$('world-toast').textContent=text;$('world-toast').className='world-toast show'+(tone==='warn'?' danger':'');$('announcer').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('world-toast').classList.remove('show'),4500);}
  function spriteMarkup(name,child=false){return `<div class="intro-sprite${child?' child':''}${name==='filha'?' girl':''}"><img src="${ASSET_BASE}assets/characters/${name}.png" alt="${name==='esposa'?'Sabrina':name==='gringo'?'Gringo':name==='filho'?'Filho':'Filha'}"></div>`;}
  const familyMarkup=()=>`<div class="intro-family">${spriteMarkup('filho',true)}${spriteMarkup('gringo')}${spriteMarkup('esposa')}${spriteMarkup('filha',true)}</div>`;
  function openModal(type,html){
    const wasOpen=modalOpen;modalOpen=true;modalType=type;keys={};clickTarget=null;
    if(!wasOpen)previousFocus=document.activeElement;
    $('modal').innerHTML=html;$('modal-backdrop').hidden=false;
    syncMusic();
    requestAnimationFrame(()=>$('modal').querySelector('button')?.focus({preventScroll:true}));
    if(loaded)saveGame();
  }
  function closeModal(){modalOpen=false;modalType='';$('modal-backdrop').hidden=true;keys={};if(previousFocus&&document.contains(previousFocus))previousFocus.focus();else canvas.focus({preventScroll:true});previousFocus=null;syncMusic();}
  function start(){loaded=true;running=true;closeModal();if(soundOn&&audioUnlocked)initAudio();updateUI();saveGame();toast('A casa é pequena. A ambição, não. Bora, família!');}
  function pauseGame(){
    if(modalOpen||!running)return;
    openModal('pause',`${familyMarkup()}<span class="eyebrow">UM RESPIRO MERECIDO</span><h2>Até superpais<br><em>precisam de pausa.</em></h2><p>A família está esperando. O caos também.</p><div class="modal-meta"><span>HERDEIROS<strong>${game.state.kids}</strong></span><span>PONTOS<strong>${game.state.score}</strong></span><span>TEMPO<strong>${formatTime(game.state.time)}</strong></span></div><button class="primary orange" id="resume-game">VOLTAR PARA O CAOS →</button><button class="secondary" id="pause-help">Como jogar</button>`);
    $('modal').querySelector('h2').innerHTML='Família<br><em>Paim de Araujo.</em>';
    $('modal').querySelector('.modal-meta').insertAdjacentHTML('beforeend',`<span>RECORDE<strong id="best-kids">${best}</strong></span>`);
    $('modal').querySelector('#pause-help').remove();
    $('modal').insertAdjacentHTML('beforeend','<div class="menu-grid"><button class="secondary" id="menu-upgrades">⌂ Melhorias e equipe</button><button class="secondary" id="achievements">⚑ Conquistas</button><button class="secondary" id="help">? Como jogar</button><button class="secondary" id="restart">↻ Reiniciar família</button></div>');
    $('resume-game').onclick=closeModal;$('menu-upgrades').onclick=showUpgrades;$('help').onclick=showHelp;$('achievements').onclick=showAchievements;$('restart').onclick=confirmRestart;updateUI();
  }
  function showUpgrades(){
    if(!running||game.state.ended)return;
    openModal('upgrades',`<span class="eyebrow">ESTRUTURA PARA A DINASTIA</span><h2>Melhorias<br><em>da família.</em></h2><p>Caixa: <strong id="upgrade-money"></strong> · <span id="income-note"></span></p><div class="upgrade-list"><button class="upgrade" id="upgrade-robot"><span class="upgrade-icon">▣</span><span><strong>Robô de limpeza</strong><small id="robot-level"></small></span><b id="robot-cost"></b></button><button class="upgrade" id="upgrade-income"><span class="upgrade-icon">⌨</span><span><strong>Trabalhar como escravo para meu pai</strong><small id="income-level"></small></span><b id="income-cost"></b></button><button class="upgrade" id="upgrade-home"><span class="upgrade-icon">⌂</span><span><strong id="home-upgrade-name"></strong><small id="home-level"></small></span><b id="home-cost"></b></button></div><div class="team-row"><div><strong>♥ Sua dupla: Sabrina</strong><p id="ally-status"></p></div><button class="small-button" id="ally-mode"></button></div><button class="primary orange" id="close-upgrades">VOLTAR AO JOGO →</button>`);
    for(const id of ['robot','income','home'])$(`upgrade-${id}`).onclick=()=>{const changed=game.upgrade(id);if(changed&&id==='home')closeModal();processEvents();updateUI();};
    $('ally-mode').onclick=()=>{game.state.allyMode=(game.state.allyMode+1)%2;updateUI();};
    $('close-upgrades').onclick=closeModal;updateUI();
  }
  function showHelp(){
    openModal('help',`<span class="eyebrow">MANUAL DE SOBREVIVÊNCIA</span><h2>Paternidade no<br><em>modo arcade.</em></h2><ul class="help-list"><li><span>⌨</span><span><strong>WASD ou setas:</strong> mover. <strong>E ou espaço:</strong> interagir.<br><strong>Clique / toque:</strong> caminhar e agir no alvo.<br><strong>1–5:</strong> poderes. <strong>M:</strong> melhorias.<br><strong>P / Esc:</strong> menu e pausa.</span></li><li><span>▤</span><span><strong>Brinquedos no chão:</strong> recolha para baixar o caos.<br><strong>Crianças com mamadeira:</strong> estão com fome.</span></li><li><span>♜</span><span><strong>Cozinha:</strong> 3 mamadeiras por R$ 5.<br><strong>Notebook:</strong> trabalhe por R$ 22 (melhorável).<br><strong>Ferramentas:</strong> repare 22% da casa por R$ 12.</span></li><li><span>♥</span><span>A Sabrina alimenta, limpa, prepara mamadeiras e repara. Ações dos dois em até <strong>7 segundos</strong> carregam o combo mais rápido. Alterne a prioridade dela em Melhorias e equipe (M).</span></li><li><span>+</span><span>Prepare cada chegada em <strong>60 segundos</strong>. Os objetivos aparecem na tela; a ajuda da Sabrina conta. O custo é pago no início do desafio.</span></li><li><span>⌂</span><span>Compre melhorias e expanda para <strong>mansão, condomínio, bairro e cidade</strong>. Toda expansão renova a casa e aumenta a renda.</span></li><li><span>⚑</span><span>A casa cai com <strong>0% de integridade</strong>. A família quebra com <strong>R$ −60</strong>. Os recordes ficam neste navegador. A aba em segundo plano pausa a partida.</span></li></ul><button class="primary orange" id="close-help">ENTENDI. BORA, FAMÍLIA! →</button>`);
    $('close-help').onclick=closeModal;
    $('modal').insertAdjacentHTML('beforeend','<a class="secondary help-link" href="help/">Abrir apresentação e manual completo ↗</a>');
  }
  function showAchievements(){
    openModal('achievements',`<span class="eyebrow">DO SOFÁ AO MUNICÍPIO</span><h2>A árvore genealógica<br><em>virou floresta.</em></h2><p>Conquistas desta partida. Cada marco dá pontos e uma ajuda no caixa.</p><ol class="milestones">${MILESTONES.map(([n,title])=>`<li class="${game.state.kids>=n?'unlocked':''}"><b>${n}</b><span>${title}</span><span class="ach-icon">${game.state.kids>=n?'✓':'○'}</span></li>`).join('')}</ol><button class="primary orange" id="close-achievements">VOLTAR À FAMÍLIA →</button>`);$('close-achievements').onclick=closeModal;
  }
  function confirmRestart(){
    if(!loaded)return;
    openModal('restart',`<span class="eyebrow">OUTRA CHANCE, MESMA AMBIÇÃO</span><h2>Recomeçar<br><em>a dinastia?</em></h2><p>A partida atual será reiniciada com dois filhos. Seu recorde de <strong>${best} herdeiros</strong> será mantido.</p><button class="primary orange" id="confirm-restart">SIM, REINICIAR FAMÍLIA</button><button class="secondary" id="cancel-restart">Continuar com a família atual</button>`);
    $('confirm-restart').onclick=()=>{game=new Game();clickTarget=null;particles=[];floaters=[];sceneEnding=false;start();};$('cancel-restart').onclick=closeModal;
  }
  function showGameOver(){
    running=false;storage.remove(SAVE_KEY);
    openModal('gameover',`${familyMarkup()}<span class="eyebrow">FIM DE PARTIDA. O AMOR CONTINUA.</span><h2>${game.state.integrity<=0?'O teto caiu.<br><em>Literalmente.</em>':'Acabou o caixa.<br><em>Sobraram herdeiros.</em>'}</h2><p>${game.state.integrity<=0?'A casa não aguentou o tamanho do sonho. Repare antes que a integridade acabe e use Family First quando o caos apertar.':'O orçamento chegou a R$ −60. Trabalhe no notebook e melhore a renda antes de encomendar outro berço.'}</p><div class="modal-meta"><span>FILHOS<strong>${game.state.kids}</strong></span><span>PONTOS<strong>${game.state.score}</strong></span><span>TEMPO<strong>${formatTime(game.state.time)}</strong></span></div><button class="primary orange" id="retry-game">REINICIAR FAMÍLIA ↻</button>`);$('retry-game').onclick=()=>{game=new Game();particles=[];floaters=[];sceneEnding=false;start();};
  }
  function showVictory(civilization=false){
    sceneEnding=true;render();
    let scene=familyMarkup();
    try{scene=`<img class="finale-scene" src="${canvas.toDataURL('image/png')}" alt="Gringo e Sabrina de mãos dadas diante de uma multidão de filhos em pixel art.">`;}catch{}
    openModal('victory',`${scene}<span class="eyebrow">${civilization?'500 HERDEIROS · UMA NOVA CIVILIZAÇÃO':'100 HERDEIROS · MUNICÍPIO PAIM DE ARAUJO'}</span><h2>Parabéns! Você não<br>criou uma família.<br><em>Você criou um município!</em></h2><p>A família inteira se reúne. De mãos dadas, o Gringo e a Sabrina olham para a multidão que leva seu sobrenome.</p><p class="victory-quote">“E ele ainda acha que cabe mais um...”</p><button class="primary orange" id="keep-growing">${civilization?'VOLTAR À MINHA CIVILIZAÇÃO':'RUMO AOS 500!'} →</button><button class="secondary" id="victory-restart">Começar uma nova dinastia</button>`);
    $('keep-growing').onclick=()=>{sceneEnding=false;closeModal();saveGame();};$('victory-restart').onclick=confirmRestart;chime();
  }
  function saveGame(){if(!loaded)return;if(game.state.ended){storage.remove(SAVE_KEY);return;}storage.set(SAVE_KEY,JSON.stringify(game.snapshot()));}

  $('more-baby').onclick=()=>{if(modalOpen||!running)return;if(game.beginPrep())beep(490,.12);processEvents();updateUI();};
  $('pause').onclick=()=>{if(modalType==='pause'){closeModal();return;}pauseGame();};
  $('open-upgrades').onclick=showUpgrades;
  $('view-map').onclick=toggleOverview;
  $('music').onclick=()=>{musicOn=!musicOn;storage.set(MUSIC_KEY,String(musicOn));syncMusic();};
  $('sound').onclick=()=>{soundOn=!soundOn;storage.set(SOUND_KEY,String(soundOn));if(soundOn){initAudio();beep(660,.15,'triangle',.06);}updateSound();};
  function updateSound(){$('sound-label').textContent=soundOn?'Efeitos on':'Efeitos off';$('sound').setAttribute('aria-label',soundOn?'Desativar efeitos sonoros':'Ativar efeitos sonoros');$('sound').setAttribute('aria-pressed',String(soundOn));}
  $('powers').innerHTML=POWERS.map((p,i)=>`<button class="power" id="power-${p.id}" title="${p.name}: ${p.desc}" aria-label="${p.name}: ${p.desc}"><span class="power-key">${i+1}</span><span class="power-icon" aria-hidden="true">${p.icon}</span><span class="power-state" id="power-state-${p.id}"></span><span class="power-cooldown" id="power-cooldown-${p.id}"></span></button>`).join('');
  for(const p of POWERS)$(`power-${p.id}`).onclick=()=>activatePower(p.id);
  function activatePower(id){if(!running||modalOpen)return;game.usePower(id);processEvents();updateUI();}
  addEventListener('keydown',event=>{
    if(modalOpen){
      if(event.key==='Tab'){
        const buttons=[...$('modal').querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')];if(!buttons.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      if(event.key==='Escape'&&['pause','help','achievements','restart','upgrades'].includes(modalType)){event.preventDefault();closeModal();}return;
    }
    if(!running)return;
    const key=event.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','e','p','m','v','escape','1','2','3','4','5'].includes(key)){
      // Native buttons retain Enter/Space activation; movement shortcuts own game focus.
      if(key===' '&&document.activeElement?.tagName==='BUTTON')return;
      event.preventDefault();keys[key]=true;
    }
    if(!event.repeat){if(key==='p'||key==='escape')pauseGame();if(key==='m')showUpgrades();if(key==='v')toggleOverview();if(/^[1-5]$/.test(key))activatePower(POWERS[Number(key)-1].id);}
  });
  addEventListener('keyup',event=>{keys[event.key.toLowerCase()]=false;});
  addEventListener('blur',()=>{keys={};pauseGame();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys={};pauseGame();saveGame();}});
  addEventListener('pagehide',saveGame);
  canvas.addEventListener('pointerdown',event=>{
    if(!running||modalOpen)return;event.preventDefault();canvas.focus({preventScroll:true});
    updateCamera();const box=canvas.getBoundingClientRect(),screen={x:(event.clientX-box.left)*W/box.width,y:(event.clientY-box.top)*H/box.height};
    const mini=game.state.home&&!overview&&screen.x>=MINIMAP.x&&screen.x<=MINIMAP.x+MINIMAP.w&&screen.y>=MINIMAP.y&&screen.y<=MINIMAP.y+MINIMAP.h;
    const p=mini?{x:(screen.x-MINIMAP.x)/MINIMAP.w*game.world.width,y:(screen.y-MINIMAP.y)/MINIMAP.h*game.world.height}:{x:screen.x/camera.zoom+camera.x,y:screen.y/camera.zoom+camera.y};
    const choices=[...game.state.toys.map(t=>({type:'toy',ref:t,...t})),...game.state.children.filter(c=>c.hunger>=45).map(c=>({type:'child',ref:c,...c})),...game.stations.map(s=>({type:'station',ref:s,...s}))];
    const hit=choices.map(t=>({...t,clickDistance:Math.hypot(t.x-p.x,t.y-p.y)})).filter(t=>t.clickDistance<(t.type==='station'?52:34)).sort((a,b)=>a.clickDistance-b.clickDistance)[0];
    clickTarget=hit||null;const target=hit?.ref||p;game.goTo(target.x,target.y);particles.push({x:target.x,y:target.y,life:.55,max:.55,ring:true,color:'#f0f5c5'});
  });
  for(const button of document.querySelectorAll('[data-move]')){
    const key={up:'w',down:'s',left:'a',right:'d'}[button.dataset.move];
    button.addEventListener('pointerdown',e=>{if(modalOpen||!running)return;e.preventDefault();button.setPointerCapture(e.pointerId);keys[key]=true;clickTarget=null;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys[key]=false);
  }
  $('touch-action').addEventListener('pointerdown',e=>{if(modalOpen||!running)return;e.preventDefault();game.interact();processEvents();});

  function updateUI(){
    const s=game.state,stage=STAGES[s.home];
    $('kids').textContent=s.kids;$('money').textContent=money(s.money);$('money').classList.toggle('danger',s.money<0);
    $('integrity-value').textContent=Math.ceil(s.integrity)+'%';$('integrity-bar').style.width=s.integrity+'%';$('integrity-value').classList.toggle('danger',s.integrity<30);$('integrity-bar').style.background=s.integrity<30?'var(--red)':'var(--green)';
    $('chaos-value').textContent=Math.floor(s.chaos)+'%';$('chaos-bar').style.width=s.chaos+'%';
    $('clock').textContent=formatTime(s.time);$('score').textContent=String(s.score).padStart(4,'0');$('bottles').textContent=s.bottles;
    $('stage-badge').textContent=stage.name.toUpperCase()+' · '+game.world.rooms.length+' CÔMODOS';$('round-number').textContent='RODADA '+s.round;
    $('view-map').hidden=!s.home;$('view-map').setAttribute('aria-pressed',String(overview));$('view-map').title=overview?'Voltar a acompanhar o Gringo (V)':'Ver todos os cômodos (V)';
    $('combo-bar').style.width=s.combo+'%';$('combo-value').textContent=Math.floor(s.combo)+'%';
    $('prep').hidden=!s.prep;
    $('more-baby').disabled=!!s.prep||s.kids>=500||s.ended;
    $('more-baby').innerHTML=`<span class="baby-plus">${s.prep?'◷':'+'}</span><span><strong>${s.prep?'BEBÊ A CAMINHO':s.kids>=500?'CIVILIZAÇÃO COMPLETA':'QUERO MAIS UM!'}</strong><small id="next-cost">${s.prep?Math.ceil(s.prep.time)+'s para preparar':money(game.babyCost)}</small></span>`;
    if(s.prep){const p=s.prep;$('prep-timer').textContent=Math.ceil(p.time)+'s';$('prep-timer').classList.toggle('danger',p.time<15);
      $('prep-tasks').innerHTML=[[p.clean,p.needClean,'Limpar','Recolher brinquedos'],[p.bottles,p.needBottles,'Mamadeiras','Preparar mamadeiras na cozinha'],[p.work,p.needWork,'Renda','Trabalhar no notebook']].map(([n,total,label,title])=>`<div class="prep-task ${n>=total?'done':''}" title="${title}"><i>${n>=total?'✓':''}</i><span>${label}</span><b>${Math.min(n,total)}/${total}</b></div>`).join('');}
    if($('upgrade-money')){
      $('upgrade-money').textContent=money(s.money);$('income-note').textContent=`renda ${money(game.income)} · custo ${money(game.expense)} / 10s`;
      $('robot-level').textContent=s.upgrades.robot?`Nível ${s.upgrades.robot} · limpeza automática`:'Recolhe a bagunça automaticamente.';
      $('income-level').textContent=s.upgrades.income?`Nível ${s.upgrades.income} · renda ampliada`:'Mais renda no notebook e por rodada.';
      $('robot-cost').textContent=s.upgrades.robot>=5?'MÁX.':money(game.discount(game.robotCost));$('income-cost').textContent=s.upgrades.income>=5?'MÁX.':money(game.discount(game.incomeCost));
      $('upgrade-robot').disabled=s.upgrades.robot>=5;$('upgrade-income').disabled=s.upgrades.income>=5;
      const nextStage=STAGES[s.home+1],nextWorld=nextStage?FamilyGame.getWorld(s.home+1):null;
      $('home-upgrade-name').textContent=nextStage?`${stage.name} → ${nextStage.name}`:'Cidade Paim de Araujo';
      $('home-level').textContent=nextWorld?`${game.world.rooms.length} → ${nextWorld.rooms.length} cômodos · ${Math.round((nextWorld.messRate/game.world.messRate-1)*100)}% mais bagunça · manutenção +${money(nextWorld.maintenance-game.world.maintenance)}/10s`:game.world.rooms.length+' cômodos construídos';
      $('home-cost').textContent=nextStage?money(game.discount(stage.cost)):'MÁX.';$('upgrade-home').disabled=!nextStage;
      $('ally-status').textContent=s.wifeStatus;$('ally-mode').textContent=s.allyMode?'Foco: limpeza ⇄':'Equilibrada ⇄';
    }
    for(const p of POWERS){const cool=s.cooldowns[p.id]||0,active=s.active[p.id]||0,locked=s.kids<p.unlock;
      const status=locked?`Libera com ${p.unlock} filhos`:active>0?`Ativo por ${Math.ceil(active)}s`:cool>0?`Recarga: ${Math.ceil(cool)}s`:'Pronto para usar';
      $(`power-${p.id}`).disabled=locked||cool>0||s.ended;$(`power-${p.id}`).title=`${p.name}: ${p.desc} ${status}`;$(`power-${p.id}`).setAttribute('aria-label',`${p.name}. ${status}`);
      $(`power-state-${p.id}`).textContent=locked?p.unlock+' filhos':cool>0?Math.ceil(active||cool)+'s':'';
      $(`power-cooldown-${p.id}`).style.width=(cool>0?100*(1-cool/p.cooldown):0)+'%';
    }
    $('active-effects').innerHTML=Object.entries(s.active).filter(([,v])=>v>0).map(([id,sec])=>`<span class="effect-chip">${POWERS.find(p=>p.id===id)?.name||({love:'Amor Infinito',super:'Super Pais',mutirao:'Mutirão da Família'}[id])} ${Math.ceil(sec)}s</span>`).join('');
    const nearby=game.nearby();$('interaction-hint').hidden=!nearby||modalOpen;$('interaction-hint').querySelector('span').textContent=nearby?nearby.label:'Interagir';
    $('pause-label').textContent=modalType==='pause'?'Continuar':'Menu';$('pause').setAttribute('aria-label',modalType==='pause'?'Continuar jogo':'Abrir menu e pausar');updateSound();
  }

  function processEvents(){
    for(const event of game.drainEvents()){
      if(event.type==='toast')toast(event.text,event.tone);
      if(event.type==='action'){
        beep(event.kind==='clean'?560:event.kind==='feed'?720:360,.06,'triangle',.025);
        burst(event.x,event.y,event.together?'#edb9cf':'#cfec91',event.together?7:4);
        floaters.push({x:event.x,y:event.y-38,text:event.together?'♥ DUO!':event.kind==='clean'?'+12':event.kind==='feed'?'♥':'✓',color:event.together?'#f5bbd5':'#e4f0c0',life:1.25});
      }
      if(event.type==='float')floaters.push({...event,life:1.5});
      if(event.type==='birth'){toast(event.text);chime();burst(game.state.player.x,game.state.player.y-20,'#f9b773',32);saveGame();}
      if(event.type==='milestone'){toast(`CONQUISTA: ${event.text}!`);chime();}
      if(event.type==='combo'){toast(`♥ COMBO CASAL PERFEITO: ${event.text}!`);chime();burst(480,310,'#efb9d3',40);}
      if(event.type==='power'){toast(event.text);beep(220,.3,'sawtooth',.035);beep(660,.25,'triangle',.04,.08);burst(game.state.player.x,game.state.player.y-20,'#c0eb92',22);}
      if(event.type==='upgrade'){if(event.home){overview=true;buildFlash=5;clickTarget=null;updateCamera();}toast(event.text);chime();saveGame();}
      if(event.type==='prepFailed'){toast(event.text,'warn');beep(150,.3);}
      if(event.type==='robot')burst(event.x,event.y,'#a6cfe3',4);
      if(event.type==='gameover')showGameOver();
      if(event.type==='victory')showVictory(false);
      if(event.type==='civilization')showVictory(true);
    }
    if(game.state.kids>best){best=game.state.kids;storage.set(BEST_KEY,String(best));}
  }
  function burst(x,y,color,count){if(reduced)return;for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*100,vy:-30-Math.random()*90,life:.7+Math.random()*.6,max:1.3,color});}

  // World art is drawn as small, integer-aligned pixel shapes. Character images are the approved assets.
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  const GAME_FONT='system-ui, -apple-system, "Segoe UI", sans-serif';
  function text(label,x,y,size=10,color='#5b553e',align='left'){ctx.font=`600 ${Math.max(9,size)}px ${GAME_FONT}`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(label,x,y);ctx.textAlign='left';}
  function box(x,y,w,h,top,side='#534c3d',depth=7){rect(x,y+depth,w,h,side);rect(x,y,w,h,top);rect(x+3,y+3,w-6,3,'#ffffff18');}
  function plant(x,y,scale=1){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);rect(-9,-12,18,16,'#9e6b4d');rect(-11,-14,22,6,'#be8f67');rect(-2,-37,4,24,'#42643e');rect(-13,-35,14,11,'#5e8c4c');rect(0,-42,13,13,'#65964f');rect(-16,-28,16,9,'#7ba755');rect(1,-27,14,10,'#416d40');ctx.restore();}
  function windowFrame(x,y,w=74){rect(x-4,y-4,w+8,47,'#9f8e63');rect(x,y,w,38,'#a4c8be');rect(x+4,y+3,w/2-7,29,'#c6e0cf');rect(x+w/2,y+3,w/2-4,29,'#b8d8c5');rect(x+w/2-2,y,4,38,'#f2e6bb');rect(x,y+32,w,6,'#eee1b6');rect(x-7,y-7,9,45,'#d88f78');rect(x+w-2,y-7,9,45,'#d88f78');}
  function labelPlate(label,x,y){const lines=label.split('\n');ctx.font=`600 10.5px ${GAME_FONT}`;const w=Math.ceil(Math.max(...lines.map(line=>ctx.measureText(line).width)))+18;rect(x-w/2,y-12,w,20+(lines.length-1)*13,'#fff4dff0');lines.forEach((line,i)=>text(line,x,y+2+i*13,10.5,'#3f4c34','center'));}
  const roomColors={suite:'#c1cfbd',playroom:'#dabaa5',dorm:'#bec9c9',dining:'#d8c896',daycare:'#cbbbd2',laundry:'#b6cdd0',classroom:'#d8be91',playground:'#aac496',gym:'#c49d73',townhall:'#c7bb9c',clinic:'#d0ddd0',living:'#ddbd86',kitchen:'#c7d5c0',nursery:'#d3b6a4'};
  function extensionFloors(){
    const world=game.world;
    if(game.state.home)rect(898,130,world.bounds.right-896,410,'#d9bc88');
    if(game.state.home>=2)rect(64,540,world.bounds.right-62,world.bounds.bottom-538,'#d3b785');
    for(const r of world.rooms.filter(r=>r.level)){
      rect(r.x,r.y,r.w,r.h,roomColors[r.kind]||'#dcc59e');
      for(let y=r.y;y<r.y+r.h;y+=28){rect(r.x,y,r.w,1,'#76634125');for(let x=r.x+(Math.floor(y/28)%2)*50;x<r.x+r.w;x+=100)rect(x,y,1,28,'#76634124');}
      if(['playroom','daycare','playground'].includes(r.kind))for(let y=0;y<3;y++)for(let x=0;x<5;x++)rect(r.x+r.w/2-75+x*30,r.y+r.h/2-45+y*30,29,29,['#e3bf88','#a0bd97','#bdadc8','#ebd59e'][(x+y)%4]);
      if(r.kind==='gym'){
        ctx.strokeStyle='#f0dfb0';ctx.lineWidth=3;ctx.strokeRect(r.x+30,r.y+30,r.w-60,r.h-60);ctx.beginPath();ctx.moveTo(r.x+r.w/2,r.y+30);ctx.lineTo(r.x+r.w/2,r.y+r.h-30);ctx.stroke();ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+r.h/2,38,38,0,0,Math.PI*2);ctx.stroke();
        for(const x of [r.x+27,r.x+r.w-37]){rect(x,r.y+r.h/2-25,10,50,'#eee5bd');for(let y=0;y<5;y++)rect(x,r.y+r.h/2-24+y*10,10,1,'#9c9778');}
      }
      if(r.kind==='classroom'){rect(r.x+r.w/2-68,r.y+5,136,29,'#516e53');rect(r.x+r.w/2-62,r.y+9,124,20,'#3c5d49');text('PAIM DE ARAUJO — TURMA INFINITA',r.x+r.w/2,r.y+23,6,'#e6e6c2','center');}
      if(buildFlash>0&&r.level===game.state.home){ctx.strokeStyle='#fff1a1';ctx.lineWidth=3;ctx.setLineDash([10,6]);ctx.strokeRect(r.x+4,r.y+4,r.w-8,r.h-8);ctx.setLineDash([]);}
    }
    if(game.state.home>=2){labelPlate('CORREDOR DA DINASTIA',684,587);if(game.state.home>=4)labelPlate('AVENIDA PAIM DE ARAUJO',900,1005);}
  }
  function extraFurniture(){
    for(const f of game.world.furniture){const {x,y,w,h,kind}=f;
      if(kind==='bed'){
        box(x,y,w,h,'#a58c6d','#77664f',5);rect(x+4,y+4,w-8,h-8,'#91b5b3');rect(x+7,y+5,w-14,17,'#f0ead4');rect(x+6,y+29,w-12,h-35,'#c2d5bd');rect(x+7,y+h-12,w-14,4,'#86aaa1');
      }else if(kind==='washer'){
        box(x,y,w,h,'#e6e6cb','#9aa99b',5);rect(x+5,y+5,w-10,7,'#a0baaf');ctx.fillStyle='#5b7e79';ctx.beginPath();ctx.ellipse(x+w/2,y+h*.62,w*.28,h*.28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a7d2c2';ctx.beginPath();ctx.ellipse(x+w/2,y+h*.62,w*.18,h*.18,0,0,Math.PI*2);ctx.fill();rect(x+w-11,y+6,4,4,'#e7bc7e');
      }else if(kind==='desk'){
        box(x,y,w,h,'#b18c60','#816449',6);rect(x+w/2-17,y-9,34,24,'#3d574a');rect(x+w/2-14,y-6,28,17,'#a1c4a9');rect(x+w/2-20,y+16,40,5,'#65775e');rect(x+w-14,y+16,8,10,'#e9dfb7');
      }else if(kind==='table'){
        box(x,y,w,h,'#b99568','#866a4a',7);rect(x+5,y+5,w-10,h-10,'#d4b584');for(const xx of [x+16,x+w-16]){ctx.fillStyle='#eeead0';ctx.beginPath();ctx.ellipse(xx,y+h/2,9,8,0,0,Math.PI*2);ctx.fill();rect(xx-4,y+h/2-3,8,5,'#a4b77e');}
      }else if(kind==='toybox'){
        box(x,y,w,h,'#b3926a','#8b7353',6);for(let i=0;i<4;i++)rect(x+5+i*11,y-7-(i%2)*5,9,13,['#d9937e','#8bb8a7','#d9bd77','#b39abb'][i]);rect(x+6,y+9,w-12,4,'#ccb084');
      }else if(kind==='slide'){
        box(x,y,w,h,'#89a986','#4f775b',4);rect(x+7,y+7,20,h-14,'#c3b375');for(let i=0;i<5;i++)rect(x+8,y+10+i*11,17,4,'#e5d39e');rect(x+32,y+5,25,h-9,'#da9a78');rect(x+38,y+9,13,h-17,'#f1c48f');
      }else{
        box(x,y,w,h,'#a68c67','#7c674f',5);rect(x+4,y+4,w-8,h-8,'#cfb78b');for(let i=0;i<5;i++)rect(x+7+i*(w-14)/5,y+8,(w-18)/5,h-17,['#8da49b','#c29a8d','#d5b772','#9f94aa','#8aab85'][i]);
      }
    }
    for(const r of game.world.rooms.filter(r=>r.level)){windowFrame(r.x+r.w-86,r.y+8,58);plant(r.x+r.w-23,r.y+r.h-22,.8);const font=overview?Math.min(24,9/camera.zoom):10;text(r.name.toUpperCase(),r.x+r.w/2,r.y+r.h*.55,font,'#5e6450','center');}
    for(const t of game.stations.filter(t=>!STATIONS.some(s=>s.x===t.x&&s.y===t.y))){rect(t.x-19,t.y-30,38,25,'#638471');rect(t.x-16,t.y-27,32,19,'#dbdcb6');text(t.icon,t.x,t.y-12,17,'#60735a','center');}
    if(game.state.upgrades.income){const n=game.state.upgrades.income;rect(151,137,31,27,'#354e43');rect(154,140,25,20,'#9dceb2');text('+'+n,167,154,9,'#3e674e','center');if(n>=3){rect(87,138,19,23,'#354e43');rect(90,141,13,16,'#bdddb0');}if(n>=5){rect(110,128,68,6,'#f0d496');}}
  }
  function drawMiniMap(){
    if(!game.state.home||overview)return;const m=MINIMAP,world=game.world,sx=m.w/world.width,sy=m.h/world.height;
    rect(m.x-5,m.y-17,m.w+10,m.h+24,'#1e342be8');text('CASA · CLIQUE PARA IR',m.x+4,m.y-6,7,'#dce8bd');
    for(const r of world.rooms)rect(m.x+r.x*sx,m.y+r.y*sy,r.w*sx,r.h*sy,roomColors[r.kind]||'#b6bb95');
    for(const wall of world.walls)rect(m.x+wall.x*sx,m.y+wall.y*sy,Math.max(1,wall.w*sx),Math.max(1,wall.h*sy),'#52634d');
    for(const t of game.state.toys)rect(m.x+t.x*sx,m.y+t.y*sy,2,2,'#c98267');
    ctx.strokeStyle='#f8edb0';ctx.lineWidth=1;ctx.strokeRect(m.x+camera.x*sx,m.y+camera.y*sy,W/camera.zoom*sx,H/camera.zoom*sy);
    for(const [actor,color]of [[game.state.player,'#fff0a0'],[game.state.wife,'#f3bbd3']])rect(m.x+actor.x*sx-2,m.y+actor.y*sy-2,5,5,color);
  }
  function floorArt(home){
    rect(0,0,game.world.width,game.world.height,'#758d58');
    for(let y=4;y<600;y+=17)for(let x=4;x<960;x+=19){const seed=(x*13+y*7)%43;rect(x,y,seed%3===0?3:2,3,seed<20?'#819961':'#69864f');}
    // Garden path and the slightly crooked front fence.
    rect(424,0,106,97,'#c4b78b');for(let y=0;y<90;y+=24){rect(430,y+5,92,18,'#d3c79a');rect(434,y+8,84,2,'#b9aa7b');}
    rect(16,75,408,5,'#b1b78b');rect(528,75,416,5,'#b1b78b');
    for(let x=18;x<945;x+=24)if(x<416||x>534){rect(x,66,9,29,'#d8d2aa');rect(x+2,63,5,4,'#e6dfb6');rect(x,87,9,5,'#b5b68d');}
    for(const [x,y] of [[34,38],[75,46],[167,40],[214,51],[337,42],[592,43],[658,51],[737,39],[892,38],[933,53]]){
      rect(x-14,y-10,33,18,'#466d40');rect(x-9,y-17,22,13,'#537f43');rect(x+2,y-12,14,5,'#6b9251');rect(x-4,y-6,4,4,'#e5c178');}
    rect(33,104,899,465,'#40553a55');rect(52,109,862,449,'#766548');
    const wallColors=['#d3d2a3','#cfd5b3','#bfcdbf','#c8cfb3','#b5c5c4'];
    // Floorboards are offset to avoid a repetitive checkerboard.
    rect(64,130,835,410,'#ddbd86');
    for(let row=0,y=132;y<541;y+=28,row++){
      rect(64,y,835,2,'#c6a875');
      for(let x=64+(row%2)*65;x<899;x+=132){rect(x,y,2,28,'#caaa76');rect(x+14,y+9,48,1,'#e7c895');rect(x+23,y+20,34,1,'#d4b47d');}
    }
    // Kitchen tiles and playroom.
    rect(626,130,274,205,'#c7d5c0');for(let y=132;y<334;y+=29)for(let x=627;x<900;x+=29){if((Math.floor(y/29)+Math.floor(x/29))%2)rect(x,y,27,27,'#b7c9af');rect(x,y,28,1,'#dce2cc');}
    rect(626,339,274,200,'#d3b6a4');for(let x=627;x<900;x+=32)rect(x,339,2,200,'#c6a48e');
    extensionFloors();
    for(const wall of game.world.walls){rect(wall.x,wall.y,wall.w,wall.h,wallColors[home]);if(wall.w<wall.h)rect(wall.x,wall.y,3,wall.h,'#ac9c73');else rect(wall.x,wall.y+wall.h-3,wall.w,3,'#ac9c73');}
    for(const d of game.world.doors){rect(d.x,d.y,d.w,d.h,'#e0c89c');}
    const sideDoor=DOORWAYS.nurserySide,kitchenDoor=DOORWAYS.nurseryKitchen;
    rect(sideDoor.x-2,sideDoor.y,sideDoor.w+4,sideDoor.h,'#c9ac7e');rect(sideDoor.x-2,sideDoor.y,sideDoor.w+4,3,'#ead6aa');rect(sideDoor.x-2,sideDoor.y+sideDoor.h-3,sideDoor.w+4,3,'#ead6aa');
    rect(kitchenDoor.x,kitchenDoor.y,kitchenDoor.w,kitchenDoor.h,'#c5b58e');rect(kitchenDoor.x,kitchenDoor.y+4,kitchenDoor.w,3,'#e1d4a9');
    windowFrame(253,120,72);windowFrame(687,120,72);windowFrame(788,120,64);
    text('FAMÍLIA PAIM DE ARAUJO',478,111,10,'#e9e8c5','center');
    if(home>0){text(['','MANSÃO PAIM DE ARAUJO','CONDOMÍNIO PAIM DE ARAUJO','BAIRRO PAIM DE ARAUJO','CIDADE PAIM DE ARAUJO'][home],475,74,10,'#304b31','center');}
    if(home>=2){for(const [x,y] of [[100,16],[248,15],[630,10],[783,17]]){rect(x,y,62,41,'#c9b282');rect(x-4,y-4,70,8,home>=4?'#ab8466':'#bc8f6b');rect(x+7,y+12,12,12,'#91bca8');rect(x+38,y+12,12,12,'#91bca8');}}
    // Living room rug and sofa.
    rect(247,286,269,189,'#b1826250');rect(250,281,264,189,home>0?'#879b76':'#d09a78');rect(260,291,244,169,home>0?'#afbc8a':'#e5b797');rect(268,299,228,153,home>0?'#a3b381':'#dfb08c');
    for(let x=270;x<497;x+=14){rect(x,282,2,7,'#efd0a7');rect(x,460,2,8,'#efd0a7');}
    // Sofa faces the rug. Backrest casts a short floor shadow.
    box(354,158,151,51,'#859d6c','#687e59',9);rect(360,152,139,22,'#97af7d');rect(354,166,15,35,'#78905f');rect(490,166,15,35,'#78905f');rect(373,179,52,22,'#a9bd8b');rect(431,179,52,22,'#9fb581');rect(367,203,129,5,'#687f54');rect(365,208,8,7,'#5a4f3b');rect(487,208,8,7,'#5a4f3b');
    // Work desk, laptop, coffee and chair.
    box(87,152,123,48,'#b48a5e','#7b6047',9);rect(95,158,107,30,'#c7a479');rect(108,140,45,28,'#3b4d43');rect(112,144,37,20,'#a2c5b1');rect(118,149,24,2,'#ddedcc');rect(118,154,17,2,'#76957e');rect(103,168,55,7,'#526256');rect(109,170,43,2,'#8b9d86');rect(177,164,12,12,'#efe8cb');rect(188,167,4,7,'#ded5b7');rect(180,162,5,3,'#78543b');
    box(125,215,43,21,'#8a9e77','#596d50',5);rect(135,235,5,10,'#7c6849');rect(155,235,5,10,'#7c6849');
    // TV cabinet and cozy details.
    box(87,354,113,61,'#b18b5b','#886846',8);rect(96,355,94,31,'#384c43');rect(101,359,83,22,'#7f9c78');rect(106,362,48,4,'#abc19a');rect(139,372,30,5,'#a0af85');rect(126,386,33,4,'#495546');rect(97,394,38,14,'#c5a16b');rect(143,394,44,14,'#c5a16b');rect(113,399,9,3,'#7c704e');
    box(291,393,99,44,'#b69164','#947049',8);rect(298,398,84,30,'#cda877');rect(321,404,24,13,'#f0dfb4');rect(325,407,16,2,'#c8b88e');rect(358,407,10,11,'#8b6748');
    plant(103,293,.95);plant(577,194,1.1);plant(559,506,.8);plant(851,302,.7);
    // Tool station, fixed to the wall beside the sofa.
    rect(519,137,49,28,'#a99166');rect(523,141,41,20,'#c2ae83');rect(529,145,5,14,'#6d7560');rect(526,144,13,5,'#87957b');rect(547,144,5,15,'#925e3e');rect(542,142,15,5,'#626f5c');
    // Kitchen units, sink, stove, fridge and bottles.
    box(652,151,227,46,'#80a69a','#5d8278',8);rect(657,148,218,18,'#f0e5be');
    for(let x=659;x<879;x+=44){rect(x,172,39,20,'#95b6a7');rect(x+28,178,6,2,'#486d60');}
    rect(668,149,45,18,'#6d8f82');rect(674,152,32,11,'#b7d3c0');rect(690,141,4,13,'#aab8a0');rect(690,140,12,4,'#b8c8b0');
    rect(818,144,49,26,'#4e6259');for(const [x,y]of [[830,152],[852,152],[830,163],[852,163]]){rect(x-5,y-3,11,6,'#263f36');rect(x-2,y-1,5,2,'#829482');}
    for(let x=740;x<793;x+=16)bottle(x,158,1);
    box(740,245,82,37,'#e4c79c','#b69870',8);rect(747,251,68,21,'#eedcb3');rect(768,254,17,12,'#bdc999');
    // Playroom: two beds, toy bin and checker play mat.
    for(const x of [730,820]){box(x,416,68,71,'#ae9773','#8d765b',7);rect(x+4,413,60,12,'#c7af88');rect(x+6,425,56,56,x===730?'#8eb7b6':'#c99cae');rect(x+9,423,50,16,'#eee5c9');rect(x+8,448,52,28,x===730?'#a9cebf':'#dfb6bf');rect(x+8,472,52,5,x===730?'#7fa7a1':'#bd8c9e');}
    const matX=649,matY=366;for(let y=0;y<2;y++)for(let x=0;x<9;x++)rect(matX+x*26,matY+y*21,25,20,['#d9b684','#a5bd95','#b5a9bf','#e1c995'][(x+y)%4]);
    box(643,496,49,28,'#a78868','#846b4b',6);rect(649,489,9,12,'#d79676');rect(660,485,13,15,'#92b29a');rect(674,491,10,10,'#c4b16f');
    // Framed family print.
    rect(239,143,33,33,'#90764f');rect(243,147,25,25,'#ebdfb4');rect(249,151,6,8,'#6a6550');rect(257,153,6,8,'#8b7658');rect(248,160,16,8,'#a6b385');
    labelPlate('Trabalhar como escravo\npara meu pai',149,263);labelPlate('SALA DO CAOS',388,502);labelPlate('COZINHA',768,308);labelPlate('MINI HERDEIROS',772,355);
    // Expansion alters the home and lets more of the dynasty appear outdoors.
    if(home>=1){rect(206,147,12,39,'#c4a368');rect(208,142,8,9,'#dfc789');rect(201,153,22,3,'#dfc789');}
    if(home>=3){rect(332,18,74,35,'#e1d6a5');rect(326,12,86,9,'#b48a67');text(home===4?'PREFEITURA':'GRINGOS',369,41,9,'#746546','center');}
    extraFurniture();
  }
  function bottle(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);rect(-4,-13,9,14,'#e9e9cf');rect(-5,-14,11,4,'#e7b178');rect(-2,-18,5,5,'#f1d6a1');rect(-2,-7,5,6,'#c9dcbe');ctx.restore();}
  function toyArt(toy){const {x,y,kind}=toy;
    rect(x-9,y+3,20,6,'#6f66442a');
    if(kind===0){box(x-9,y-7,18,12,'#d78e70','#b76956',3);rect(x-5,y-11,4,4,'#edb18b');rect(x+2,y-11,4,4,'#edb18b');}
    if(kind===1){rect(x-9,y-5,19,9,'#8cafa6');rect(x-5,y-10,11,6,'#aac8b7');rect(x-7,y+3,5,5,'#4f6257');rect(x+4,y+3,5,5,'#4f6257');rect(x-2,y-9,5,4,'#dfdfb7');}
    if(kind===2){rect(x-7,y-10,14,17,'#d5b475');rect(x-10,y-6,20,9,'#e1c38b');rect(x-4,y-6,3,3,'#6f684c');rect(x+3,y-6,3,3,'#6f684c');rect(x-2,y-1,5,3,'#9b7953');}
    if(kind===3){rect(x-8,y-8,16,15,'#bba2bb');rect(x-5,y-11,10,21,'#bba2bb');rect(x-5,y-8,5,5,'#d8b9cd');rect(x+1,y+2,5,4,'#927f9f');}
    if(kind===4){rect(x-13,y-7,24,10,'#d99dab');rect(x-7,y-12,13,9,'#eee0bb');rect(x+4,y-3,11,9,'#9db5c1');}
    if(kind===5){rect(x-11,y-8,22,15,'#e4d7a3');rect(x-8,y-5,13,6,'#ba976b');rect(x+7,y+4,5,5,'#af7953');}
    if(kind===6){box(x-11,y-9,23,16,'#dccb9f','#b39168',3);rect(x-7,y-6,15,2,'#9d9c79');rect(x-7,y-1,11,2,'#9d9c79');}
    if(kind===7){rect(x-14,y-5,9,10,'#d78a75');rect(x-2,y-8,11,13,'#92aba4');rect(x+10,y,7,8,'#d2b15d');}
  }
  function drawSprite(name,actor,scale=1,forceDir){
    const im=images[name],data=atlas[name],frame=data.frames[forceDir||actor.dir||'down'],b=frame.visibleBounds;
    const height=(name==='gringo'||name==='esposa'?66:49)*scale,w=b.w/b.h*height;
    const bob=!reduced&&actor.moving?Math.sin(game.state.time*17+(actor.id||0))*1.8:0;
    const x=Math.round(actor.x),y=Math.round(actor.y+bob);
    ctx.fillStyle='#344c3b33';ctx.beginPath();ctx.ellipse(x,y+1,w*.42,5*scale,0,0,Math.PI*2);ctx.fill();
    if(name==='gringo'&&(game.effect('first')||game.effect('super'))){ctx.strokeStyle='#f3e3a1';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-29,25,42,0,0,Math.PI*2);ctx.stroke();}
    if(im?.complete&&im.naturalWidth)ctx.drawImage(im,frame.x+b.x,frame.y+b.y,b.w,b.h,Math.round(x-w/2),Math.round(y-height),Math.round(w),Math.round(height));
    else{rect(x-10,y-30,20,24,name==='gringo'?'#efdfb8':'#b7c99b');rect(x-8,y-42,16,14,'#bf926b');}
    if(actor.hunger>=45){const pulse=Math.sin(game.state.time*5)*1.5;bottle(x,y-height-8+pulse,.75);}
    if(name==='gringo'||name==='esposa'){
      const label=name==='gringo'?'GRINGO':'SABRINA',labelWidth=name==='gringo'?46:60;rect(x-labelWidth/2,y+7,labelWidth,13,name==='gringo'?'#354e35df':'#72575fdf');text(label,x,y+16,6.5,name==='gringo'?'#e7f5d0':'#f6d6dc','center');
    }
  }
  function drawStations(){for(const station of game.stations){
    const p=game.state.player,near=dist(p,station)<65;ctx.strokeStyle=near?'#fcdf9d':'#f4e2af80';ctx.lineWidth=near?2:1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(station.x,station.y+4,24,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    if(near){rect(station.x-9,station.y-24,18,17,'#fff0c9');text('E',station.x,station.y-12,10,'#586b47','center');}
  }}
  function renderEnding(){
    floorArt(game.state.home);rect(0,0,W,H,'#203c2960');
    for(let i=0;i<120;i++){const row=Math.floor(i/20),col=i%20;drawSprite(i%2?'filha':'filho',{x:89+col*41+(row%2)*9,y:237+row*52,dir:'up',id:i},.63,'up');}
    drawSprite('gringo',{x:447,y:168,dir:'down'},1.3);drawSprite('esposa',{x:493,y:168,dir:'down'},1.3);
    rect(463,133,16,4,'#d6a27b');text('E ele ainda acha que cabe mais um...',480,583,20,'#fff0c1','center');
  }
  function render(){
    if(renderDensity!==clamp(window.devicePixelRatio||1,1,3))resizeCanvas();
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);
    if(sceneEnding){renderEnding();return;}
    updateCamera();ctx.save();ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
    const s=game.state;floorArt(s.home);drawStations();
    for(const toy of s.toys)toyArt(toy);
    if(s.upgrades.robot){const angle=s.time*.6,robot={x:470+Math.sin(angle)*100,y:410+Math.cos(angle)*55};rect(robot.x-11,robot.y-4,24,14,'#dee2bf');rect(robot.x-8,robot.y-7,18,5,'#b8c8b2');rect(robot.x+1,robot.y-4,5,5,'#85aa97');}
    const actors=[...s.children.map(a=>({a,name:a.kind})),{a:s.player,name:'gringo'},{a:s.wife,name:'esposa'}].sort((a,b)=>a.a.y-b.a.y);
    for(const {a,name}of actors)drawSprite(name,a);
    if(s.kids>72){rect(675,575,219,18,'#344c39');text(`+${s.kids-72} herdeiros brincando pelo bairro`,784,588,9,'#ebedcd','center');}
    // Subtle foreground flower boxes frame the house.
    for(const x of [125,232,638,776]){rect(x,564,60,14,'#9d8061');rect(x+4,562,52,6,'#5f7e48');for(let j=0;j<4;j++){rect(x+8+j*12,556,4,8,'#96ac6b');rect(x+7+j*12,553,6,5,j%2?'#dfbd82':'#d99f93');}}
    if(clickTarget){const p=clickTarget.ref||clickTarget;ctx.strokeStyle='#f5e5ae';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+5,16+Math.sin(s.time*7)*2,7,0,0,Math.PI*2);ctx.stroke();}
    for(const particle of particles){ctx.globalAlpha=clamp(particle.life/(particle.max||1),0,1);if(particle.ring){ctx.strokeStyle=particle.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(particle.x,particle.y,22*(1-particle.life/particle.max)+5,10*(1-particle.life/particle.max)+3,0,0,Math.PI*2);ctx.stroke();}else rect(particle.x,particle.y,4,4,particle.color);}ctx.globalAlpha=1;
    for(const f of floaters){ctx.globalAlpha=Math.min(1,f.life);text(f.text,f.x,f.y,11,f.color,'center');}ctx.globalAlpha=1;
    if(game.effect('daddy'))text('LET’S GO, KIDS!',s.player.x,s.player.y-82,14,'#3c5d4a','center');
    ctx.restore();drawMiniMap();
    if(overview&&s.home){rect(W/2-149,H-101,298,23,'#20372be8');text(`${game.world.rooms.length} CÔMODOS · V PARA VER DE PERTO`,W/2,H-85,10,'#f3e5bd','center');}
    if(s.chaos>75){ctx.fillStyle=`rgba(166,65,43,${.03+Math.sin(s.time*3)*.015})`;ctx.fillRect(0,0,W,H);}
  }
  function frame(now){
    const dt=Math.min((now-(lastFrame||now))/1000,.05);lastFrame=now;
    if(running&&!modalOpen){
      const dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
      if(dx||dy)clickTarget=null;
      game.update(dt,{dx,dy,interact:keys.e||keys[' ']});
      if(clickTarget){
        const ref=clickTarget.ref||clickTarget,valid=clickTarget.type==='toy'?game.state.toys.includes(ref):clickTarget.type==='child'?ref.hunger>=45:true;
        if(!valid)clickTarget=null;
        else if(dist(game.state.player,ref)<54){game.interact(clickTarget);clickTarget=null;game.state.player.path=[];}
        else if(!game.state.player.path.length){game.goTo(ref.x,ref.y);if(!game.state.player.path.length)clickTarget=null;}
      }
      processEvents();
      buildFlash=Math.max(0,buildFlash-dt);
      for(const p of particles){p.life-=dt;if(!p.ring){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=95*dt;}}particles=particles.filter(p=>p.life>0);
      for(const f of floaters){f.life-=dt;f.y-=24*dt;}floaters=floaters.filter(f=>f.life>0);
      saveTimer+=dt;if(saveTimer>=5){saveTimer=0;saveGame();}
    }
    uiTimer+=dt;if(uiTimer>.13){uiTimer=0;updateUI();}
    render();requestAnimationFrame(frame);
  }
  // Read-only inspection surface for debugging a saved run; gameplay is driven by normal controls.
  globalThis.GringoGame={snapshot:()=>game.snapshot(),view:()=>({camera:{...camera},overview,rooms:game.world.rooms.map(r=>({...r})),world:{width:game.world.width,height:game.world.height}}),get version(){return '1.3.2';}};
  let saved=null;try{saved=JSON.parse(storage.get(SAVE_KEY));}catch{}
  game.restore(saved);
  updateSound();start();resizeCanvas();requestAnimationFrame(frame);
})();
