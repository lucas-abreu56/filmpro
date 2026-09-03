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
-- Este no roda nos DOIS caminhos, e ate 03/09/2026 o ON CONFLICT so tocava em
-- hit_count e last_hit_at. A consequencia so aparecia depois de 30 dias, que e
-- a janela do SELECT em cache-l1.sql:
--
--   dia 31  -> o SELECT nao acha (created_at velho), o caminho vivo roda,
--              gasta a chamada de LLM, e o INSERT cai no ON CONFLICT
--   ON CONFLICT -> descarta a curadoria nova e NAO renova created_at
--   dia 32  -> exatamente a mesma coisa. E no dia 33. Para sempre.
--
-- Ou seja: cache miss PERMANENTE, com custo de modelo em TODA requisicao
-- daquela consulta, e o resultado jogado fora toda vez. Provado em tabela
-- temporaria: depois de regravar, colecao continuava 'VELHA' e idade 40 dias.
--
-- O sinal para distinguir os dois caminhos e model_used: 'Preparar registro'
-- envia null quando serviu do cache e o nome do modelo quando o curador rodou.
-- SE ALGUEM MUDAR AQUILO, ISTO AQUI QUEBRA EM SILENCIO.
ON CONFLICT (query_hash) DO UPDATE
   SET hit_count = search_cache.hit_count + 1,
       last_hit_at = now(),
       picks            = CASE WHEN EXCLUDED.model_used IS NULL THEN search_cache.picks            ELSE EXCLUDED.picks            END,
       not_found        = CASE WHEN EXCLUDED.model_used IS NULL THEN search_cache.not_found        ELSE EXCLUDED.not_found        END,
       collection_title = CASE WHEN EXCLUDED.model_used IS NULL THEN search_cache.collection_title ELSE EXCLUDED.collection_title END,
       model_used       = COALESCE(EXCLUDED.model_used, search_cache.model_used),
       created_at       = CASE WHEN EXCLUDED.model_used IS NULL THEN search_cache.created_at       ELSE now()                     END
