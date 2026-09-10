# FilmPro

Você descreve o que quer sentir. Um agente de IA escolhe os filmes e escreve, em
uma frase, por que cada um responde ao seu pedido. Todo o resto (pôster, nota,
duração, elenco, trailer, onde assistir) vem do TMDB. O modelo cura, a API
informa.

No ar em [filmpro.lucasschwingel.com](https://filmpro.lucasschwingel.com).

---

## Por que ele existe

Isto começou como um projeto de curso da Asimov Academy, e o projeto original
tinha um defeito que vale mais que o exercício.

Ele pedia ao LLM que preenchesse um schema com `imdb_rating`,
`duration_minutes`, `poster_url` e `streaming_platforms`. São coisas que um
modelo de linguagem não tem como saber: notas mudam, catálogos de streaming
mudam por país e por semana, e uma URL de imagem ou existe no servidor ou não
existe. O modelo preenchia mesmo assim, porque é o que modelo de linguagem faz.
Havia uma ferramenta de consulta ao OMDB, mas ela buscava um título por chamada
e o resultado não voltava para a resposta final, então `poster_url` chegava
`null` e a interface caía num placeholder cinza.

A correção não é buscar o pôster depois e injetar. É tirar esses campos do schema
do modelo: campo que não existe não pode ser inventado.

O agente devolve quatro campos por filme, e o schema é fechado
(`additionalProperties: false`):

```json
{ "title": "...", "originalTitle": "...", "year": 1999, "reason": "..." }
```

Título, título original e ano são chaves de busca. Servem para achar o filme no
TMDB, e são conferidos lá. `reason` é a única coisa que o modelo realmente
produz, e é a que nenhuma API tem.

Na resposta final, dois campos são autorais (o `reason` e o nome que o agente dá
ao conjunto) e nenhum fato vem do modelo. Cada card carrega o link do TMDB. Se o
agente sugere um filme que o TMDB não confirma, ele não vira card: entra em
`notFound`, e a interface diz quantas sugestões foram descartadas em vez de
fingir que a lista veio inteira.

---

## Para que serve

É um portfólio, e uma opinião sobre como usar LLM em produto: dar ao modelo a
tarefa em que ele é insubstituível (entender "quero algo que doa mas termine
bem" e justificar uma escolha) e não deixá-lo perto de nenhum dado verificável.

Também é uma ferramenta que funciona. Recomendação por catálogo e por gênero já é
busca resolvida; recomendação por estado de espírito é o que ninguém faz bem, e é
onde um modelo de linguagem ganha.

---

## Como funciona

```
Browser
  │  POST /api/recommendations { preferences, limit }
  ▼
Next.js route handler (BFF)      ← autentica, limita a 5/min por IP,
  │                                 valida 10 a 500 caracteres
  │  POST webhook (header x-api-key)
  ▼
n8n, 4 workflows publicados
  ├─ "FilmPro — Recomendações" (25 nós):
  │    ├─ normaliza o texto → SHA256(consulta | limite | versão do prompt)
  │    ├─ cache acertou? ── sim ──▶ carrega os fatos ──▶ responde
  │    ├─ agente (Gemini 3.1 Flash Lite, reserva Groq) + Structured Output Parser
  │    ├─ para cada título: busca no TMDB → detalhes → OMDB
  │    └─ responde primeiro; só então grava cache e telemetria
  ├─ "FilmPro — Filme Standalone" (5 nós):
  │    └─ consulta direta por tmdb_id na tabela movies (rota /filme/[tmdbId])
  ├─ "FilmPro — Fileiras da semana" (10 nós):
  │    └─ toda segunda 6h: um agente escolhe os temas, cada tema passa pelo
  │       webhook de recomendações e o resultado vai para home_sections
  └─ "FilmPro — Fileiras da Home" (5 nós):
       └─ leitura da home: lê home_sections + movies, sem LLM e sem TMDB
```

O Next nunca fala com o TMDB, com o OMDB nem com o Postgres. Todas as chaves
vivem num lugar só, no n8n, e o navegador nunca chega perto delas.

A tela inicial não é estática. As fileiras vêm de uma curadoria semanal que o
workflow "Fileiras da semana" grava toda segunda, reaproveitando o mesmo webhook
de recomendações que uma pessoa usa. A home só lê o que já está gravado.

### O cache tem duas camadas, e elas guardam coisas diferentes

| | Guarda | Chave | Validade |
|---|---|---|---|
| **L1** `search_cache` | a curadoria: `[{tmdb_id, reason, rank}]` | hash da consulta | 30 dias |
| **L2** `movies` | os fatos, do TMDB | `tmdb_id` | 90 dias |

O L1 não guarda a resposta pronta. Ela é sempre remontada juntando as duas
camadas, porque nota e disponibilidade de streaming mudam, e servir "está na
Netflix" de três meses atrás é um erro que o usuário vê.

Os 90 dias do L2 são deliberados: pôster, sinopse, elenco e duração não mudam. Em
troca, a interface mostra *"disponibilidade verificada em {data}"* em vez de
afirmar o presente.

A invalidação é uma linha: `prompt_version` entra no material que vira hash.
Editou o prompt do agente, todo hash muda e o cache inteiro se invalida sozinho,
sem `DELETE` e sem migração.

A quarta tabela, `home_sections`, não é cache. É o snapshot das fileiras que o
robô grava toda segunda, com o mesmo formato de `picks` que o L1. Ele sobrevive à
expiração do L1 e não muda no meio da semana, mesmo que alguém rebusque as mesmas
palavras.

---

## Segurança

`preferences` é texto livre vindo da internet e vai direto para um LLM. A defesa
principal é o schema, não um parágrafo no prompt pedindo bom comportamento:

- Quatro campos, `additionalProperties: false`, `maxLength` no texto autoral e
  `maxItems` na lista. Injeção não cria campo novo nem resposta gigante.
- O agente não tem ferramentas e não tem segredo no contexto. Não há ação para
  sequestrar nem nada para exfiltrar.
- O TMDB funciona como sumidouro de injeção. Todo título passa por lá antes de
  virar card, e nem um agente completamente dominado consegue exibir um filme que
  não existe.
- Sobra uma superfície: o texto autoral renderizado. Ele passa por
  [`src/lib/sanitize.ts`](src/lib/sanitize.ts), onde link, tag HTML e link
  markdown derrubam o campo inteiro para um texto neutro, antes de ir para o
  cache e de novo antes de renderizar.
- `dangerouslySetInnerHTML` não aparece em lugar nenhum do código, por regra.

O limite é de 5 requisições por minuto por IP, porque cada uma custa uma chamada
de LLM mais até 16 chamadas ao TMDB.

> O contador vive na memória do módulo. Em serverless cada instância tem o seu, e
> a plataforma sobe várias sob carga. Isso atrapalha um script ingênuo, mas não
> substitui um armazenamento compartilhado como Redis. A ressalva existe para que
> a promessa caiba no que o código faz.

---

## Licenças e atribuição

O FilmPro é uma peça de portfólio e não é comercial. Sem anúncio, sem cobrança,
sem afiliado, sem venda do app. Não é uma preferência: é a condição que mantém
válidas as duas APIs de dados do projeto.

| Fonte | O que exige | Onde está cumprido |
|---|---|---|
| TMDB | aviso com redação literal + logo oficial, menos proeminente que a marca do app; uso não comercial | [`src/components/ui/Footer.tsx`](src/components/ui/Footer.tsx), persistente em toda rota |
| OMDb | uso pessoal e não comercial. Não exige atribuição; o crédito vem da CC BY-NC 4.0 declarada no site deles, que pede link de volta | mesmo rodapé, com link |
| Tipografia | Big Shoulders e Inter, ambas OFL | via `next/font/google`; nenhum arquivo de fonte no repositório |
| Dependências | nada a cumprir | as cinco de produção são MIT (`next`, `react`, `react-dom`, `zustand`, `lenis`) |

Os levantamentos de sistemas de design de terceiros que orientaram a identidade
(`referencia/`, `docs/design-systems/`) são material de marca alheia e não fazem
parte deste repositório. Estão no `.gitignore` e nunca foram commitados. A
procedência está registrada em
[docs/identidade-visual.md](docs/identidade-visual.md).

### A ordem do fluxo também é uma decisão de licença

Os termos do TMDB tratam como uso comercial o emprego do conteúdo deles "em
conexão com" um sistema interativo de pergunta-resposta baseado em LLM. O que
mantém o FilmPro fora disso é a ordem, e ela é deliberada: o modelo escolhe
títulos com o repertório dele, e só então o TMDB é consultado para resolver
aqueles títulos em fatos e imagens.

Nenhum conteúdo do TMDB entra no modelo. Ele não é treinado com aquilo, não lê
aquilo e não responde a partir daquilo, o oposto do chatbot que usa o catálogo
como base de conhecimento, que é o que a cláusula existe para barrar. O parágrafo
de abertura de [`n8n/nos/curador.prompt.md`](n8n/nos/curador.prompt.md) é o que
segura essa fronteira.

Três mudanças quebrariam a conformidade: qualquer receita; alimentar o modelo com
conteúdo do TMDB; ou deixar o modelo responder *sobre* os filmes usando dado do
TMDB em vez de só escolher títulos.

---

## Design

Papel creme `#FDF6E4`, tinta marrom-vinho `#531A0F`, e um vermelho-sangue
`#C52E2E` que aparece uma palavra por tela. Nenhum cinza inventado: os tons de
apoio saem da própria tinta com alpha.

Claro não é o oposto de cinematográfico. É a diferença entre a estética de um
serviço de streaming e a de crítica impressa, e a segunda serve melhor a um
produto cujo diferencial é texto.

O gesto do produto é a tira de filme: os resultados são fotogramas com
perfuração, cinza em repouso; sob o cursor um deles dobra de largura e recupera a
cor, porque cor é recompensa por atenção. Ao clicar, a ficha do filme abre com o
trailer em 16:9, sinopse, ficha técnica e onde assistir.

A procedência de cada valor está em
[docs/identidade-visual.md](docs/identidade-visual.md).

---

## Rodando

Requer Node 20.9+.

```bash
npm install
cp .env.example .env    # preencha N8N_API_KEY e as três URLs de webhook
npm run dev
```

As três `N8N_FILMPRO_*_WEBHOOK` são obrigatórias e não têm default. Em branco, a
página degrada e o log nomeia a que faltou, em vez de bater num host hardcoded.

Para ver a interface sem depender do n8n, e sem preencher nada:

```bash
NEXT_PUBLIC_FILMPRO_MOCK=1 npm run dev
```

O schema do banco está em [`db/schema.sql`](db/schema.sql), com 4 tabelas e 3
views. O passo a passo das contas e credenciais está em
[docs/SETUP.md](docs/SETUP.md).

```bash
npm test        # rate limiting, sanitização, normalização de cache, a lógica
                # dos nós do n8n (pontuação TMDB, acentuação, paridade das
                # cópias) e um harness de personas do curador
npm run lint
npm run aquecer # deixa quentes as 4 sugestões dos botões da tela inicial
```

---

## Onde está hoje

No ar, funcionando de ponta a ponta: navegador → BFF → n8n → TMDB e OMDB →
Postgres → tela. Publicado na Vercel, com a função em São Paulo e o Cloudflare na
frente. O porquê de cada uma dessas escolhas está em
[docs/SETUP.md](docs/SETUP.md).

| | |
|---|---|
| n8n | 4 workflows publicados (Recomendações, Standalone, Fileiras da semana, Fileiras da Home) |
| Acerto de cache | ~490 ms em produção; dentro do workflow, p50 84 ms, p95 1,7 s (n=331, 30 d) |
| Busca inédita | dentro do workflow, p50 9,8 s, p95 58,7 s, máx 83,6 s (n=125, 30 d), Gemini 3.1 Flash Lite |
| Acerto de cache (taxa) | 72,6% das buscas humanas em 30 dias (331 de 456) |
| Interface | tela inicial com fileiras semanais, tira de filme e ficha completa no ar |
| Ficha do filme | modal interceptado `@modal` + rota standalone `/filme/[tmdbId]` |

As latências vêm de medição, e de duas fronteiras diferentes. A telemetria
gravada no banco cronometra o que acontece dentro do workflow; o tempo que o
visitante sente inclui a rede até o n8n e o salto pelo BFF.

A fronteira de fora melhorou ao mover a função da Vercel para São Paulo, ao lado
do n8n: o acerto de cache caiu de ~870 ms para ~490 ms. A região segue o dado, e
o estático já sai da borda mais perto de quem acessa.

O ponto fraco é a busca inédita. O enriquecimento pelas APIs custa ~1,6 s (medido
em execução real: TMDB busca + detalhes + OMDB). Toda a variação restante é o
tempo de resposta do LLM, e ela é enorme: numa medição de 30 dias (125 buscas
frias), p50 9,8 s mas p95 58,7 s, acima do teto de 45 s do BFF. Não é cauda rara:
uma em cada vinte buscas inéditas estoura e vira 504, em português, porque o BFF
aborta antes do teto da plataforma de propósito.

O que segura isso na prática é o cache: um acerto volta em segundos em vez de
dezenas deles, e as quatro sugestões dos botões da tela inicial já ficam quentes
com `npm run aquecer`.

---

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · n8n (Gemini com reserva Groq) ·
PostgreSQL · TMDB · OMDB

A definição do workflow é gerada a partir do que está publicado no n8n, e fica em
[n8n/](n8n/): código de cada nó, SQL, prompt e mapa de conexões, tudo legível em
diff. Existiu ali um espelho escrito à mão, que divergiu do que estava no ar em
um único dia e foi removido por isso.
