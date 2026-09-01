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

O OMDB **só** aceita a chave por query string — não tem autenticação por header.
Usar o tipo `Query Auth` pelo menos mantém a chave fora do campo de URL do nó e
guardada na credencial, em vez de digitada no workflow.

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
3. **OMDB** — `GET https://www.omdbapi.com/?i=tt0137523` com a credencial
   `OMDB Key` devolve `imdbRating`.
4. **Workflow** — `curl` na URL de teste devolve JSON com `posterUrl`
   preenchido. **Este é o marco que importa:** é a prova de que o defeito
   central do projeto original está morto.
5. **Latência** — anote quanto demorou. Esse número decide se o fluxo precisa
   virar assíncrono com polling, e é a única forma de decidir isso sem chutar.

```bash
curl -X POST "https://<seu-n8n>/webhook-test/filmpro/recommendations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{"preferences":"suspense psicológico dos anos 90","limit":8,"requestId":"teste-1"}'
```
