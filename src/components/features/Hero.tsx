import SearchPanel from "@/components/features/SearchPanel";
import type { Movie } from "@/lib/types";

/**
 * A sala escura: herói em tela cheia com o filme em destaque da semana atrás
 * de tudo. Prototipado em três versões (still, faixa clara, trailer de
 * verdade) e aprovado por captura em 07/09/2026 — o Lucas escolheu o still
 * com deriva lenta por ser mais simples e não depender do YouTube embutir.
 *
 * `mix-blend-mode: difference` no H1 é o item 5 das animações aprovadas em
 * `docs/identidade-visual.md` desde 01/09/2026, nunca implementado até aqui.
 *
 * A busca é só o formulário (`SearchPanel`) — embrulhado em `.tema-escuro`
 * (já existe, é o mesmo truque da ficha) para os tokens
 * `--color-tinta/apoio/fio` virarem claros sobre o fundo escuro sem duplicar
 * o componente. A tira de RESULTADOS é outro componente, `SearchResults`,
 * renderizado fora do herói, no papel claro de sempre.
 *
 * Os dois já foram um componente só, e os resultados nasciam dentro deste
 * cartão. Bug real, achado só ao testar uma busca de verdade (não em
 * captura estática): o cartão crescia bem além dos 100vh da imagem, e a
 * tira de filmes ficava presa a um cartão escuro — ilegível quando ele
 * ainda era vidro translúcido, e mesmo sólido continuava estranho (mesmo
 * filme em destaque grande no herói, resultado de busca escurecido logo
 * abaixo). Separar os dois componentes (estado compartilhado via
 * `useSearchStore`) resolve isso na raiz: o cartão aqui só cresce com o
 * formulário e o erro, nunca com resultado.
 */
interface HeroProps {
  movie: Movie;
  semanaLabel: string | null;
}

export default function Hero({ movie, semanaLabel }: HeroProps) {
  if (!movie.backdropUrl) return null;

  return (
    // Sangra de ponta a ponta apesar de `main` ter `max-w-[84rem]` — o truque
    // clássico funciona porque `main` é centralizado (`mx-auto`): `left-1/2`
    // desloca pela largura do PAI até o centro (que coincide com o centro do
    // viewport), e `-ml-[50vw]` puxa de volta por metade do viewport.
    <div className="hero-cinema relative left-1/2 w-screen -ml-[50vw]">
      <div className="hero-still">
        {/* eslint-disable-next-line @next/next/no-img-element -- backdrop do TMDB, sem next/image neste projeto */}
        <img
          src={movie.backdropUrl}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="perfuracao" />
      </div>
      <div className="hero-scrim" />

      <div className="relative z-10 flex min-h-screen flex-col justify-end px-6 pt-24 pb-24 sm:px-12 sm:pb-32">
        <div className="absolute top-8 right-6 left-6 flex items-center justify-between text-xs tracking-[0.16em] uppercase sm:right-12 sm:left-12">
          <span>FilmPro</span>
          {semanaLabel && <span>Semana de {semanaLabel}</span>}
        </div>

        <div className="max-w-2xl">
          {movie.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- letreiro do TMDB, sem next/image neste projeto
            <img
              src={movie.logoUrl}
              alt={movie.title}
              className="mb-5 max-h-24 max-w-[70%] drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <p className="font-display mb-5 text-3xl leading-[0.95] font-medium uppercase">
              {movie.title}
            </p>
          )}

          {movie.tagline && (
            <p className="mb-9 max-w-md text-base leading-relaxed text-papel/80 italic">
              “{movie.tagline}”
            </p>
          )}

          <h1 className="hero-h1 font-display mb-8 text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[0.9] font-medium uppercase">
            O que você
            <br />
            quer sentir
            <br />
            hoje?
          </h1>

          <div className="tema-escuro bg-profundo/95 max-w-xl rounded-[2px] border border-papel/15 p-6">
            <SearchPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
