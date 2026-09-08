import { type Movie } from "@/lib/types";

/**
 * Tira do `Movie` os campos que a interface não desenha, antes de ele cruzar
 * do servidor para o navegador.
 *
 * ── O número que justifica isto ─────────────────────────────────────────────
 * Medido no HTML de produção em 08/09/2026, com o payload do React Server
 * Components já embutido:
 *
 *   home  (40 filmes): 164.917 de 423.153 chars mortos  →  39% da página
 *   ficha (1 filme):     4.791 de  26.228 chars mortos  →  18% da página
 *
 * Os três maiores são `similar` (80 KB), `cast` (47 KB) e `crew` (27 KB) — o
 * elenco sozinho carrega dez pessoas com URL de foto do TMDB por filme, e a
 * tira mostra oito filmes por fileira, cinco fileiras.
 *
 * ── Por que enxugar em vez de apagar ────────────────────────────────────────
 * Estes campos NÃO são lixo esquecido: são features desenhadas e não
 * construídas — o bloco "Elenco e equipe" da MUBI, a fileira "Títulos
 * semelhantes", o selo de idioma. Os docblocks em `types.ts` descrevem cada
 * uma.
 *
 * Apagá-los do n8n e do banco jogaria fora dado que já foi buscado e pago (o
 * TMDB entrega tudo numa chamada só, via `append_to_response` — não custa
 * requisição extra). Cortar aqui recupera os 39% hoje e deixa o dado esperando
 * no banco para o dia em que a fileira existir.
 *
 * **Para reativar um campo:** tire o nome da lista abaixo e troque o `?` dele
 * em `types.ts`. Nada mais — o n8n continua enviando.
 */
const NAO_RENDERIZADOS = [
  "cast",
  "crew",
  "similar",
  "keywords",
  "spokenLanguages",
  "collection",
  "voteCount",
  "rating",
  "originalLanguage",
] as const;

export function enxugarFilme(filme: Movie): Movie {
  const copia = { ...filme };
  for (const campo of NAO_RENDERIZADOS) delete copia[campo];
  return copia;
}

export function enxugarFilmes(filmes: Movie[]): Movie[] {
  return filmes.map(enxugarFilme);
}
