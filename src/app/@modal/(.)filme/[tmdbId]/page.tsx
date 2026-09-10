import { buscarFilme } from "@/lib/filme";

import InterceptedModal from "./InterceptedModal";

/**
 * A rota interceptadora. `(.)filme` e não `(..)filme`: o slot `@modal` mora na
 * raiz do app, e `/filme` também — mesmo nível, um ponto só.
 *
 * ── Por que ela busca, se o store quase sempre tem o filme ──────────────────
 * Até 10/09/2026 não buscava nada, e o argumento registrado aqui era que dar
 * latência a todo clique para cobrir "o caso raro do store vazio" não valia.
 * O caso não era raro, e o remédio era pior: o `InterceptedModal` respondia com
 * `location.replace('/filme/…')`, o que **abandonava o modal** e jogava a
 * pessoa na página inteira, de fundo creme. Visto no celular do Lucas em
 * 10/09/2026 — a ficha aparecia ora escura (modal), ora clara (página), sem
 * padrão aparente.
 *
 * No celular o store esvazia com facilidade: `HidratarStore` grava dentro de um
 * `useEffect`, então tocar num filme antes de a hidratação terminar encontra o
 * store vazio — e numa home de cinco fileiras por oito filmes, numa rede de
 * celular, essa janela é larga. Recarregar em cima do modal zera igual.
 *
 * A latência que o comentário antigo temia não existe deste lado: o
 * `InterceptedModal` continua lendo o store primeiro e só usa esta reserva
 * quando não acha o filme. O que o `await` daqui custa é o tempo até o modal
 * aparecer — e o webhook tem `revalidate` de uma semana, então na prática é
 * cache.
 */
export default async function ModalFicha(props: PageProps<"/filme/[tmdbId]">) {
  const { tmdbId } = await props.params;
  const reserva = await buscarFilme(tmdbId);

  return <InterceptedModal tmdbId={Number(tmdbId)} reserva={reserva} />;
}
