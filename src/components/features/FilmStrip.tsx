"use client";

import { useEffect, useState } from "react";

import { fotogramaProcedural } from "@/lib/mock";
import { trailerEmbedUrl } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";

/**
 * A tira de filme — o gesto que define o produto.
 *
 * Os resultados são fotogramas de uma tira real, com perfuração em cima e
 * embaixo, e a tira **rola na horizontal**: você percorre a fita.
 *
 * ── Por que o fotograma é deitado ────────────────────────────────────────────
 * Ele já foi uma coluna estreita e alta, e isso brigava com o conteúdo. Medido
 * em 02/09/2026, num viewport de 1440×900: o fotograma aberto tinha 262×558 px
 * (proporção 0,47) e o `<iframe>` do trailer, 463×725. Dentro dele o YouTube
 * encaixava o vídeo 16:9 pela largura, então o trailer renderizava a 463×260 e
 * sobravam 465 px de faixa preta. Para cobrir aquela caixa seria preciso 992 px
 * de largura — mais que o dobro do que havia.
 *
 * Aumentar a porcentagem não resolvia: só mostraria o terço central de cada
 * quadro. Um trailer 16:9 não cabe numa coluna estreita, e fotograma de 35 mm
 * também é deitado. O formato certo era o do conteúdo desde o começo.
 *
 * Agora o cartão é 16:9, igual ao `backdrop` do TMDB e igual ao trailer: o
 * mesmo retângulo serve para os dois, e o vídeo cobre sem sobra.
 */
const LARGURA = "clamp(17rem, 30vw, 24rem)";

/** O player do YouTube monta durante a transição de entrada e disputa quadros
 *  com ela. Esperar o hover assentar tira os dois do mesmo instante — e evita
 *  montar oito iframes de quem só passou o mouse atravessando a tira. */
const ESPERA_TRAILER_MS = 220;

export default function FilmStrip({ movies }: { movies: Movie[] }) {
  // `null` = nenhum aberto. No toque, o primeiro toque abre e o segundo
  // navega; no mouse, o hover do CSS já resolve e este estado só entra em
  // ação para montar o iframe.
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [tocaTrailer, setTocaTrailer] = useState(false);
  // Separado de `abertoId` de propósito: o cartão abre na hora, o vídeo espera.
  const [comTrailer, setComTrailer] = useState<number | null>(null);

  // Autoplay de vídeo e movimento ficam de fora para quem pediu menos
  // movimento. O cartão ainda abre — só não vira cinema.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplica = () => setTocaTrailer(!mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, []);

  // Nada de zerar isto quando o hover sai: o render exige `aberto` **e** este
  // id, então um valor velho aqui não mostra nada. Zerar custaria um render a
  // mais a cada saída de mouse, e o lint reclama com razão.
  useEffect(() => {
    if (abertoId == null) return;
    const t = setTimeout(() => setComTrailer(abertoId), ESPERA_TRAILER_MS);
    return () => clearTimeout(t);
  }, [abertoId]);

  return (
    <div className="moldura">
      <div className="perfuracao" aria-hidden="true" />

      {/* A rolagem vive aqui, não na página: a tira desliza, o resto fica.
          `overscroll-x-contain` impede que o gesto vaze para o histórico do
          navegador quando a fita chega ao fim. */}
      <ul className="bg-profundo tira flex list-none gap-0 overflow-x-auto overscroll-x-contain">
        {movies.map((movie, i) => {
          const aberto = abertoId === movie.tmdbId;
          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative shrink-0 border-l-2 first:border-l-0"
              style={{ width: LARGURA }}
              data-aberto={aberto || undefined}
              onMouseEnter={() => setAbertoId(movie.tmdbId)}
              onMouseLeave={() => setAbertoId(null)}
              onFocus={() => setAbertoId(movie.tmdbId)}
              onBlur={() => setAbertoId(null)}
            >
              <a
                href={`/filme/${movie.tmdbId}`}
                className="relative block aspect-video w-full outline-none"
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
                    iframes do YouTube simultâneos derrubam a página.
                    Como o cartão é 16:9 e o vídeo também, `inset-0` já cobre:
                    não há mais conta de escala, nem faixa preta. */}
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

                {/* Título deitado, porque agora há largura para ele. Na coluna
                    estreita ele precisava girar 90°; aqui isso seria manha sem
                    motivo. Some quando o cartão abre: ali o motivo assume, e os
                    dois no mesmo canto se sobrepunham. */}
                <span
                  className="pointer-events-none absolute right-4 bottom-4 left-4 opacity-100 transition-opacity duration-300 data-[on]:opacity-0"
                  data-on={aberto || undefined}
                >
                  <span className="text-papel font-display block text-[clamp(1.1rem,2vw,1.6rem)] leading-[0.95] font-medium tracking-tight uppercase">
                    {movie.title}
                  </span>
                  {movie.year && (
                    <span className="text-papel/60 font-display mt-1 block text-xs tracking-[0.14em]">
                      {movie.year}
                    </span>
                  )}
                </span>

                {/* Metadado só aparece no fotograma aberto: em repouso a tira
                    tem que ler como imagem, não como tabela. */}
                <span
                  className="absolute right-4 bottom-4 left-4 flex flex-col gap-2 opacity-0 transition-opacity duration-300 data-[on]:opacity-100"
                  data-on={aberto || undefined}
                >
                  <span className="flex flex-wrap gap-1.5">
                    {movie.runtime && <Selo>{`${movie.runtime} min`}</Selo>}
                    {movie.ageRating && <Selo>{movie.ageRating}</Selo>}
                    {movie.year && <Selo>{String(movie.year)}</Selo>}
                  </span>
                  <span className="text-papel/90 text-sm leading-snug font-medium">
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
