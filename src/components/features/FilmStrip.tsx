"use client";

import { memo, useCallback, useState } from "react";
import Link from "next/link";

import { fotogramaProcedural } from "@/lib/mock";
import { backdropMenor, tmdbWatchUrl } from "@/lib/tmdb";
import type { Movie, ProviderType, WatchProvider } from "@/lib/types";
import { useMedia } from "@/lib/useMedia";

/**
 * A tira de filme.
 *
 * ── Dois desenhos, e o corte é em 64rem ─────────────────────────────────────
 * No celular a fita empilha e sangra até as bordas: o polegar rola para cima,
 * não para o lado, e a imagem grande é o que faz a tela valer.
 *
 * No computador são colunas dessaturadas entre duas perfurações. Sob o cursor
 * uma delas cresce e recupera a cor, e a legenda abaixo conta quem é. Cinco
 * cabem por vez; as outras chegam pelas setas.
 *
 * ── O trailer não mora mais aqui (03/09/2026) ───────────────────────────────
 * Ele toca só dentro da ficha. Foram duas medições que levaram a isso, e vale
 * guardar as duas porque elas explicam por que não adianta "só otimizar":
 *
 * 1. **Geometria.** Em 02/09 o vídeo dava 463×260 px numa coluna de 262 px de
 *    largura, com 465 px de tarja preta em volta. Um trailer 16:9 não cabe em
 *    coluna alta e estreita — aumentar porcentagem não resolve, é a proporção
 *    que está errada.
 * 2. **Custo.** Em 03/09, Chrome 152, 1440×900, perfil limpo: quando o trailer
 *    nascia sob o mouse a página congelava 2,67 s — 6 medições, de 2661 a
 *    2692 ms. **Nada disso é JavaScript**: o PerformanceObserver não viu uma
 *    long task sequer, e o trace mostra uma GPUTask sozinha de 2676 ms no
 *    processo de GPU, com os workers do ANGLE ao lado. Não é rede — reproduz
 *    com o YouTube inteiro bloqueado. Não é o nosso CSS — grão, cinza e scrim
 *    não reproduzem numa página nua.
 *
 * Tirar o trailer do hover dissolve os dois problemas em vez de administrá-los:
 * na ficha o quadro é horizontal por construção, e o vídeo entra uma vez, por
 * escolha de quem clicou.
 *
 * ── A altura é fixa, e isso é o ponto ───────────────────────────────────────
 * O desenho anterior punha a ficha ao lado da projeção e deixava **o texto
 * mandar na altura da linha**. Como o texto muda de filme para filme — só o
 * bloco de provedores varia de uma a três linhas —, trocar de filme rápido
 * fazia a página crescer e encolher. Agora a tira tem altura própria em
 * `clamp` e a legenda tem piso fixo. Medido depois da mudança: oito filmes,
 * uma única combinação de alturas.
 */

/** Abaixo disto a coluna não tem largura para existir, e a pilha é melhor. */
const MESA = "(min-width: 64rem)";

export default function FilmStrip({ movies }: { movies: Movie[] }) {
  /** Começa `false` (o caso do toque) porque no servidor não há `matchMedia`.
   *  A tira só renderiza depois do fetch, então nada disso é hidratado. */
  const temHover = useMedia("(hover: hover) and (pointer: fine)");
  const mesa = useMedia(MESA);

  // `prefers-reduced-motion` não aparece mais aqui: sem trailer, o que resta é
  // transição de CSS, e o bloco em `globals.css` já as neutraliza para quem
  // pediu menos movimento. Uma pergunta a menos para o JavaScript responder.
  if (!movies.length) return null;
  // A pilha não recebe `temHover`: no toque não existe gesto de atenção
  // antes do toque, e quem cuida do cinza dela é o `@media (hover)` do CSS.
  // Ela recebia e ignorava desde que o cartão do celular deixou de abrir
  // trailer — prop que ninguém lê é promessa que o tipo faz e o código não
  // cumpre.
  return mesa ? (
    <MesaDeMontagem movies={movies} temHover={temHover} />
  ) : (
    <Pilha movies={movies} />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Computador: a coluna que acorda, e a legenda que não pula
// ────────────────────────────────────────────────────────────────────────────

/**
 * Oito colunas dessaturadas. Sob o cursor uma delas cresce e recupera a cor.
 *
 * É o padrão "a coluna que acorda" do República Pureza, com as duas regras que
 * a documentação dele enuncia: **cor é recompensa por atenção** — em repouso
 * nada tem cor — e **a largura é o feedback**, não uma sombra nem uma borda.
 *
 * ── Por que a legenda vive FORA das colunas ─────────────────────────────────
 * Na referência o texto mora dentro da coluna que abre. Aqui não pode: o
 * `reason` é a única frase autoral do sistema e a tese do produto, e a regra
 * do projeto é que ele nunca dependa de um gesto. Ele desce para uma faixa
 * própria, sempre visível.
 *
 * Isso também conserta o defeito que motivou o redesenho. Antes a altura da
 * linha era ditada pelo conteúdo da ficha ao lado, que muda de filme para
 * filme — só o bloco de provedores varia de uma a três linhas. Trocar de filme
 * rápido fazia a página crescer e encolher. Agora a tira tem altura própria e
 * a legenda tem piso fixo: nenhuma das duas depende do tamanho do texto.
 *
 * ── Por que o fotograma, e não o pôster ─────────────────────────────────────
 * Cheguei a usar o pôster, por ele já nascer 2:3 e caber na coluna estreita.
 * Errado, por dois motivos que só apareceram em captura: pôster traz tipografia
 * impressa, e o corte partia o título no meio — "VALSA COM BASHI", "MARY E MA";
 * e alargar a coluna PIORA um 2:3, porque afasta ainda mais a proporção.
 *
 * O fotograma 16:9 faz o contrário. Em repouso é uma lasca vertical de uma
 * imagem larga; abrir revela mais dela. A largura vira recompensa em vez de
 * deformação, que é exatamente a lógica da referência.
 */
function MesaDeMontagem({
  movies,
  temHover,
}: {
  movies: Movie[];
  temHover: boolean;
}) {
  const [focoId, setFocoId] = useState<number | null>(null);
  const filme = movies.find((m) => m.tmdbId === focoId) ?? movies[0];

  // A tira não re-renderiza quando o foco muda — quem muda é só a legenda.
  // Sem isso, cada entrada de mouse re-renderizaria as oito colunas no meio da
  // transição de largura, que é exatamente o que já engasgou aqui uma vez.
  const aoFocar = useCallback((id: number) => setFocoId(id), []);

  return (
    <div className="w-full">
      <Tira movies={movies} temHover={temHover} aoFocar={aoFocar} />
      {/* A `key` não é organização de lista — é o gatilho da animação. Uma
          animação CSS só recomeça quando o elemento nasce de novo, e trocar a
          chave é o que faz o React remontar a legenda em vez de reaproveitá-la
          com texto diferente dentro. */}
      <Legenda key={filme.tmdbId} filme={filme} />
    </div>
  );
}

/**
 * Quantas colunas cabem de uma vez. O número não é estético, é geométrico: o
 * pôster é 2:3, e a coluna precisa chegar perto disso ou a arte é cortada no
 * meio da própria tipografia. Com os oito filmes na tela, cada coluna dava
 * ~130 px de largura para 468 px de altura — proporção 0,28 contra os 0,67 do
 * pôster, e títulos partidos ao meio ("VALSA C", "MARY E"). Com cinco, a
 * coluna fica em ~269 px para 416 px: 0,65, que é o pôster quase inteiro.
 */
const VISIVEIS = 5;

const Tira = memo(function Tira({
  movies,
  temHover,
  aoFocar,
}: {
  movies: Movie[];
  temHover: boolean;
  aoFocar: (id: number) => void;
}) {
  const [passo, setPasso] = useState(0);

  const rola = movies.length > VISIVEIS;
  const ultimoPasso = Math.max(0, movies.length - VISIVEIS);

  // A trilha é mais larga que a janela, e desliza. Não é `overflow-x: auto`:
  // rolagem nativa brigaria com a coluna que cresce no hover — mudar a largura
  // de um filho muda `scrollWidth` e a barra pula debaixo do cursor.
  const larguraTrilha = rola ? (movies.length / VISIVEIS) * 100 : 100;
  const deslocamento = rola ? (passo * 100) / movies.length : 0;

  return (
    <div className="relative">
      <div className="moldura bg-profundo overflow-hidden">
        <div className="perfuracao" aria-hidden="true" />

        {/* Altura em `clamp`, e nunca derivada do conteúdo: é esta linha que
            garante que trocar de filme não mexa na página. */}
        <ul
          className="flex h-[clamp(20rem,48vh,26rem)] list-none transition-transform duration-500 ease-[var(--ease-camera)]"
          style={{
            width: `${larguraTrilha}%`,
            transform: `translateX(-${deslocamento}%)`,
          }}
        >
          {movies.map((movie, i) => {
            // As oito colunas são renderizadas sempre, mas só `VISIVEIS` cabem
            // na janela — o resto fica fora por `translateX` dentro de um
            // `overflow: hidden`. Sem tirar as de fora da ordem de tabulação, o
            // Tab levava o foco para um link invisível e o `overflow: hidden`
            // rolava a trilha para alcançá-lo, quebrando o passo do carrossel.
            const foraDaJanela = rola && (i < passo || i >= passo + VISIVEIS);
            return (
              <li
                key={movie.tmdbId}
                className="coluna border-profundo relative border-l-2 first:border-l-0"
                aria-hidden={foraDaJanela || undefined}
                onMouseEnter={temHover ? () => aoFocar(movie.tmdbId) : undefined}
              >
                {/* Link, e não botão: a coluna leva à ficha, e ficha é uma rota.
                    Botão que navega quebra abrir em nova aba e o clique do meio. */}
                <Link
                  href={`/filme/${movie.tmdbId}`}
                  data-cursor="ver ficha"
                  tabIndex={foraDaJanela ? -1 : undefined}
                  onFocus={() => aoFocar(movie.tmdbId)}
                  className="absolute inset-0 block overflow-hidden outline-none"
                >
                  <span
                    className="absolute inset-0 bg-cover bg-center"
                    style={
                      movie.backdropUrl ?? movie.posterUrl
                        ? {
                            backgroundImage: `url(${
                              movie.backdropUrl
                                ? backdropMenor(movie.backdropUrl)
                                : movie.posterUrl
                            })`,
                          }
                        : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                    }
                  />
                  <span className="scrim absolute inset-0" />

                  <span
                    className="text-papel/50 font-display absolute top-3 left-3 text-[11px]"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="absolute inset-x-3 bottom-3">
                    <span className="text-papel font-display line-clamp-2 block text-[13px] leading-[1.05] tracking-tight uppercase">
                      {movie.title}
                    </span>
                    {movie.year && (
                      <span
                        className="coluna-ano text-papel/60 font-display mt-1 block text-[11px] tracking-[0.12em]"
                        aria-hidden="true"
                      >
                        {movie.year}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="perfuracao" aria-hidden="true" />
      </div>

      {rola && (
        <>
          <Seta
            lado="esquerda"
            desabilitada={passo === 0}
            aoClicar={() => setPasso((p) => Math.max(0, p - 1))}
          />
          <Seta
            lado="direita"
            desabilitada={passo >= ultimoPasso}
            aoClicar={() => setPasso((p) => Math.min(ultimoPasso, p + 1))}
          />
        </>
      )}
    </div>
  );
});

/** Fora da moldura, sobre o papel: dentro dela a seta cairia em cima do
 *  fotograma e disputaria a leitura com a imagem. */
function Seta({
  lado,
  desabilitada,
  aoClicar,
}: {
  lado: "esquerda" | "direita";
  desabilitada: boolean;
  aoClicar: () => void;
}) {
  const esquerda = lado === "esquerda";
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitada}
      aria-label={esquerda ? "Filmes anteriores" : "Próximos filmes"}
      className={`border-fio bg-papel text-tinta hover:border-acento hover:text-acento disabled:text-fio-forte absolute top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border text-sm transition-colors disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--color-fio)] ${
        esquerda ? "-left-5" : "-right-5"
      }`}
    >
      {esquerda ? "←" : "→"}
    </button>
  );
}

/**
 * O filme em foco, por extenso. O `min-h` é o que trava a altura da página —
 * sem ele voltaríamos ao defeito, só que um andar abaixo.
 *
 * ── Por que ela entra, em vez de só trocar ──────────────────────────────────
 * A coluna lá em cima responde ao mouse abrindo; aqui embaixo o texto trocava
 * no mesmo quadro, no mesmo pixel. Duas respostas ao mesmo gesto, e só uma
 * parecia intencional — a outra parecia a página se corrigindo.
 *
 * Entram escalonados, na ordem em que se lê: título, motivo do curador, selos.
 * Os dois links do rodapé ficam de fora de propósito: eles apontam para o filme
 * em foco, mas o rótulo nunca muda, e piscar texto que não mudou é ruído.
 *
 * Quem pediu `prefers-reduced-motion: reduce` não vê nada disso — o bloco no
 * fim do `globals.css` zera a duração de toda animação da página.
 */
function Legenda({ filme }: { filme: Movie }) {
  const meta = [filme.director, filme.year, filme.runtime && `${filme.runtime} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="legenda-entra border-fio mt-6 flex min-h-[12.5rem] flex-col gap-3 border-t pt-6">
      <div className="surge flex items-start justify-between gap-8">
        <div className="min-w-0">
          <h3 className="font-display text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[0.92] font-medium tracking-tight uppercase">
            {filme.title}
          </h3>
          {meta && (
            <p className="text-apoio mt-2 text-[11px] tracking-[0.08em] uppercase">{meta}</p>
          )}
        </div>

        {/* Numeral grande e alinhado à direita, como a MUBI põe a nota: número
            é dado, não rótulo, então ele tem corpo próprio. */}
        {filme.imdbRating && (
          <p className="font-display shrink-0 text-right leading-none">
            <span className="text-[1.75rem] tabular-nums">{filme.imdbRating}</span>
            <span className="text-apoio ml-1.5 text-[10px] tracking-[0.14em] uppercase">
              IMDb
            </span>
          </p>
        )}
      </div>

      {/* Três linhas, no máximo. O schema já limita `reason` a 220 caracteres,
          mas quem garante a altura é o clamp — não a confiança no dado. */}
      <p className="surge surge-2 text-tinta/85 line-clamp-3 max-w-[68ch] text-[15px] leading-relaxed">
        {filme.reason}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <span className="surge surge-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {filme.ageRating && <Selo>{filme.ageRating}</Selo>}
          {filme.genres.slice(0, 3).map((g) => (
            <Selo key={g}>{g}</Selo>
          ))}

          <ProvedoresEmLinha providers={filme.providers} tmdbId={filme.tmdbId} />
        </span>

        <span className="ml-auto flex items-center gap-5">
          <Link
            href={`/filme/${filme.tmdbId}`}
            className="text-tinta hover:text-acento focus-visible:text-acento font-display text-[11px] font-bold tracking-[0.12em] uppercase transition-colors"
          >
            Ficha completa →
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
        </span>
      </div>
    </div>
  );
}

/**
 * Provedores em UMA linha, só os logos.
 *
 * O bloco completo — rótulo por tipo, uma linha para cada — varia de uma a três
 * linhas conforme o filme, e era o maior responsável por a altura pular. Aqui
 * fica o reconhecimento imediato; o agrupamento por tipo, com "aluguel" e
 * "compra" separados, continua inteiro na ficha.
 */
function ProvedoresEmLinha({
  providers,
  tmdbId,
}: {
  providers: WatchProvider[];
  tmdbId: number;
}) {
  const vistos = new Set<string>();
  const unicos = providers.filter((p) => {
    if (vistos.has(p.name)) return false;
    vistos.add(p.name);
    return true;
  });

  // Ausência é informação, e aparece escrita: sumir sem explicação faz a pessoa
  // achar que a página quebrou.
  if (!unicos.length) {
    return <span className="text-apoio text-[11px]">Sem streaming no Brasil</span>;
  }

  const ondeAssistir = tmdbWatchUrl(tmdbId);

  return (
    <span className="flex items-center">
      <span className="text-apoio font-display mr-1 text-[10px] tracking-[0.14em] uppercase">
        Onde assistir
      </span>
      {unicos.slice(0, 6).map((p) => (
        <Logo key={p.name} provedor={p} href={ondeAssistir} />
      ))}
      {unicos.length > 6 && (
        <a
          href={ondeAssistir}
          target="_blank"
          rel="noreferrer"
          data-cursor="onde assistir"
          className="text-apoio hover:text-acento focus-visible:text-acento p-2 text-[11px]"
        >
          +{unicos.length - 6}
        </a>
      )}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Celular e tablet: a pilha que já estava boa
// ────────────────────────────────────────────────────────────────────────────

function Pilha({ movies }: { movies: Movie[] }) {
  return (
    // `-mx-6` desfaz o respiro lateral da página: na MUBI a imagem encosta na
    // borda, e dentro da margem ela ficava pequena demais (304 px de 390).
    // Acima de 40rem a pilha para de sangrar e se centra: um fotograma de
    // 900 px de largura não é generoso, é desproporcional.
    <div className="moldura -mx-6 sm:mx-auto sm:max-w-[34rem]">
      <div className="perfuracao" aria-hidden="true" />

      <ul className="bg-profundo flex list-none flex-col overflow-visible">
        {movies.map((movie, i) => {
          const meta = [movie.director, movie.year, movie.runtime && `${movie.runtime} min`]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={movie.tmdbId}
              className="fotograma border-profundo relative w-full border-t-2 first:border-t-0"
            >
              {/* Link, e não botão: agora o gesto leva à ficha, e ficha é uma
                  rota. O comentário antigo dizia que `/filme/{id}` "nunca
                  existiu" — existe desde 03/09/2026, e é para lá que o trailer
                  mudou. */}
              <Link
                href={`/filme/${movie.tmdbId}`}
                data-cursor="ver ficha"
                aria-label={`Ver a ficha de ${movie.title}`}
                className="relative block aspect-video w-full outline-none"
              >
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={
                    movie.backdropUrl
                      ? { backgroundImage: `url(${backdropMenor(movie.backdropUrl)})` }
                      : { backgroundImage: fotogramaProcedural(movie.tmdbId) }
                  }
                />

                <span className="scrim absolute inset-0" />

                <span
                  className="text-papel/40 font-display absolute top-3 left-4 text-xs"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </Link>

              <div className="bg-papel text-tinta flex flex-col gap-1.5 px-6 py-4">
                <h3 className="font-display text-[clamp(1.15rem,4.5vw,1.5rem)] leading-[0.95] font-medium tracking-tight uppercase">
                  {movie.title}
                </h3>

                {meta && (
                  <p className="text-apoio text-[11px] tracking-[0.08em] uppercase">{meta}</p>
                )}

                <p className="text-tinta/85 mt-1 text-sm leading-relaxed">{movie.reason}</p>

                <OndeAssistir
                  providers={movie.providers}
                  fetchedAt={movie.fetchedAt}
                  tmdbId={movie.tmdbId}
                />

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
  tmdbId,
}: {
  providers: WatchProvider[];
  fetchedAt: string;
  tmdbId: number;
}) {
  const grupos = TIPOS.map(({ tipo, rotulo }) => ({
    rotulo,
    lista: providers.filter((p) => p.type === tipo),
  })).filter((g) => g.lista.length);

  const dia = new Date(fetchedAt);
  const data = Number.isNaN(dia.getTime())
    ? null
    : dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Mesmo fio do caso cheio: quem chama não desenha separador nenhum, então o
  // bloco precisa ter a mesma silhueta nos dois estados. Sem isto, um filme
  // sem provedor perderia a linha que os outros têm, e a diferença leria como
  // desalinho em vez de ausência de dado.
  if (!grupos.length) {
    return (
      <div className="border-fio mt-1 border-t pt-3">
        <p className="text-apoio text-xs">
          Sem streaming no Brasil segundo o TMDB{data && ` em ${data}`}.
        </p>
      </div>
    );
  }

  const ondeAssistir = tmdbWatchUrl(tmdbId);

  return (
    <div className="border-fio mt-1 border-t pt-3">
      {/* O rótulo também abre: quem quer a lista inteira não precisa acertar um
          logo de 24 px, e quem não tem o serviço que quer tem por onde ver os
          outros. */}
      <a
        href={ondeAssistir}
        target="_blank"
        rel="noreferrer"
        data-cursor="onde assistir"
        className="text-apoio hover:text-acento focus-visible:text-acento font-display inline-flex items-center gap-1 text-[11px] tracking-[0.16em] uppercase transition-colors"
      >
        Onde assistir ↗
      </a>

      <ul className="mt-2 flex list-none flex-col gap-1.5">
        {grupos.map(({ rotulo, lista }) => (
          <li key={rotulo} className="flex items-center gap-2">
            <span className="text-apoio w-[9.5rem] shrink-0 text-[11px]">{rotulo}</span>
            <span className="flex flex-wrap items-center">
              {lista.slice(0, 5).map((p) => (
                <Logo key={`${rotulo}-${p.name}`} provedor={p} href={ondeAssistir} />
              ))}
              {lista.length > 5 && (
                <span className="text-apoio text-[11px]">+{lista.length - 5}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {data && <p className="text-apoio mt-2 text-[10px]">Verificado em {data}</p>}
    </div>
  );
}

/**
 * O logo é o reconhecimento imediato; o nome fica no `title` e no leitor de
 * tela. Sem logo — acontece — o nome vira o próprio selo.
 *
 * ── Por que 24 px, e por que não adianta pedir maior ────────────────────────
 * Os logos de provedor do TMDB **nascem com 100 × 100**. Medido em 04/09/2026
 * nos quatro provedores de uma ficha: `original` devolve 100 px, e `w154`,
 * `w185` e `w300` são o mesmo original ampliado — `w300` triplica os bytes
 * (3,7 KB → 11,3 KB) sem um pixel de detalhe a mais.
 *
 * A 24 px CSS, uma tela de 3× pede 72 px e o `w92` entrega 92. Já estamos
 * acima do que a tela mostra; não há alta definição a ganhar porque a fonte
 * não tem. **O teto é ~33 px CSS a 3×** — daí para cima o original de 100 px
 * acaba e a imagem começa a borrar de verdade.
 *
 * Passar isso pelo otimizador da Vercel gastaria invocação de função para
 * economizar quilobyte nenhum.
 */
function Logo({ provedor, href }: { provedor: WatchProvider; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      // Diz para onde vai de verdade. "Assistir na Netflix" seria mentira: o
      // destino é a central do TMDB, que lista todas as plataformas.
      title={`${provedor.name} — onde assistir, no TMDB`}
      data-cursor="onde assistir"
      // `p-2` não é respiro, é alvo: 24 + 16 = 40 px de área de toque, contra
      // os 24 do logo cru. O espaçamento entre logos passa a vir do próprio
      // padding, e por isso o contêiner não tem `gap` — assim as áreas se
      // encostam sem se sobrepor, e não existe faixa morta entre elas.
      //
      // `-my-2` cancela só a altura: a área continua com 40 px, mas o layout
      // volta a contar 24. Sem isso a legenda da tira ficava 1 px mais alta
      // nos filmes COM provedor do que nos sem, e a página passava a ter duas
      // alturas — 1777 e 1776. Um pixel não se vê, mas "uma combinação só" é a
      // garantia que este redesenho inteiro existe para manter, e ela vale
      // enquanto ninguém a afrouxa "porque é pouco".
      className="hover:opacity-100 focus-visible:opacity-100 -my-2 flex items-center p-2 opacity-90 transition-opacity"
    >
      {provedor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={provedor.logoUrl}
          alt={provedor.name}
          width={24}
          height={24}
          loading="lazy"
          className="border-fio h-6 w-6 rounded-[4px] border object-cover"
        />
      ) : (
        <Selo>{provedor.name}</Selo>
      )}
    </a>
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-fio text-apoio rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}
