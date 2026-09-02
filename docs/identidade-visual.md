# Identidade visual do FilmPro

Decidido em 01/09/2026. Substitui integralmente o tema escuro laranja que veio
no material do curso.

## Por que não o tema do curso

O `Luminous` que acompanha o `FilmPro_v4` é dark com gradiente laranja, glow e
cantos arredondados. Saiu por dois motivos independentes:

1. É a paleta do portfólio do Lucas. O FilmPro precisa de identidade própria.
2. É o visual padrão de praticamente todo app de filme com IA — o oposto de
   diferencial numa peça de portfólio.

Trocar escuro por claro **não** abandona "cinema". Troca de qual cinema: de
estética de serviço de streaming (MUBI, Netflix, Letterboxd escuro) para
estética de cultura impressa de crítica (Cahiers du Cinéma, Criterion,
Metrograph). A segunda serve melhor a um produto cujo diferencial é texto.

Confirmação empírica: a **kirlian.io** é uma empresa de cinema — clientes BFI,
IFFR, Screen Australia — e é clara, quente e editorial.

## As quatro referências concordam entre si

Valores medidos sobre levantamentos dos sites de referência. Os arquivos desses
levantamentos **não fazem parte deste repositório** — ver *Procedência*, no fim.

| | Kirlian | Awwwocado 08 | Crying Glacier |
|---|---|---|---|
| Fundo | `#FDF6E4` creme | `#FCF4F4` creme rosado | branco |
| Tinta | `#531A0F` marrom-vinho | `#000` + `#180B09` | `#0E0E0E` off-black |
| Acento | `#EDBC3B` amarelo | `#C52E2E` sangue | `#4D7091` azul |
| Cinzas | derivados da tinta com alpha | **nenhum** | **nenhum** |
| Display | condensada, caixa alta, `lh .75` | condensada, caixa alta | Inter Tight 700 |

Quatro regras comuns, e todas valem para o FilmPro:

1. **O fundo é creme, não branco.**
2. **A tinta não é preta.** É marrom-vinho — é daí que vem o calor.
3. **Não existe escala de cinza.** A doc da Awwwocado é explícita: *"hierarquia
   vem do tamanho do tipo, não da cor"*. Os apoios saem da própria tinta com
   alpha.
4. **O acento aparece pouquíssimo.** *"Uma palavra por tela, no máximo."*

## A paleta

```css
--papel:    #FDF6E4;  /* fundo de tudo. Valor real da kirlian */
--tinta:    #531A0F;  /* marrom-vinho. Títulos, corpo, traços */
--profundo: #250701;  /* palco do trailer e carregamento. NUNCA em texto */
--acento:   #C52E2E;  /* vermelho-sangue. Valor real da Awwwocado */

/* Apoios derivados da tinta — nenhum cinza inventado */
--apoio:  rgba(83, 26, 15, 0.62);  /* texto secundário */
--fio:    rgba(83, 26, 15, 0.18);  /* filetes e molduras */
--fio-forte: rgba(83, 26, 15, 0.42);
```

O acento é vermelho-sangue, não o amarelo da kirlian: escolha do Lucas em
01/09/2026. Regra de uso herdada da Awwwocado — **uma palavra por tela**.

### Rotação cromática por coleção

A kirlian tem cinco cromáticos como superfície secundária. No FilmPro eles
ganham função: **cada coleção recebe um matiz da rotação.** O agente batiza a
coleção, e ela ganha uma cor. Busca nova, coleção nova, cor nova.

```css
--teal: #AACBC1;  --azul: #9BB2CD;  --verde: #CEE56E;
--roxo: #D1ABE3;  --rosa: #E89ED3;
```

O produto ganha variedade sem introduzir um segundo acento permanente, porque a
cor é **dirigida por conteúdo**, não decoração. Uso contido: um bloco por
coleção, nunca em texto corrido.

## Tipografia

Founders Grotesk X-Condensed (kirlian) e Schabo Condensed (Awwwocado) são
pagas. A própria doc da kirlian aponta as substitutas livres.

| Papel | Família | Uso |
|---|---|---|
| Display | **Big Shoulders Display** | Caixa alta, peso 500, `line-height: .75`, tamanhos em `vw`. Voz do produto |
| Texto | **Inter** | Tudo que se lê em linha |

Duas vozes, e a distinção carrega a tese do projeto — no modelo da Crying
Glacier, onde tamanho e peso fazem toda a hierarquia:

- **Curadoria** (`reason`, nome da coleção): Inter grande, peso 500, tracking
  apertado (`-0.04em`). É o `.lede-t` da kirlian.
- **Fato** (TMDB, OMDB): Inter pequena, esmaecida com `--apoio`.

Fraunces foi cogitada e descartada: era recomendação minha antes de os valores
reais existirem.

## Animações aprovadas

Todas em 01/09/2026. Técnicas medidas em `referencia/python/kirlianscrollreplica.html`.

**1. Carregamento em quatro fases** — a de maior valor, e não é enfeite: o
agente leva de 7 a 16 segundos, e hoje isso é uma frase parada na tela. Fundo
`--profundo`, tipo a 12vw, colunas rolando em direções opostas
(`@keyframes col`, 9s linear infinite, `is-reversed` inverte), barra de
progresso e contador de porcentagem a 14vw. Sai com
`transform: translateY(-100%)` e `cubic-bezier(.76, 0, .24, 1)` em 900ms.

**2. Tira de filme com perfurações** — a assinatura visual. As colunas de
resultado passam a ser fotogramas de uma tira real: `.frame` de 220×169 com
`border-left: 2px solid var(--tinta)`, e fileiras de `.sprocket` (26×12) em
cima e embaixo. Funde a coluna que acorda com a estrutura da kirlian.

**3. Grão de filme** — `div` fixo, `z-index: 9999`, `pointer-events: none`,
`opacity: .15`, com `feTurbulence` (`baseFrequency: .85`, `numOctaves: 4`) em
data-URI. Cinco linhas, e a tela ganha textura de película.

**4. Cursor com rótulo contextual** — anel de 52px com borda `--tinta` e texto
em condensada 11px que muda conforme o alvo ("ver trailer", "abrir ficha").
Exige guarda para dispositivo de toque e para navegação por teclado.

**5. `mix-blend-mode: difference`** (Crying Glacier) — título sobre o trailer no
hero da ficha, invertendo conforme a imagem passa.

### O gesto central, confirmado

A **coluna que acorda** continua sendo o gesto do produto, agora dentro de um
fotograma com perfurações: em repouso `grayscale(100%)` sobre o backdrop do
TMDB; sob foco a coluna vai de 12,5% para ~28% de largura, a cor volta e o
trailer do YouTube sobe de `opacity 0` para `1` em `320ms cubic-bezier(.2,.7,.3,1)`.
Expansão em **260ms**, não nos 100ms do original — a doc da Pureza registra que
100ms para 33% de largura lê como corte, não como câmera.

### Descartadas

- **Palco fixado de `2600vh`** — serve a manifesto de narrativa fixa, não a uma
  grade de resultados que muda a cada busca.
- **GSAP Flip** (o pôster voando da tira para a ficha) — é a transição ideal
  para a rota interceptadora, mas custa GSAP + plugin. Reavaliar depois de a
  ficha existir.

## Regras da casa

1. Um acento só. Ênfase é vermelho sobre creme, nunca um segundo matiz.
2. Nenhum cinza inventado — apoio sai da tinta com alpha.
3. Hierarquia por tamanho e peso, não por cor.
4. Imagem sobre fundo claro **precisa de moldura**: no escuro o fotograma se
   fundia à página; no creme ele flutua sem um filete de contorno.
5. `prefers-reduced-motion` corta trailer, colunas do loader e grão animado.

## Procedência

Os valores acima vieram de levantamentos feitos sobre sites de terceiros —
kirlian.io, MUBI e República Pureza. **Esses arquivos não são versionados
aqui**: são material de marca alheia, e ficam só na máquina de quem levantou
(`docs/design-systems/` e `referencia/python/`, ambos ignorados pelo git).

A doc da República Pureza diz explicitamente que o `#EF4123` e o logotipo são
identidade da produtora, não token reutilizável — respeitado: **nenhum matiz de
marca alheia foi levado**. O que foi levado é estrutura, e a paleta do FilmPro é
própria.
