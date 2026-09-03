"use client";

import { OndeAssistir } from "@/components/features/FilmStrip";
import { trailerEmbedUrl } from "@/lib/tmdb";
import { type Movie } from "@/lib/types";
import { useMedia } from "@/lib/useMedia";

/**
 * A ficha do filme — a sala de projeção do produto.
 *
 * Serve os dois caminhos sem saber em qual está: dentro do modal interceptado
 * (dados do store) e em `/filme/[tmdbId]` (dados do webhook standalone). O
 * contrato `Movie` é o mesmo, e por isso não há variante.
 *
 * ── Por que ela é escura, sendo o site creme ────────────────────────────────
 * Porque aqui a imagem é a única fonte de luz — a regra que a MUBI enuncia e
 * que o `--color-profundo` já antecipava no sistema, descrito desde sempre
 * como "palco do trailer e do loader". A ficha não inventa cor nova: ela acende
 * o palco que já existia. Creme atrás de um fotograma faz moldura; preto faz
 * projeção.
 *
 * ── Onde o trailer foi parar ────────────────────────────────────────────────
 * Aqui, e só aqui. Na tira ele vivia numa coluna estreita e alta, e um vídeo
 * 16:9 nunca coube: medido em 02/09/2026, dava 463×260 px com 465 px de tarja
 * preta em volta. Neste quadro ele é horizontal por construção, ocupa a
 * largura toda e não sobra nada.
 */
export default function MovieDetail({ movie }: { movie: Movie }) {
  const semMovimento = useMedia("(prefers-reduced-motion: reduce)");

  const meta = [
    movie.director && `Dirigido por ${movie.director}`,
    movie.year,
    movie.runtime && `${movie.runtime} min`,
  ]
    .filter(Boolean)
    .join(" · ");

  const fundo = movie.backdropUrl ?? movie.posterUrl;

  return (
    <article className="bg-profundo text-papel flex max-h-full min-h-0 flex-col overflow-y-auto">
      {/* ── O palco ────────────────────────────────────────────────────────
          16:9 fixo. A altura da ficha nunca depende do texto — foi o defeito
          que motivou este redesenho, e ele não vai se mudar para cá. */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={fundo ? { backgroundImage: `url(${fundo})` } : undefined}
        />

        {!semMovimento && movie.trailerKey && (
          <iframe
            src={trailerEmbedUrl(movie.trailerKey, { autoplay: true, loop: true })}
            title={`Trailer de ${movie.title}`}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 h-full w-full"
          />
        )}

        {/* O gradiente de legibilidade da MUBI: texto sobre still nunca
            repousa direto na imagem. `pointer-events-none` para não roubar o
            clique do player embaixo. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#250701] via-[#250701]/55 to-transparent"
          aria-hidden="true"
        />

        {/* Título e nota fecham a mesma linha, em pontas opostas.
            A nota já esteve no alto à direita, como na MUBI — mas a MUBI não
            tem um "Fechar" ali, e no modal os dois se sobrepunham. Visto em
            captura, não deduzido. */}
        <header className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-10">
          <div className="min-w-0">
            <h2 className="font-display text-[clamp(2rem,5.5vw,4rem)] leading-[0.9] font-medium tracking-tight uppercase">
              {movie.title}
            </h2>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-papel/55 mt-1 text-sm italic">{movie.originalTitle}</p>
            )}
            {meta && (
              <p className="text-papel/70 mt-3 text-[11px] tracking-[0.14em] uppercase">
                {meta}
              </p>
            )}
          </div>

          {/* Número, e não rótulo: dado tem corpo próprio. */}
          {movie.imdbRating && (
            <p className="shrink-0 text-right leading-none">
              <span className="font-display text-[1.75rem] tabular-nums">
                {movie.imdbRating}
              </span>
              <span className="text-papel/60 ml-1.5 text-[10px] tracking-[0.14em] uppercase">
                IMDb
              </span>
              {movie.imdbVotes && (
                <span className="text-papel/45 mt-1 block text-[10px] tabular-nums">
                  {movie.imdbVotes.toLocaleString("pt-BR")} avaliações
                </span>
              )}
            </p>
          )}
        </header>
      </div>

      {/* ── A leitura ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <div className="flex flex-wrap gap-2">
          {movie.ageRating && <Etiqueta>{movie.ageRating}</Etiqueta>}
          {movie.genres.map((g) => (
            <Etiqueta key={g}>{g}</Etiqueta>
          ))}
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* A tese do projeto — mas só quando existe curadoria de verdade.
              `reason` é escrito para UMA busca e vem do L1; num link direto
              para um filme cuja busca já expirou não há texto nenhum, e a
              seção some. Inventar frase de curador seria mentir no campo que
              o produto vende. */}
          {movie.reason && (
            <section>
              <h3 className="text-acento font-display mb-3 text-[11px] tracking-[0.16em] uppercase">
                Por que este filme
              </h3>
              <p className="text-papel/90 text-[15px] leading-relaxed">{movie.reason}</p>
            </section>
          )}

          <section>
            <h3 className="text-papel/55 font-display mb-3 text-[11px] tracking-[0.16em] uppercase">
              Sinopse
            </h3>
            <p className="text-papel/70 text-[15px] leading-relaxed">
              {movie.overview || "Sem sinopse disponível."}
            </p>
          </section>
        </div>

        {/* Fio de 1 px em vez de sombra ou caixa: a MUBI separa por contraste
            e filete, e o projeto inteiro já segue isso. */}
        <div className="border-papel/15 border-t pt-6">
          <div className="tema-escuro">
            <OndeAssistir providers={movie.providers} fetchedAt={movie.fetchedAt} />
          </div>
        </div>

        <div className="border-papel/15 flex flex-wrap items-center gap-4 border-t pt-6">
          <a
            href={movie.tmdbUrl}
            target="_blank"
            rel="noreferrer"
            data-cursor="abrir no TMDB"
            // Pílula, a única forma arredondada do sistema, e reservada a ação.
            className="border-papel/30 hover:border-papel hover:bg-papel hover:text-profundo font-display rounded-full border px-5 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors"
          >
            Ficha no TMDB ↗
          </a>
          {movie.awards && (
            <p className="text-papel/45 min-w-0 flex-1 text-[11px]">{movie.awards}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-papel/25 text-papel/70 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium tracking-[0.06em] uppercase">
      {children}
    </span>
  );
}
