-- Nó "Gravar L2" — n8n-nodes-base.postgres
INSERT INTO movies (
  tmdb_id, imdb_id, title, original_title, release_year, tagline, overview,
  poster_path, backdrop_path, logo_path, rating, vote_count,
  imdb_rating, imdb_votes, awards, runtime, genres, keywords,
  original_language, spoken_languages, age_rating, director,
  cast_members, crew_members, collection_name, similar_movies, providers,
  trailer_key, fetched_at
)
SELECT
  (m->>'tmdb_id')::int, m->>'imdb_id', m->>'title', m->>'original_title',
  (m->>'release_year')::smallint, m->>'tagline', m->>'overview',
  m->>'poster_path', m->>'backdrop_path', m->>'logo_path',
  (m->>'rating')::numeric, (m->>'vote_count')::int,
  (m->>'imdb_rating')::numeric, (m->>'imdb_votes')::int, m->>'awards',
  (m->>'runtime')::smallint, m->'genres', m->'keywords',
  m->>'original_language', m->'spoken_languages', m->>'age_rating',
  m->>'director', m->'cast_members', m->'crew_members',
  m->>'collection_name', m->'similar_movies', m->'providers',
  m->>'trailer_key', now()
FROM jsonb_array_elements($1::jsonb) AS m
ON CONFLICT (tmdb_id) DO UPDATE SET
  imdb_id = EXCLUDED.imdb_id, title = EXCLUDED.title,
  original_title = EXCLUDED.original_title, release_year = EXCLUDED.release_year,
  tagline = EXCLUDED.tagline, overview = EXCLUDED.overview,
  poster_path = EXCLUDED.poster_path, backdrop_path = EXCLUDED.backdrop_path,
  logo_path = EXCLUDED.logo_path, rating = EXCLUDED.rating,
  vote_count = EXCLUDED.vote_count, imdb_rating = EXCLUDED.imdb_rating,
  imdb_votes = EXCLUDED.imdb_votes, awards = EXCLUDED.awards,
  runtime = EXCLUDED.runtime, genres = EXCLUDED.genres,
  keywords = EXCLUDED.keywords, original_language = EXCLUDED.original_language,
  spoken_languages = EXCLUDED.spoken_languages, age_rating = EXCLUDED.age_rating,
  director = EXCLUDED.director, cast_members = EXCLUDED.cast_members,
  crew_members = EXCLUDED.crew_members, collection_name = EXCLUDED.collection_name,
  similar_movies = EXCLUDED.similar_movies, providers = EXCLUDED.providers,
  trailer_key = EXCLUDED.trailer_key, fetched_at = now()
RETURNING *
