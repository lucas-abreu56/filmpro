/**
 * Montagem de URL do TMDB e do YouTube.
 *
 * O banco guarda `poster_path` (`/wLLBRoBRsCK4vJb0.jpg`), nunca a URL pronta:
 * a base e o tamanho são decisão de apresentação, e congelar a URL inteira
 * significaria reescrever a tabela para trocar de `w500` para `w780`. Toda a
 * montagem vive aqui, num lugar só.
 *
 * Sem chave de API: o CDN de imagem do TMDB é público. A chave só existe no
 * n8n, e nunca chega ao browser.
 */

const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Tamanhos que o TMDB publica para cada tipo. Não invente outros — um valor
 *  fora da lista devolve 404, não uma imagem redimensionada. */
export const POSTER_SIZES = ["w185", "w342", "w500", "w780", "original"] as const;
export const BACKDROP_SIZES = ["w300", "w780", "w1280", "original"] as const;
export const PROFILE_SIZES = ["w45", "w185", "h632", "original"] as const;
export const LOGO_SIZES = ["w45", "w92", "w154", "w185", "original"] as const;

type PosterSize = (typeof POSTER_SIZES)[number];
type BackdropSize = (typeof BACKDROP_SIZES)[number];
type ProfileSize = (typeof PROFILE_SIZES)[number];
type LogoSize = (typeof LOGO_SIZES)[number];

function imageUrl(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  // O TMDB devolve o path já com barra inicial. Concatenar sem checar geraria
  // `/t/p/w500wLLBR...` silenciosamente — 404 sem erro visível.
  return `${IMAGE_BASE}/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Capa vertical 2:3. Reserva para quando o filme não tem backdrop. */
export function posterUrl(path: string | null, size: PosterSize = "w500") {
  return imageUrl(path, size);
}

/** Fotograma 16:9 — a imagem base da coluna. */
export function backdropUrl(path: string | null, size: BackdropSize = "w780") {
  return imageUrl(path, size);
}

export function profileUrl(path: string | null, size: ProfileSize = "w185") {
  return imageUrl(path, size);
}

/** Logo do provedor de streaming, para a fileira de "onde assistir". */
export function providerLogoUrl(path: string | null, size: LogoSize = "w92") {
  return imageUrl(path, size);
}

/** Link canônico da ficha. É o "prove que existe" de cada card. */
export function tmdbMovieUrl(tmdbId: number) {
  return `https://www.themoviedb.org/movie/${tmdbId}`;
}

// ── YouTube ────────────────────────────────────────────────────────────────
// O banco guarda só a `key` do vídeo, pela mesma razão do poster_path.

/**
 * URL de embed do trailer.
 *
 * `youtube-nocookie.com` em vez de `youtube.com`: não planta cookie de
 * rastreamento antes de a pessoa dar play. `mute=1` é obrigatório para o
 * autoplay funcionar nos navegadores atuais.
 *
 * Este iframe só deve ser montado para a coluna sob foco — oito iframes
 * simultâneos derrubam a página.
 */
export function trailerEmbedUrl(
  key: string,
  { autoplay = true, loop = true, jsapi = false } = {},
) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
    // Com `enablejsapi`, o player passa a responder ao handshake `listening`
    // por `postMessage` e a avisar mudança de estado. É o único jeito de saber
    // daqui de fora que o vídeo começou — o iframe é cross-origin, e sem esse
    // aviso a página não distingue "carregando" de "tocando".
    ...(jsapi ? { enablejsapi: "1" } : {}),
    // `loop` exige `playlist` com a própria chave; sem isso o vídeo para no fim.
    ...(loop ? { loop: "1", playlist: key } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${key}?${params}`;
}
