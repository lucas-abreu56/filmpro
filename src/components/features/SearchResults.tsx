"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";

import FilmStrip from "@/components/features/FilmStrip";
import { useSearchStore } from "@/lib/store";

const MOCK = process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1";

/** Respiro acima da seção quando a página salta até ela, em px. Um número só,
 *  lido pelos dois caminhos de rolagem — ver o efeito abaixo. */
const RESPIRO_TOPO = 32;

/**
 * A tira de resultados da busca — separada do `SearchPanel` em 07/09/2026.
 * Antes as duas coisas eram um componente só, e no herói (`Hero.tsx`) isso
 * significava a tira de resultados nascendo dentro do cartão escuro: quando
 * uma busca de verdade voltava, o cartão crescia bem além da imagem de fundo
 * e a tira ficava presa ao tema escuro (ou ilegível, antes do cartão virar
 * sólido). Resultado sempre no papel claro, renderizado fora do herói,
 * resolve os dois problemas de uma vez.
 */
export default function SearchResults() {
  const estado = useSearchStore((state) => state.estado);
  const secaoRef = useRef<HTMLElement>(null);
  const lenis = useLenis();
  /** O último `estado` para o qual o salto já aconteceu. Ver o efeito abaixo. */
  const jaSaltou = useRef<unknown>(null);

  // Quando a curadoria fica pronta, joga a página direto nos filmes.
  //
  // Salto instantâneo, nunca `smooth`, por dois motivos: a cortina do
  // `Loader` ainda cobre a tela quando isto roda (ela leva 900ms para sair),
  // então um scroll suave seria trabalho invisível — a cortina abre já na
  // coleção; e instantâneo já é, por definição, o comportamento que
  // `prefers-reduced-motion` pediria, então não há caso especial a tratar.
  //
  // Com o Lenis dirigindo o `<body>`, um `scrollIntoView` nativo deixaria a
  // posição virtual dele dessincronizada — por isso o salto passa por
  // `lenis.scrollTo(alvo, { immediate: true })`. Sem Lenis (movimento
  // reduzido), o caminho nativo continua valendo, e aí quem dá o respiro é o
  // `scrollMarginTop` — por isso os dois lados leem a MESMA constante
  // `RESPIRO_TOPO`, em vez de um `scroll-mt-8` no JSX e um `-32` aqui, que
  // eram dois números para manter em sincronia à mão.
  //
  // Depende de `estado` (o objeto inteiro, não da fase): `setEstado` cria um
  // objeto novo a cada busca, então uma segunda busca com o mesmo resultado
  // ainda dispara o salto.
  //
  // `lenis` também está nas deps, e é por isso que existe o `jaSaltou`: sem
  // ele, o Lenis passando de `undefined` a instância — o que acontece se
  // alguém liga/desliga `prefers-reduced-motion` no sistema com a coleção na
  // tela — re-dispararia o salto e jogaria a leitura de volta para o topo.
  useEffect(() => {
    if (estado.fase !== "pronto") return;
    if (jaSaltou.current === estado) return;
    const alvo = secaoRef.current;
    if (!alvo) return;
    jaSaltou.current = estado;
    if (lenis) lenis.scrollTo(alvo, { immediate: true, offset: -RESPIRO_TOPO });
    else alvo.scrollIntoView({ behavior: "instant", block: "start" });
  }, [estado, lenis]);

  if (estado.fase !== "pronto") return null;

  return (
    <section
      ref={secaoRef}
      style={{ scrollMarginTop: RESPIRO_TOPO }}
      className="mt-16 w-full"
    >
      <header className="mb-6 max-w-5xl">
        <p className="text-apoio font-display text-xs tracking-[0.16em] uppercase">
          Coleção
        </p>
        {/* Nome da coleção: texto autoral do agente. */}
        <h2 className="font-display mt-1 text-[clamp(2.5rem,7vw,5rem)] leading-[0.85] font-medium uppercase">
          {estado.dados.collectionTitle}
        </h2>
        <p className="text-apoio mt-3 text-xs tabular-nums">
          {estado.dados.movies.length} filmes · {estado.ms} ms
          {estado.dados.cached && " · do cache"}
          {/* Contar a verdade é o ponto deste texto — então ele precisa
              concordar em número. "2 sugestão descartada" desmente a
              própria frase que está tentando ser honesta.

              "na verificação", e não mais "por não constar no TMDB": desde
              03/09/2026 uma sugestão também cai quando dois títulos do
              curador resolvem para o MESMO filme. Nesse caso o filme
              existe, e a frase antiga afirmava o contrário. */}
          {estado.dados.notFound.length === 1 &&
            " · 1 sugestão descartada na verificação"}
          {estado.dados.notFound.length > 1 &&
            ` · ${estado.dados.notFound.length} sugestões descartadas na verificação`}
        </p>
      </header>

      <FilmStrip movies={estado.dados.movies} />

      {MOCK && (
        <p className="text-apoio mt-4 text-xs">
          Dados falsos — quadros procedurais, como na réplica da kirlian.
          Trailer e pôster reais exigem as credenciais do TMDB.
        </p>
      )}
    </section>
  );
}
