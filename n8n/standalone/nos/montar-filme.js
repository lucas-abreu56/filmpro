// Nó "Montar filme" — n8n-nodes-base.code
// Apresentacao, e so isso — o gemeo de 'Montar resposta' do workflow
// principal, para um filme so. Recebe UMA linha de movies (mais o reason do
// LATERAL) e devolve exatamente o contrato `Movie` de src/lib/types.ts.
//
// Se os dois divergirem, a ficha standalone quebra EM SILENCIO: o React
// renderiza undefined sem reclamar, e `genres.map` de undefined derruba a
// pagina inteira. A versao de 03/09/2026 nao tinha este no — devolvia a linha
// crua, com poster_path onde a UI esperava posterUrl.
const IMG = 'https://image.tmdb.org/t/p/';

// Espelha src/lib/sanitize.ts e o 'Montar resposta'. O reason e a unica coisa
// escrita por modelo que chega a ser renderizada, entao e a unica superficie
// de injecao que sobra. Invisiveis por NUMERO, nunca escritos como caractere.
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

function url(base, caminho) { return caminho ? IMG + base + caminho : null; }
// NUMERIC volta como string do no Postgres (largeNumbersOutput = text por
// padrao). Sem o Number(), rating viraria "8.3" e a UI compararia string.
function num(v) { return v == null ? null : Number(v); }

// 'Buscar filme' tem alwaysOutputData ligado. Sem isso, zero linhas fariam o
// n8n pular este no E o Responder junto, e o webhook ficaria pendurado ate o
// timeout em vez de devolver 404.
const d = $input.first().json || {};
if (d.tmdb_id == null) {
  return [{ json: { encontrado: false } }];
}

return [{ json: { encontrado: true, filme: {
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
  fetchedAt: d.fetched_at ? new Date(d.fetched_at).toISOString() : new Date().toISOString(),
  // Sem fallback generico, ao contrario de 'Montar resposta'. La sempre houve
  // um pedido do usuario para justificar; aqui pode nao haver curadoria
  // nenhuma, e a ficha esconde a secao. Texto inventado seria pior que secao
  // ausente num produto cujo diferencial e justamente o texto.
  reason: limpar(d.reason, 220),
} } }];
