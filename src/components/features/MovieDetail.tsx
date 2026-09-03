"use client";

import { OndeAssistir } from "@/components/features/FilmStrip";
import { trailerEmbedUrl } from "@/lib/tmdb";
import { type Movie } from "@/lib/types";
import { useMedia } from "@/lib/useMedia";

/**
 * A ficha do filme. Serve os dois caminhos sem saber em qual está: dentro do
 * modal interceptado (dados do store) e na página `/filme/[tmdbId]` (dados do
 * webhook standalone). O contrato `Movie` é o mesmo nos dois, e é por isso que
 * este componente não precisa de variante.
 */
export default function MovieDetail({ movie }: { movie: Movie }) {
  // A tira já respeita isto para o trailer, e a ficha precisa respeitar
  // igual — senão o mesmo trailer que a home se recusa a tocar começa
  // sozinho, com som mudo mas em loop, a um clique de distância.
  const semMovimento = useMedia("(prefers-reduced-motion: reduce)");

  return (
    <div className="flex max-h-full min-h-0 flex-col overflow-y-auto sm:flex-row">
      {/* Pôster, com o trailer por cima quando há um e o movimento é bem-vindo.
          O pôster fica montado por baixo nos dois casos: é o que preenche a
          coluna enquanto o player do YouTube ainda não pintou nada. */}
      <div className="bg-tinta relative flex-shrink-0 sm:w-1/3 md:w-2/5">
        <div
          className="aspect-[2/3] w-full bg-cover bg-center sm:h-full"
          style={
            movie.posterUrl
              ? { backgroundImage: `url(${movie.posterUrl})` }
              : undefined
          }
        />
        {!semMovimento && movie.trailerKey && (
          <iframe
            src={trailerEmbedUrl(movie.trailerKey, {
              autoplay: true,
              loop: true,
            })}
            title={`Trailer de ${movie.title}`}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 h-full w-full"
          />
        )}
      </div>

      <div className="flex flex-col gap-6 p-6 sm:p-10 md:p-12">
        <header>
          <h2 className="font-display text-[clamp(2rem,6vw,3.5rem)] leading-[0.9] font-medium tracking-tight uppercase">
            {movie.title}
          </h2>
          <div className="text-apoio mt-3 flex flex-wrap items-center gap-2 text-[11px] tracking-[0.12em] uppercase">
            {movie.year && <span>{movie.year}</span>}
            {movie.runtime && <span>• {movie.runtime} min</span>}
            {movie.director && <span>• Dir. {movie.director}</span>}
            {movie.imdbRating && <span>• IMDb {movie.imdbRating}</span>}
            {movie.ageRating && <span>• {movie.ageRating}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {movie.genres.map((g) => (
              <span
                key={g}
                className="border-fio text-apoio rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium uppercase"
              >
                {g}
              </span>
            ))}
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* A tese do projeto fica aqui — mas só quando existe curadoria de
              verdade. `reason` é escrito para UMA busca e vem do L1; num link
              direto para um filme cuja busca já expirou não há texto nenhum, e
              a seção some. Inventar frase de curador seria mentir justamente
              no campo que o produto vende. */}
          {movie.reason && (
            <section>
              <h3 className="text-acento font-display mb-2 text-[11px] tracking-[0.16em] uppercase">
                Por que este filme
              </h3>
              <p className="text-tinta/90 text-sm leading-relaxed">
                {movie.reason}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-apoio font-display mb-2 text-[11px] tracking-[0.16em] uppercase">
              Sinopse
            </h3>
            <p className="text-apoio/80 text-sm leading-relaxed">
              {movie.overview || "Sem sinopse disponível."}
            </p>
          </section>
        </div>

        <div className="mt-auto pt-6">
          <OndeAssistir providers={movie.providers} fetchedAt={movie.fetchedAt} />
        </div>
      </div>
    </div>
  );
}
