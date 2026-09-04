# Setup

O que precisa existir antes de o workflow do n8n poder ser construído. Todos os
serviços são gratuitos e nenhum pede cartão.

Ordem importa: a credencial do TMDB depende da conta, o workflow depende das
credenciais, e a medição de latência depende do workflow.

---

## 1. Contas

### TMDB — a base de tudo

1. Crie conta em <https://www.themoviedb.org/signup> e confirme o e-mail.
2. Vá em **Configurações → API** (<https://www.themoviedb.org/settings/api>) e
   solicite acesso. Uso pessoal/portfólio é aprovado na hora.
3. Copie o **API Read Access Token**, não a "API Key (v3)". É um token longo,
   começando com `eyJ...`. Ele vai num header `Authorization: Bearer <token>`.

### OMDB — só a nota do IMDB

1. <https://www.omdbapi.com/apikey.aspx>, opção **FREE (1000 daily limit)**.
2. A chave chega por e-mail e **precisa ser ativada pelo link da mensagem** —
   sem isso toda requisição responde `401`.

O OMDB entra apenas para `imdbRating`, `imdbVotes` e `Awards`, consultado por
`i=<imdb_id>`. Todo o resto vem do TMDB.

---

## 2. Credenciais no n8n

### TMDB Bearer — tipo `Header Auth`

| Campo | Valor |
|---|---|
| Nome | `TMDB Bearer` |
| Name | `Authorization` |
| Value | `Bearer eyJ...` (com a palavra `Bearer` e um espaço) |

Header, e não `?api_key=` na URL: na query string a chave aparece em texto claro
no log de execução do n8n, que é visível na interface.

### OMDB — tipo `Query Auth`

| Campo | Valor |
|---|---|
| Nome | `OMDB Key` |
| Name | `apikey` |
| Value | a chave ativada |

O OMDB **só** aceita a chave por query string — não tem autenticação por header,
e por isso a chave viaja na URL de qualquer jeito. O `Query Auth` não muda o que
trafega; muda **o que sai do n8n**.

O backup diário dos workflows para o GitHub exporta o JSON completo de todos
eles. Os `parameters` de cada nó vão inteiros — inclusive uma URL
com `?apikey=...` digitada à mão. **Credencial não vai:** o export leva só o id
e o nome dela. Escrever a chave na URL é commitá-la todo dia; guardá-la na
credencial não é.

Sempre `https://`, nunca `http://` — sobre http a chave atravessa a rede em
texto claro, e aí nenhuma credencial adianta.

### FilmPro Webhook — tipo `Header Auth`

| Campo | Valor |
|---|---|
| Nome | `FilmPro Webhook` |
| Name | `x-api-key` |
| Value | uma string aleatória sua |

É o que autentica o Next chamando o n8n. Gere com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O mesmo valor vai no `.env` do projeto como `N8N_API_KEY`.

### Postgres — reaproveitar ou criar

Crie uma credencial Postgres apontando para o banco que vai hospedar o FilmPro,
ou reaproveite uma que já exista. O projeto usa um **database dedicado**
(`filmpro`, schema `public`), então dividir servidor com outros projetos não
colide.

### Já existentes, nada a fazer

As credenciais do Gemini e do Groq, e o webhook de notificação de erro.

---

## 3. Banco

Com a credencial escolhida, rode o schema no banco correspondente:

```bash
psql "postgresql://usuario:senha@host:5432/banco" -f db/schema.sql
```

Verificação — deve devolver 3 tabelas e 3 views:

```sql
SELECT table_name, table_type
  FROM information_schema.tables
 WHERE table_schema = 'public'
 ORDER BY table_type, table_name;
```

---

## 4. Ambiente local

```bash
cp .env.example .env
```

Preencha `N8N_API_KEY` com a mesma string da credencial *FilmPro Webhook*.

Enquanto o workflow estiver em construção, aponte para a URL de teste — ela só
responde enquanto a aba do n8n estiver com "Listen for test event" ligado:

```ini
N8N_FILMPRO_WEBHOOK="https://<seu-n8n>/webhook-test/filmpro/recommendations"
```

```bash
npm install
npm run dev
```

---

## 5. Verificação, na ordem

Cada passo só faz sentido depois do anterior.

1. **Banco** — a consulta do passo 3 devolve 3 tabelas e 3 views.
2. **TMDB** — um nó HTTP Request isolado no n8n, `GET`
   `https://api.themoviedb.org/3/movie/550?language=pt-BR`, com a credencial
   `TMDB Bearer`, devolve "Clube da Luta".
3. **OMDB** — `GET https://www.omdbapi.com/` com `i=tt0137523` em query
   parameter e a credencial `OMDB Key` devolve `imdbRating`.
   *Verificado em 01/09/2026, execução `1655`: 445 ms, `Response: "True"`.*
4. **Workflow** — `curl` na URL de teste devolve JSON com `posterUrl`
   preenchido. **Este é o marco que importa:** é a prova de que o defeito
   central do projeto original está morto.
5. **Latência** — anote quanto demorou. Esse número decide se o fluxo precisa
   virar assíncrono com polling, e é a única forma de decidir isso sem chutar.

---

## 6. Os workflows, e a armadilha da credencial do webhook
 
O FilmPro utiliza **dois workflows** no n8n:
1. **FilmPro — Recomendações** (`gwKwNLFM2ztGuB8U`) — curadoria completa por IA, enriquecimento via TMDB e OMDB, cache em duas camadas (L1/L2).
2. **FilmPro — Filme Standalone** (`H494wB7YvKU25gOq`) — leitura direta e autenticada da tabela `movies` no Postgres para a rota `/filme/[tmdbId]`, sem invocar LLM nem TMDB.

A fonte de verdade é o que está no n8n. A documentação em [`n8n/`](../n8n/) é
**gerada** a partir deles (com subpasta dedicada `n8n/standalone/` para o segundo fluxo):

```bash
node scripts/exportar-workflow.mjs n8n/workflow.json
```

```
Webhook → Validar entrada → Curador (Gemini + parser) → Enfileirar titulos
       → TMDB busca → Escolher correspondencia → TMDB detalhes → OMDB
       → Montar resposta → Responder
```

**Ao criar o workflow, o n8n anexou sozinho a credencial `RapidAPI-Key` ao nó
Webhook.** Ele reaproveita qualquer credencial `httpHeaderAuth` existente
quando a pedida ainda não existe, e não avisa em vermelho — só no resumo do
trigger, em letra miúda: *"requires a header with name X-RapidAPI-Key"*.

Isso **falha fechado**, não aberto: o BFF manda `x-api-key`, o webhook espera
`X-RapidAPI-Key`, e a requisição toma 403. Ninguém entra. Mas parece "o
workflow não funciona" em vez de "a credencial está errada", que é o tipo de
pista falsa que custa uma tarde.

Então, ao criar a credencial `FilmPro Webhook`, **troque-a no nó Webhook** —
não basta criar. E confira de passagem se os três nós HTTP (`TMDB busca`,
`TMDB detalhes`, `OMDB`) mostram a credencial certa: o MCP não devolve
credencial de nó na leitura, então isso eu não consigo verificar daqui.

### A latência, medida em 01/09/2026

| Execução | Total | Agente | Enriquecimento |
|---|---|---|---|
| `1660` | **51,2 s** | ~48,3 s | 2,7 s |
| `1663` | **15,1 s** | ~12,4 s | 2,7 s |

**O enriquecimento custa 2,7 s e não varia.** Dez buscas no TMDB levaram 536 ms
somadas — o nó HTTP processa os itens em lote. Toda a variação está no LLM.

Isso derruba a hipótese que sustentava a Fase 5. O gargalo nunca foi a
arquitetura de chamadas; é o tempo de resposta do Gemini, que oscilou 4× entre
duas execuções separadas por cinco minutos. Job com polling não resolveria
nada disso — só mudaria onde a espera acontece.

**Mas os 45 s do `AbortSignal.timeout` no BFF ficam apertados.** Na `1660` a
resposta chegou aos 51,2 s — o BFF teria abortado.

O Groq chegou a ser promovido a principal, por ser cerca de 8× mais rápido, e foi
rebaixado depois: ele falha o schema com frequência, e toda execução mostrava o
`autoFix` do parser consertando a saída. Hoje o **Gemini é o principal e o Groq é
a reserva**, via `needsFallback` no nó do agente.

A cauda continua aberta. A telemetria gravada no banco em 02/09/2026 mede **33,4 s
de média e 73,8 s de pior caso** para busca inédita — contra 45 s de timeout. O
504 em português já está implementado para quando ela estoura.

### O modelo de rascunho e publicação — a pegadinha que custou uma rodada

Este n8n separa **rascunho** de **versão publicada**. Editar pelo MCP mexe no
rascunho; o webhook de produção continua servindo a versão ativa até alguém
publicar.

Isso não dá erro: a chamada responde 200, com o comportamento antigo. Passei
uma rodada inteira achando que a correção da correspondência não funcionava,
quando ela nem estava no ar. **Depois de editar, publique** — `publish_workflow`
pelo MCP, ou o botão na interface.

---

## 7. O OMDB devolve tudo como string — converter antes de gravar

Medido na execução `1655` (01/09/2026). Os três campos que usamos não chegam
no tipo que o banco espera:

| Campo | OMDB devolve | Coluna em `db/schema.sql` |
|---|---|---|
| `imdbRating` | `"7.6"` | `numeric(3,1)` |
| `imdbVotes` | `"828,114"` | `integer` |
| `Awards` | texto livre | `text` — único que já casa |

Duas armadilhas, e a primeira é a pior porque **não levanta erro**:

- `parseInt("828,114")` devolve **828**. Erra por mil vezes, em silêncio, e
  vira um número plausível na tela. `Number("828,114")` devolve `NaN`. O certo
  é `Number(v.replace(/,/g, ""))` → `828114`.
- **`"N/A"` é o valor de ausente do OMDB**, não `null`. Aparece já na resposta
  de teste, em `DVD` e `Production`, e cai em `imdbRating` para filme obscuro —
  justamente o caso que a curadoria por IA tende a sugerir. `Number("N/A")` é
  `NaN` e derruba o cast para `numeric(3,1)`.

Então o nó de conversão trata os dois casos antes do upsert:

```js
const naoDisponivel = (v) => v == null || v === "N/A";
const nota  = naoDisponivel(o.imdbRating) ? null : Number(o.imdbRating);
const votos = naoDisponivel(o.imdbVotes)  ? null : Number(o.imdbVotes.replace(/,/g, ""));
```

`null` é a resposta honesta para "o IMDB não tem nota deste filme", e o
contrato em `src/lib/types.ts` já a admite: `imdbRating: number | null`. A
interface omite o selo em vez de mostrar zero.

---


---

## 8. Deploy na Vercel

O site está em <https://filmpro.lucasschwingel.com>. Projeto `filmpro` na Vercel,
plano Hobby, uma região só.

### As variáveis de ambiente

| | |
|---|---|
| `N8N_API_KEY` | **Obrigatória.** A mesma string da credencial *FilmPro Webhook* no n8n. Sem ela o BFF e a rota de filme devolvem erro de propósito, em vez de chamar os webhooks sem autenticação. |
| `N8N_FILMPRO_WEBHOOK` | A URL de produção do webhook de recomendações (`/webhook/filmpro/recommendations`). Tem fallback no código, mas o fallback usa `??`, que só cobre ausente — uma string **vazia** passa e quebra o `fetch`. Preencha, ou remova a variável; nunca deixe presente e vazia. |
| `N8N_FILMPRO_MOVIE_WEBHOOK` | A URL de produção do webhook standalone de filme (`/webhook/filmpro/movie`). Usada em `/filme/[tmdbId]` para acessos diretos. Possui fallback para a URL de produção oficial. |

As três em Production e Preview.

### A região da função: São Paulo, e por quê

Fica em Settings → Functions → Function Region, e **exige um deploy novo para
valer** — salvar não basta. Está em `gru1` (São Paulo), não no padrão `iad1`
(Washington).

O motivo não é a proximidade do usuário, é a do dado. O conteúdo estático já sai
da borda mais perto de quem acessa, independente disso; o que a região decide é
onde o **código** roda, e a lentidão dele vem das idas e vindas até o n8n, que
está em Campinas. Medido em 02/09/2026: a resposta em cache caiu de ~870 ms para
**~490 ms** só com essa troca.

A regra que fica: **a região segue os dados, não o usuário.** Se o n8n um dia
mudar de país, essa escolha inverte de sinal.

> A região vive só no painel. Se o projeto for recriado na Vercel, ela volta ao
> padrão `iad1` e ninguém vai lembrar. Para versionar, use
> `export const preferredRegion = "gru1"` na rota, ou um `vercel.json`.

### Cloudflare na frente, e a ordem que evita erro

O DNS é Cloudflare. O registro `filmpro` é um CNAME para a Vercel, **proxiado**
(nuvem laranja), com SSL/TLS do domínio em **Full (strict)**.

O proxy não é enfeite. Sem ele, o site não abria em algumas redes — a da
faculdade, e às vezes 5G. Redes institucionais filtram faixas de hospedagem, e os
IPs do Cloudflare são impraticáveis de bloquear sem quebrar metade da web.

**A ordem importa, e errar custa uma tarde.** Deixe o registro em *DNS only* até
a Vercel emitir o certificado dela; só então ligue o proxy. Com Full (strict) e o
proxy ligado antes da hora, o Cloudflare não consegue validar a origem e a
resposta vira **erro 526** — que parece problema de DNS, e não é.

Ficam dois certificados na corrente: o do Cloudflare para o visitante, e o da
Vercel no trecho de trás, que o Full (strict) confere. Os dois renovam sozinhos.

Duas coisas a não fazer: **nenhuma regra de "Cache Everything"** para este host —
o padrão do Cloudflare só guarda estático, e uma regra agressiva serviria a
página de resultados de uma pessoa para outra. E, se um dia o abuso incomodar,
**rate limiting na borda do Cloudflare** é o que resolve de verdade a ressalva do
limitador em memória, sem Redis e sem mudar código.

### O teto de tempo

O plano Hobby concede **60 s** por execução, e o código pede isso explicitamente
com `export const maxDuration = 60`. O `AbortSignal.timeout` do BFF dispara
antes, aos 45 s, para que quem devolve 504 sejamos nós, com mensagem em
português, em vez da página de erro genérica da plataforma.

Medido em produção em 02/09/2026: uma busca inédita levou 20 s. Isso prova que
20 s cabem — **não descobre o teto**, que veio do painel, não de medição.

### O que fica no repositório

Só o mínimo, e ignorado pelo git: `.vercel/project.json` (o vínculo — sem ele a
CLI não sabe qual projeto é este diretório) e `.env.local` (o Next lê variáveis
da raiz do projeto). Nada mais da Vercel precisa morar aqui.

---

```bash
curl -X POST "https://<seu-n8n>/webhook-test/filmpro/recommendations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{"preferences":"suspense psicológico dos anos 90","limit":8,"requestId":"teste-1"}'
```
