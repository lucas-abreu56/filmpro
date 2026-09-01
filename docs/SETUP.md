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

O backup diário para o GitHub (`lucas-abreu56/n8n`) exporta o JSON completo de
todos os workflows. Os `parameters` de cada nó vão inteiros — inclusive uma URL
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

Você já tem três credenciais Postgres no n8n (`Atendimento IA`,
`Registro Vagas RP - pgAdmin`, `Convite Aniversario`). O schema do FilmPro vive
num schema dedicado chamado `filmpro`, então pode dividir servidor com os outros
projetos sem colidir. **Decida qual usar** — ou crie uma nova, se preferir
isolar.

### Já existentes, nada a fazer

Gemini (`Gemini N8N`), Groq (`Groq account`) e o webhook do Discord
(`Notificações Workflows`, para o aviso de erro).

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
 WHERE table_schema = 'filmpro'
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

## 6. O workflow, e a armadilha da credencial do webhook

O workflow **FilmPro — Recomendações** (`gwKwNLFM2ztGuB8U`) já está publicado.
A fonte de verdade dele é [`n8n/filmpro-recomendacoes.ts`](../n8n/filmpro-recomendacoes.ts)
— editar por lá e republicar; editar pela interface faz o arquivo virar mentira.

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

### O que ainda não foi medido

A **latência**. É o número que decide se o fluxo precisa virar assíncrono com
polling, e nenhuma execução real aconteceu ainda — executar pelo MCP pina os
nós HTTP e mede simulação, não rede. Rode uma vez pela interface e anote.

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

```bash
curl -X POST "https://<seu-n8n>/webhook-test/filmpro/recommendations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{"preferences":"suspense psicológico dos anos 90","limit":8,"requestId":"teste-1"}'
```
