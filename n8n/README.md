# O workflow

A definição que roda em produção vive no n8n, no workflow
`FilmPro — Recomendações` (`gwKwNLFM2ztGuB8U`). O que está aqui é **gerado a
partir dela**, para poder ser lido e revisado em diff.

```bash
node scripts/exportar-workflow.mjs n8n/workflow.json
```

| | |
|---|---|
| `workflow.json` | a definição publicada, sem credenciais |
| `nos/*.js` | o código de cada nó Code |
| `nos/*.sql` | a query de cada nó Postgres |
| `nos/curador.prompt.md` | o system message do agente |
| `nos/*.schema.json` | o schema do Structured Output Parser |
| `nos/ligacoes.txt` | o mapa de conexões, uma por linha |

## Por que gerado, e não escrito à mão

Existiu aqui um `filmpro-recomendacoes.ts`, escrito à mão no SDK do n8n e
declarado "fonte de verdade". **Ele divergiu do que estava publicado em um
dia** — bastou construir o cache por operações MCP em vez de republicar o
arquivo.

Um arquivo que se anuncia como fonte de verdade e não é vale menos que arquivo
nenhum, porque alguém age em cima dele. Saída gerada não tem essa falha: ou
está atualizada, ou é obviamente antiga.

Isso também resolve a queixa contra o backup diário em `lucas-abreu56/n8n`: lá
o JSON preserva tudo e é ilegível num diff, com o prompt e o SQL escondidos
dentro de strings escapadas. Aqui `ligacoes.txt` mostra uma topologia de 24 nós
em 24 linhas, e mover uma conexão vira uma linha alterada.

## Como o fluxo se lê

```
Webhook → Validar entrada → Hash → Cache L1 → Tem cache?
                                                 ├─[0] acerto → Cache L2 ─┐
                                                 └─[1] erro   → Curador   │
                                                        ↓                 │
                            Enfileirar → TMDB busca → Escolher →          │
                            TMDB detalhes → OMDB → Montar fatos →         │
                            Gravar L2 (RETURNING *) ───────────────────┬──┘
                                                                       ↓
                                                            Montar resposta
                                                                       ↓
                                                                  Responder
                                                                       ↓
                                              Preparar registro → Gravar L1
                                                                → Telemetria
```

Dois detalhes que o desenho não conta e custaram tempo:

- **`Gravar L2` usa `RETURNING *`.** Por isso `Montar resposta` recebe linhas
  da tabela `movies` nos dois caminhos — do upsert quando é busca nova, do
  `SELECT` quando é acerto de cache. Uma lógica de apresentação só, sem ramo
  duplicado.
- **Nó Postgres substitui o item.** A saída dele é o resultado da query, não a
  entrada enriquecida. Foi o que quebrou o `Curador` quando o cache entrou no
  meio do caminho: ele lia `$json.preferences` e recebia `undefined`, e passou
  a responder como se o usuário não tivesse pedido nada. Expressão que precisa
  de um dado de trás referencia o nó pelo nome.

## Depois de mexer no prompt

`prompt_version` está em `nos/validar-entrada.js` e entra no hash do cache.
Incrementar invalida tudo sozinho, sem `DELETE` e sem migração — e é o que
descarta respostas ruins já gravadas. Feito isso, reaqueça:

```bash
npm run aquecer
```

---

## O workflow standalone (`n8n/standalone/`)

Para acessos diretos à ficha do filme (`/filme/[tmdbId]`) — compartilhamento de link, refresh no navegador ou robôs de busca —, existe o workflow **FilmPro — Filme Standalone** (`H494wB7YvKU25gOq`).

Ele não passa por LLM nem pelo TMDB. Lê diretamente a tabela `movies` no Postgres e devolve o filme formatado no mesmo contrato do frontend:

```
Webhook (/webhook/filmpro/movie) → Validar id → Buscar filme (Postgres) → Montar filme → Responder
```

Os arquivos gerados desse fluxo vivem em `n8n/standalone/`:
- `workflow.json`: definição do fluxo no n8n.
- `nos/buscar-filme.sql`: query no Postgres pela chave `tmdb_id`.
- `nos/montar-filme.js`: mapeamento de colunas para o contrato `Movie` do Next.js.
- `nos/validar-id.js`: sanitização do parâmetro `id`.
