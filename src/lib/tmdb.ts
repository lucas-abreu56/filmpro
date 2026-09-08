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
 *  fora da lista devolve 404, não uma imagem redimensionada.
 *
 *  Havia aqui `PROFILE_SIZES`/`LOGO_SIZES` e as funções `profileUrl` e
 *  `providerLogoUrl`. Saíram em 08/09/2026 por não terem nenhum chamador: as
 *  fotos de elenco nunca foram desenhadas, e o logo do provedor chega do n8n
 *  como URL já montada. Voltam junto com a tela que precisar delas. */
export const POSTER_SIZES = ["w185", "w342", "w500", "w780", "original"] as const;
export const BACKDROP_SIZES = ["w300", "w780", "w1280", "original"] as const;

type PosterSize = (typeof POSTER_SIZES)[number];
type BackdropSize = (typeof BACKDROP_SIZES)[number];

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

/**
 * Reduz um backdrop JÁ MONTADO para um tamanho menor, reescrevendo o segmento
 * de tamanho na URL.
 *
 * O n8n assa `w1280` na URL do backdrop (`montar-resposta.js` e dois espelhos).
 * É o tamanho certo para o herói, que ocupa a largura inteira da tela — e
 * desperdício para os fotogramas da tira, que no desktop não passam de ~270px
 * de largura e no celular de ~540px. Nesse tamanho `w780` é indistinguível de
 * `w1280` e custa ~55% menos bytes; além do peso de rede, o fundo é
 * re-rasterizado a cada quadro enquanto a coluna abre no hover, e a textura
 * menor barateia esse custo.
 *
 * Recorte de string de propósito: a URL chega pronta do n8n e o `backdrop_path`
 * não é persistido separado no payload enxuto (`enxugar.ts`). O conserto certo
 * é o n8n mandar só o path e o Next montar aqui — quando isso acontecer, esta
 * função sai junto.
 */
export function backdropMenor(url: string, size: BackdropSize = "w780"): string {
  return url.replace(/\/t\/p\/w\d+\//, `/t/p/${size}/`);
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

/**
 * A página "onde assistir" do filme, no Brasil.
 *
 * É a central que o TMDB monta com dados da JustWatch: lista as plataformas
 * ativas no país e traz o botão de reprodução de cada uma. Linkar para ela não
 * é só conveniência — os termos de uso dos dados de provedor pedem que se
 * atribua a fonte e se aponte para a página deles.
 *
 * ── Por que não um link por streaming ───────────────────────────────────────
 * Porque esse link não existe no dado. O TMDB entrega, por país, UMA página
 * com todos os serviços; não há URL por serviço na API. Montar
 * "netflix.com/search?q=…" seria inventar um destino e acertar às vezes. Esta
 * página é onde os botões de reprodução realmente estão — um toque a mais, e
 * nenhum chute.
 *
 * A URL é a rota do próprio site do TMDB. O campo `link` que a API devolve em
 * `watch/providers.results.BR` diria o mesmo e seria a fonte mais correta, mas
 * ele **não é persistido em `movies`**: usá-lo custaria coluna nova no schema,
 * mudança nos nós do n8n e sincronia com o VPS. Fica como refinamento, não
 * como pré-requisito. (Verificado em 04/09/2026.)
 */
export function tmdbWatchUrl(tmdbId: number) {
  return `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=BR`;
}
