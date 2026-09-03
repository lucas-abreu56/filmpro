"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { fotogramaProcedural } from "@/lib/mock";
import { trailerEmbedUrl } from "@/lib/tmdb";
import type { Movie, ProviderType, WatchProvider } from "@/lib/types";
import { useMedia } from "@/lib/useMedia";

/**
 * A tira de filme.
 *
 * ── Dois desenhos, e o corte é em 64rem ──────────────────────────────────────
 * No celular a fita empilha e sangra até as bordas: o polegar rola para cima,
 * não para o lado, e a imagem grande é o que faz a tela valer. Esse desenho
 * ficou bom e não mudou.
 *
 * No computador ela vira **mesa de montagem**: uma projeção grande em cima,
 * com a ficha ao lado, e embaixo a fita inteira em fotogramas pequenos entre
 * duas perfurações. Antes eram cartões largos numa fileira rolável, e de oito
 * filmes apareciam três — a coleção dizia "8 filmes" e a tela desmentia. Aqui
 * os oito cabem de uma vez, e o filme escolhido ganha uma área muito maior do
 * que qualquer cartão poderia ter.
 *
 * ── Por que o trailer saiu do hover dos cartões ──────────────────────────────
 * Medido em 03/09/2026, Chrome 152, janela de 1440×900, perfil limpo: quando o
 * trailer nascia sob o mouse, a página congelava 2,67 s — 6 medições, de 2661 a
 * 2692 ms. **Nada disso é JavaScript**: o PerformanceObserver não viu uma única
 * long task, e o trace mostra uma GPUTask sozinha de 2676 ms no processo de
 * GPU, com os workers do ANGLE ao lado. Não é rede: reproduz com o YouTube
 * inteiro bloqueado. Não é nosso CSS: o grão, o cinza e o scrim não reproduzem
 * numa página nua.
 *
 * O que dá para afirmar é que o custo chega quando o trailer ENTRA. Então ele
 * deixou de entrar por acidente: varrer a fita agora troca só a imagem parada
 * da projeção, e o iframe só nasce quando alguém repousa o ponteiro na
 * projeção — que é grande, e onde ninguém está varrendo.
 */

/** O player monta durante a transição e disputa quadros com ela. Esperar o
 *  gesto assentar tira os dois do mesmo instante. */
const ESPERA_TRAILER_MS = 220;

/** Abaixo disto a projeção não tem largura para existir, e a pilha é melhor. */
const MESA = "(min-width: 64rem)";

export default function FilmStrip({ movies }: { movies: Movie[] }) {
  /** Começa `false` (o caso do toque) porque no servidor não há `matchMedia`.
   *  A tira só renderiza depois do fetch, então nada disso é hidratado. */
  const temHover = useMedia("(hover: hover) and (pointer: fine)");
  const semMovimento = useMedia("(prefers-reduced-motion: reduce)");
  const mesa = useMedia(MESA);

  if (!movies.length) return null;
  return mesa ? (
    <MesaDeMontagem movies={movies} temHover={temHover} tocaTrailer={!semMovimento} />
  ) : (
    <Pilha movies={movies} temHover={temHover} tocaTrailer={!semMovimento} />
  );
}

type Props = { movies: Movie[]; temHover: boolean; tocaTrailer: boolean };

// ────────────────────────────────────────────────────────────────────────────
// Computador: projeção em cima, fita embaixo
// ────────────────────────────────────────────────────────────────────────────

function MesaDeMontagem({ movies, temHover, tocaTrailer }: Props) {
  const [escolhidoId, setEscolhidoId] = useState<number | null>(null);
  const [pedido, setPedido] = useState<number | null>(null);
  const [rodandoId, setRodandoId] = useState<number | null>(null);

  // Derivado, e não sincronizado por efeito: numa busca nova o id anterior
  // simplesmente não está mais na lista, e a projeção volta para o primeiro.
  const filme = movies.find((m) => m.tmdbId === escolhidoId) ?? movies[0];

  // Nada de zerar `rodandoId` quando o pedido sai: o render exige `pedido`
  // **e** este id, então um valor velho não mostra nada — e zerar aqui seria
  // setState dentro de efeito, que encadeia render à toa.
  useEffect(() => {
    if (pedido == null) return;
    const t = setTimeout(() => setRodandoId(pedido), ESPERA_TRAILER_MS);
    return () => clearTimeout(t);
  }, [pedido]);

  /** Escolher outro filme sempre desmonta o trailer: o iframe é do filme que
   *  está em projeção, e trocar os dois no mesmo quadro pisca. */
  function projetar(id: number) {
    setEscolhidoId(id);
    setPedido(null);
  }

  const rodando =
    pedido != null && rodandoId === filme.tmdbId && tocaTrailer && !!filme.trailerKey;
  const meta = [filme.director, filme.year, filme.runtime && `${filme.runtime} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="moldura bg-profundo">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── A projeção ─────────────────────────────────────────────────── */}
        <button
          type="button"
          aria-label={rodando ? `Parar o trailer de ${filme.title}` : `Ver o trailer de ${filme.title}`}
          data-cursor={filme.trailerKey ? (rodando ? "parar" : "ver trailer") : undefined}
          // `h-full`, e nao `aspect-video`: quem manda na altura da linha e a
          // ficha, que estica quando o texto quebra mais — a 1024 px sobravam
          // 127 px de tarja escura sob a imagem. A imagem parada cobre a
          // celula inteira; o trailer, esse sim, fica preso em 16:9 e
          // centrado, com a propria imagem servindo de matte em cima e
          // embaixo. Esticar o video para preencher deformaria o quadro.
          className="relative block h-full min-h-[16rem] w-full cursor-pointer overflow-hidden outline-none"
          onMouseEnter={temHover && filme.trailerKey ? () => setPedido(filme.tmdbId) : undefined}
          onMouseLeave={temHover ? () => setPedido(null) : undefined}
          // Com hover e clique ligados juntos, entrar com o mouse abria e o
          // clique em seguida fechava. Medido; por isso são exclusivos.
          onClick={
            temHover || !filme.trailerKey
              ? undefined
              : () => setPedido(rodando ? null : filme.tmdbId)
          }
        >
          <span
            key={filme.tmdbId}
            className="absolute inset-0 bg-cover bg-center"
            style={
              filme.backdropUrl
                ? { backgroundImage: `url(${filme.backdropUrl})` }
                : { backgroundImage: fotogramaProcedural(filme.tmdbId) }
            }
          />

          {rodando && filme.trailerKey && (
            <span className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2 overflow-hidden">
              <iframe
                src={trailerEmbedUrl(filme.trailerKey)}
                title={`Trailer de ${filme.title}`}
                allow="autoplay; encrypted-media"
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            </span>
          )}

          <span className="scrim absolute inset-0" />

          {filme.trailerKey && (
            <span
              className="text-papel/75 font-display absolute right-5 bottom-4 text-[11px] tracking-[0.16em] uppercase transition-opacity duration-300 data-[on]:opacity-0"
              data-on={rodando || undefined}
              aria-hidden="true"
            >
              ▶ trailer
            </span>
          )}
        </button>

        {/* ── A ficha ────────────────────────────────────────────────────── */}
        <div className="bg-papel text-tinta flex flex-col gap-3 px-8 py-7">
          <p className="text-apoio font-display text-[11px] tracking-[0.16em] uppercase">
            Em projeção
          </p>

          <div>
            <h3 className="font-display text-[clamp(1.6rem,2.4vw,2.4rem)] leading-[0.92] font-medium tracking-tight uppercase">
              {filme.title}
            </h3>
            {filme.originalTitle && filme.originalTitle !== filme.title && (
              <p className="text-apoio mt-1 text-sm italic">{filme.originalTitle}</p>
            )}
            {meta && (
              <p className="text-apoio mt-2 text-[11px] tracking-[0.08em] uppercase">{meta}</p>
            )}
          </div>

          {/* A única frase que o modelo escreve. É a tese do produto, então
              tem o corpo maior da ficha e nunca depende de um gesto. */}
          <p className="text-tinta/85 text-[15px] leading-relaxed">{filme.reason}</p>

          <div className="flex flex-wrap items-center gap-2">
            {filme.ageRating && <Selo>{filme.ageRating}</Selo>}
            {filme.genres.slice(0, 3).map((g) => (
              <Selo key={g}>{g}</Selo>
            ))}
            {filme.imdbRating && <Selo>{`IMDb ${filme.imdbRating}`}</Selo>}
          </div>

          <OndeAssistir providers={filme.providers} fetchedAt={filme.fetchedAt} />

          <div className="mt-auto flex items-center justify-between pt-2">
            <Link
              href={`/filme/${filme.tmdbId}`}
              className="text-tinta hover:text-acento focus-visible:text-acento font-display text-[11px] font-bold tracking-[0.12em] uppercase transition-colors"
            >
              Ficha Completa
            </Link>

            <a
              href={filme.tmdbUrl}
              target="_blank"
              rel="noreferrer"
              data-cursor="abrir no TMDB"
              className="text-apoio hover:text-acento focus-visible:text-acento font-display text-[11px] tracking-[0.12em] uppercase"
            >
              TMDB ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── A fita ───────────────────────────────────────────────────────── */}
      <div className="perfuracao" aria-hidden="true" />

      <ul className="bg-profundo tira flex list-none overflow-x-auto overscroll-x-contain">
        {movies.map((movie, i) => {
          const ativo = movie.tmdbId === filme.tmdbId;
          return (
            <li
              key={movie.tmdbId}
              className="border-profundo min-w-[7rem] flex-1 basis-0 border-l-2 first:border-l-0"
            >
              <button
                type="button"
                aria-current={ativo || undefined}
                aria-label={`Projetar ${movie.title}`}
                data-cursor="projetar"
                data-ativo={ativo || undefined}
                className="fotograma-mini relative block aspect-video w-full cursor-pointer outline-none"
                onMouseEnter={temHover ? () => projetar(movie.tmdbId) : undefined}
                onClick={() => projetar(movie.tmdbId)}
                onFocus={() => projetar(movie.tmdbId)}
              >
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={
                    movie.backdropUrl
                      ? { backgroundImage: `url(${movie.backdropUrl})` }
                      : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                  }
                />
                <span className="scrim absolute inset-0" />

                <span
                  className="text-papel/45 font-display absolute top-2 left-3 text-[10px]"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="text-papel font-display absolute right-3 bottom-2 left-3 line-clamp-2 text-left text-[13px] leading-[1.08] tracking-tight uppercase">
                  {movie.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="perfuracao" aria-hidden="true" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Celular e tablet: a pilha que já estava boa
// ────────────────────────────────────────────────────────────────────────────

function Pilha({ movies, temHover, tocaTrailer }: Props) {
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [comTrailer, setComTrailer] = useState<number | null>(null);

  useEffect(() => {
    if (abertoId == null) return;
    const t = setTimeout(() => setComTrailer(abertoId), ESPERA_TRAILER_MS);
    return () => clearTimeout(t);
  }, [abertoId]);

  return (
    // `-mx-6` desfaz o respiro lateral da página: na MUBI a imagem encosta na
    // borda, e dentro da margem ela ficava pequena demais (304 px de 390).
    // Acima de 40rem a pilha para de sangrar e se centra: um fotograma de
    // 900 px de largura não é generoso, é desproporcional.
    <div className="moldura -mx-6 sm:mx-auto sm:max-w-[34rem]">
      <div className="perfuracao" aria-hidden="true" />

      <ul className="bg-profundo flex list-none flex-col overflow-visible">
        {movies.map((movie, i) => {
          const aberto = abertoId === movie.tmdbId;
          const meta = [movie.director, movie.year, movie.runtime && `${movie.runtime} min`]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative w-full border-t-2 first:border-t-0"
              data-aberto={aberto || undefined}
              onMouseEnter={temHover ? () => setAbertoId(movie.tmdbId) : undefined}
              onMouseLeave={temHover ? () => setAbertoId(null) : undefined}
            >
              {/* Botão, e não link: a rota `/filme/{id}` nunca existiu, e o
                  cartão apontar para 404 foi defeito real em produção. */}
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
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={
                    movie.backdropUrl
                      ? { backgroundImage: `url(${movie.backdropUrl})` }
                      : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                  }
                />

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

                {movie.trailerKey && (
                  <span
                    className="text-papel/70 font-display absolute top-3 right-4 text-[10px] tracking-[0.14em] uppercase transition-opacity duration-300 data-[on]:opacity-0"
                    data-on={aberto || undefined}
                    aria-hidden="true"
                  >
                    ▶ trailer
                  </span>
                )}
              </button>

              <div className="bg-papel text-tinta flex flex-col gap-1.5 px-6 py-4">
                <h3 className="font-display text-[clamp(1.15rem,4.5vw,1.5rem)] leading-[0.95] font-medium tracking-tight uppercase">
                  {movie.title}
                </h3>

                {meta && (
                  <p className="text-apoio text-[11px] tracking-[0.08em] uppercase">{meta}</p>
                )}

                <p className="text-tinta/85 mt-1 text-sm leading-relaxed">{movie.reason}</p>

                <OndeAssistir providers={movie.providers} fetchedAt={movie.fetchedAt} />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {movie.ageRating && <Selo>{movie.ageRating}</Selo>}
                  {movie.genres.slice(0, 2).map((g) => (
                    <Selo key={g}>{g}</Selo>
                  ))}
                  {movie.imdbRating && <Selo>{`IMDb ${movie.imdbRating}`}</Selo>}
                  
                  <div className="ml-auto flex items-center gap-4">
                    <Link
                      href={`/filme/${movie.tmdbId}`}
                      className="text-tinta hover:text-acento focus-visible:text-acento font-display text-[11px] font-bold tracking-[0.12em] uppercase transition-colors"
                    >
                      Ficha
                    </Link>
                    <a
                      href={movie.tmdbUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-cursor="abrir no TMDB"
                      className="text-apoio hover:text-acento focus-visible:text-acento font-display text-[11px] tracking-[0.12em] uppercase"
                    >
                      TMDB ↗
                    </a>
                  </div>
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

// ────────────────────────────────────────────────────────────────────────────
// Onde assistir
// ────────────────────────────────────────────────────────────────────────────

/**
 * Os cinco tipos do TMDB, na ordem em que interessam a quem vai assistir hoje.
 * Assinatura primeiro; comprar por último, porque é o que menos gente faz.
 */
const TIPOS: { tipo: ProviderType; rotulo: string }[] = [
  { tipo: "flatrate", rotulo: "No catálogo" },
  { tipo: "free", rotulo: "De graça" },
  { tipo: "ads", rotulo: "Grátis com anúncio" },
  { tipo: "rent", rotulo: "Aluguel" },
  { tipo: "buy", rotulo: "Compra" },
];

/**
 * "Onde assistir no Brasil", com a data em que o dado foi buscado.
 *
 * A data não é enfeite: o cache de fatos vive 90 dias, e catálogo de streaming
 * muda toda semana. Dizer "verificado em 12/08" é honesto; mostrar o logo da
 * Netflix sem data seria afirmar sobre hoje uma coisa medida em agosto.
 *
 * Três dos oito filmes da coleção de teste não têm provedor nenhum no Brasil.
 * Isso aparece escrito, e não como um espaço vazio: some sem explicação é o
 * tipo de silêncio que faz a pessoa achar que a página quebrou.
 */
export function OndeAssistir({
  providers,
  fetchedAt,
}: {
  providers: WatchProvider[];
  fetchedAt: string;
}) {
  const grupos = TIPOS.map(({ tipo, rotulo }) => ({
    rotulo,
    lista: providers.filter((p) => p.type === tipo),
  })).filter((g) => g.lista.length);

  const dia = new Date(fetchedAt);
  const data = Number.isNaN(dia.getTime())
    ? null
    : dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (!grupos.length) {
    return (
      <p className="text-apoio mt-1 text-xs">
        Sem streaming no Brasil segundo o TMDB{data && ` em ${data}`}.
      </p>
    );
  }

  return (
    <div className="border-fio mt-1 border-t pt-3">
      <p className="text-apoio font-display text-[11px] tracking-[0.16em] uppercase">
        Onde assistir
      </p>

      <ul className="mt-2 flex list-none flex-col gap-1.5">
        {grupos.map(({ rotulo, lista }) => (
          <li key={rotulo} className="flex items-center gap-2">
            <span className="text-apoio w-[9.5rem] shrink-0 text-[11px]">{rotulo}</span>
            <span className="flex flex-wrap items-center gap-1">
              {lista.slice(0, 5).map((p) => (
                <Logo key={`${rotulo}-${p.name}`} provedor={p} />
              ))}
              {lista.length > 5 && (
                <span className="text-apoio text-[11px]">+{lista.length - 5}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {data && <p className="text-apoio/70 mt-2 text-[10px]">Verificado em {data}</p>}
    </div>
  );
}

/** O logo é o reconhecimento imediato; o nome fica no `title` e no leitor de
 *  tela. Sem logo — acontece — o nome vira o próprio selo. */
function Logo({ provedor }: { provedor: WatchProvider }) {
  if (!provedor.logoUrl) return <Selo>{provedor.name}</Selo>;
  return (
    // Logo de 24 px vindo do CDN do TMDB, com o tamanho já pedido na URL
    // (`w92`). Passar isso pelo otimizador da Vercel gastaria invocação de
    // função para economizar quilobyte nenhum.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={provedor.logoUrl}
      alt={provedor.name}
      title={provedor.name}
      width={24}
      height={24}
      loading="lazy"
      className="border-fio h-6 w-6 rounded-[4px] border object-cover"
    />
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-fio text-apoio rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}
