import Link from "next/link";
import { notFound } from "next/navigation";

import MovieDetail from "@/components/features/MovieDetail";
import { sanitizeReasonOrNull } from "@/lib/sanitize";
import { type Movie } from "@/lib/types";

/**
 * A ficha por link direto — sem modal e sem store: refresh em cima do modal,
 * URL colada no WhatsApp, robô de indexação.
 *
 * O Next não fala com o Postgres (regra do projeto: credencial de banco vive
 * só no n8n), então quem lê a tabela é um webhook dedicado, sem LLM e sem
 * TMDB. Contrato de saída idêntico ao de `/api/recommendations`: o mapeamento
 * de coluna para `Movie` acontece lá, no nó `Montar filme`.
 */
const WEBHOOK_URL =
  process.env.N8N_FILMPRO_MOVIE_WEBHOOK ??
  "https://<seu-n8n>/webhook/filmpro/movie";

/** Os fatos de um filme mudam pouco — a tabela `movies` já tem TTL de 90 dias
 *  do lado do n8n. Uma semana aqui na frente evita ida ao VPS a cada visita. */
const REVALIDA_S = 604_800;

async function buscarFilme(tmdbId: string): Promise<Movie | null> {
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

  try {
    const res = await fetch(
      `${WEBHOOK_URL}?id=${encodeURIComponent(tmdbId)}`,
      {
        headers: { "x-api-key": apiKey },
        next: { revalidate: REVALIDA_S },
      },
    );

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
    return { ...filme, reason: sanitizeReasonOrNull(filme.reason) };
  } catch (err) {
    console.error("Falha ao buscar filme no webhook:", err);
    return null;
  }
}

export async function generateMetadata(props: PageProps<"/filme/[tmdbId]">) {
  const { tmdbId } = await props.params;
  const movie = await buscarFilme(tmdbId);
  if (!movie) return { title: "Filme não encontrado — FilmPro" };
  return {
    title: `${movie.title} — FilmPro`,
    description: movie.overview ?? undefined,
  };
}

export default async function MoviePage(props: PageProps<"/filme/[tmdbId]">) {
  const { tmdbId } = await props.params;
  const movie = await buscarFilme(tmdbId);

  if (!movie) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-24">
      <Link
        href="/"
        className="text-apoio hover:text-acento focus-visible:text-acento font-display mb-8 text-xs tracking-[0.16em] uppercase transition-colors"
      >
        ← Voltar para a busca
      </Link>
      {/* Mesma moldura do modal, para o link direto e o gesto na tira darem na
          mesma tela — sem sombra, fio de 1 px, fundo de palco. */}
      <div className="bg-profundo border-fio overflow-hidden rounded border">
        <MovieDetail movie={movie} />
      </div>
    </main>
  );
}
