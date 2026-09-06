-- FilmPro — schema do Postgres
--
-- Rode uma vez, no banco `filmpro`. Tudo vive no schema `public` porque o
-- banco já é dedicado: um schema `filmpro` dentro do banco `filmpro` seria
-- aninhamento redundante, e obrigaria todo nó Postgres do n8n a trocar o
-- schema padrão — configuração silenciosa é a que mais custa caro.
--
-- Idempotente: pode rodar de novo sem apagar dado.
--
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Ou cole no Query Tool do pgAdmin, com o banco `filmpro` selecionado.

-- ---------------------------------------------------------------------------
-- L2 — os fatos. Vêm do TMDB, uma linha por filme, compartilhada entre buscas.
-- ---------------------------------------------------------------------------
-- Guarda o *path* do pôster (`/wLLBRoBRsCK4vJb0.jpg`), não a URL montada. A base
-- (image.tmdb.org/t/p/) e o tamanho (w342, w500) são decisão de apresentação;
-- congelar a URL inteira significa reescrever a tabela para trocar de tamanho.
CREATE TABLE IF NOT EXISTS movies (
    tmdb_id           integer      PRIMARY KEY,
    -- `tt0098936`, de external_ids. É a ponte para o OMDB: consulta por id
    -- exato, sem a ambiguidade de título homônimo que quebrava o projeto
    -- original (que buscava por `t=` e às vezes trazia outro filme).
    imdb_id           text,
    title             text         NOT NULL,   -- pt-BR
    original_title    text,
    release_year      smallint,
    tagline           text,
    overview          text,                    -- pt-BR; pode faltar em títulos obscuros
    poster_path       text,
    backdrop_path     text,
    -- PNG do letreiro do filme (images.logos). É como MUBI e Netflix põem o
    -- título sobre o fotograma sem usar texto. Frequentemente ausente.
    logo_path         text,
    rating            numeric(3,1),            -- vote_average — nota do TMDB
    vote_count        integer,                 -- para a UI esconder nota com n baixo
    -- Nota do IMDB. O TMDB NÃO fornece isto: `vote_average` acima é a nota do
    -- próprio TMDB. Estes três vêm do OMDB, consultado por imdb_id.
    imdb_rating       numeric(3,1),
    imdb_votes        integer,
    awards            text,                    -- "Won 1 Oscar. 42 wins & 89 nominations"
    runtime           smallint,                -- minutos
    -- jsonb, não text[]: o resource mapper do nó Postgres do n8n serializa
    -- array JS para JSON naturalmente, mas para uma coluna `text[]` teria que
    -- produzir literal de array do Postgres ({Terror,Suspense}) e depende de
    -- attemptToConvertTypes. jsonb tira essa classe de bug e fica consistente
    -- com cast_members e providers, que são jsonb de qualquer jeito.
    genres            jsonb        NOT NULL DEFAULT '[]',  -- ["Terror", "Suspense"]
    keywords          jsonb        NOT NULL DEFAULT '[]',  -- de append_to_response=keywords
    original_language char(2),
    spoken_languages  jsonb        NOT NULL DEFAULT '[]',  -- selo "🔊 Inglês"
    age_rating        text,                    -- certificação BR: L, 10, 12, 14, 16, 18
    director          text,
    cast_members      jsonb        NOT NULL DEFAULT '[]',  -- [{name, character, profilePath}]
    crew_members      jsonb        NOT NULL DEFAULT '[]',  -- [{name, role, profilePath}]
    collection_name   text,                    -- "parte da coleção X", se franquia
    -- Objetos completos: [{tmdb_id, title, year, poster_path, backdrop_path}].
    -- A ideia original era guardar só os ids e buscar os dados nesta mesma
    -- tabela, mas os semelhantes quase nunca estão cacheados — num acerto de
    -- cache a fileira viria vazia. Chamava-se `similar_ids`; `similar` sozinho
    -- não serve, é palavra reservada do Postgres (SIMILAR TO).
    similar_movies    jsonb        NOT NULL DEFAULT '[]',
    providers         jsonb        NOT NULL DEFAULT '[]',  -- watch/providers da região BR
    -- Chave do YouTube do trailer oficial, de /videos via append_to_response.
    -- Só a chave: a URL de embed e a de thumbnail se montam a partir dela.
    trailer_key       text,
    fetched_at        timestamptz  NOT NULL DEFAULT now()
);

-- TTL de 90 dias, não de 7. Pôster, sinopse, elenco e duração não mudam nunca;
-- só `rating` e `providers` mudam. TTL curto forçaria refetch dos 8 filmes toda
-- semana e anularia este cache em quase todo acerto. Em troca, a UI mostra
-- "disponibilidade verificada em {fetched_at}" no bloco de streaming.
CREATE INDEX IF NOT EXISTS movies_fetched_at_idx
    ON movies (fetched_at);


-- ---------------------------------------------------------------------------
-- L1 — a curadoria. Vem do LLM.
-- ---------------------------------------------------------------------------
-- `picks` guarda SÓ [{tmdb_id, reason, rank}] — nunca a resposta pronta. A
-- resposta é sempre remontada juntando com movies, senão o cache serve
-- nota e "onde assistir" congelados de meses atrás, que é bug visível.
--
-- `prompt_version` entra no material hasheado: editou o system prompt, todo
-- hash muda e o cache inteiro invalida sozinho, sem DELETE e sem migração.
CREATE TABLE IF NOT EXISTS search_cache (
    query_hash     char(64)     PRIMARY KEY,   -- SHA256 hex de query_norm|limit|prompt_version
    query_text     text         NOT NULL,      -- como o usuário digitou, para depurar
    query_norm     text         NOT NULL,      -- o que de fato entrou no hash
    limit_n        smallint     NOT NULL,
    prompt_version smallint     NOT NULL,
    picks          jsonb        NOT NULL,
    not_found      jsonb        NOT NULL DEFAULT '[]',
    -- Texto autoral do agente. Sem esta coluna, um acerto de cache perderia o
    -- nome da coleção — que é metade da curadoria que aparece na tela.
    collection_title text,
    model_used     text,                       -- 'gemini' | 'groq'
    created_at     timestamptz  NOT NULL DEFAULT now(),
    hit_count      integer      NOT NULL DEFAULT 0,
    last_hit_at    timestamptz
);

-- A validade é aplicada na leitura (created_at > now() - interval '30 days'),
-- não por cron. Este índice é para a limpeza física semanal.
CREATE INDEX IF NOT EXISTS search_cache_created_at_idx
    ON search_cache (created_at);


-- ---------------------------------------------------------------------------
-- Telemetria — uma linha por requisição, inclusive as servidas de cache.
-- ---------------------------------------------------------------------------
-- Sem FK para search_cache: limpar o cache não pode apagar o histórico.
CREATE TABLE IF NOT EXISTS searches (
    id              bigserial    PRIMARY KEY,
    request_id      uuid         NOT NULL,     -- correlaciona log da Vercel com execução do n8n
    query_hash      char(64)     NOT NULL,
    query_text      text         NOT NULL,
    cache_hit       boolean      NOT NULL,
    model_used      text,
    movie_count     smallint     NOT NULL,
    not_found_count smallint     NOT NULL DEFAULT 0,
    latency_ms      integer,
    -- 'human' | 'robot'. Decidido em 05/09/2026: sem isto, as 5 buscas
    -- sintéticas por semana do workflow de fileiras (`n8n/nos/curar-tema`, via
    -- 'Curar tema' → webhook de recomendações) seriam indistinguíveis de
    -- busca de gente de verdade — 260 por ano, envenenando `stats_summary`
    -- antes de `/estatisticas` sequer existir. Default 'human': todo tráfego
    -- de produção de hoje não manda este campo, e a ausência tem de continuar
    -- significando "pessoa", não "desconhecido".
    source          text         NOT NULL DEFAULT 'human'
                                  CHECK (source IN ('human', 'robot')),
    created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS searches_created_at_idx
    ON searches (created_at DESC);
CREATE INDEX IF NOT EXISTS searches_query_hash_idx
    ON searches (query_hash);


-- ---------------------------------------------------------------------------
-- Views para /estatisticas
-- ---------------------------------------------------------------------------
-- Só 'human': as buscas do robô de fileiras semanais (source = 'robot') não
-- são uso do produto, são o produto rodando sozinho para alimentar a home.
-- Contá-las aqui infla total_searches e cache_hits sem que ninguém tenha
-- pedido nada.
CREATE OR REPLACE VIEW stats_summary AS
SELECT
    count(*)                                                  AS total_searches,
    count(*) FILTER (WHERE cache_hit)                          AS cache_hits,
    count(*) FILTER (WHERE model_used = 'groq')                AS fallback_uses,
    sum(not_found_count)                                       AS discarded_titles,
    round(avg(latency_ms) FILTER (WHERE NOT cache_hit))        AS avg_latency_live_ms,
    round(avg(latency_ms) FILTER (WHERE cache_hit))            AS avg_latency_cached_ms,
    max(created_at)                                            AS last_search_at
FROM searches
WHERE source = 'human';

CREATE OR REPLACE VIEW stats_top_movies AS
SELECT
    m.tmdb_id,
    m.title,
    m.release_year,
    m.poster_path,
    m.rating,
    count(*) AS times_recommended
FROM search_cache sc
CROSS JOIN LATERAL jsonb_array_elements(sc.picks) AS pick
JOIN movies m ON m.tmdb_id = (pick->>'tmdb_id')::integer
GROUP BY m.tmdb_id, m.title, m.release_year, m.poster_path, m.rating
ORDER BY times_recommended DESC;

CREATE OR REPLACE VIEW stats_top_genres AS
SELECT
    genre,
    count(*) AS occurrences
FROM search_cache sc
CROSS JOIN LATERAL jsonb_array_elements(sc.picks) AS pick
JOIN movies m ON m.tmdb_id = (pick->>'tmdb_id')::integer
CROSS JOIN LATERAL jsonb_array_elements_text(m.genres) AS genre
GROUP BY genre
ORDER BY occurrences DESC;


-- ---------------------------------------------------------------------------
-- As fileiras da home, criadas por um agente uma vez por semana.
-- ---------------------------------------------------------------------------
-- Por que uma tabela, e não uma marca no `search_cache`: aquela tabela tem
-- semântica de CACHE — os SELECT dela filtram 30 dias, e o ON CONFLICT do
-- `Gravar L1` decide pelo `model_used IS NULL` se a gravação veio do curador
-- ou de um acerto. Uma coleção da home não expira no meio da semana e não é
-- acerto de nada; enfiá-la ali significaria coluna nova numa tabela que já
-- roda, ou sobrecarregar `model_used`, que é contrato e quebra em silêncio.
--
-- Isto aqui é aditivo: não altera nenhuma tabela existente.
CREATE TABLE IF NOT EXISTS home_sections (
    -- Segunda-feira da semana, de `date_trunc('week', now())::date`. É a chave
    -- da rotação: a home pede a semana corrente e pronto, sem aritmética de
    -- data espalhada por nó de workflow.
    week       date        NOT NULL,
    position   smallint    NOT NULL,   -- 1..5, a ordem na tela
    -- O pedido que o modelo inventou, no mesmo formato que uma pessoa
    -- digitaria ("um faroeste sujo e desesperançado"). Guardado porque é o que
    -- se manda de volta ao gerador na semana seguinte, para ele não repetir —
    -- e porque sem ele não há como auditar de onde a fileira saiu.
    theme      text        NOT NULL,
    title      text        NOT NULL,   -- o collectionTitle escrito pelo curador
    -- MESMO formato de `search_cache.picks`: [{tmdb_id, reason, rank}]. O
    -- espelho é de propósito — permite montar a resposta com a mesma lógica,
    -- em vez de uma segunda implementação que diverge daqui a um mês.
    --
    -- É snapshot, não referência: se alguém buscar as mesmas palavras e o
    -- ON CONFLICT regravar aquela linha do L1, a fileira da semana não muda no
    -- meio da semana. E ela sobrevive à expiração do cache.
    picks      jsonb       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (week, position)
);

-- Sem índice em `week`, de propósito. A tabela ganha 5 linhas por semana —
-- 260 por ano —, e a chave primária já cobre a única consulta que existe. Um
-- índice aqui não se pagaria, e índice que não serve é peso que alguém vai
-- ter que justificar daqui a um ano.
--
-- A consulta da home pede a semana mais recente que EXISTE (`ORDER BY week
-- DESC LIMIT 1`), nunca `week = hoje`: se o job semanal falhar — modelo fora
-- do ar, TMDB lento —, a home mostra a semana anterior em vez de ficar vazia.


-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
-- Deve devolver 4 BASE TABLE e 3 VIEW (eram 3 tabelas antes de
-- `home_sections`):
--
--   SELECT table_name, table_type
--     FROM information_schema.tables
--    WHERE table_schema = 'public'
--    ORDER BY table_type, table_name;
--
-- A tabela de memória da conversa (fase 6) não está aqui: o nó Postgres Chat
-- Memory do n8n cria a dele sozinho. Como o banco é dedicado ao FilmPro, o
-- nome padrão serve — não há com o que colidir.
