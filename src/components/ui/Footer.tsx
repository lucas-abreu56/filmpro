/**
 * Rodapé persistente — existe por obrigação contratual, não por decoração.
 *
 * Os termos de uso da API do TMDB (seção 3, conferidos em 07/09/2026) exigem
 * DUAS coisas de toda aplicação que serve dado ou imagem deles:
 *
 *   1. o logo oficial, sem alteração de cor ou proporção, e **menos
 *      proeminente** que a marca que identifica a própria aplicação;
 *   2. o aviso, literal: *"This [website] uses TMDB and the TMDB APIs but is
 *      not endorsed, certified, or otherwise approved by TMDB."*
 *
 * Por isso o aviso está em inglês: é texto de contrato, não copy. A frase em
 * português ao lado é que explica ao leitor de onde vem o que ele está vendo.
 *
 * Por isso também o logo vem de `/tmdb.svg`, o arquivo oficial baixado da
 * página de logos deles — recolorir para o creme do projeto violaria os
 * termos. E por isso ele mora aqui, num rodapé de `layout.tsx`: os termos
 * pedem "in or on Your Application", e o README não é a aplicação.
 *
 * A hierarquia de proeminência é deliberada: "FILMPRO" na display, maior, à
 * esquerda; o logo do TMDB pequeno, à direita.
 */
export default function Footer() {
  return (
    <footer className="border-fio-forte mt-24 border-t">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-xl tracking-[0.16em] uppercase">
            FilmPro
          </p>
          <p className="text-apoio mt-2 max-w-md text-xs leading-relaxed">
            Pôster, fotograma, elenco, duração e onde assistir vêm do TMDB.
            Nota do IMDb e prêmios vêm do OMDb. A curadoria — e só ela — é
            escrita por um agente.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="self-start opacity-80 transition-opacity hover:opacity-100 sm:self-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- o projeto
                inteiro usa <img>; não há next/image aqui (ver src/lib/tmdb.ts). */}
            <img
              src="/tmdb.svg"
              alt="The Movie Database (TMDB)"
              width={96}
              height={13}
            />
          </a>
          <p className="text-apoio max-w-xs text-[11px] leading-relaxed sm:text-right">
            This website uses TMDB and the TMDB APIs but is not endorsed,
            certified, or otherwise approved by TMDB.
          </p>
        </div>
      </div>
    </footer>
  );
}
