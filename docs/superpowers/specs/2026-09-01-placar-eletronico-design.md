# Placar Eletrônico por Modalidade

## Objetivo

Dar ao organizador um placar eletrônico projetável (segunda tela/monitor externo), controlado por um painel de operação, adaptado à modalidade do campeonato — inspirado nas placas físicas (ex.: mseletronica) mas rodando no navegador, sem hardware.

## Experiência proposta

- Nas abas **Jogos** e **Chaveamento**, cada partida ganha um botão "🖥️ Placar ao vivo".
- Clicar nele abre a aba **Placar** dentro da própria página do campeonato (mesmo `store`, mesma sessão, mesmas permissões — sem tela de carregamento nova), com controles grandes para operar a partida.
- Nesse painel, um botão "Abrir tela de projeção" abre `/placar/:id/:matchId` em nova janela. O operador arrasta essa janela para o monitor externo e clica em "Tela cheia" (Fullscreen API).
- A tela de projeção é somente leitura, fundo escuro, fontes grandes, e se atualiza sozinha conforme o operador mexe no painel de controle — sem precisar apertar F5.

## Escopo

Dentro:
- Placar (gols/sets/pontos), cronômetro (iniciar/pausar/zerar), período/tempo, faltas, tempos técnicos, pênaltis de combate (lutas), indicador de saque (esportes de set).
- Layout adaptado por `scoreType`/`category` (já existentes em `templates.js`), cobrindo as modalidades cadastradas.
- Sincronização no mesmo computador (painel numa aba, projeção noutra janela/monitor).
- Persistência no Firestore (sobrevive a F5, funciona em qualquer aba do mesmo campeonato).
- Partidas de fase liga/grupos (`state.matches`) e confrontos de mata-mata (`bracket` ties), controlando a perna ativa.

Fora (não faz parte desta tarefa):
- Cronômetro/controles não aparecem na súmula, PDF ou portal público — só na tela de projeção e no painel.
- Pênaltis de desempate do mata-mata continuam só na aba Chaveamento (não entram na tela de projeção).
- Sincronização entre dispositivos diferentes (operador e tela em computadores separados) — hoje ambos ficam no mesmo computador; entre abas/janelas do mesmo navegador já funciona via Firestore, então cross-device pode até funcionar na prática, mas não é testado/otimizado nesta tarefa (sem BroadcastChannel dedicado).
- Regras oficiais exatas de cada esporte (nº de tempos técnicos, faltas que geram bônus, etc.) — os contadores são genéricos, o operador usa o que for aplicável à modalidade.

## Modelo de dados

Adicionado dentro do próprio objeto `match`/`tie` (blob JSON já salvo hoje, sem mudança em `schemas.js` nem `firestore.rules`):

```js
obj.clock = { running: false, startedAt: null, elapsedMs: 0, period: 1 };
obj.fouls = { home: 0, away: 0 };       // scoreType 'goals'
obj.timeouts = { home: 0, away: 0 };    // scoreType 'goals'
obj.penalties = { home: 0, away: 0 };   // category 'lutas'
obj.server = null;                      // 'home' | 'away' | null — scoreType 'sets'
```

Tempo corrente do cronômetro é sempre calculado no cliente:
`running ? elapsedMs + (Date.now() - startedAt) : elapsedMs`
— não há gravação por segundo; só grava ao iniciar/pausar/zerar/trocar período.

## Arquitetura

**`src/app/scoreboard.js`** (novo) — mutadores puros, mesmo estilo de `matches.js`:
`clockToggle(obj)`, `clockReset(obj)`, `setPeriod(obj, n)`, `adjustFoul(obj, side, delta)`, `adjustTimeout(obj, side, delta)`, `adjustPenalty(obj, side, delta)`, `toggleServer(obj)`, `currentElapsedMs(obj)`.

**`src/services/championships.js`** — adicionar `subscribeChampionship(id, cb)` usando `onSnapshot` na coleção privada `championships`, reaproveitando `parseSnapshot` já existente.

**`src/pages/championship/tabs/scoreboard-control.js`** (novo) — painel de operação. Recebe `store` e a partida/perna selecionada (estado local da página do campeonato, como já ocorre com a aba/seleção atual). Renderiza layout por modalidade (goals/sets/lutas/points) com botões grandes; cada ação chama uma função de `scoreboard.js` e reaproveita o `persist()` já existente na página do campeonato.

**`src/pages/scoreboard-display.js`** (novo) + rota `/placar/:id/:matchId?tie=1&leg=1|2` em `main.js` — assina `subscribeChampionship`, localiza a partida/perna (via `allMatchObjs`/busca no bracket), renderiza full-bleed. Usa o padrão `root.__publicUnsubscribe` para ser limpo automaticamente pelo `safeRoute` existente. Sem autenticação própria: se o Firestore negar leitura (usuário deslogado/sem permissão), mostra mensagem "Faça login para ver este placar" com link pra `/login`.

## Layout por modalidade

- **`scoreType: 'goals'`** (futebol, futsal, basquete, handebol, rugby, hóquei...): nomes dos times, placar grande, cronômetro MM:SS, período (ex.: "2º tempo"), faltas e tempos técnicos por lado (contadores +/-).
- **`scoreType: 'sets'`** (vôlei, tênis, padel, beach tennis, badminton, mesa, squash): sets ganhos em destaque, placar do set atual, bolinha indicando quem saca.
- **`scoreType: 'points'` + `category: 'lutas'`** (judô, jiu-jitsu, karatê, taekwondo): pontos, penalidades por lado, cronômetro de round, número do round.
- **`scoreType: 'points'` (demais individuais)**: placar, cronômetro, período — sem faltas/pênaltis/penalidades.

## Validação

- Placar exibido bate com o valor salvo em `match.hg`/`match.ag` (ou `tie.ag{leg}`/`tie.bg{leg}`) após editar pelo painel.
- Cronômetro conta corretamente após pausar/retomar/zerar, inclusive após F5 na tela de projeção (recalcula a partir de `elapsedMs`/`startedAt` salvos).
- Layout muda corretamente entre uma modalidade `goals`, uma `sets` e uma `lutas`.
- Painel some/mostra faltas, tempos técnicos, pênaltis e saque só nas modalidades corretas.
- Ação sem permissão (papel sem acesso a resultados) é bloqueada como já ocorre hoje em `persist()`.
