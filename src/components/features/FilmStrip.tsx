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
 * sobravam 465 px de faixa preta.
 *
 * Um trailer 16:9 não cabe numa coluna estreita, e fotograma de 35 mm também é
 * deitado. O cartão agora é 16:9, igual ao `backdrop` e igual ao trailer: o
 * mesmo retângulo serve para os dois, e o vídeo cobre sem sobra.
 *
 * ── Por que o cartão não é um link ───────────────────────────────────────────
 * Ele já foi `<a href="/filme/{id}">`. Essa rota **nunca existiu** — medido em
 * produção em 02/09/2026: `/filme/274` e `/filme/550` respondiam 404. Todo
 * cartão do site era um link morto.
 *
 * Enquanto a ficha não existe, o cartão abre no lugar e oferece o TMDB como
 * saída real. Quando `/filme/[tmdbId]` for construída, ele volta a ser link e
 * este comentário sai junto.
 */

/**
 * Largura do cartão. Uma única `clamp` cobre da tela do celular à do desktop:
 * em 390 px o `78vw` manda e o cartão ocupa quase a largura toda, deixando
 * espiar o próximo; do tablet para cima o teto de 20rem assume e cabem três.
 * Antes o teto era 24rem e cabiam 2,5 — pouca fita à vista para escolher.
 */
const LARGURA = "clamp(16rem, 78vw, 20rem)";

/** O player do YouTube monta durante a transição de entrada e disputa quadros
 *  com ela. Esperar o hover assentar tira os dois do mesmo instante — e evita
 *  montar oito iframes de quem só passou o mouse atravessando a tira. */
const ESPERA_TRAILER_MS = 220;

export default function FilmStrip({ movies }: { movies: Movie[] }) {
  // `null` = nenhum aberto.
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [tocaTrailer, setTocaTrailer] = useState(false);
  /**
   * Se o aparelho tem hover de verdade. Decide **qual** gesto abre o cartão, e
   * os dois não podem coexistir: com hover e clique ligados juntos, entrar com
   * o mouse abre e o clique em seguida fecha — medido, o cartão ficava fechado
   * sob o cursor até você sair e voltar.
   *
   * Começa `false` (o caso do toque) porque no servidor não há `matchMedia`, e
   * assumir toque é o padrão seguro: no pior caso o primeiro render entrega o
   * gesto que funciona em qualquer lugar.
   */
  const [temHover, setTemHover] = useState(false);
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

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const aplica = () => setTemHover(mq.matches);
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
      <ul className="bg-profundo tira flex list-none overflow-x-auto overscroll-x-contain">
        {movies.map((movie, i) => {
          const aberto = abertoId === movie.tmdbId;
          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative aspect-video shrink-0 border-l-2 first:border-l-0"
              style={{ width: LARGURA }}
              data-aberto={aberto || undefined}
              onMouseEnter={temHover ? () => setAbertoId(movie.tmdbId) : undefined}
              onMouseLeave={temHover ? () => setAbertoId(null) : undefined}
            >
              {/* Botão, não link: no toque não existe hover, e sem isto o
                  `reason` — que é a tese do produto — era invisível no celular.
                  Medido: `(hover: hover)` é falso em 390 px e em 768 px.
                  Agora um toque abre, e o foco do teclado abre igual. */}
              <button
                type="button"
                aria-expanded={aberto}
                aria-label={
                  aberto
                    ? `Fechar ${movie.title}`
                    : `${movie.title}, ${movie.year ?? "ano desconhecido"} — ver por que foi escolhido`
                }
                data-cursor={aberto ? "fechar" : "por que este"}
                className="absolute inset-0 block w-full cursor-pointer text-left outline-none"
                onClick={temHover ? undefined : () => setAbertoId(aberto ? null : movie.tmdbId)}
                onFocus={() => setAbertoId(movie.tmdbId)}
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

                {/* O trailer só é montado para o cartão aberto: oito iframes do
                    YouTube simultâneos derrubam a página. Como o cartão é 16:9
                    e o vídeo também, `inset-0` já cobre — sem conta de escala,
                    sem faixa preta. */}
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

                {/* Título deitado, porque agora há largura para ele. Some
                    quando o cartão abre: ali o motivo assume, e os dois no
                    mesmo canto se sobrepunham. */}
                <span
                  className="pointer-events-none absolute right-4 bottom-4 left-4 opacity-100 transition-opacity duration-300 data-[on]:opacity-0"
                  data-on={aberto || undefined}
                >
                  <span className="text-papel font-display block text-[clamp(1.05rem,2vw,1.5rem)] leading-[0.95] font-medium tracking-tight uppercase">
                    {movie.title}
                  </span>
                  {movie.year && (
                    <span className="text-papel/60 font-display mt-1 block text-xs tracking-[0.14em]">
                      {movie.year}
                    </span>
                  )}
                </span>

                {/* Metadado só aparece no cartão aberto: em repouso a tira tem
                    que ler como imagem, não como tabela. O `pr-16` abre espaço
                    para o link do TMDB, que mora fora do botão. */}
                <span
                  className="pointer-events-none absolute right-4 bottom-4 left-4 flex flex-col gap-2 pr-16 opacity-0 transition-opacity duration-300 data-[on]:opacity-100"
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
              </button>

              {/* Fora do botão: link dentro de botão é aninhamento inválido, e
                  o leitor de tela anuncia os dois como um só. Só recebe clique
                  quando o cartão está aberto. É a "prova de que o filme
                  existe" que o projeto promete em cada card. */}
              <a
                href={movie.tmdbUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={aberto ? 0 : -1}
                aria-hidden={!aberto}
                data-cursor="abrir no TMDB"
                className="text-papel/70 hover:text-papel focus-visible:text-papel font-display absolute right-3 bottom-4 z-10 text-[11px] tracking-[0.12em] uppercase opacity-0 transition-opacity duration-300 data-[on]:pointer-events-auto data-[on]:opacity-100 pointer-events-none"
                data-on={aberto || undefined}
              >
                TMDB ↗
              </a>

              {/* Numeração da posição — a curadoria é ordenada por relevância,
                  e mostrar isso é honesto sobre o que a lista é. */}
              <span
                className="text-papel/40 font-display pointer-events-none absolute top-3 left-3 text-xs"
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
