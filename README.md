# Gringo: Fábrica de Herdeiros

Arcade 2D de sobrevivência e gerenciamento familiar, em português, feito em HTML, CSS e JavaScript com Canvas. Usa os quatro personagens em pixel art criados a partir da foto de referência. Não requer instalação de bibliotecas.

## Jogar

Abra `dist/index.html` no navegador. Para servir por HTTP com Node.js:

```sh
npm start
```

Acesse `http://127.0.0.1:4173`. O jogo também funciona em telas menores, com controles por toque.

## Publicar no GitHub Pages

O projeto está preparado para publicar automaticamente o conteúdo de `dist/`, sem build. O workflow `.github/workflows/pages.yml` instala as dependências de desenvolvimento, verifica o JavaScript e executa os testes antes de publicar. O jogo publicado continua sem dependências de servidor.

1. Crie um repositório no GitHub e envie o **conteúdo desta pasta `gringo-game` para a raiz do repositório**, incluindo `.github/`, `dist/`, `tests/`, `package.json` e `package-lock.json`. Não coloque tudo dentro de outra pasta `gringo-game` no repositório. Não envie `node_modules/`, `.git/`, `.qa/` nem a foto original.
2. Use `main` ou `master` como branch padrão do repositório.
3. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
4. Em **Actions**, selecione **Publicar jogo no GitHub Pages** e clique em **Run workflow** na branch padrão. Os próximos pushes nessa branch publicarão as atualizações automaticamente.
5. Após a conclusão, abra o endereço indicado no ambiente `github-pages` ou em **Settings → Pages**. Em um repositório comum, o endereço será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Não é necessário cadastrar tokens ou secrets: o workflow usa o `GITHUB_TOKEN` automático com as permissões do Pages. Somente `dist/` é enviado ao site. Os caminhos dos scripts, estilos e sprites são relativos, portanto funcionam também no subdiretório do repositório. O arquivo `dist/.nojekyll` permite servir essa pasta como arquivos estáticos também em uma publicação manual.

Para usar a publicação manual **Deploy from a branch**, copie somente o conteúdo de `dist/` para a raiz da branch de publicação ou para `/docs` e selecione essa pasta nas configurações do Pages. Essa alternativa dispensa o workflow.

Cada jogador tem seu próprio save no navegador. Trocar o endereço do site não transfere o save do endereço anterior. A música começa após a interação com o jogo.

Referência: [documentação oficial do GitHub Pages sobre workflows personalizados](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Interface e circulação — versão 1.1

A partida ocupa uma única tela. O HUD sobre o jogo reúne filhos, caixa, integridade, caos, mamadeiras, combo e poderes compactos. O botão **QUERO MAIS UM!** e os objetivos da preparação ficam dentro da tela. Melhorias, prioridade da Esposa, conquistas e reinício são acessados pelos menus; não há painéis laterais nem página de apresentação durante a partida.

A família é identificada como **Paim de Araujo** na casa, no menu e na cidade. O quarto dos mini herdeiros tem uma entrada de 112 pixels pela sala e uma passagem de 158 pixels pela cozinha. As camas foram reposicionadas para liberar a circulação. As paredes desenhadas e as colisões compartilham a mesma geometria, e as rotas partem de um ponto alcançável sem cortar quinas.

### Correção de navegação — versão 1.1.1

A navegação mantém distância de segurança das paredes e conclui cada curva antes de seguir para o próximo ponto. A Esposa mantém a tarefa atual, acompanha crianças em movimento e recalcula rotas obstruídas. Alvos inacessíveis são adiados para que ela possa atender outras tarefas. O estoque cheio de mamadeiras também pode ser organizado para cumprir a preparação de um bebê. Quando não há tarefas, ela informa isso no menu da equipe.

Os testes incluem as posições exatas que reproduziam a quina, centenas de rotas com taxas de quadros e velocidades diferentes, recuperação de rotas bloqueadas e 20 simulações de dois minutos com 11 filhos.

## Controles

- WASD ou setas: mover o Gringo.
- E ou espaço: interagir com o objeto próximo.
- Clique ou toque: caminhar até um alvo e interagir automaticamente.
- 1 a 5: poderes do Gringo.
- M: melhorias e equipe.
- V ou botão ⤢: alternar entre visão geral dos cômodos e câmera acompanhando o Gringo. O minimapa também aceita cliques para caminhar.
- Botão ♫: ligar/desligar a música de fundo independentemente dos efeitos sonoros. A preferência é salva neste navegador.
- P ou Esc: menu e pausa. A aba oculta também pausa o jogo.

## Regras

### Expansões físicas — versão 1.2

Cada compra aumenta a área percorrível do mapa. A câmera acompanha o personagem e, logo após a construção, mostra a planta completa. A interface continua dentro do jogo.

| Etapa | Cômodos | Novos ambientes |
| --- | --- | --- |
| Casa pequena | 3 | Sala, cozinha e quarto dos mini herdeiros |
| Mansão | 5 | Suíte do casal e brinquedoteca |
| Condomínio | 9 | Dormitório coletivo, refeitório, berçário e lavanderia |
| Bairro | 12 | Escolinha, parquinho coberto e quadra |
| Cidade | 16 | Escola da dinastia, praça, prefeitura e enfermaria |

As expansões trazem pontos extras de mamadeiras, trabalho e reparo. Cada área começa com bagunça e gera novos tipos: roupas na lavanderia, restos no refeitório e papéis na escola e prefeitura. A frequência e o limite de bagunça aumentam com a casa, assim como a manutenção a cada 10 segundos. A ampliação também restaura a integridade, melhora a renda e libera mais capacidade para filhos.

A música de fundo é uma composição original em chiptune com ritmo brasileiro leve, sintetizada por Web Audio. Começa após a interação de início da partida e pausa nos menus ou quando a aba perde o foco. Pode ser desligada no botão ♫; o botão de efeitos é independente. Não há download de trilha nem dependência de internet para tocar.

A família começa com a Esposa e dois filhos. Clique em **QUERO MAIS UM!** para pagar a preparação e abrir um desafio de 60 segundos: recolher brinquedos, preparar mamadeiras na cozinha e trabalhar no notebook. Só depois de cumprir os três objetivos chega um novo filho. Se o tempo acabar, a chegada é adiada e a casa perde 6% de integridade; o jogador pode tentar de novo.

O notebook gera renda por interação e tem um intervalo de 2,6 segundos. A cozinha prepara 3 mamadeiras por R$ 5. As ferramentas reparam 22% da casa por R$ 12. A renda e as despesas automáticas acontecem a cada 10 segundos de partida. A família quebra em R$ −60 ou quando a integridade da casa chega a zero.

A Esposa busca rotas pela casa, limpa brinquedos, alimenta as crianças, prepara mamadeiras e repara danos. A prioridade pode ser equilibrada ou voltada à limpeza, no menu Melhorias e equipe (M). Ações próximas no tempo dos dois pais carregam mais rápido o combo, alternando **Amor Infinito**, **Super Pais** e **Mutirão da Família**.

Os cinco poderes têm duração e recarga próprias. Made in Brazil e International Daddy estão disponíveis no começo; Family First libera com 3 filhos, Pai de Multidões com 5 e Plano de Expansão com 7. O jogador pode comprar robôs, melhorar a renda de **Trabalhar como escravo para meu pai** e expandir de casa para mansão, condomínio, bairro e cidade. As expansões mudam o cenário, restauram a casa e aumentam a renda e a capacidade confortável.

Conquistas: 2, 3, 5, 7, 11, 20, 50, 100 e 500 filhos. Aos 100, a cena da família reunida celebra Gringolândia; é possível continuar até 500. Para preservar o desempenho, até 72 crianças são representadas individualmente no interior da casa; as demais contam para a população, custos e pressão do caos, e são indicadas como brincando pelo bairro.

As folhas originais têm poses paradas em quatro direções. A caminhada usa troca de direção e oscilação leve do personagem, sem alterar os PNGs. O som é sintetizado no navegador e pode ser ativado pelo botão Som.

## Salvamento e acessibilidade

A partida é salva a cada cinco segundos e nos momentos principais no `localStorage` deste navegador. O recorde é mantido ao reiniciar. Não há progresso offline. Se o navegador bloquear o armazenamento, a partida continua funcionando, mas o progresso poderá ser perdido ao fechar. Modais prendem o foco, os botões têm rótulos e a preferência de movimento reduzido é respeitada.

## Desenvolvimento e verificação

```sh
npm install
npm run check
npm test
```

- `dist/engine.js`: simulação independente de DOM, IA, rotas e regras.
- `dist/world.js`: plantas físicas, portas, móveis e serviços de cada expansão.
- `dist/music.js`: composição, sintetizador, loop e controle da trilha de fundo.
- `dist/game.js`: Canvas, interface, controles, áudio e salvamento.
- `dist/atlas.js`: metadados locais dos sprites; permite abrir por `file://` sem buscar JSON.
- `dist/styles.css`: interface responsiva.
- `tests/engine.test.cjs`: progressão, economia, IA, poderes, combos, expansões, finais e restauração.

As fontes externas são opcionais; o jogo funciona com as fontes locais se estiver offline. Os quatro sprites e os metadados estão incluídos em `dist/assets/characters`. A foto de referência original não faz parte da distribuição do jogo.
