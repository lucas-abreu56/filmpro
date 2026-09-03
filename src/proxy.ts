import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { clientIp, overLimit } from "@/lib/rateLimit";

/**
 * Freio na ficha do filme.
 *
 * `/api/recommendations` sempre teve limitador; `/filme/[tmdbId]` nasceu sem.
 * Enquanto essa rota respondia 404 em toda chamada — o que ela fez desde que
 * nasceu até 03/09/2026 — isso não custava nada. Agora que ela funciona, cada
 * acerto atravessa Next → n8n (VPS em Campinas) → Postgres.
 *
 * O `revalidate` de 7 dias na página só cobre **id repetido**. Uma varredura
 * de `/filme/1` a `/filme/999999` erra o cache em todas, e é exatamente o que
 * um robô bobo faz com uma rota numérica que ele acabou de descobrir.
 *
 * ── Por que aqui, e não dentro da página ────────────────────────────────────
 * Proxy roda **antes** do cache e antes do render, que é o único lugar de onde
 * dá para negar a requisição sem pagar por ela. Server Component também não
 * consegue devolver 429: ele renderiza ou chama `notFound()`, e responder 404
 * a quem está só rápido demais seria mentir sobre o que aconteceu.
 *
 * ── O que isto NÃO é ────────────────────────────────────────────────────────
 * O contador vive na memória da instância, igual ao de `rateLimit.ts` — em
 * serverless cada instância tem o seu, então o teto real é por instância.
 * Atrapalha script ingênuo; não é proteção sob carga. A defesa de verdade é
 * regra de rate limiting na borda do Cloudflare, que o projeto já identificou
 * e ainda não configurou.
 */

/** Alto o bastante para nenhuma pessoa encostar — quem abre 30 fichas em um
 *  minuto não está lendo — e baixo o bastante para uma varredura parar na
 *  primeira dúzia de ids. */
const MAX_POR_MINUTO = 30;

// DIAGNÓSTICO TEMPORÁRIO — remover. Conta invocações nesta instância para
// descobrir se a memória de módulo sobrevive entre requisições na Vercel.
let invocacoes = 0;

export function proxy(request: NextRequest) {
  invocacoes++;

  if (!overLimit(clientIp(request.headers), MAX_POR_MINUTO)) {
    const res = NextResponse.next();
    res.headers.set("x-freio-inst", String(invocacoes));
    return res;
  }

  // `Retry-After` não é enfeite: é o que um robô que se comporta lê para
  // recuar. Texto puro porque, na prática, só robô chega aqui.
  return new Response(
    "Muitas fichas seguidas. Espere um minuto e tente de novo.\n",
    {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "60",
      },
    },
  );
}

export const config = {
  // Só a ficha. A home é estática, e `/api/recommendations` já tem o freio
  // dele, com 429 em JSON e mensagem própria — passar duas vezes pelo mesmo
  // contador daria erro sem explicação.
  matcher: "/filme/:path*",
};
