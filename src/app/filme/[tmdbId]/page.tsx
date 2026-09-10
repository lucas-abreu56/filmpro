import Link from "next/link";
import { notFound } from "next/navigation";

import MovieDetail from "@/components/features/MovieDetail";
import { buscarFilme } from "@/lib/filme";

/**
 * A ficha por link direto — sem modal e sem store: refresh em cima do modal,
 * URL colada no WhatsApp, robô de indexação.
 *
 * A busca em si mora em `lib/filme.ts` desde 10/09/2026: a rota interceptadora
 * do modal passou a precisar da mesma, e duas cópias divergiriam no
 * `revalidate` e nas duas passagens de sanitização.
 */

/**
 * `index: false` porque o que esta página tem de original é UMA frase — o
 * `reason` do curador — e ela é curadoria escrita para uma busca, não fato do
 * filme: mora em `search_cache.picks`, e o `LEFT JOIN LATERAL` de
 * `buscar-filme.sql` devolve NULL quando nenhuma entrada do L1 cita mais este
 * filme. A seção some, e sobra sinopse do TMDB — o mesmo texto de centenas de
 * sites. Entrar no índice assim é entrar na versão em que a página tem menos
 * a dizer.
 *
 * `follow: true` porque o link "Voltar para a busca" deve continuar valendo:
 * o que não se quer é esta URL no índice, não que o rastreador pare aqui.
 *
 * O par disto é `src/app/robots.ts`, que permite baixar `/filme/`. Bloquear
 * ali impediria o rastreador de LER este noindex — e uma URL bloqueada ainda
 * pode ser listada, nua, sem jeito de sair.
 */
export async function generateMetadata(props: PageProps<"/filme/[tmdbId]">) {
  const { tmdbId } = await props.params;
  const movie = await buscarFilme(tmdbId);
  const robots = { index: false, follow: true };
  if (!movie) return { title: "Filme não encontrado — FilmPro", robots };

  // O template `%s — FilmPro` do layout cuida do sufixo — aqui só o nome.
  const titulo = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  const descricao = movie.overview ?? undefined;

  // `og:image` só com FATOS do filme — backdrop, pôster, título, ano. Nunca o
  // `reason` do curador: o `AGENTS.md` separa "escolher títulos" de "responder
  // sobre os filmes", e um card social com a justificativa cruzaria essa linha.
  const imagem = movie.backdropUrl ?? movie.posterUrl ?? undefined;

  return {
    title: titulo,
    description: descricao,
    robots,
    // `index: false` continua valendo, e OG funciona mesmo assim: o unfurl do
    // WhatsApp/Slack lê os `<meta>`, não consulta o robots.
    openGraph: {
      type: "video.movie",
      title: `${titulo} — FilmPro`,
      description: descricao,
      ...(imagem ? { images: [{ url: imagem }] } : {}),
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: `${titulo} — FilmPro`,
      description: descricao,
    },
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
