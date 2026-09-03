import Link from "next/link";

/**
 * A tela de 404 do projeto inteiro. Nasceu por causa da ficha do filme: até
 * então `notFound()` caía na página preta padrão do Next, que não se parece
 * com nada aqui e faz o site parecer quebrado em vez de honesto.
 *
 * O texto não promete que o filme não existe — ele pode existir e só não ter
 * passado por nenhuma busca ainda, que é como o catálogo cresce.
 */
export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
      <p className="text-acento font-display text-xs tracking-[0.16em] uppercase">
        404
      </p>

      <h1 className="font-display mt-3 text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.88] font-medium uppercase">
        Este rolo
        <br />
        não está
        <br />
        na estante
      </h1>

      <p className="text-apoio mt-8 max-w-md text-sm leading-relaxed">
        A página não existe — ou o filme ainda não entrou no catálogo. Ele só é
        arquivado depois de aparecer em alguma busca; descreva o que você quer
        assistir e talvez ele apareça agora.
      </p>

      <Link
        href="/"
        className="text-tinta hover:text-acento focus-visible:text-acento font-display mt-10 self-start text-xs font-bold tracking-[0.16em] uppercase transition-colors"
      >
        ← Voltar para a busca
      </Link>
    </main>
  );
}
