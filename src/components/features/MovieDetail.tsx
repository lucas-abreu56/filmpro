"use client";

import { type Movie } from "@/lib/types";
import { trailerEmbedUrl } from "@/lib/tmdb";
import { OndeAssistir } from "@/components/features/FilmStrip";

export default function MovieDetail({ movie }: { movie: Movie }) {
  return (
    <div className="flex max-h-full min-h-0 flex-col overflow-y-auto sm:flex-row">
      {/* Coluna da Esquerda: Pôster ou Trailer (se houver) */}
      <div className="bg-tinta flex-shrink-0 sm:w-1/3 md:w-2/5">
        {movie.trailerKey ? (
          <div className="aspect-video w-full sm:aspect-[2/3] sm:h-full sm:w-auto relative">
            {/* O iframe do trailer pode ficar como um recorte ou ocupar a área.
                Para ficar elegante, vamos colocar o poster como fallback, mas 
                se tiver trailerKey, renderizamos o iframe no topo (mobile) ou
                na metade de cima (desktop). */}
            <iframe
              src={trailerEmbedUrl(movie.trailerKey, { autoplay: true, loop: true })}
              title={`Trailer de ${movie.title}`}
              allow="autoplay; encrypted-media"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-[2/3] w-full bg-cover bg-center"
            style={
              movie.posterUrl
                ? { backgroundImage: `url(${movie.posterUrl})` }
                : { backgroundColor: "#1c1c1c" }
            }
          />
        )}
      </div>

      {/* Coluna da Direita: Informações */}
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
          {/* A tese do projeto: Por que este filme vs Sinopse */}
          <section>
            <h3 className="text-acento font-display mb-2 text-[11px] tracking-[0.16em] uppercase">
              Por que este filme
            </h3>
            <p className="text-tinta/90 text-sm leading-relaxed">{movie.reason}</p>
          </section>

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
