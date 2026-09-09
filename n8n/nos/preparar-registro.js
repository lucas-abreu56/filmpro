// Nó "Preparar registro" — n8n-nodes-base.code
const entrada = $('Validar entrada').first().json;
const resp = $('Montar resposta').first().json;
const l1 = $('Cache L1').all();
const doCache = l1.length > 0 && l1[0].json && Array.isArray(l1[0].json.picks) && l1[0].json.picks.length > 0;

let picks;
if (doCache) {
  picks = l1[0].json.picks;
} else {
  // Mesmo filtro de 'Montar resposta': a sentinela { vazio: true } de
  // 'Escolher correspondencia' nao e filme e nao pode virar pick.
  picks = $('Escolher correspondencia').all()
    .map(function (i) { return i.json; })
    .filter(function (c) { return c && c.tmdbId != null; })
    .map(function (c) {
      return { tmdb_id: c.tmdbId, reason: c.reason, rank: c.rank };
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
  // ATENCAO: este null NAO e so telemetria, e contrato.
  //
  // O ON CONFLICT do no 'Gravar L1' usa `EXCLUDED.model_used IS NULL` para
  // saber se a gravacao veio do cache ou do curador. NULL significa "nao
  // chamei modelo nenhum", e o SQL entao preserva picks, collection_title e
  // created_at, contando so mais um hit. Preencher isto num acerto de cache
  // faria toda leitura renovar o created_at, e a curadoria nunca envelheceria.
  // Trocar o 'gemini' por null faria o contrario: a entrada expirada nunca se
  // recuperaria, que era exatamente o defeito consertado em 03/09/2026.
  //
  // O valor da string em si nao importa para o SQL, so o null-ou-nao.
  modelUsed: doCache ? null : 'gemini',
  cacheHit: !!doCache,
  // 'human' | 'robot', decidido pelo 'Validar entrada' a partir de body.source.
  // So a telemetria em 'searches' le isto (5.3) — search_cache continua sem
  // marca, de proposito: a curadoria de um recorte do robo serve normalmente
  // se uma pessoa buscar as mesmas palavras depois.
  source: entrada.source,
  // Lido pelo IF 'Vale cachear?', que decide se 'Gravar L1' roda. Zero filmes
  // NAO pode entrar no search_cache: 'Cache L1' nao filtra por picks vazio,
  // mas 'Tem cache?' exige picks notEmpty — a linha nunca serviria de cache e
  // ainda assim ocuparia o query_hash por 30 dias, mandando toda busca daquela
  // consulta pelo curador de novo. Cache miss permanente COM custo de LLM, que
  // e o pior dos dois mundos e foi o defeito consertado em 03/09/2026 por
  // outro caminho. Zero confirmados costuma ser transitorio (TMDB fora, uma
  // curadoria ruim): a proxima busca merece tentar de novo, fresca.
  //
  // A telemetria em 'searches' continua gravando normalmente — e justamente
  // dela que sai a contagem de movie_count = 0.
  valeCachear: (resp.movies || []).length > 0,
  movieCount: (resp.movies || []).length,
  notFoundCount: (resp.notFound || []).length,
  latencyMs: Date.now() - Number(entrada.inicio || Date.now()),
  requestId: requestId,
} }];
