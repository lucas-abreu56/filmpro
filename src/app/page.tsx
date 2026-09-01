import SearchPanel from "@/components/features/SearchPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-20 sm:py-28">
      <header className="mb-12 w-full max-w-3xl">
        <p className="text-chama font-display text-xs tracking-[2px] uppercase">
          FilmPro
        </p>
        <h1 className="text-gelo font-display mt-4 text-5xl leading-[0.95] font-bold uppercase sm:text-7xl">
          O que você
          <br />
          quer sentir
          <br />
          hoje?
        </h1>
        <p className="text-pedra mt-6 max-w-xl text-sm leading-relaxed">
          Descreva o filme que você procura. Um agente cura a lista e escreve o
          motivo de cada escolha — pôster, nota, duração e onde assistir vêm do
          TMDB, não do modelo.
        </p>
      </header>

      <SearchPanel />
    </main>
  );
}
