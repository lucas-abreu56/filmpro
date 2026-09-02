// Nó "Montar fatos" — n8n-nodes-base.code
// Fatos crus, no formato EXATO da tabela movies: guarda o PATH, nunca a URL.
// Tamanho de imagem (w342, w500) e decisao de apresentacao e e montado em
// 'Montar resposta'; congelar a URL no banco significa reescrever a tabela
// inteira so para trocar de tamanho.
const casados = $('Escolher correspondencia').all().map(function (i) { return i.json; });
const fichas = $('TMDB detalhes').all().map(function (i) { return i.json; });
const notas = $input.all().map(function (i) { return i.json; });

function ausente(v) { return v == null || v === 'N/A' || v === ''; }
function numero(v) {
  if (ausente(v)) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

const linhas = [];
for (let i = 0; i < casados.length; i++) {
  const d = fichas[i];
  if (!d || !d.id) continue;
  const o = notas[i] || {};
  const temNota = o.Response === 'True';

  const creditos = d.credits || {};
  const equipe = Array.isArray(creditos.crew) ? creditos.crew : [];
  const elenco = Array.isArray(creditos.cast) ? creditos.cast : [];
  const diretor = equipe.find(function (c) { return c.job === 'Director'; });

  const lancamentos = (d.release_dates && d.release_dates.results) || [];
  const br = lancamentos.find(function (r) { return r.iso_3166_1 === 'BR'; });
  const cert = ((br && br.release_dates) || [])
    .map(function (r) { return r.certification; })
    .find(function (c) { return c; });

  const videos = (d.videos && d.videos.results) || [];
  const trailer = videos.find(function (v) { return v.site === 'YouTube' && v.type === 'Trailer'; })
    || videos.find(function (v) { return v.site === 'YouTube'; });

  const logos = (d.images && d.images.logos) || [];
  const logo = logos.find(function (l) { return l.iso_639_1 === 'pt'; }) || logos[0];

  const onde = ((d['watch/providers'] || {}).results || {}).BR || {};
  const provedores = [];
  [['assinatura', 'flatrate'], ['aluguel', 'rent'], ['compra', 'buy']].forEach(function (par) {
    (onde[par[1]] || []).forEach(function (p) {
      provedores.push({ type: par[0], name: p.provider_name, logo_path: p.logo_path || null });
    });
  });

  linhas.push({
    tmdb_id: d.id,
    imdb_id: (d.external_ids && d.external_ids.imdb_id) || null,
    title: d.title || casados[i].title,
    original_title: d.original_title || null,
    release_year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    tagline: d.tagline || null,
    overview: d.overview || null,
    poster_path: d.poster_path || null,
    backdrop_path: d.backdrop_path || null,
    logo_path: (logo && logo.file_path) || null,
    rating: typeof d.vote_average === 'number' ? Number(d.vote_average.toFixed(1)) : null,
    vote_count: d.vote_count == null ? null : d.vote_count,
    imdb_rating: temNota ? numero(o.imdbRating) : null,
    imdb_votes: temNota ? numero(o.imdbVotes) : null,
    awards: temNota && !ausente(o.Awards) ? o.Awards : null,
    runtime: d.runtime || null,
    genres: (d.genres || []).map(function (g) { return g.name; }),
    keywords: (((d.keywords || {}).keywords) || []).slice(0, 12).map(function (k) { return k.name; }),
    original_language: d.original_language || null,
    spoken_languages: (d.spoken_languages || []).map(function (l) { return l.name; }),
    age_rating: cert || null,
    director: (diretor && diretor.name) || null,
    cast_members: elenco.slice(0, 10).map(function (a) {
      return { name: a.name, character: a.character || null, profile_path: a.profile_path || null };
    }),
    crew_members: equipe.filter(function (c) {
      return ['Director', 'Screenplay', 'Writer', 'Director of Photography', 'Original Music Composer'].indexOf(c.job) !== -1;
    }).slice(0, 8).map(function (c) {
      return { name: c.name, role: c.job, profile_path: c.profile_path || null };
    }),
    collection_name: (d.belongs_to_collection && d.belongs_to_collection.name) || null,
    similar_movies: (((d.recommendations || {}).results) || []).slice(0, 8).map(function (r) {
      return {
        tmdb_id: r.id, title: r.title,
        year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
        poster_path: r.poster_path || null, backdrop_path: r.backdrop_path || null,
      };
    }),
    providers: provedores,
    trailer_key: (trailer && trailer.key) || null,
  });
}
if (!linhas.length) throw new Error('Nenhum filme sobreviveu ao enriquecimento.');

// Um unico item com o array dentro: o no Postgres roda a query uma vez so,
// com um parametro jsonb, em vez de uma query por filme.
return [{ json: { linhas: linhas } }];
