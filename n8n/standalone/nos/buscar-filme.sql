-- Nó "Buscar filme" — n8n-nodes-base.postgres
-- Rota standalone: /filme/[tmdbId] quando nao ha modal — link direto, refresh
-- em cima do modal, robo de indexacao.
--
-- O id entra por $1. NUNCA por concatenacao: este webhook e publico e o valor
-- vem da query string. A versao de 03/09/2026 montava a string na mao, o que
-- era injecao de SQL direta.
--
-- Os nomes aqui sao os da TABELA, nao os do contrato TypeScript. A versao
-- anterior pedia tmdb_url, year, poster_url, backdrop_url, logo_url, crew,
-- collection, similar e reason — nenhuma dessas colunas existe, e por isso o
-- webhook devolvia 500 em toda chamada. `similar` ainda por cima e palavra
-- reservada (SIMILAR TO). Traduzir para camelCase e montar URL e apresentacao,
-- e vive no no 'Montar filme'.
SELECT
  m.tmdb_id, m.imdb_id, m.title, m.original_title, m.release_year,
  m.tagline, m.overview, m.poster_path, m.backdrop_path, m.logo_path,
  m.rating, m.vote_count, m.imdb_rating, m.imdb_votes, m.awards, m.runtime,
  m.genres, m.keywords, m.original_language, m.spoken_languages,
  m.age_rating, m.director, m.cast_members, m.crew_members,
  m.collection_name, m.similar_movies, m.providers, m.trailer_key,
  m.fetched_at,
  -- `reason` NAO e fato do filme e nao existe em movies: e curadoria escrita
  -- para UMA busca, e mora em search_cache.picks. Pegamos a mais recente que
  -- citou este filme. Pode nao haver nenhuma (filme que entrou no L2 mas cuja
  -- busca ja saiu do L1) — ai volta NULL, e a ficha esconde a secao em vez de
  -- inventar texto de curador.
  c.reason
FROM movies m
LEFT JOIN LATERAL (
  SELECT p->>'reason' AS reason
    FROM search_cache sc,
         LATERAL jsonb_array_elements(sc.picks) AS p
   -- Comparacao como texto, e nao ::int: picks e jsonb escrito por outro no, e
   -- um valor torto ali derrubaria a consulta inteira com erro de cast.
   WHERE p->>'tmdb_id' = m.tmdb_id::text
     AND nullif(btrim(coalesce(p->>'reason', '')), '') IS NOT NULL
   ORDER BY sc.created_at DESC
   LIMIT 1
) c ON true
WHERE m.tmdb_id = $1
