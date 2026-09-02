-- Nó "Gravar L1" — n8n-nodes-base.postgres
-- Um unico parametro jsonb, e nao uma lista separada por virgula: query_text
-- e texto livre do usuario e QUALQUER virgula nele quebraria a separacao.
INSERT INTO search_cache (
  query_hash, query_text, query_norm, limit_n, prompt_version,
  picks, not_found, collection_title, model_used
)
SELECT
  d->>'queryHash', d->>'queryText', d->>'queryNorm',
  (d->>'limitN')::smallint, (d->>'promptVersion')::smallint,
  d->'picks', d->'notFound', d->>'collectionTitle', d->>'modelUsed'
FROM jsonb_array_elements($1::jsonb) AS d
ON CONFLICT (query_hash) DO UPDATE
   SET hit_count = search_cache.hit_count + 1,
       last_hit_at = now()
