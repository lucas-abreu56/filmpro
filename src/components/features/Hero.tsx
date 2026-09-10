import SearchPanel from "@/components/features/SearchPanel";
import { backdropMenor } from "@/lib/tmdb";
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
          // Sempre `w780`, sem `srcSet`. O n8n assa `w1280` na URL; aqui isso
          // vira ~55% menos bytes (ver `backdropMenor` em `tmdb.ts`). O fundo é
          // decorativo — `alt=""`, atrás do scrim — e a `w1280` esticada num
          // desktop de 1920px é indistinguível da `w780` sob o escurecimento.
          //
          // `srcSet` + `sizes` foi tentado e piorou: o React 19 emite um
          // `<link rel=preload as=image imageSrcSet>` para este `<img>`, e o
          // candidato do preload não bate com o do elemento — o browser
          // baixava `w780` E `w1280`, e a `w1280` competia com o letreiro (o
          // LCP desta tela) na mesma conexão com o TMDB. Uma URL só resolve.
          src={backdropMenor(movie.backdropUrl, "w780")}
          width={1280}
          height={720}
          alt=""
          // Sem `fetchPriority="high"` de propósito: o LCP desta tela é o
          // LETREIRO, não o fundo (que é decorativo — `alt=""`, atrás do
          // scrim). Os dois competindo em prioridade alta na mesma conexão
          // com o TMDB serializava o carregamento e empurrava o LCP para 4 s.
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="perfuracao" />
      </div>
      <div className="hero-scrim" />

      {/* `pb-12` no celular, não `pb-24`: com o H1 fora e os exemplos numa
          faixa só, o respiro de 6rem embaixo virava vão morto entre o cartão e
          a perfuração. No desktop o valor original continua. */}
      <div className="relative z-10 flex min-h-screen flex-col justify-end px-6 pt-24 pb-12 sm:px-12 sm:pb-32">
        {/* `hero-marca` põe sombra nestas duas linhas. O scrim não escurece
            mais o topo, e 12px claros sobre um still qualquer não se sustentam
            sozinhos. */}
        <div className="hero-marca absolute top-8 right-6 left-6 flex items-center justify-between text-xs tracking-[0.16em] uppercase sm:right-12 sm:left-12">
          <span>FilmPro</span>
          {semanaLabel && <span>Semana de {semanaLabel}</span>}
        </div>

        <div className="max-w-2xl">
          {movie.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- letreiro do TMDB, sem next/image neste projeto
            <img
              src={movie.logoUrl}
              alt={movie.title}
              // Este é o elemento LCP da tela. `fetchPriority="high"` para o
              // browser buscá-lo já na primeira leva, sem esperar o parser
              // chegar até aqui — sem isto o Lighthouse cronometra o letreiro
              // entrando na fila atrás do backdrop.
              fetchPriority="high"
              // `h-24 w-auto`, não `max-h-24`: o TMDB não manda a dimensão do
              // PNG, então sem altura fixa o `<img>` nasce com 0 de altura e
              // empurra o layout ~116px quando carrega (CLS). Com `h-24` a
              // caixa já ocupa 6rem antes de a imagem chegar; só a largura
              // ainda varia, e ela não desloca nada abaixo. `decoding="async"`
              // tira o decode do PNG da thread principal.
              decoding="async"
              className="mb-5 h-24 w-auto max-w-[70%] object-contain object-left drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
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

          {/* O H1 só existe da tela média para cima. No celular ele custava
              10,4% da tela (medido em 10/09/2026, 412×915) para repetir o que
              o placeholder da busca já diz, logo abaixo — e o que sobrava para
              o still era quase nada. Continua no DOM em toda largura: `hidden`
              tira da árvore de acessibilidade junto, e a página precisa de um
              `h1`, então quem some é a versão grande e entra a de leitor de
              tela (`sr-only`) no celular. */}
          {/* As quebras são `<br className="hidden sm:inline">` porque no
              celular o h1 é lido por leitor de tela, e ali a frase precisa
              soar como uma frase, não como três fragmentos. */}
          <h1 className="hero-h1 font-display sm:mb-8 sm:text-[clamp(2.5rem,6.5vw,5.5rem)] sm:leading-[0.9] sm:font-medium sm:uppercase">
            O que você <br className="hidden sm:inline" />
            quer sentir <br className="hidden sm:inline" />
            hoje?
          </h1>

          {/* Vidro fosco, não bloco opaco. O `bg-profundo/95` que estava aqui
              tapava 35,1% da tela do herói no celular — mais que o scrim, o
              letreiro e o H1 somados. A `--color-profundo` a 62% com blur
              separa o campo de entrada da fotografia sem apagá-la: o still
              continua existindo atrás do cartão, desfocado.

              `supports-[backdrop-filter]` mantém a opacidade alta onde o blur
              não existe (Firefox com a flag desligada), porque ali o texto
              precisaria do fundo sólido para ter contraste. */}
          <div className="tema-escuro bg-profundo/85 supports-[backdrop-filter]:bg-profundo/62 max-w-xl rounded-[2px] border border-papel/15 p-6 backdrop-blur-md">
            <SearchPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
