"use client";

import { useEffect, useState } from "react";

import { fotogramaProcedural } from "@/lib/mock";
import { trailerEmbedUrl } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";

/**
 * A tira de filme — o gesto que define o produto.
 *
 * Os resultados não são uma grade de cartões: são fotogramas de uma tira, com
 * perfuração em cima e embaixo. Em repouso tudo é cinza; sob foco o fotograma
 * dobra de largura, a cor volta e o trailer sobe. Cor é recompensa por
 * atenção — regra herdada do sistema da República Pureza.
 *
 * A largura é o feedback: como a base é `flex-grow`, as colunas vizinhas
 * cedem espaço e o layout inteiro reage. Largura fixa não produziria isso.
 */
export default function FilmStrip({ movies }: { movies: Movie[] }) {
  // `null` = nenhum aberto. No toque, o primeiro toque abre e o segundo
  // navega; no mouse, o hover do CSS já resolve e este estado só entra em
  // ação para montar o iframe.
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [tocaTrailer, setTocaTrailer] = useState(false);

  // Autoplay de vídeo e movimento ficam de fora para quem pediu menos
  // movimento. A coluna ainda abre — só não vira cinema.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplica = () => setTocaTrailer(!mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, []);

  return (
    <div className="moldura overflow-hidden">
      <div className="perfuracao" aria-hidden="true" />

      <ul className="bg-profundo flex h-[62vh] min-h-[420px] list-none">
        {movies.map((movie, i) => {
          const aberto = abertoId === movie.tmdbId;
          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative border-l-2 first:border-l-0"
              data-aberto={aberto || undefined}
              onMouseEnter={() => setAbertoId(movie.tmdbId)}
              onMouseLeave={() => setAbertoId(null)}
              onFocus={() => setAbertoId(movie.tmdbId)}
              onBlur={() => setAbertoId(null)}
            >
              <a
                href={`/filme/${movie.tmdbId}`}
                className="absolute inset-0 block outline-none"
                data-cursor="abrir ficha"
                aria-label={`${movie.title}, ${movie.year ?? "ano desconhecido"}`}
              >
                {/* Fotograma. Sem backdrop no TMDB — comum em título obscuro
                    — cai no gradiente procedural derivado do id. */}
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={
                    movie.backdropUrl
                      ? { backgroundImage: `url(${movie.backdropUrl})` }
                      : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                  }
                />

                {/* O trailer só é montado para o fotograma sob foco. Oito
                    iframes do YouTube simultâneos derrubam a página. */}
                {aberto && tocaTrailer && movie.trailerKey && (
                  <span className="absolute inset-0 overflow-hidden">
                    <iframe
                      src={trailerEmbedUrl(movie.trailerKey)}
                      title={`Trailer de ${movie.title}`}
                      allow="autoplay; encrypted-media"
                      className="pointer-events-none absolute top-1/2 left-1/2 h-[130%] w-[178%] -translate-x-1/2 -translate-y-1/2"
                    />
                  </span>
                )}

                <span className="scrim absolute inset-0" />

                {/* Título vertical, no lugar onde a República Pureza põe o
                    ano — aqui é o nome do filme, que era o pedido.
                    `vertical-rl` mais `rotate(180deg)` dá leitura de baixo
                    para cima com suporte universal; `sideways-lr` faria o
                    mesmo em uma linha, mas ainda não é seguro fora do Chrome.
                    O wrapper com altura do fotograma e `items-end` é o que
                    ancora o texto embaixo — sem ele o bloco vazava para fora
                    da moldura, por cima da perfuração.
                    Some quando o fotograma abre: ali o motivo assume, e os
                    dois no mesmo canto se sobrepunham. */}
                <span
                  className="pointer-events-none absolute inset-y-4 right-3 flex max-h-full items-end overflow-hidden opacity-100 transition-opacity duration-300 data-[on]:opacity-0"
                  data-on={aberto || undefined}
                >
                  <span className="text-papel font-display rotate-180 text-[clamp(1.25rem,2.6vw,2.25rem)] leading-none font-medium tracking-tight uppercase [writing-mode:vertical-rl]">
                    {movie.title}
                  </span>
                </span>

                {/* Metadado só aparece no fotograma aberto: em repouso a tira
                    tem que ler como imagem, não como tabela. */}
                <span
                  className="absolute bottom-4 left-4 flex flex-col gap-2 opacity-0 transition-opacity duration-300 data-[on]:opacity-100"
                  data-on={aberto || undefined}
                >
                  <span className="flex gap-1.5">
                    {movie.runtime && <Selo>{`${movie.runtime} min`}</Selo>}
                    {movie.ageRating && <Selo>{movie.ageRating}</Selo>}
                    {movie.year && <Selo>{String(movie.year)}</Selo>}
                  </span>
                  <span className="text-papel/90 max-w-[28ch] text-sm leading-snug font-medium">
                    {movie.reason}
                  </span>
                </span>
              </a>

              {/* Numeração da posição — a curadoria é ordenada por
                  relevância, e mostrar isso é honesto sobre o que a lista é. */}
              <span
                className="text-papel/40 font-display absolute top-3 left-3 text-xs"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
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
    <span className="bg-papel/25 text-papel rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}
