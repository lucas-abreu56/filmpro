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

/**
 * A resposta do 429, em HTML.
 *
 * **Era `text/plain`, e isso quebrava no Safari.** O comentário antigo dizia
 * "texto puro porque, na prática, só robô chega aqui" — falso, e o Lucas topou
 * com isso no iPhone em 10/09/2026: numa NAVEGAÇÃO, o Safari não exibe
 * `text/plain`, ele **baixa**. A tela ficou preta e apareceu um `530385.txt` na
 * barra de download — o id da ficha que ele tinha acabado de tocar. Nada ali
 * indicava um limite de requisições; parecia a página ter quebrado.
 *
 * Ele chegou ao teto porque cada ficha que o modal abandonava virava uma
 * navegação extra por esta rota (ver `InterceptedModal.tsx`). Aquilo está
 * consertado, mas o teto continua alcançável por uma pessoa — voltar/avançar
 * no histórico, abrir várias fichas em abas — e uma pessoa precisa de uma
 * frase legível.
 *
 * HTML mínimo e embutido, sem passar pelo render do Next: o proxy roda antes do
 * render de propósito, e chamar o React aqui pagaria justamente o custo que
 * este freio existe para evitar. Robô continua servido — lê o status e o
 * `Retry-After`, não o corpo.
 *
 * As cores são os literais da identidade (`globals.css`), e não um `var()`: o
 * CSS do projeto não carrega aqui. As famílias também são de sistema, porque
 * as fontes do projeto vêm do `next/font` e essa infra não existe nesta
 * resposta — pedir a Big Shoulders daria um fallback qualquer, não a fonte.
 */
const PAGINA_429 = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Espere um minuto — FilmPro</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#fdf6e4;color:#531a0f;padding:1.5rem;
       font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5}
  main{max-width:32rem}
  .rotulo{margin:0;font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;
          color:rgb(83 26 15 / .72)}
  h1{margin:.75rem 0 0;font-size:clamp(2rem,7vw,3.25rem);line-height:.95;
     text-transform:uppercase;font-weight:600;letter-spacing:-.01em}
  p{margin:1.5rem 0 0;color:rgb(83 26 15 / .72)}
  a{color:#c52e2e;text-decoration:none;font-weight:600}
  a:hover,a:focus-visible{text-decoration:underline}
</style>
</head>
<body>
<main>
  <p class="rotulo">FilmPro</p>
  <h1>Espere um minuto</h1>
  <p>Você abriu muitas fichas seguidas. O limite volta ao normal em um minuto
  — é só recarregar esta página.</p>
  <p><a href="/">← Voltar para a busca</a></p>
</main>
</body>
</html>
`;

export function proxy(request: NextRequest) {
  if (!overLimit(clientIp(request.headers), MAX_POR_MINUTO)) return;

  // `Retry-After` não é enfeite: é o que um robô que se comporta lê para
  // recuar.
  return new Response(PAGINA_429, {
    status: 429,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "60",
    },
  });
}

export const config = {
  // Só a ficha. A home é estática, e `/api/recommendations` já tem o freio
  // dele, com 429 em JSON e mensagem própria — passar duas vezes pelo mesmo
  // contador daria erro sem explicação.
  matcher: "/filme/:path*",
};
