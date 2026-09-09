// O juiz automático da bateria de personas (`scripts/testes-curador.mjs`).
//
// ── O que ele faz e o que NÃO faz ──────────────────────────────────────────
//
// FAZ (mecanizável, sai do julgamento humano): estrutura do JSON, tamanhos,
// `collectionTitle` sem aspas / dois-pontos / a palavra "coleção", `reason`
// sem markdown / emoji / URL, zero `tmdbId` repetido, filme citado abrindo a
// lista, contagem e latência.
//
// NÃO FAZ (julgamento estético, fica para inspeção humana): "reason conecta ao
// pedido", "sem elogio genérico", "collectionTitle evocativo", "diversificou
// décadas". Calibrar um LLM-juiz para isso custaria mais que ler 10 textos, e
// um juiz mal calibrado dá falso conforto. O harness imprime os textos lado a
// lado para leitura.
//
// ── Acentuação: taxa, nunca assertiva por resposta ─────────────────────────
//
// Um booleano sobre saída estocástica é sempre falso positivo ou falso
// negativo (medido: 8/8, 5/8 e 1/8 na mesma intenção). Aqui a função só CONTA
// os `reason` com palavra do léxico sem acento; o limiar (≥95%) é decidido
// sobre a taxa agregada da bateria, no harness, não aqui.
//
// ── Reúso, não reimplementação ────────────────────────────────────────────
//
// `reason` sem markdown/URL: reúsa `sanitizeAuthoredText` (se o texto muda ao
// passar por ela, tinha algo que texto de curadoria não tem). Filme citado
// abrindo a lista: reúsa `normalizar()` do resolvedor do TMDB. Acento:
// reúsa `LEXICO_ACENTUACAO`. Reimplementar qualquer um seria criar a próxima
// cópia divergente — o problema que a Fase 1 existe para travar.
//
// Mora em `n8n/logica/` só para ficar perto dos módulos que reúsa e ser
// testável pelo mesmo glob; o nó do n8n não usa nada disto.

import { LIMITS } from "../../src/lib/types.ts";
import { sanitizeAuthoredText } from "../../src/lib/sanitize.ts";
import { LEXICO_ACENTUACAO } from "./corrigir-acentuacao.js";
import { normalizar } from "./pontuar-correspondencia.js";

/** Palavras do léxico da Fase 6, como regex de palavra inteira. */
const SEM_ACENTO = new RegExp(
  `\\b(${Object.keys(LEXICO_ACENTUACAO).join("|")})\\b`,
  "i",
);

/** markdown de ênfase/estrutura e emoji — o que `sanitizeAuthoredText` não pega. */
const MARKDOWN = /(\*\*|__|^[-*] |`|#{1,6} )/m;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

/**
 * Avalia uma resposta da API contra as regras mecanizáveis do prompt.
 *
 * `citados` são os `originalTitle` que a persona nomeou explicitamente no
 * pedido, na ordem — vazio quando ela não citou nenhum. A regra do prompt é
 * "citou um filme, ESSE filme ABRE a lista".
 *
 * Devolve `{ falhas, avisos, acentuacao }`:
 *  - `falhas`: violações de regra dura (reprova a resposta).
 *  - `avisos`: coisas que merecem olho humano mas não reprovam sozinhas.
 *  - `acentuacao`: `{ total, comErro }` dos `reason`, para a taxa agregada.
 */
export function avaliarResposta(corpo, citados = []) {
  const falhas = [];
  const avisos = [];
  const acentuacao = { total: 0, comErro: 0 };

  if (!corpo || typeof corpo !== "object") {
    return { falhas: ["resposta não é um objeto JSON"], avisos, acentuacao };
  }

  const { collectionTitle, movies, notFound } = corpo;

  // ── collectionTitle ──────────────────────────────────────────────────────
  if (typeof collectionTitle !== "string" || !collectionTitle.trim()) {
    falhas.push("collectionTitle ausente ou vazio");
  } else {
    if (collectionTitle.length > LIMITS.MAX_COLLECTION_TITLE) {
      falhas.push(
        `collectionTitle tem ${collectionTitle.length} chars (máx ${LIMITS.MAX_COLLECTION_TITLE})`,
      );
    }
    if (/["'“”]/.test(collectionTitle)) falhas.push("collectionTitle com aspas");
    if (collectionTitle.includes(":")) falhas.push("collectionTitle com dois-pontos");
    if (/cole[çc][ãa]o/i.test(collectionTitle)) {
      falhas.push('collectionTitle usa a palavra "coleção"');
    }
  }

  // ── movies ───────────────────────────────────────────────────────────────
  if (!Array.isArray(movies)) {
    falhas.push("movies não é array");
    return { falhas, avisos, acentuacao };
  }
  if (movies.length === 0) {
    // Estado vazio legítimo (Fase 4/5) — não é falha do juiz, mas o harness
    // registra à parte para não contar como bateria bem-sucedida.
    avisos.push("movies: [] — nenhum título confirmou no TMDB");
  }

  const idsVistos = new Set();
  movies.forEach((m, i) => {
    const rotulo = `movies[${i}] (${m?.originalTitle ?? "?"})`;

    if (typeof m?.originalTitle !== "string" || !m.originalTitle.trim()) {
      falhas.push(`${rotulo}: originalTitle ausente`);
    }
    if (typeof m?.title !== "string" || !m.title.trim()) {
      falhas.push(`${rotulo}: title ausente`);
    }
    if (!Number.isInteger(m?.year) || m.year < 1888 || m.year > 2100) {
      falhas.push(`${rotulo}: year inválido (${m?.year})`);
    }
    if (typeof m?.tmdbId === "number") {
      if (idsVistos.has(m.tmdbId)) falhas.push(`${rotulo}: tmdbId ${m.tmdbId} repetido`);
      idsVistos.add(m.tmdbId);
    }

    // ── reason ─────────────────────────────────────────────────────────────
    const reason = m?.reason;
    if (typeof reason !== "string" || !reason.trim()) {
      falhas.push(`${rotulo}: reason ausente`);
    } else {
      if (reason.length > LIMITS.MAX_REASON) {
        falhas.push(`${rotulo}: reason tem ${reason.length} chars (máx ${LIMITS.MAX_REASON})`);
      }
      // `sanitizeAuthoredText` devolve o fallback quando rejeita (URL, tag
      // HTML, link markdown). `maxLength` alto e espaços normalizados aqui
      // para que só a REJEIÇÃO dispare, não a truncagem nem "\s+ → espaço".
      const REJEITADO = "\0";
      const limpo = sanitizeAuthoredText(reason.replace(/\s+/g, " ").trim(), {
        maxLength: 100_000,
        fallback: REJEITADO,
      });
      if (limpo === REJEITADO) {
        falhas.push(`${rotulo}: reason contém URL, tag HTML ou link markdown`);
      }
      if (MARKDOWN.test(reason)) falhas.push(`${rotulo}: reason contém markdown`);
      if (EMOJI.test(reason)) falhas.push(`${rotulo}: reason contém emoji`);

      acentuacao.total++;
      if (SEM_ACENTO.test(reason)) acentuacao.comErro++;
    }
  });

  // ── filme citado abre a lista ────────────────────────────────────────────
  citados.forEach((titulo, i) => {
    const naPosicao = movies[i];
    if (!naPosicao) {
      falhas.push(`filme citado "${titulo}" deveria estar na posição ${i + 1}, lista mais curta`);
      return;
    }
    const alvo = normalizar(titulo);
    const bate =
      normalizar(naPosicao.originalTitle) === alvo || normalizar(naPosicao.title) === alvo;
    if (!bate) {
      falhas.push(
        `posição ${i + 1} deveria ser o filme citado "${titulo}", veio "${naPosicao.originalTitle}"`,
      );
    }
  });

  if (notFound !== undefined && !Array.isArray(notFound)) {
    avisos.push("notFound presente mas não é array");
  }

  return { falhas, avisos, acentuacao };
}
