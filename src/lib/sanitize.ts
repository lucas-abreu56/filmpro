/**
 * Validação do texto que o modelo escreve.
 *
 * `reason` e `collectionTitle` são os únicos campos autorais do sistema, e os
 * únicos que chegam à tela vindos do LLM. Como `preferences` é texto livre de
 * estranho na internet, esses dois são a superfície de injeção que sobra.
 *
 * A defesa principal não está aqui — está no JSON Schema entregue ao agente
 * (quatro campos, `additionalProperties: false`, `maxLength`), que impede
 * campo novo e resposta gigante. Um schema que não valida não passa; um
 * parágrafo de prompt o modelo pode desobedecer.
 *
 * Isto é a segunda linha: roda **antes de gravar no cache** e de novo antes de
 * renderizar. Gravar sem validar deixaria um texto malicioso persistido sob
 * aquele hash, servido a quem digitasse a mesma consulta.
 *
 * O que NÃO é problema aqui: XSS. O React escapa texto por padrão. A regra
 * que sustenta isso é não usar `dangerouslySetInnerHTML` em nenhum lugar do
 * projeto — e é regra, não preferência.
 */

// Extensão explícita: `npm test` roda no ESM do Node (`--experimental-strip-types`),
// que não resolve caminho sem extensão como o bundler do Next resolve. É a
// mesma forma que os arquivos de teste já usam.
import { LIMITS } from "./types.ts";

/**
 * Link (markdown ou cru), tag HTML e esquemas perigosos.
 *
 * `<[a-z]` e não `<` sozinho: `<` aparece legitimamente em texto ("anos < 90"),
 * mas `<` colado numa letra é abertura de tag.
 */
const SUSPEITO =
  /https?:\/\/|www\.|<[a-z/]|\[[^\]]*\]\([^)]*\)|javascript:|data:/i;

/**
 * Zero-width e afins: invisíveis na tela, mas podem esconder instrução.
 *
 * Declarados por NÚMERO, e não escritos como caractere. O nó `Validar
 * entrada` do n8n precisa remover exatamente este conjunto — é o mesmo hash
 * de cache — e por semanas ele **não** removeu: faltava lá o U+00AD, e
 * ninguém percebeu porque não se confere a olho o que não se vê. Por número,
 * as duas listas se leem e se comparam lado a lado.
 */
const INVISIVEIS = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
const INVISIVEL = new RegExp(
  `[${INVISIVEIS.map((c) => String.fromCharCode(c)).join("")}]`,
  "g",
);

export interface SanitizeOptions {
  maxLength: number;
  /** Devolvido quando o texto é rejeitado. Precisa fazer sentido na tela. */
  fallback: string;
}

/**
 * Devolve o texto limpo, ou o fallback se ele contiver algo que texto de
 * curadoria não tem motivo para conter.
 *
 * Rejeita em vez de tentar limpar: remover o link e manter a frase deixaria o
 * resto da instrução injetada intacto. Se o campo está corrompido, o campo
 * inteiro é descartado.
 */
export function sanitizeAuthoredText(
  raw: unknown,
  { maxLength, fallback }: SanitizeOptions,
): string {
  if (typeof raw !== "string") return fallback;

  const texto = raw
    .replace(INVISIVEL, "")
    .replace(/\s+/g, " ") // quebra de linha vira espaço: é frase, não bloco
    .trim();

  if (!texto) return fallback;
  if (SUSPEITO.test(texto)) return fallback;

  // O `maxLength` do schema já deveria ter contido isto. O corte aqui existe
  // porque o schema é do modelo e este código é nosso — vale desconfiar.
  return texto.length > maxLength
    ? `${texto.slice(0, maxLength - 1).trimEnd()}…`
    : texto;
}

/**
 * O mesmo filtro, com a outra política de rejeição: descarta em vez de
 * substituir.
 *
 * `search_cache.picks` é lido por dois caminhos. `/api/recommendations` limpa
 * o `reason` e, se rejeitar, põe "Escolhido pela curadoria para esta busca." —
 * ali sempre houve uma busca, então sempre há curadoria a anunciar.
 * `/filme/[tmdbId]` lê a MESMA tabela por um LATERAL join, e ali `null` é
 * estado legítimo: um link direto para um filme cuja busca já saiu do cache
 * não tem curadoria nenhuma, e a ficha some com a seção.
 *
 * Por isso a rota de link direto não pode usar o fallback da outra. Trocar
 * texto suspeito por uma frase de curador assinaria como curadoria justamente
 * o que acabou de ser descartado — e no campo que o produto vende.
 *
 * (Esta função nasceu em 04/09/2026, quando se percebeu que a rota standalone
 * entregava o texto do cache direto ao componente. A segunda passagem existia
 * só de um lado da mesma tabela.)
 */
export function sanitizeReasonOrNull(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const limpo = sanitizeAuthoredText(raw, {
    maxLength: LIMITS.MAX_REASON,
    fallback: "",
  });
  return limpo || null;
}

/**
 * Normalização da consulta antes do hash de cache.
 *
 * Sem isto, "Terror anos 90" e "terror anos 90 " são hashes diferentes e o
 * cache quase nunca acerta. Precisa bater exatamente com a normalização feita
 * no n8n — se as duas divergirem, o cache silenciosamente para de funcionar,
 * sem erro nenhum.
 *
 * O resultado é gravado em `search_cache.query_norm` para poder ser auditado.
 */
export function normalizeQuery(raw: string): string {
  return (
    raw
      .normalize("NFC")
      .toLowerCase()
      .replace(INVISIVEL, "")
      .replace(/\s+/g, " ")
      // O `trim` vem ANTES de tirar a pontuação, e a ordem não é detalhe: com
      // ela invertida, `$` não casa em "anos 90! " porque a string ainda
      // termina em espaço, e "anos 90!" e "anos 90! " viram hashes
      // diferentes. O cache erraria em silêncio. Pego por teste.
      .trim()
      .replace(/[.,;:!?]+$/, "")
      .trim()
  );
}
