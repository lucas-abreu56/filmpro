import InterceptedModal from "./InterceptedModal";

/**
 * A rota interceptadora. `(.)filme` e não `(..)filme`: o slot `@modal` mora na
 * raiz do app, e `/filme` também — mesmo nível, um ponto só.
 *
 * Aqui não há busca de dados de propósito. Quem chega nesta rota veio de um
 * clique na tira, e a tira já tem o filme inteiro em memória; o componente de
 * cliente lê do store. Buscar no servidor daria latência a todo clique para
 * cobrir o caso raro do store vazio, que o `InterceptedModal` resolve mandando
 * a pessoa para a página real.
 */
export default async function ModalFicha(
  props: PageProps<"/filme/[tmdbId]">,
) {
  const { tmdbId } = await props.params;
  return <InterceptedModal tmdbId={Number(tmdbId)} />;
}
