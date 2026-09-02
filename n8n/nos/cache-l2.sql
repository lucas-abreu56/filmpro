-- Nó "Cache L2" — n8n-nodes-base.postgres
SELECT * FROM movies
 WHERE tmdb_id IN (
   SELECT (p->>'tmdb_id')::int
     FROM jsonb_array_elements($1::jsonb) AS p
 )
