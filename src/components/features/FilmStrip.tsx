"use client";

import { useEffect, useState } from "react";

import { fotogramaProcedural } from "@/lib/mock";
import { trailerEmbedUrl } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";

/**
 * A tira de filme.
 *
 * ── Duas orientações, uma estrutura ──────────────────────────────────────────
 * No computador a fita corre na horizontal e você a percorre. No celular ela
 * empilha e sangra até as bordas, porque **o polegar rola para cima, não para o
 * lado** — a própria MUBI, que usa fileiras horizontais no desktop, empilha na
 * vertical no telefone.
 *
 * ── Por que o motivo não está mais escondido ─────────────────────────────────
 * Ele já dependeu de hover, e depois de um toque. Os dois estavam errados pelo
 * mesmo motivo: `reason` é a única coisa que o modelo escreve e a tese inteira
 * do produto. Esconder justamente isso atrás de uma interação é esconder o que
 * nos diferencia. Agora ele fica no papel, sob o fotograma, sempre legível.
 * O hover e o toque passam a valer pelo que sobrou: a cor e o trailer.
 *
 * ── Por que o fotograma é deitado ────────────────────────────────────────────
 * Ele já foi uma coluna estreita e alta. Medido em 02/09/2026, a 1440×900: o
 * cartão aberto tinha 262×558 e o trailer renderizava a 463×260 dentro de um
 * iframe de 463×725 — 465 px de faixa preta. Um vídeo 16:9 não cabe numa coluna
 * estreita, e fotograma de 35 mm também é deitado.
 */

/** Largura do cartão no computador. No celular ele ocupa a tela toda. */
const LARGURA = "clamp(16rem, 78vw, 20rem)";

/** O player do YouTube monta durante a transição e disputa quadros com ela.
 *  Esperar o gesto assentar tira os dois do mesmo instante — e evita montar
 *  oito iframes de quem só atravessou a fita com o mouse. */
const ESPERA_TRAILER_MS = 220;

export default function FilmStrip({ movies }: { movies: Movie[] }) {
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [tocaTrailer, setTocaTrailer] = useState(false);
  const [comTrailer, setComTrailer] = useState<number | null>(null);
  /**
   * Se o aparelho tem hover de verdade. Decide qual gesto pede o trailer, e os
   * dois não podem coexistir: com hover e clique ligados juntos, entrar com o
   * mouse abria e o clique em seguida fechava — medido.
   *
   * Começa `false` (o caso do toque) porque no servidor não há `matchMedia`.
   */
  const [temHover, setTemHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplica = () => setTocaTrailer(!mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const aplica = () => setTemHover(mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, []);

  // Nada de zerar isto quando o gesto sai: o render exige `aberto` **e** este
  // id, então um valor velho não mostra nada.
  useEffect(() => {
    if (abertoId == null) return;
    const t = setTimeout(() => setComTrailer(abertoId), ESPERA_TRAILER_MS);
    return () => clearTimeout(t);
  }, [abertoId]);

  return (
    // `-mx-6` desfaz o respiro lateral da página só no celular: na MUBI a
    // imagem encosta na borda, e dentro da margem ela ficava pequena demais
    // (medido: 304 px de 390). No computador a margem volta.
    <div className="moldura -mx-6 md:mx-0">
      <div className="perfuracao" aria-hidden="true" />

      <ul className="bg-profundo tira flex list-none flex-col overflow-visible md:flex-row md:overflow-x-auto md:overscroll-x-contain">
        {movies.map((movie, i) => {
          const aberto = abertoId === movie.tmdbId;
          const meta = [movie.director, movie.year, movie.runtime && `${movie.runtime} min`]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative w-full shrink-0 border-t-2 first:border-t-0 md:w-[var(--w)] md:border-t-0 md:border-l-2 md:first:border-l-0"
              style={{ "--w": LARGURA } as React.CSSProperties}
              data-aberto={aberto || undefined}
              onMouseEnter={temHover ? () => setAbertoId(movie.tmdbId) : undefined}
              onMouseLeave={temHover ? () => setAbertoId(null) : undefined}
            >
              {/* O fotograma. Botão porque pede o trailer — não navega: a rota
                  `/filme/{id}` nunca existiu, e o cartão apontar para 404 foi
                  defeito real, medido em produção. */}
              <button
                type="button"
                aria-expanded={aberto}
                aria-label={
                  aberto ? `Parar o trailer de ${movie.title}` : `Ver o trailer de ${movie.title}`
                }
                data-cursor={aberto ? "parar" : "ver trailer"}
                className="relative block aspect-video w-full cursor-pointer outline-none"
                onClick={temHover ? undefined : () => setAbertoId(aberto ? null : movie.tmdbId)}
                onFocus={() => setAbertoId(movie.tmdbId)}
              >
                {/* Sem backdrop no TMDB — comum em título obscuro — cai no
                    gradiente procedural derivado do id. */}
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={
                    movie.backdropUrl
                      ? { backgroundImage: `url(${movie.backdropUrl})` }
                      : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                  }
                />

                {/* Cartão e vídeo são 16:9, então `inset-0` cobre: sem conta de
                    escala, sem faixa preta. */}
                {aberto && comTrailer === movie.tmdbId && tocaTrailer && movie.trailerKey && (
                  <span className="absolute inset-0 overflow-hidden">
                    <iframe
                      src={trailerEmbedUrl(movie.trailerKey)}
                      title={`Trailer de ${movie.title}`}
                      allow="autoplay; encrypted-media"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  </span>
                )}

                <span className="scrim absolute inset-0" />

                <span
                  className="text-papel/40 font-display absolute top-3 left-4 text-xs"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Selo de "tem trailer": sem ele nada avisa que o fotograma
                    faz algo. Some quando o trailer está tocando. */}
                {movie.trailerKey && (
                  <span
                    className="text-papel/70 font-display absolute top-3 right-4 text-[10px] tracking-[0.14em] uppercase opacity-100 transition-opacity duration-300 data-[on]:opacity-0"
                    data-on={aberto || undefined}
                    aria-hidden="true"
                  >
                    ▶ trailer
                  </span>
                )}
              </button>

              {/* A legenda, sobre o papel. É aqui que mora a tese do produto, e
                  por isso ela não depende de gesto nenhum. */}
              <div className="bg-papel text-tinta flex flex-col gap-1.5 px-6 py-4 md:px-4">
                <h3 className="font-display text-[clamp(1.15rem,4.5vw,1.5rem)] leading-[0.95] font-medium tracking-tight uppercase">
                  {movie.title}
                </h3>

                {meta && (
                  <p className="text-apoio text-[11px] tracking-[0.08em] uppercase">{meta}</p>
                )}

                <p className="text-tinta/85 mt-1 text-sm leading-relaxed">{movie.reason}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {movie.ageRating && <Selo>{movie.ageRating}</Selo>}
                  {movie.genres.slice(0, 2).map((g) => (
                    <Selo key={g}>{g}</Selo>
                  ))}
                  {movie.imdbRating && <Selo>{`IMDb ${movie.imdbRating}`}</Selo>}
                  <a
                    href={movie.tmdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-cursor="abrir no TMDB"
                    className="text-apoio hover:text-acento focus-visible:text-acento font-display ml-auto text-[11px] tracking-[0.12em] uppercase"
                  >
                    TMDB ↗
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="perfuracao" aria-hidden="true" />
    </div>
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-fio text-apoio rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}
