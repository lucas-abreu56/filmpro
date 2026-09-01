import SearchPanel from "@/components/features/SearchPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-24">
      <header className="mb-16 w-full">
        <p className="text-acento font-display text-xs tracking-[0.16em] uppercase">
          FilmPro
        </p>

        {/* Display condensada em vw, para o título tocar as margens em
            qualquer largura.
            A entrelinha é 0.88, não os 0.75 do sistema da kirlian: aquele
            valor foi medido sobre caixa alta em inglês, e em português os
            diacríticos sobem acima da altura de maiúscula — a 0.78 o
            circunflexo de "VOCÊ" colidia com a linha de cima. */}
        <h1 className="font-display mt-3 text-[clamp(2.75rem,9vw,7rem)] leading-[0.88] font-medium uppercase">
          O que você
          <br />
          quer sentir
          <br />
          hoje?
        </h1>

        <p className="text-apoio mt-8 max-w-md text-sm leading-relaxed">
          Descreva o filme que você procura. Um agente cura a lista e escreve o
          motivo de cada escolha — pôster, nota, duração e onde assistir vêm do
          TMDB, não do modelo.
        </p>
      </header>

      <SearchPanel />
    </main>
  );
}
