import { enxugarFilme } from "@/lib/enxugar";
import { sanitizeReasonOrNull } from "@/lib/sanitize";
import { type Movie } from "@/lib/types";

/**
 * Um filme, pelo webhook dedicado.
 *
 * Nasceu dentro de `app/filme/[tmdbId]/page.tsx` e saiu de lá em 10/09/2026,
 * quando a rota interceptadora do modal passou a precisar da mesma busca: sem
 * ela, o modal renunciava a si mesmo e mandava a pessoa para a página inteira
 * sempre que o store não tinha o filme. Duas cópias da mesma busca divergiriam
 * no `revalidate` e nas duas passagens de sanitização.
 *
 * **Só para Server Component.** A `N8N_API_KEY` é lida aqui, e só não vaza
 * porque nenhum componente de cliente importa este módulo. O pacote
 * `server-only` transformaria essa disciplina em erro de build; ele não está
 * instalado (dependência nova é decisão do Lucas), então a regra é humana:
 * **nunca importe daqui de dentro de um arquivo com `"use client"`.**
 *
 * O Next não fala com o Postgres (regra do projeto: credencial de banco vive
 * só no n8n), então quem lê a tabela é um webhook dedicado, sem LLM e sem
 * TMDB. Contrato de saída idêntico ao de `/api/recommendations`: o mapeamento
 * de coluna para `Movie` acontece lá, no nó `Montar filme`.
 */

/** Os fatos de um filme mudam pouco — a tabela `movies` já tem TTL de 90 dias
 *  do lado do n8n. Uma semana aqui na frente evita ida ao VPS a cada visita. */
export const REVALIDA_S = 604_800;

export async function buscarFilme(tmdbId: string): Promise<Movie | null> {
  if (process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1") {
    const { RESPOSTA_FALSA } = await import("@/lib/mock");
    return (
      RESPOSTA_FALSA.movies.find((m) => m.tmdbId === Number(tmdbId)) ?? null
    );
  }

  // Mesma postura do route handler: sem chave, reclame no log em vez de
  // mandar header vazio e receber um 403 que parece problema do n8n.
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    console.error("N8N_API_KEY não está definida nas variáveis de ambiente");
    return null;
  }

  // Obrigatória e sem default, pelos dois motivos que o route handler explica:
  // o `??` publicava o host do n8n e não cobria variável presente e vazia.
  const webhookUrl = process.env.N8N_FILMPRO_MOVIE_WEBHOOK;
  if (!webhookUrl) {
    console.error(
      "N8N_FILMPRO_MOVIE_WEBHOOK não está definida nas variáveis de ambiente",
    );
    return null;
  }

  try {
    const res = await fetch(`${webhookUrl}?id=${encodeURIComponent(tmdbId)}`, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: REVALIDA_S },
    });

    // 404 é resposta legítima do webhook (id que não existe, ou id torto que
    // ele normalizou para zero) — não é falha, e não vai para o log.
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`Webhook de filme respondeu ${res.status}`);
      return null;
    }
    // Segunda passagem sobre o único campo autoral, pelo mesmo motivo que
    // `/api/recommendations` faz a dela: esta rota lê o MESMO
    // `search_cache.picks`, e a defesa existia só de um dos dois lados da
    // mesma tabela. O porquê do `null` está no docblock de `sanitizeReasonOrNull`.
    const filme = (await res.json()) as Movie;
    // Mesmo corte da home (`enxugarFilme`): aqui vale 18% do peso da página.
    return { ...enxugarFilme(filme), reason: sanitizeReasonOrNull(filme.reason) };
  } catch (err) {
    console.error("Falha ao buscar filme no webhook:", err);
    return null;
  }
}
