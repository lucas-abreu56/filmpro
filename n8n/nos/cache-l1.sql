-- Nó "Cache L1" — n8n-nodes-base.postgres
SELECT picks, not_found, collection_title, model_used
  FROM search_cache
 WHERE query_hash = $1
   AND created_at > now() - interval '30 days'
