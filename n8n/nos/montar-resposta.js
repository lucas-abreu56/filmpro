// Nó "Montar resposta" — n8n-nodes-base.code
// Apresentacao, e so isso. Recebe linhas da tabela movies — do upsert no
// caminho vivo, ou do SELECT num acerto de cache — e monta as URLs. Um unico
// lugar decide como um filme vira JSON, para os dois caminhos.
const IMG = 'https://image.tmdb.org/t/p/';
const entrada = $('Validar entrada').first().json;
const l1 = $('Cache L1').all();
const doCache = l1.length > 0 && l1[0].json
  && Array.isArray(l1[0].json.picks) && l1[0].json.picks.length > 0;

// Espelha src/lib/sanitize.ts. O texto autoral e a unica superficie de
// injecao que sobra, porque e a unica coisa do modelo que e renderizada.
//
// A lista de invisiveis vem por NUMERO, e nao escrita como caractere. Em
// 02/09/2026 alinhei este conjunto entre sanitize.ts e o no Validar entrada,
// e ESTE arquivo passou batido: ficou sem o U+00AD por mais um dia, com um
// comentario dizendo que espelhava. Ninguem confere a olho o que nao ve.
const PROIBIDO = /https?:\/\/|www\.|<[a-z\/]|\[[^\]]*\]\([^)]*\)|javascript:|data:/i;
const PROIBIDO_INVISIVEL = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
const INVISIVEL = new RegExp('[' + PROIBIDO_INVISIVEL.map(function (c) {
  return String.fromCharCode(c);
}).join('') + ']', 'g');
function limpar(t, max) {
  const s = String(t == null ? '' : t).replace(INVISIVEL, '').trim();
  if (!s || PROIBIDO.test(s)) return null;
  return s.slice(0, max);
}

// Corrige por TABELA palavras que o modelo escreve sem acento no `reason`.
// Medido em 09/09/2026: 8/8, 5/8 e 1/8 sem acento em tres baterias da mesma
// intencao. Reforcar o prompt (a v5 ja fez isso) e trocar de modelo (o
// 3.1-flash-lite foi escolhido por latencia, 03/09/2026) foram descartados por
// medicao. So entram palavras cuja forma sem acento NAO existe como outra
// palavra valida em portugues — "atmosfera" nao leva acento e por isso nao
// esta aqui. Espelha n8n/logica/corrigir-acentuacao.js.
var LEXICO_ACENTUACAO = {
  nao: "não",
  psicologico: "psicológico",
  decada: "década",
  japones: "japonês",
  historia: "história",
  familia: "família",
  tragedia: "tragédia",
  solidao: "solidão",
};
function corrigirAcentuacao(texto) {
  var s = String(texto == null ? "" : texto);
  return s.replace(/[A-Za-zÀ-ÿ]+/g, function (palavra) {
    var certa = LEXICO_ACENTUACAO[palavra.toLowerCase()];
    if (!certa) return palavra;
    if (palavra[0] === palavra[0].toUpperCase()) {
      return certa[0].toUpperCase() + certa.slice(1);
    }
    return certa;
  });
}

let picks, colecao, naoAchados;
if (doCache) {
  picks = l1[0].json.picks;
  colecao = l1[0].json.collection_title;
  naoAchados = l1[0].json.not_found || [];
} else {
  // O item { vazio: true } e a sentinela que 'Escolher correspondencia' emite
  // quando NENHUM titulo confirmou no TMDB. Ela existe so para o ramo nao
  // morrer em silencio (no Code que devolve [] interrompe o fluxo e o webhook
  // pendura); nao e um filme, e nao pode virar pick. Filtrar por tmdbId em vez
  // de por 'vazio' porque qualquer item sem id e igualmente inutil aqui.
  const casados = $('Escolher correspondencia').all()
    .map(function (i) { return i.json; })
    .filter(function (c) { return c && c.tmdbId != null; });
  const pedidos = $('Enfileirar titulos').all().map(function (i) { return i.json; });
  picks = casados.map(function (c) {
    return { tmdb_id: c.tmdbId, reason: c.reason, rank: c.rank };
  });
  // notFound e so o que o TMDB nao confirmou — calculado antes de qualquer
  // corte. Os excedentes do limit+2 sao folga, nao descarte.
  const conf = {};
  casados.forEach(function (c) { conf[c.rank] = true; });
  naoAchados = pedidos
    .filter(function (p) { return !conf[p.rank]; })
    .map(function (p) { return limpar(p.title, 120) || 'titulo invalido'; });
  colecao = (($('Curador').first().json || {}).output || {}).collectionTitle;
}

const fatos = {};
$input.all().forEach(function (i) {
  const j = i.json;
  if (j && j.tmdb_id != null) fatos[j.tmdb_id] = j;
});

function url(base, caminho) { return caminho ? IMG + base + caminho : null; }
function num(v) { return v == null ? null : Number(v); }

// NUMERIC volta como string do no Postgres (largeNumbersOutput = text por
// padrao). Sem o Number(), rating viraria "8.3" e a UI compararia string.
function montar(d, reason) {
  return {
    tmdbId: d.tmdb_id,
    tmdbUrl: 'https://www.themoviedb.org/movie/' + d.tmdb_id,
    imdbId: d.imdb_id || null,
    title: d.title,
    originalTitle: d.original_title || null,
    year: num(d.release_year),
    tagline: d.tagline || null,
    overview: d.overview || null,
    posterUrl: url('w500', d.poster_path),
    backdropUrl: url('w1280', d.backdrop_path),
    logoUrl: url('w300', d.logo_path),
    trailerKey: d.trailer_key || null,
    rating: num(d.rating),
    voteCount: num(d.vote_count),
    imdbRating: num(d.imdb_rating),
    imdbVotes: num(d.imdb_votes),
    awards: d.awards || null,
    runtime: num(d.runtime),
    genres: d.genres || [],
    keywords: d.keywords || [],
    originalLanguage: d.original_language || null,
    spokenLanguages: d.spoken_languages || [],
    ageRating: d.age_rating || null,
    director: d.director || null,
    cast: (d.cast_members || []).map(function (a) {
      return { name: a.name, character: a.character || null, profileUrl: url('w185', a.profile_path) };
    }),
    crew: (d.crew_members || []).map(function (c) {
      return { name: c.name, role: c.role, profileUrl: url('w185', c.profile_path) };
    }),
    collection: d.collection_name || null,
    similar: (d.similar_movies || []).map(function (r) {
      return {
        tmdbId: r.tmdb_id, title: r.title, year: num(r.year),
        backdropUrl: url('w780', r.backdrop_path),
        posterUrl: url('w342', r.poster_path),
        director: null,
      };
    }),
    providers: (d.providers || []).map(function (p) {
      return { type: p.type, name: p.name, logoUrl: url('w92', p.logo_path) };
    }),
    // A UI mostra "disponibilidade verificada em {data}": provedor e nota
    // mudam, e datar a informacao e mais honesto que fingir que e de agora.
    fetchedAt: d.fetched_at ? new Date(d.fetched_at).toISOString() : new Date().toISOString(),
    reason: limpar(reason, 220) || 'Escolha do curador para o que voce pediu.',
  };
}

// A ordem do curador e informacao: o primeiro e o que ele defenderia
// primeiro. Nem o banco nem os nos HTTP garantem ordem.
const ordenados = picks.slice().sort(function (a, b) {
  return Number(a.rank || 0) - Number(b.rank || 0);
});
// Disponibilidade decide a ORDEM, nunca o tamanho da lista.
//
// O pedido era descartar quem nao tem onde ser assistido no Brasil. Descarte
// puro acontece DEPOIS do slice(limit) la embaixo: sobrando menos que o
// pedido, a colecao encolhe em silencio — e a colecao de teste do projeto tem
// 3 de 8 filmes sem provedor no BR. Aqui o indisponivel so ocupa vaga que
// nenhum disponivel reclamou, e chega rotulado: a UI escreve "Sem streaming
// no Brasil segundo o TMDB em {data}" em vez de sumir com o filme.
//
// Dentro de cada grupo o rank do curador continua mandando.
const disponiveis = [];
const indisponiveis = [];
ordenados.forEach(function (p) {
  const d = fatos[p.tmdb_id];
  if (!d) return;
  const filme = montar(d, corrigirAcentuacao(p.reason));
  if (filme.providers.length > 0) disponiveis.push(filme);
  else indisponiveis.push(filme);
});
const filmes = disponiveis.concat(indisponiveis);

return [{ json: {
  requestId: entrada.requestId,
  query: entrada.preferences,
  collectionTitle: limpar(colecao, 60) || 'Selecao do curador',
  cached: !!doCache,
  generatedAt: new Date().toISOString(),
  movies: filmes.slice(0, entrada.limit),
  notFound: naoAchados,
} }]
