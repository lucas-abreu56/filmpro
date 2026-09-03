import { notFound } from "next/navigation";
import MovieDetail from "@/components/features/MovieDetail";
import { type Movie } from "@/lib/types";
import Link from "next/link";

/**
 * Este webhook será chamado quando o usuário acessar a URL /filme/123 diretamente.
 * Como o Next.js não fala com o Postgres, o n8n vai servir como ponte (leitura rápida).
 */
const WEBHOOK_URL = process.env.N8N_FILMPRO_MOVIE_WEBHOOK ?? "https://<seu-n8n>/webhook/filmpro/movie";

async function getMovieFromN8n(tmdbId: string): Promise<Movie | null> {
  // Se estivermos em dev mock, ou se o n8n ainda não estiver pronto,
  // vamos falhar de forma gracefully.
  const isMock = process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1";
  if (isMock) {
    // Retorna do mock falso para testar a interface
    const { RESPOSTA_FALSA } = await import("@/lib/mock");
    return RESPOSTA_FALSA.movies.find((m) => m.tmdbId === Number(tmdbId)) || null;
  }

  try {
    const apiKey = process.env.N8N_API_KEY || "";
    const res = await fetch(`${WEBHOOK_URL}?id=${tmdbId}`, {
      headers: { "x-api-key": apiKey },
      // Cache de 7 dias. Na arquitetura sem DB, cacheamos pesado para anular 
      // a latência natural de ~200ms do n8n.
      next: { revalidate: 604800 },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      console.error(`Erro no webhook standalone do n8n: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data as Movie;
  } catch (err) {
    console.error("Erro de fetch standalone:", err);
    return null;
  }
}

export default async function MoviePage(props: {
  params: Promise<{ tmdbId: string }>;
}) {
  const params = await props.params;
  const movie = await getMovieFromN8n(params.tmdbId);

  if (!movie) {
    return notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col py-16 px-6 sm:py-24">
      <Link
        href="/"
        className="text-apoio hover:text-acento font-display mb-8 text-xs tracking-[0.16em] uppercase transition-colors"
      >
        ← Voltar para a busca
      </Link>
      <div className="bg-papel rounded shadow-sm border border-fio overflow-hidden">
        <MovieDetail movie={movie} />
      </div>
    </main>
  );
}
