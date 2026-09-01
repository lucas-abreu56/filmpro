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
 * O `x-forwarded-for` chega como lista ("cliente, proxy1, proxy2"). Usar a
 * string inteira como chave faria cada cadeia de proxy virar um balde novo,
 * então só a primeira entrada conta.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
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
