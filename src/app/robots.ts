import type { MetadataRoute } from "next";

/**
 * Antes disto, `/robots.txt` respondia 200 com o boilerplate de content
 * signals da Cloudflare: nenhuma diretiva, nenhuma linha `Sitemap:`. Ou seja,
 * o site não dizia nada a rastreador nenhum — e "nada" é uma escolha por
 * omissão, não uma decisão.
 *
 * ── Por que ALLOW em tudo, inclusive em `/filme/` ──────────────────────────
 *
 * A decisão de produto é NÃO indexar as fichas (o porquê está abaixo), e a
 * tentação é escrever `Disallow: /filme/`. Seria o contrário do que se quer.
 *
 * `Disallow` proíbe BAIXAR a página, não indexá-la. O Google ainda pode
 * listar a URL — sem título e sem descrição, montada a partir de links de
 * terceiros — e, pior, fica proibido de ler a própria `<meta name="robots"
 * content="noindex">` que mandaria removê-la. O resultado do bloqueio é a
 * ficha indexada como um link nu e permanente.
 *
 * Quem tira a página do índice é o `noindex` da ficha, em
 * `src/app/filme/[tmdbId]/page.tsx`. Para ele funcionar, o rastreador precisa
 * poder entrar. Por isso: `Allow: /` aqui, `noindex` lá.
 *
 * ── Por que a ficha não vai para o índice ──────────────────────────────────
 *
 * O que ela tem de original é UMA frase: o `reason` do curador. E ele não é
 * fato do filme — é curadoria escrita para uma busca específica, que mora em
 * `search_cache.picks` e é lida pelo `LEFT JOIN LATERAL` de
 * `n8n/standalone/nos/buscar-filme.sql`. Quando nenhuma entrada do L1 cita
 * mais aquele filme, volta NULL e a seção some da ficha.
 *
 * Tirando essa frase, o conteúdo é TMDB e OMDB — sinopse, elenco, nota —, o
 * mesmo texto que existe em centenas de sites. Indexar seria pedir para
 * entrar no índice na versão em que a página tem menos a dizer.
 *
 * ── Sem linha `Sitemap:`, de propósito ─────────────────────────────────────
 *
 * Não existe sitemap, e declarar um que dá 404 é pior que não declarar. Se um
 * dia houver, ele depende de um quarto webhook: o Next não fala com o
 * Postgres, e a lista de `tmdb_id` está lá.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
