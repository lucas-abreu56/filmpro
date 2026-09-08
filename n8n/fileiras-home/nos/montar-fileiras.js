// Nó "Montar fileiras" — n8n-nodes-base.code
// Apresentacao, e so isso — o TERCEIRO espelho do contrato Movie. Os outros
// dois: 'Montar resposta' (workflow FilmPro — Recomendacoes) e 'Montar
// filme' (workflow FilmPro — Filme Standalone). Nao ha um so lugar que os
// tres importem — cada um vive num workflow n8n diferente, sem import entre
// eles — entao mudar o formato de UM contrato obriga a mudar os TRES.
const IMG = 'https://image.tmdb.org/t/p/';

// Espelha src/lib/sanitize.ts e os outros dois montadores. O reason e o label
// sao o que chega escrito por modelo a ser renderizado, entao sao a superficie
// de injecao que sobra. Invisiveis por NUMERO, nunca escritos como caractere —
// e assim que se compara com o lado do TypeScript.
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

function montarFilme(d, reason) {
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
    fetchedAt: d.fetched_at ? new Date(d.fetched_at).toISOString() : new Date().toISOString(),
    // Sem fallback generico de reason, igual ao 'Montar filme': aqui SEMPRE
    // existe curadoria (o pick veio do curador), entao um reason ausente
    // significa que a sanitizacao rejeitou o texto, nao que ele nunca existiu.
    reason: limpar(reason, 220),
  };
}

// 'Buscar semana' tem alwaysOutputData ligado (tabela vazia no dia zero nao
// pode pendurar o webhook ate o timeout). Filtra o item sintetico: ele nao
// tem 'week', uma linha de verdade sempre tem.
const secoes = $('Buscar semana').all().map(function (i) { return i.json; })
  .filter(function (s) { return s && s.week; });

const fatos = {};
$input.all().forEach(function (i) {
  const j = i.json;
  if (j && j.tmdb_id != null) fatos[j.tmdb_id] = j;
});

// A ordem dentro de cada fileira ja e a ordem final — o rank aqui e o
// indice pos-reordenacao que 'Montar resposta' ja fez (disponibilidade no
// Brasil primeiro) na hora em que o robo curou o tema. Nao ha o que
// reordenar de novo, so preservar.
const sections = secoes.map(function (s) {
  const picks = (s.picks || []).slice().sort(function (a, b) {
    return Number(a.rank || 0) - Number(b.rank || 0);
  });
  return {
    position: s.position,
    collectionTitle: s.collection_title,
    // Rotulo curto escrito pelo 'Programador da semana' (1-3 palavras). null
    // nas semanas gravadas antes de 09/2026 e quando a sanitizacao rejeita —
    // a home cai num rotulo neutro por posicao.
    label: limpar(s.label, 28),
    theme: s.theme,
    movies: picks
      .map(function (p) {
        const d = fatos[p.tmdb_id];
        return d ? montarFilme(d, p.reason) : null;
      })
      // Defensivo: so faltaria fato se 'Buscar filmes' e 'Buscar semana' lessem
      // semanas diferentes por uma corrida entre as duas consultas — nao deveria
      // acontecer (mesma tabela, mesmo max(week) resolvido nas duas), mas um
      // filme ausente e melhor que a pagina inteira quebrar.
      .filter(function (m) { return m; }),
  };
});

return [{ json: {
  week: secoes.length ? secoes[0].week : null,
  sections: sections,
} }];
