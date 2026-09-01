-- FilmPro — schema do Postgres
--
-- Rode uma vez, no banco que a credencial do n8n aponta. Schema dedicado
-- porque esse servidor já hospeda outros projetos (convidados_aniversario,
-- historico_chat, registro de vagas) e `movies` é um nome bom demais para
-- ficar solto no public.
--
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE SCHEMA IF NOT EXISTS filmpro;


-- ---------------------------------------------------------------------------
-- L2 — os fatos. Vêm do TMDB, uma linha por filme, compartilhada entre buscas.
-- ---------------------------------------------------------------------------
-- Guarda o *path* do pôster (`/wLLBRoBRsCK4vJb0.jpg`), não a URL montada. A base
-- (image.tmdb.org/t/p/) e o tamanho (w342, w500) são decisão de apresentação;
-- congelar a URL inteira significa reescrever a tabela para trocar de tamanho.
CREATE TABLE IF NOT EXISTS filmpro.movies (
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
    keywords          jsonb        NOT NULL DEFAULT '[]',
    original_language char(2),
    spoken_languages  jsonb        NOT NULL DEFAULT '[]',  -- selo "🔊 Inglês"
    age_rating        text,                    -- certificação BR: L, 10, 12, 14, 16, 18
    director          text,
    cast_members      jsonb        NOT NULL DEFAULT '[]',  -- [{name, character, profilePath}]
    crew_members      jsonb        NOT NULL DEFAULT '[]',  -- [{name, role, profilePath}]
    collection_name   text,                    -- "parte da coleção X", se franquia
    -- Só os tmdb_id dos semelhantes. Os dados de cada um vêm desta mesma
    -- tabela quando já estiverem cacheados — não duplica catálogo.
    similar_ids       jsonb        NOT NULL DEFAULT '[]',
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
    ON filmpro.movies (fetched_at);


-- ---------------------------------------------------------------------------
-- L1 — a curadoria. Vem do LLM.
-- ---------------------------------------------------------------------------
-- `picks` guarda SÓ [{tmdb_id, reason, rank}] — nunca a resposta pronta. A
-- resposta é sempre remontada juntando com filmpro.movies, senão o cache serve
-- nota e "onde assistir" congelados de meses atrás, que é bug visível.
--
-- `prompt_version` entra no material hasheado: editou o system prompt, todo
-- hash muda e o cache inteiro invalida sozinho, sem DELETE e sem migração.
CREATE TABLE IF NOT EXISTS filmpro.search_cache (
    query_hash     char(64)     PRIMARY KEY,   -- SHA256 hex de query_norm|limit|prompt_version
    query_text     text         NOT NULL,      -- como o usuário digitou, para depurar
    query_norm     text         NOT NULL,      -- o que de fato entrou no hash
    limit_n        smallint     NOT NULL,
    prompt_version smallint     NOT NULL,
    picks          jsonb        NOT NULL,
    not_found      jsonb        NOT NULL DEFAULT '[]',
    model_used     text,                       -- 'gemini' | 'groq'
    created_at     timestamptz  NOT NULL DEFAULT now(),
    hit_count      integer      NOT NULL DEFAULT 0,
    last_hit_at    timestamptz
);

-- A validade é aplicada na leitura (created_at > now() - interval '30 days'),
-- não por cron. Este índice é para a limpeza física semanal.
CREATE INDEX IF NOT EXISTS search_cache_created_at_idx
    ON filmpro.search_cache (created_at);


-- ---------------------------------------------------------------------------
-- Telemetria — uma linha por requisição, inclusive as servidas de cache.
-- ---------------------------------------------------------------------------
-- Sem FK para search_cache: limpar o cache não pode apagar o histórico.
CREATE TABLE IF NOT EXISTS filmpro.searches (
    id              bigserial    PRIMARY KEY,
    request_id      uuid         NOT NULL,     -- correlaciona log da Vercel com execução do n8n
    query_hash      char(64)     NOT NULL,
    query_text      text         NOT NULL,
    cache_hit       boolean      NOT NULL,
    model_used      text,
    movie_count     smallint     NOT NULL,
    not_found_count smallint     NOT NULL DEFAULT 0,
    latency_ms      integer,
    created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS searches_created_at_idx
    ON filmpro.searches (created_at DESC);
CREATE INDEX IF NOT EXISTS searches_query_hash_idx
    ON filmpro.searches (query_hash);


-- ---------------------------------------------------------------------------
-- Views para /estatisticas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW filmpro.stats_summary AS
SELECT
    count(*)                                                  AS total_searches,
    count(*) FILTER (WHERE cache_hit)                          AS cache_hits,
    count(*) FILTER (WHERE model_used = 'groq')                AS fallback_uses,
    sum(not_found_count)                                       AS discarded_titles,
    round(avg(latency_ms) FILTER (WHERE NOT cache_hit))        AS avg_latency_live_ms,
    round(avg(latency_ms) FILTER (WHERE cache_hit))            AS avg_latency_cached_ms,
    max(created_at)                                            AS last_search_at
FROM filmpro.searches;

CREATE OR REPLACE VIEW filmpro.stats_top_movies AS
SELECT
    m.tmdb_id,
    m.title,
    m.release_year,
    m.poster_path,
    m.rating,
    count(*) AS times_recommended
FROM filmpro.search_cache sc
CROSS JOIN LATERAL jsonb_array_elements(sc.picks) AS pick
JOIN filmpro.movies m ON m.tmdb_id = (pick->>'tmdb_id')::integer
GROUP BY m.tmdb_id, m.title, m.release_year, m.poster_path, m.rating
ORDER BY times_recommended DESC;

CREATE OR REPLACE VIEW filmpro.stats_top_genres AS
SELECT
    genre,
    count(*) AS occurrences
FROM filmpro.search_cache sc
CROSS JOIN LATERAL jsonb_array_elements(sc.picks) AS pick
JOIN filmpro.movies m ON m.tmdb_id = (pick->>'tmdb_id')::integer
CROSS JOIN LATERAL jsonb_array_elements_text(m.genres) AS genre
GROUP BY genre
ORDER BY occurrences DESC;


-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
-- Deve devolver 3 BASE TABLE e 3 VIEW:
--
--   SELECT table_name, table_type
--     FROM information_schema.tables
--    WHERE table_schema = 'filmpro'
--    ORDER BY table_type, table_name;
--
-- A tabela de memória da conversa (fase 5) não está aqui: o nó Postgres Chat
-- Memory do n8n cria a dele sozinho, e provavelmente em `public`. Quando chegar
-- a hora, use tableName = 'filmpro_chat' para não colidir com o `historico_chat`
-- do convite, que divide o mesmo servidor.
