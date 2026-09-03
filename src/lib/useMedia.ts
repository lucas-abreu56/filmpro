import { useEffect, useState } from "react";

/**
 * Media query como estado de React.
 *
 * Começa `false` porque no servidor não existe `matchMedia`, e o primeiro
 * render do cliente tem que bater com o do servidor. Consequência a ter em
 * mente em cada uso: o primeiro quadro é sempre o caso negativo.
 *
 * Morava dentro de `FilmStrip`. Saiu de lá quando a ficha do filme passou a
 * precisar da mesma pergunta sobre `prefers-reduced-motion` — e a primeira
 * versão dela, por não ter onde importar, simplesmente não perguntou.
 */
export function useMedia(consulta: string) {
  const [bate, setBate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const aplica = () => setBate(mq.matches);
    aplica();
    mq.addEventListener("change", aplica);
    return () => mq.removeEventListener("change", aplica);
  }, [consulta]);
  return bate;
}
