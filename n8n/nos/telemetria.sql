-- Nó "Telemetria" — n8n-nodes-base.postgres
INSERT INTO searches (
  request_id, query_hash, query_text, cache_hit, model_used,
  movie_count, not_found_count, latency_ms, source
)
SELECT
  (d->>'requestId')::uuid, d->>'queryHash', d->>'queryText',
  (d->>'cacheHit')::boolean, d->>'modelUsed',
  (d->>'movieCount')::smallint, (d->>'notFoundCount')::smallint,
  (d->>'latencyMs')::int, coalesce(d->>'source', 'human')
FROM jsonb_array_elements($1::jsonb) AS d
