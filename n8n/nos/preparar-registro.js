// Nó "Preparar registro" — n8n-nodes-base.code
const entrada = $('Validar entrada').first().json;
const resp = $('Montar resposta').first().json;
const l1 = $('Cache L1').all();
const doCache = l1.length > 0 && l1[0].json && Array.isArray(l1[0].json.picks) && l1[0].json.picks.length > 0;

let picks;
if (doCache) {
  picks = l1[0].json.picks;
} else {
  picks = $('Escolher correspondencia').all().map(function (i) {
    return { tmdb_id: i.json.tmdbId, reason: i.json.reason, rank: i.json.rank };
  });
}

// searches.request_id e uuid NOT NULL. O BFF sempre manda um; chamada de
// teste feita na mao, nao. Marcar com o uuid nulo e mais honesto que
// derrubar a gravacao de telemetria por causa de um curl.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requestId = UUID.test(entrada.requestId || '')
  ? entrada.requestId
  : '00000000-0000-0000-0000-000000000000';

return [{ json: {
  queryHash: $('Hash').first().json.queryHash,
  queryText: entrada.preferences,
  queryNorm: entrada.queryNorm,
  limitN: entrada.limit,
  promptVersion: entrada.promptVersion,
  picks: picks,
  notFound: resp.notFound || [],
  collectionTitle: resp.collectionTitle,
  modelUsed: doCache ? null : 'gemini',
  cacheHit: !!doCache,
  movieCount: (resp.movies || []).length,
  notFoundCount: (resp.notFound || []).length,
  latencyMs: Date.now() - Number(entrada.inicio || Date.now()),
  requestId: requestId,
} }];
