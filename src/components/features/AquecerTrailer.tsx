"use client";

import { useEffect, useState } from "react";

/**
 * Um iframe de 2×2 px que não mostra nada e serve para uma coisa só: manter
 * viva uma superfície cross-origin do YouTube antes de alguém pedir o trailer.
 *
 * ── O defeito que isto conserta ──────────────────────────────────────────────
 * Quando o primeiro trailer entrava na página, o navegador congelava. Medido em
 * 03/09/2026, Chrome 152, 1440×900, perfil limpo: **2,67 s**, seis medições
 * entre 2661 e 2692 ms, sem uma única long task. O trace mostra o custo inteiro
 * numa GPUTask solitária de 2676 ms no processo de GPU, com os workers do ANGLE
 * ao lado. Não é o nosso JavaScript, não é rede — reproduz com o YouTube todo
 * bloqueado — e não é o nosso CSS: grão, cinza e scrim não reproduzem numa
 * página nua.
 *
 * ── Como se descobriu que era isto ───────────────────────────────────────────
 * Um iframe do YouTube montado e mantido vivo derrubou o congelamento para
 * 83 ms; o mesmo iframe montado e REMOVIDO trouxe os 2629 ms de volta. O custo
 * é pago sempre que não existe nenhuma superfície cross-origin viva. Daí:
 *
 *   iframe 2×2 com vídeo            67 ms
 *   iframe 2×2 SEM vídeo (isto)     48–67 ms
 *   um <video> local de canvas      2632 ms — não adianta
 *
 * O canvas descarta a explicação fácil: não é o caminho genérico de compor
 * vídeo. É a superfície cross-origin. Por isso o quadro quente não carrega
 * vídeo nenhum: `/embed/` sem id devolve a página de erro do próprio YouTube,
 * o que custa um documento minúsculo e zero decodificação.
 *
 * ── Por que só depois do primeiro gesto ──────────────────────────────────────
 * Pedir isso no carregamento faria todo visitante falar com o Google mesmo sem
 * nunca buscar nada. Espera o primeiro sinal de intenção — foco no campo ou
 * clique num exemplo. E precisa de tempo: com 5 s de antecedência o gesto custa
 * 46 ms, com 700 ms ainda custa 2400 ms. Entre a intenção e o primeiro hover
 * passam a digitação, a busca e a leitura do nome da coleção.
 *
 * Quem pediu menos movimento nunca vê trailer, então não paga esta requisição.
 *
 * ── O que NÃO foi verificado ─────────────────────────────────────────────────
 * Tudo acima é Chrome headless nesta máquina, onde não há GPU de verdade e o
 * rasterizador é software. O Lucas relatou cerca de 1 s no navegador dele, com
 * GPU real: mesmo fenômeno, magnitude menor. Que o conserto transfira é
 * expectativa fundamentada, não medição.
 */
const QUADRO_QUENTE = "https://www.youtube-nocookie.com/embed/";

export default function AquecerTrailer({ ligado }: { ligado: boolean }) {
  const [querMovimento, setQuerMovimento] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplica = () => setQuerMovimento(!mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, []);

  if (!ligado || !querMovimento) return null;

  return (
    <iframe
      src={QUADRO_QUENTE}
      title=""
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none fixed top-0 left-0 -z-10 h-0.5 w-0.5 border-0 opacity-[0.01]"
    />
  );
}
