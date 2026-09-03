/**
 * Limite de requisições mantido na memória do módulo.
 *
 * Em ambiente serverless cada instância guarda o seu próprio contador, e a
 * plataforma sobe várias sob carga. O teto real é por instância, não global:
 * isso atrapalha um script ingênuo, mas não substitui um armazenamento
 * compartilhado (Redis, Vercel KV). O README diz exatamente isso — a alegação
 * precisa caber no que o código faz.
 *
 * Copiado do convite-aniversario, onde já roda em produção. O teto aqui é mais
 * apertado (5/min contra 10/min do chat) porque cada requisição do FilmPro
 * custa uma chamada de LLM mais até 16 chamadas ao TMDB.
 */

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/**
 * De quem é esta requisição.
 *
 * **`cf-connecting-ip` vem primeiro, e isso não é preferência — é correção de
 * um defeito medido em 03/09/2026.** Com o proxy do Cloudflare ligado (desde
 * 02/09), quem abre a conexão TCP com a Vercel é o Cloudflare, então o
 * `x-forwarded-for` que chega aqui traz o IP da **borda do Cloudflare**, não o
 * do visitante. Medido em produção: `x-forwarded-for: 172.71.234.154`, que é
 * faixa do Cloudflare.
 *
 * O estrago é dos dois lados. Uma pessoa sozinha espalha as requisições por
 * várias bordas e nunca bate no teto — 50 chamadas seguidas a `/filme/274`
 * passaram sem um único 429. E pessoas diferentes que saem pela mesma borda
 * dividem o balde, então uma podia gastar o limite da outra. `5/min` em
 * `/api/recommendations` era, na prática, 5/min por servidor do Cloudflare.
 *
 * Ressalva honesta: `cf-connecting-ip` só é confiável porque o Cloudflare
 * sobrescreve o cabeçalho. O domínio `filmpro-snowy.vercel.app` chega à Vercel
 * **sem passar por ele**, e ali um cliente pode forjar o valor. Quem faz isso
 * escapa do freio — mas escapa de um contador em memória de qualquer jeito
 * (ver o comentário no topo), então não é este o cabeçalho que segura ataque.
 *
 * O `x-forwarded-for` de reserva chega como lista ("cliente, proxy1, proxy2");
 * usar a string inteira faria cada cadeia de proxy virar um balde novo, então
 * só a primeira entrada conta.
 *
 * Recebe os headers, e não a `Request`: o `proxy.ts` também precisa disto, e
 * o tipo estrutural evita arrastar `NextRequest` para dentro de `lib/`.
 */
export function clientIp(headers: {
  get(name: string): string | null;
}): string {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const forwarded = headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim() || "desconhecido";
}

export function overLimit(ip: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();

  // Filtrar o array de um IP nunca remove a chave dele. Sem esta varredura o
  // mapa cresceria enquanto a instância vivesse.
  if (now - lastSweep > windowMs) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
    lastSweep = now;
  }

  const times = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  times.push(now);
  hits.set(ip, times);

  return times.length > max;
}
