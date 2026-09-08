# Auditoria de front-end — 08/09/2026

Rodada com a skill `impeccable` (`optimize` + `audit` + `critique`) a pedido do
Lucas, junto da investigação do travamento na rolagem. Modo **refinamento**: a
`docs/identidade-visual.md` é autoridade e nada aqui propõe trocar o mundo
visual — só apontar onde a execução fica abaixo dele.

O que **já virou código** nesta passada está na seção 3, com os números. O
resto é achado: o Lucas decide o que vira trabalho.

---

## 1. O sintoma

> "Engasga, treme, perde quadros" — ao rolar a home **e** ao passar o mouse
> pela tira de filmes.

Não é lag de inércia (o Lenis acompanhando devagar). É **queda de quadro**:
o navegador não entrega o frame a tempo.

## 2. Diagnóstico

### Numa frase

**Tudo foi medido com uma tira. A home tem cinco.**

O projeto tem documentação de performance rara — `FilmStrip.tsx`,
`AquecerTrailer.tsx` e a `identidade-visual.md` trazem números de traces reais,
e decisões já foram revertidas com base neles. Mas **toda medição foi feita num
resultado de busca, que tem uma tira só**. A home renderiza **cinco fileiras
empilhadas**, cada uma um `FilmStrip` de oito colunas com filtro sobre um
fotograma de fundo. Os achados de performance são o mesmo padrão: *corretos em
n=1, quadráticos em n=5.*

### É runtime, não carregamento

Medido em produção (home, Chrome headless por CDP):

| | |
|---|---|
| LCP | 0,51 s — **ótimo** (alvo < 2,5 s) |
| CLS | 0,025 — **ótimo** (alvo < 0,1) |
| peso total | 3.768 KB, dos quais **3.430 KB de imagem** |

LCP e CLS ótimos descartam carregamento. O engasgo está em **decode de imagem,
paint e composição** durante a rolagem — trabalho que o navegador refaz a cada
quadro.

### As duas fontes de custo por quadro

1. **40 fotogramas em `w1280` como `background-image`.** Só existem 3 `<img>`
   em todo o `src/`; os 40 fotogramas da tira são `background-image` de CSS. Isso
   torna `loading="lazy"`, `decoding="async"` e `srcset` **indisponíveis**, e faz
   o decode acontecer **na thread principal, durante o paint**. 40 backdrops de
   1280×720 são ~148 MB de textura decodificada. Quando uma coluna abre no hover,
   o fundo é **re-rasterizado a cada quadro** dos 260 ms da transição — e a
   textura maior custa mais.

2. **Nenhuma contenção de layout.** Zero ocorrências de `content-visibility`,
   `contain` ou `will-change` no projeto. As cinco fileiras — quatro nascendo
   fora da tela — passam por layout, recálculo de estilo e paint já no primeiro
   quadro, e continuam "vivas" para o compositor enquanto a página existe.

### Por que a medição remota não fecha o caso

Três tentativas de reproduzir o engasgo em Chrome headless deram "sem problema"
— inclusive **zero layouts com `flex-grow` animando**, o que é impossível. Sem
tela real o headless não executa a animação. A referência do `optimize` já
avisa: *"Desktop Chrome com conexão rápida não é representativo."* **A
confirmação que vale é a da seção 4.**

---

## 3. O que já foi feito nesta passada

### 3.1 Fotogramas da tira: `w1280` → `w780`

`src/lib/tmdb.ts` ganhou `backdropMenor(url)`, aplicado em `FilmStrip.tsx` nos
dois desenhos (mesa e pilha). O herói e a ficha continuam em `w1280` — são
superfícies que ocupam a largura inteira. A coluna da tira não passa de ~270 px
no desktop e ~540 px no celular; `w780` é indistinguível de `w1280` nesse
tamanho.

É recorte de string na URL porque o tamanho vem **assado do n8n**
(`montar-resposta.js` e dois espelhos). O conserto certo é o n8n mandar só o
`path` e o Next montar — quando isso acontecer, `backdropMenor` sai junto.

**Medido** (build de produção local, mesmo CDN do TMDB):

| | antes (produção) | depois |
|---|---|---|
| imagem | 3.430 KB | **1.716 KB** (−50%) |
| peso total | 3.768 KB | 2.030 KB |

As seis imagens mais pesadas da home caíram todas para `w780` (73–116 KB, contra
os 160–260 KB de antes).

### 3.2 `content-visibility: auto` nas cinco fileiras

`.fileira` em `globals.css`, com `contain-intrinsic-size: auto 800px`. O
navegador adia layout/estilo/paint da fileira até ela se aproximar da viewport,
e refaz ao sair. Fora dos blocos `@supports`/`@media` de propósito — a contenção
vale mesmo sem a animação scroll-driven.

**Medido**: as cinco fileiras entram em `content-visibility: auto`; a animação
`fileira-revela` continua funcionando (opacidade `0 → 1` ao entrar na tela); o
`scrollHeight` se ajusta ~190 px na primeira rolagem (o `auto` guarda a altura
real depois disso) e fica estável.

### 3.3 Harness de `lerp` (só em desenvolvimento)

`SmoothScroll.tsx` passa a ler `?lerp=` da URL em `npm run dev`. Em produção o
parâmetro é ignorado. Serve para o Lucas **sentir** os valores da seção 5 sem
recompilar. Sai quando o valor for escolhido.

### Verificação

`npm run lint`, `npm run build`, `npm test` (21/21) limpos. Home (desktop e
celular), ficha e busca real exercitadas — todas 200, fotograma da coluna em
`w780`, herói em `w1280`.

**Não declarado resolvido**: o engasgo em si. Ver a seção 4 — já errei três
vezes tentando julgar isso por medição remota.

---

## 4. O que só o Lucas pode confirmar (fazer antes de mais consertos)

1. **Frame Rendering Stats.** DevTools → `Ctrl+Shift+P` → "Show Rendering" →
   marcar *Frame Rendering Stats*. Rolar a home. Se o gráfico de GPU/quadros
   dispara, é paint/composição.

2. **Gravar 5 s de rolagem** na aba Performance. As faixas longas são
   **Image Decode / Paint / Composite** (confirma o diagnóstico da seção 2) ou
   **Recalculate Style / Layout** (aponta para o `flex-grow`, achado 6.7)?

3. **Isolar o Lenis.** Ativar `prefers-reduced-motion` no Windows
   (Configurações → Acessibilidade → Efeitos visuais → *Efeitos de animação*
   desligado) e recarregar. O Lenis **não monta**. Se o engasgo continuar, ele
   nunca foi o problema e a seção 6 é o caminho inteiro.

Sem o passo 1 ou 2, os consertos da seção 6 são apostas informadas, não
respostas.

---

## 5. O `lerp` — os cinco valores para sentir

`lerp` (padrão `0.1`) governa a inércia: menor é mais pesado, maior é mais seco.
As durações são o tempo até a rolagem "assentar" (99%), calculadas da fórmula de
damping exponencial do Lenis a 60 fps — exatas, não estimadas.

| URL (em `npm run dev`) | assenta em | sensação |
|---|---|---|
| `/?lerp=0.08` | ~960 ms | arrasto de projeção, bem pesado |
| `/` (padrão `0.1`) | ~770 ms | o que está no ar |
| `/?lerp=0.2` | ~385 ms | quase nativo, leve resíduo |
| `/?lerp=0.8` | ~95 ms | inércia quase nula |
| movimento reduzido no SO | — | **sem Lenis**, rolagem nativa pura |

**Se a escolha for `0.8`**: a 0,8 o Lenis quase não faz efeito. Talvez o certo
seja **removê-lo**, não neutralizá-lo — a dependência (`lenis`, ~12 KB) só se
paga pela inércia, e os toques scroll-driven da home são CSS puro, não dependem
dele.

---

## 6. Achados de auditoria

Notas por dimensão (0–4):

| dimensão | nota | resumo |
|---|---|---|
| Acessibilidade | **2** | contraste do texto de apoio falha AA no tema claro; foco sem indicador em dois caminhos |
| Performance | **2** | ver seção 2; os 40 fotogramas e a falta de contenção eram o teto |
| Responsivo | **3** | sólido; um aperto real em 320 px |
| Semântica / HTML | **4** | `<dialog>` nativo, `aria-hidden` nos lugares certos, landmarks corretos |
| Consistência visual | **4** | tokens disciplinados, sem `box-shadow` por decisão, família de cor coerente |

### Acessibilidade

**6.1 🔴 `--color-apoio` falha WCAG AA no tema claro.**
`rgb(83 26 15 / 0.62)` sobre o papel `#FDF6E4` dá contraste **≈ 4,1:1**
(calculado à mão — confirmar com ferramenta). O mínimo AA para texto normal é
4,5:1. Atinge ~15 pontos de texto pequeno: metadados da legenda, rótulos
"Onde assistir", "TMDB ↗", contadores. Subir o alpha de `0.62` para ~`0.72`
passa de 4,5:1 e **preserva a filosofia** de "hierarquia por tamanho, não por
cor" — continua sendo a tinta com alpha, só menos transparente.
O **tema escuro passa** (`rgb(253 246 228 / 0.62)` sobre `#250701` ≈ 6:1). O
problema é assimétrico.

**6.2 🔴 `text-apoio/70` a 10 px = contraste ~2,3:1.** `FilmStrip.tsx:614`, o
"Verificado em {data}" da ficha — exatamente o dado que a doc defende como
exigência de honestidade, renderizado quase invisível. `/70` multiplica o alpha
já baixo do apoio. Tirar o `/70` e deixar `text-apoio` (com a correção 6.1)
resolve.

**6.3 🔴 Foco escapa da janela visível da tira.** `VISIVEIS = 5`, mas as oito
`.coluna` são renderizadas no `<ul>`; as colunas 6–8 ficam fora da tela por
`translateX` dentro de um `overflow: hidden`. `Tab` leva o foco para links
invisíveis, e as setas não acompanham. Opções: `tabindex={-1}` +
`aria-hidden` nas colunas fora da janela (sincronizado com `passo`), ou trocar
o `translateX` por virtualização real.

**6.4 🔴 `outline-none` sem substituto no card do celular.**
`FilmStrip.tsx:447` mata o anel de foco; o `:focus-within` que o substituiria
está dentro de `@media (hover: hover)` (`globals.css:166`), então **teclado +
toque fica sem indicador nenhum**. Falha WCAG 2.4.7. No desktop a
`.coluna:focus-within` (fora do `@media`) salva — só a pilha está descoberta.

**6.5 ⚠️ Letreiro do herói sem `width`/`height`, sem `decoding`, sem `lazy`.**
`Hero.tsx` — o `<img alt="Suspiria">` com `max-h-24 max-w-[70%]` não reserva
espaço: o tamanho depende da proporção da imagem, desconhecida até carregar →
CLS. Some a isso o decode síncrono de um PNG na thread principal. Contradiz o
comentário do `next.config.ts:8` ("os cards usam `<img>` com width e height
explícitos"). O backdrop do herói também não tem dimensão, mas a caixa dele é
travada por CSS (`inset: 0`), então o risco de CLS ali é baixo.

### Performance ainda em aberto

**6.6 `content-visibility` — feito** (seção 3.2). Era o de maior retorno.

**6.7 `transition: flex-grow` na `.coluna`** (`globals.css:197`). `flex-grow` é
propriedade de **layout**: animá-la re-distribui a largura das oito colunas a
cada quadro dos 260 ms, e cada coluna re-rasteriza o fundo filtrado. O recuo
**já está escrito** no comentário de `globals.css:187-189`: tirar `flex-grow`
da transição e deixar só `filter`. **Custo**: a coluna abre de estalo em vez de
deslizar. É decisão de sensação — como o `lerp`, o Lucas julga no hardware
dele. Não mexido nesta passada de propósito.

**6.8 `mix-blend-mode: difference` no `.hero-h1`** (`globals.css:139`). Um
`<h1>` de ~280×672 px sobre o still que anima `scale()` 24 s em loop infinito:
a área do h1 é **recomposta a cada quadro**, mesmo com a página parada. É item 5
das animações aprovadas na `identidade-visual.md` — **não mexer sem o Lucas**.
Alternativa que preserva a intenção: `#fff` com `text-shadow` sutil em vez do
blend, ou `will-change: auto` e aceitar o custo só enquanto o herói está na
dobra.

**6.9 `.grao`** (`globals.css:49`): `position: fixed; inset: 0; z-index: 9999;
opacity: 0.15` — SVG de turbulência na viewport inteira, blendado sobre a página
a cada quadro. É decisão de design ("cinco linhas e a tela ganha textura"). Se a
seção 4 apontar composição como gargalo, testar `opacity` menor + `will-change`
ou trocar por um `::after` contido.

**6.10 `Cursor`** (`Cursor.tsx:26`): `closest("[data-cursor]")` + dois `setState`
**por amostra de `mousemove`**, sem `requestAnimationFrame`. Em ponteiro fino
isso é trabalho de React a cada evento do mouse. Empacotar num rAF (guardar a
última posição, aplicar uma vez por quadro) tira o React do caminho quente.

**6.11 `useMedia` começa `false`** (`useMedia.ts:15`): o desktop monta a pilha
mobile inteira do `FilmStrip` no primeiro render (SSR + primeiro quadro), depois
troca para a mesa. ~40 fotogramas montados e jogados fora por carga de página. O
docblock documenta o trade-off; `useSyncExternalStore` daria o valor certo já no
primeiro render do cliente. Mexe num hook compartilhado — passada própria, não
contrabando.

**6.12 `key={filme.tmdbId}` na `<Legenda>`** (`FilmStrip.tsx:131`): é
intencional (reinicia a animação CSS), mas remonta ~30 nós e 6 `<img>` de logo
**a cada hover**. Trocar por uma `key` no wrapper da animação e manter a
`<Legenda>` montada, ou animar via classe adicionada/removida.

### Responsivo

**6.13 ⚠️ 320 px**: `w-[9.5rem] shrink-0` no rótulo de "Onde assistir"
(`FilmStrip.tsx:601`) ocupa 152 px de 320 — 47% da linha, e os logos espremem no
resto. Abaixo de 360 px, empilhar rótulo e logos.

---

## 7. Crítica (heurística) e nota de mérito

**Crítica:**

- A tira é o coração do produto e o feedback de hover (largura + cor) é
  excelente conceito, mas a legenda que **remonta** a cada passagem do mouse
  (6.12) e o foco que **vaza** da janela (6.3) mostram que o teclado e o
  scan rápido não foram exercitados tanto quanto o mouse parado.
- "Verificado em {data}" (6.2) é a informação mais honesta da tela renderizada
  na cor menos legível. A intenção e a execução se contradizem.
- Cinco rótulos de fileira ("Recorte da semana", "Também da semana"...) é bom
  instinto contra a repetição, mas os quatro últimos são variações sem
  informação. Um rótulo real por fileira (gênero, década, humor da coleção)
  usaria melhor o espaço.

**Mérito, para o registro:**

- `<dialog>` nativo para o modal, com `lenis?.stop()`/`start()` e foco preso.
- Zero `box-shadow` no projeto inteiro, por decisão declarada.
- `:focus-within` (e não `:focus-visible`) escolhido de propósito onde o
  focável é filho.
- Contador do loader com `aria-hidden`.
- O tema escuro passa AA (6:1). O sistema de cor com alpha é coerente — só o
  ponto de partida do apoio no claro é transparente demais.
- Toda a montagem de URL do TMDB centralizada em `tmdb.ts`, com a procedência de
  cada tamanho comentada.

---

## 8. Recomendações, em ordem

| # | ação | tipo | onde |
|---|---|---|---|
| 1 | **Confirmar o gargalo** (seção 4) | medição | máquina do Lucas |
| 2 | Subir `--color-apoio` para ~`0.72`, remover `text-apoio/70` (6.1, 6.2) | a11y | `globals.css`, `FilmStrip.tsx` |
| 3 | Indicador de foco na pilha do celular (6.4) | a11y | `globals.css` |
| 4 | `tabindex={-1}`/`aria-hidden` nas colunas fora da janela (6.3) | a11y | `FilmStrip.tsx` |
| 5 | `width`/`height` + `decoding="async"` no letreiro (6.5) | perf/CLS | `Hero.tsx` |
| 6 | Decidir sobre `transition: flex-grow` (6.7) — sentir primeiro | perf/sensação | `globals.css` |
| 7 | `mix-blend-mode` do herói — só com o Lucas (6.8) | perf/design | `globals.css` |
| 8 | rAF no `Cursor` (6.10), `key` da legenda (6.12) | perf | componentes |
| 9 | n8n manda `path`, não URL `w1280` — tira `backdropMenor` | arquitetura | n8n + `tmdb.ts` |

## 9. Fora de escopo

- Redesign ou troca de mundo visual — `identidade-visual.md` é autoridade e a
  skill manda preservá-la em refinamento.
- `PRODUCT.md` / `DESIGN.md` da skill (`/impeccable init`) — ofereço depois; a
  `identidade-visual.md` serviu de DESIGN.md aqui.
- Reimportar workflow no n8n para a recomendação 9 — aponto a linha, o Lucas
  executa.
