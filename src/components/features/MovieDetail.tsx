"use client";

import { useEffect, useRef, useState } from "react";

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
      {/* ── O palco e o cabeçalho ──────────────────────────────────────────
          Um contêiner para dois arranjos do MESMO markup — nunca duas cópias,
          porque duas cópias divergem, e neste projeto já divergiram.

          **No computador** o título repousa sobre o fotograma, como na MUBI:
          há 575 px de palco e sobra imagem embaixo do texto.

          **No celular não há esse luxo.** Num aparelho de 390 px o palco 16:9
          tem ~200 px de altura, e o cabeçalho — título de duas linhas, título
          original, ficha técnica em duas linhas, nota — é mais alto que isso.
          Ele transbordava para cima e caía sobre o vídeo e sobre a barra de
          título do YouTube. Visto no telefone do Lucas em 04/09/2026, com
          "Seven — Os Sete Crimes Capitais"; nenhuma emulação minha pegou,
          porque eu vinha testando com "Anomalisa", que cabe em uma linha.

          Então no celular o cabeçalho desce para o fluxo, abaixo do palco.
          Sobrepor texto a uma imagem só funciona quando há imagem sobrando. */}
      <div className="relative shrink-0">
        <div className="relative aspect-video w-full overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={fundo ? { backgroundImage: `url(${fundo})` } : undefined}
          />

          {!semMovimento && movie.trailerKey && (
            <Trailer chave={movie.trailerKey} titulo={movie.title} />
          )}

          {/* O gradiente de legibilidade da MUBI: texto sobre still nunca
              repousa direto na imagem. Só existe onde há texto por cima — no
              celular ele escureceria o vídeo à toa. `pointer-events-none`
              para não roubar o clique do player embaixo. */}
          <div
            className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#250701] via-[#250701]/55 to-transparent sm:block"
            aria-hidden="true"
          />
        </div>

        {/* Empilhado no celular, e nas duas pontas da mesma linha no
            computador. A nota já esteve no alto à direita, como na MUBI — mas
            a MUBI não tem um "Fechar" ali. Visto em captura, não deduzido. */}
        <header className="flex flex-col gap-3 px-6 pt-6 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-10">
          <div className="min-w-0">
            <h2 className="font-display text-[clamp(1.75rem,5.5vw,4rem)] leading-[0.9] font-medium tracking-tight uppercase">
              {movie.title}
            </h2>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-papel/55 mt-1 text-sm italic">{movie.originalTitle}</p>
            )}
            {/* Entreletra menor no celular: com 0.14em, "DIRIGIDO POR DUKE
                JOHNSON · 2015 · 90 MIN" quebrava deixando "MIN" sozinho na
                segunda linha. O espaçamento largo é da versão grande. */}
            {meta && (
              <p className="text-papel/70 mt-3 text-[11px] tracking-[0.08em] uppercase sm:tracking-[0.14em]">
                {meta}
              </p>
            )}
          </div>

          {/* Número, e não rótulo: dado tem corpo próprio. */}
          {movie.imdbRating && (
            <p className="shrink-0 leading-none sm:text-right">
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

        {/* Duas colunas só quando há duas coisas para ler.
            Com `md:grid-cols-2` fixo e `reason` ausente, a sinopse ficava na
            esquerda e sobravam 450 px de buraco à direita — medido em
            04/09/2026, forçando o caso pela rede.

            Sozinha, a sinopse não se estica até os 900 px do quadro: a medida
            que já funcionava na coluna dupla continua funcionando, e linha
            longa demais é cansaço de leitura, não generosidade. */}
        <div className={`grid gap-8 ${movie.reason ? "md:grid-cols-2" : "max-w-[62ch]"}`}>
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

        {/* Sem `border-t` aqui de propósito: o fio é do próprio `OndeAssistir`,
            que se separa sozinho nos dois lugares onde vive. Envolver o bloco
            num segundo `border-t` empilhava duas linhas de 1 px com o padding
            entre elas — visível em captura no celular, em 04/09/2026. */}
        <div className="tema-escuro">
          <OndeAssistir providers={movie.providers} fetchedAt={movie.fetchedAt} />
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

/** Origem do embed. Fixa, e usada nas duas pontas: para onde a mensagem vai e
 *  de onde ela é aceita. Comparar a origem é o que impede qualquer outro
 *  quadro da página de fingir ser o player. */
const ORIGEM_YT = "https://www.youtube-nocookie.com";

const TOCANDO = 1;
/** Pronto com o pôster à mostra. É o que sobra quando o navegador recusa o
 *  autoplay, e aí a pessoa precisa ver o botão para poder tocar. */
const PRONTO_SEM_TOCAR = 5;

/**
 * Quanto vídeo precisa ter sido decodificado antes de revelar.
 *
 * "Tocando" não basta, e isso foi medido: o player anuncia `playerState: 1`
 * aos 810 ms e o quadro **ainda é preto**, com a barra de título do YouTube em
 * cima. Revelar ali só antecipava o mesmo defeito.
 *
 * O que separa preto de imagem não é o estado, é o relógio do vídeo. Na mesma
 * medição, em 04/09/2026: `currentTime` 0,48 s → preto; 1,04 s → imagem. Um
 * segundo decodificado é prova de que o player passou do próprio boot, e não
 * depende de qual trailer é — se o filme abre em preto, aí é o filme, e é
 * exatamente o que se quer mostrar.
 */
const LIMIAR_S = 1;

/**
 * Dois prazos, porque há dois motivos diferentes para o vídeo demorar.
 *
 * **`MUDO_MS` — o player nunca falou.** Protocolo mudou, mensagem bloqueada,
 * iframe que não subiu: não vai chegar sinal, e esperar mais é esperar à toa.
 *
 * **`TETO_MS` — o player falou, mas ainda não chegou lá.** Aqui esperar é o
 * certo: sabemos que o aviso vem. Só existe teto para o caso de ele travar
 * bufferizando para sempre.
 *
 * A diferença entre os dois foi o Lucas quem achou, testando num iPhone em
 * 04/09/2026: o trailer levou vários segundos numa rede de celular, e o prazo
 * único de 8 s — calibrado em `localhost` — disparava **antes** do sinal real
 * e revelava justamente a tela de carregamento que ele existe para esconder.
 * Aumentar o número seria chute; separar os casos é o conserto.
 *
 * O custo de esperar é baixo: o que fica na tela é o fotograma do filme, com
 * título, nota e a ficha inteira embaixo. Não é uma tela vazia.
 */
const MUDO_MS = 8000;
const TETO_MS = 30000;

/**
 * O trailer, que só aparece quando tem o que mostrar.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 * O iframe cobria o backdrop no instante em que montava, e o YouTube pinta
 * preto enquanto carrega — com a própria barra de título por cima. Medido em
 * 04/09/2026, num Chrome com janela e perfil limpo: **preto às 6 s, tocando
 * às 12 s**. Ou seja, o still do filme ficava escondido exatamente no momento
 * em que ele era a única coisa que havia para ver.
 *
 * ── Por que não dá para "só esperar um pouco" ───────────────────────────────
 * O iframe é cross-origin: nada dentro dele é observável daqui, nem o
 * `readyState`, nem o `<video>`. Cronômetro fixo é chute, e chute erra para o
 * lado ruim quando a rede está lenta.
 *
 * O player fala, porém, se a gente falar primeiro: com `enablejsapi=1` ele
 * responde ao handshake `listening` e passa a mandar mudança de estado por
 * `postMessage`. É o mesmo protocolo que o `iframe_api` oficial usa por baixo
 * — e usá-lo direto evita carregar um script de `www.youtube.com`, que
 * desfaria a escolha de embutir por `youtube-nocookie.com`.
 *
 * ── O que acontece se o protocolo mudar ─────────────────────────────────────
 * Nada de novo: em silêncio total o `MUDO_MS` revela o vídeo assim mesmo. O
 * pior caso volta a ser o comportamento de antes desta correção, nunca um
 * player invisível para sempre. Foi por isso que valeu depender de um
 * protocolo não documentado.
 */
function Trailer({ chave, titulo }: { chave: string; titulo: string }) {
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);
  /** O estado vem uma vez; o `currentTime` vem a cada ~260 ms, e quase sempre
   *  sozinho. Guardar o último estado é o que permite ler os dois juntos. */
  const estadoRef = useRef<number | null>(null);
  /** O player chegou a responder alguma coisa? É o que separa "protocolo
   *  quebrado" de "rede lenta" — os dois demoram, e o remédio é oposto. */
  const ouviuRef = useRef(false);

  useEffect(() => {
    // O player só começa a ouvir depois de montar o próprio JavaScript, e essa
    // hora não é observável daqui. Repetir o handshake é mais barato que
    // adivinhá-la; ele para junto com o resto no cleanup.
    const bater = () =>
      ref.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        ORIGEM_YT,
      );
    bater();
    const pulso = setInterval(bater, 400);
    // Silêncio total: não vem sinal, revela. Se o player já respondeu alguma
    // coisa, este prazo não vale — ali é rede lenta, e o aviso está a caminho.
    const semResposta = setTimeout(() => {
      if (!ouviuRef.current) setVisivel(true);
    }, MUDO_MS);
    const teto = setTimeout(() => setVisivel(true), TETO_MS);

    function aoReceber(e: MessageEvent) {
      if (e.origin !== ORIGEM_YT) return;
      let dados: unknown;
      try {
        dados = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return; // Mensagem que não é JSON não é deste protocolo.
      }
      // Duas formas na mesma conversa: `onStateChange` traz o número solto em
      // `info`, e `infoDelivery` traz um objeto com `playerState` e
      // `currentTime` dentro.
      const info = (dados as { info?: unknown })?.info;
      const solto = typeof info === "number" ? info : undefined;
      const objeto = (typeof info === "object" ? info : null) as {
        playerState?: number;
        currentTime?: number;
      } | null;

      const estado = solto ?? objeto?.playerState;
      const tempo = objeto?.currentTime;
      // Qualquer coisa reconhecível já prova que o canal está de pé, e é isso
      // que desarma o prazo curto: daqui em diante a demora é rede, não falha.
      if (typeof estado === "number" || typeof tempo === "number") {
        ouviuRef.current = true;
      }
      if (typeof estado === "number") estadoRef.current = estado;

      // Autoplay recusado: não vem quadro nenhum, e esconder o botão deixaria
      // a pessoa sem como tocar.
      if (estadoRef.current === PRONTO_SEM_TOCAR) return setVisivel(true);

      if (
        estadoRef.current === TOCANDO &&
        typeof tempo === "number" &&
        tempo >= LIMIAR_S
      ) {
        setVisivel(true);
      }
    }
    window.addEventListener("message", aoReceber);

    return () => {
      clearInterval(pulso);
      clearTimeout(semResposta);
      clearTimeout(teto);
      window.removeEventListener("message", aoReceber);
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src={trailerEmbedUrl(chave, { autoplay: true, loop: true, jsapi: true })}
      title={`Trailer de ${titulo}`}
      allow="autoplay; encrypted-media"
      // Invisível, ele continua na frente: sem `pointer-events-none` o clique
      // cairia num player que não está lá.
      className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    />
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-papel/25 text-papel/70 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium tracking-[0.06em] uppercase">
      {children}
    </span>
  );
}
