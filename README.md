# FilmPro

Recomendação de filmes por agente de IA. Você descreve o que quer sentir; um agente
cura a lista e escreve o motivo de cada escolha. **Pôster, nota, duração,
classificação e onde assistir vêm do TMDB — nunca do modelo.**

> Estado: em construção. O app Next.js compila e a tela da Fase 1 existe; o
> workflow do n8n ainda não. Ver [Situação](#situação).

---

## O problema que este projeto resolve

Este é um FilmPro próprio, construído a partir de um projeto de curso da Asimov
Academy. O projeto original pedia ao LLM que preenchesse um schema com
`imdb_rating`, `duration_minutes`, `poster_url` e `streaming_platforms` — dados
que um modelo de linguagem não tem como saber. A ferramenta de consulta ao OMDB
buscava um título exato por chamada e nada injetava o resultado dela na resposta
final, então `poster_url` voltava `null` e a interface caía num placeholder.

A correção não é injetar o pôster depois. É **tirar esses campos do schema do
modelo**: campo que não existe não pode ser alucinado.

### LLM cura, API informa

O agente devolve quatro campos por filme, e o schema é fechado
(`additionalProperties: false`):

```json
{ "title": "...", "originalTitle": "...", "year": 1999, "reason": "..." }
```

Todo o resto é buscado no TMDB por nós determinísticos. Na resposta final,
**dois campos são autorais** — `reason` e o nome da coleção, ambos curadoria — e
zero fatos vêm do modelo. Cada card carrega o `tmdbUrl` como prova de que o
filme existe.

Consequência: se o agente sugerir um filme que o TMDB não confirma, ele não vira
card. Entra em `notFound`, e a interface diz quantas sugestões foram descartadas
em vez de esconder.

---

## Arquitetura

```
Browser
  │  POST /api/recommendations { preferences, limit }
  ▼
Next.js route handler (BFF)      ← N8N_API_KEY; rate limit; 10–500 chars
  │                                 maxDuration 60s · AbortSignal.timeout(45s)
  │  POST webhook (header x-api-key)
  ▼
n8n "FilmPro — Recomendações"
  ├─ normaliza → SHA256(query | limit | prompt_version)
  ├─ cache L1 acertou? ── sim ──▶ carrega fatos do L2 ──▶ responde
  ├─ AI Agent (Gemini, fallback nativo para Groq) + Structured Output Parser
  ├─ Split Out → TMDB search → details (append_to_response)
  └─ responde, e só então grava cache e telemetria
```

O Next nunca fala com o TMDB nem com o Postgres. Um cofre só, no n8n.

### Cache em duas camadas

| | Guarda | Chave | Validade |
|---|---|---|---|
| **L1** `search_cache` | a curadoria: `[{tmdb_id, reason, rank}]` | hash da consulta | 30 dias |
| **L2** `movies` | os fatos, do TMDB | `tmdb_id` | 90 dias |

O L1 **não** guarda a resposta pronta. Ela é sempre remontada juntando as duas
camadas, porque nota e provedor de streaming mudam — servir "está na Netflix" de
três meses atrás é um bug visível.

TTL de 90 dias no L2 é deliberado: pôster, sinopse, elenco e duração não mudam
nunca. Em troca, a interface mostra *"disponibilidade verificada em {data}"*.

Invalidação principal: `prompt_version` entra no material hasheado. Editou o
system prompt, todo hash muda e o cache inteiro invalida sozinho — sem `DELETE`,
sem migração.

---

## Segurança

`preferences` é texto livre vindo da internet e vai para um LLM. A defesa
principal **não é um parágrafo no prompt — é o schema**:

- Quatro campos, `additionalProperties: false`, `maxLength` no texto autoral e
  `maxItems` na lista. Injeção não cria campo novo nem resposta gigante.
- **O agente não tem ferramentas e não tem segredo no contexto.** Não há ação
  para sequestrar nem nada para exfiltrar.
- **O TMDB é um sumidouro de injeção.** Todo título passa por lá antes de virar
  card; nem um agente totalmente dominado consegue exibir um filme inventado.
- Sobra uma superfície: o texto autoral renderizado. Ele é validado em
  [`src/lib/sanitize.ts`](src/lib/sanitize.ts) — link, tag HTML e link markdown
  derrubam o campo inteiro para um texto neutro — **antes de gravar no cache** e
  de novo antes de renderizar.
- `dangerouslySetInnerHTML` não é usado em lugar nenhum, e isso é regra.

### Limite de requisições

5 por minuto por IP, contra 10 do chat do convite-aniversario, porque cada
requisição aqui custa uma chamada de LLM mais até 16 chamadas ao TMDB.

> O contador vive na memória do módulo. Em serverless cada instância tem o seu,
> e a plataforma sobe várias sob carga — instâncias recicladas zeram a contagem.
> Isso atrapalha um script ingênuo, mas **não substitui** um armazenamento
> compartilhado como Redis. A nota existe para que a promessa caiba no que o
> código faz.

---

## Design

Papel creme `#FDF6E4`, tinta marrom-vinho `#531A0F`, um acento vermelho-sangue
`#C52E2E` que aparece uma palavra por tela. **Nenhum cinza inventado** — os
apoios saem da própria tinta com alpha. Display em Big Shoulders, caixa alta e
condensada; Inter para o que se lê em linha.

Claro não é o oposto de cinematográfico: é a diferença entre a estética de um
serviço de streaming e a de crítica impressa, e a segunda serve melhor a um
produto cujo diferencial é texto.

O gesto do produto é a **tira de filme**: os resultados são fotogramas com
perfuração, cinza em repouso; sob o cursor um deles dobra de largura, ganha cor
e o trailer sobe. Cor é recompensa por atenção.

Valores e procedência de cada decisão em
[docs/identidade-visual.md](docs/identidade-visual.md).

---

## Rodando

Requer Node 20.9+.

```bash
npm install
cp .env.example .env    # preencha N8N_API_KEY
npm run dev
```

Abra <http://localhost:3000>. Sem o workflow do n8n no ar, o formulário
responde erro — é o esperado nesta fase.

O schema do banco está em [`db/schema.sql`](db/schema.sql):

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

---

## Situação

| | |
|---|---|
| Contrato (`src/lib/types.ts`) | pronto |
| BFF, rate limit, sanitização | pronto |
| Testes do `sanitize` (`npm test`) | 10 passando |
| Identidade visual e tipografia | pronto |
| Tira de filme, carregamento, grão, cursor | pronto |
| Interface rodando com dados falsos | pronto |
| Schema do Postgres (`db/schema.sql`) | escrito, **não aplicado** |
| Prompt e schema do agente ([docs/agente/](docs/agente/)) | escritos, **não aplicados** |
| Contas TMDB e OMDB | criadas |
| Credenciais TMDB e OMDB no n8n | criadas e **verificadas** |
| Credencial Postgres | **a decidir** |
| Workflow do n8n ([n8n/](n8n/)) | **rodando de ponta a ponta** |
| Latência | medida: 15 s típico, 51 s no pior caso |
| Ficha do filme, cache, `/estatisticas` | pendente |

Para ver a interface funcionando sem depender do n8n:

```bash
NEXT_PUBLIC_FILMPRO_MOCK=1 npm run dev
```

Ver [docs/SETUP.md](docs/SETUP.md) para os passos, na ordem.

A latência foi medida em 01/09/2026: **15,1 s numa execução e 51,2 s em
outra**, cinco minutos depois. O enriquecimento responde por 2,7 s fixos — dez
buscas no TMDB somam 536 ms. Toda a variação é o tempo de resposta do LLM.

Isso descarta o polling assíncrono: ele moveria a espera, não a reduziria. Mas
deixa os 45 s do timeout apertados na cauda, e a decisão pendente é trocar o
modelo principal para o Groq.

---

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · n8n (Gemini com fallback Groq) ·
PostgreSQL · TMDB · OMDB
