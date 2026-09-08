import { NextResponse } from "next/server";

import { enxugarFilme } from "@/lib/enxugar";
import { clientIp, overLimit } from "@/lib/rateLimit";
import { sanitizeAuthoredText } from "@/lib/sanitize";
import { LIMITS, type Movie, type RecommendationsResponse } from "@/lib/types";

/**
 * O agente mais o enriquecimento no TMDB não cabem no teto padrão de função
 * serverless. `maxDuration` é config de rota do Next 16; o valor que a
 * plataforma aceita depende do plano, então confira no painel da Vercel antes
 * de confiar em 60.
 *
 * Este comentário já disse "o agente (4–12 s)". Era falso: medido em
 * 03/09/2026, o nó do curador levava de 58 a 77 s, e 22% das buscas frias
 * registradas passavam dos 45 s abaixo — ou seja, falhavam. A causa era o
 * modelo, trocado para `gemini-3.1-flash-lite` no mesmo dia. Depois da troca,
 * cinco buscas frias deram 6,4 a 32,6 s, e o TMDB somou 1,7 s.
 */
export const maxDuration = 60;

/**
 * Dispara antes do teto da plataforma de propósito: assim quem responde 504
 * somos nós, com mensagem em português, em vez de a Vercel devolver a página
 * de erro genérica dela.
 */
const N8N_TIMEOUT_MS = 45_000;

/** 5/min, não os 10/min do chat do convite: cada requisição aqui custa uma
 *  chamada de LLM mais até 16 chamadas ao TMDB. */
const MAX_POR_MINUTO = 5;

export async function POST(request: Request) {
  try {
    if (overLimit(clientIp(request.headers), MAX_POR_MINUTO)) {
      return NextResponse.json(
        { error: "Muitas buscas seguidas. Espere um minuto e tente de novo." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
    }

    const { preferences, limit } = (body ?? {}) as {
      preferences?: unknown;
      limit?: unknown;
    };

    if (typeof preferences !== "string") {
      return NextResponse.json(
        { error: "Descreva o que você quer assistir." },
        { status: 400 },
      );
    }

    const texto = preferences.trim();

    // O textarea já limita, mas o textarea é do cliente. Sem teto no servidor,
    // um texto enorme vira custo de token e latência para todo mundo.
    if (texto.length < LIMITS.MIN_PREFERENCES) {
      return NextResponse.json(
        { error: `Escreva pelo menos ${LIMITS.MIN_PREFERENCES} caracteres.` },
        { status: 400 },
      );
    }
    if (texto.length > LIMITS.MAX_PREFERENCES) {
      return NextResponse.json(
        { error: `Máximo de ${LIMITS.MAX_PREFERENCES} caracteres.` },
        { status: 400 },
      );
    }

    // Limite é sugestão do cliente, decisão do servidor.
    const quantos =
      typeof limit === "number" && Number.isInteger(limit)
        ? Math.min(Math.max(limit, 1), LIMITS.MAX_LIMIT)
        : LIMITS.DEFAULT_LIMIT;

    const apiKey = process.env.N8N_API_KEY;
    if (!apiKey) {
      console.error("N8N_API_KEY não está definida nas variáveis de ambiente");
      return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }

    // A URL do webhook é obrigatória, e **sem default** — os três webhooks
    // seguem esta mesma postura. Ela já teve um `?? "https://n8n.…/webhook/…"`,
    // e aquilo custava duas coisas:
    //
    // 1. Publicava o host do n8n num repositório que vai a público. Hoje esse
    //    endereço é invisível de fora, porque quem fala com o n8n é o servidor.
    // 2. `??` só cobre `undefined`. Uma variável PRESENTE E VAZIA — que é
    //    exatamente o que o `.env.example` entrega — escapava do fallback e
    //    virava `fetch("")`, com erro que não dizia o que faltava. `!url` cobre
    //    os dois casos.
    //
    // Aponte para `/webhook-test/...` durante o desenvolvimento do workflow.
    const webhookUrl = process.env.N8N_FILMPRO_WEBHOOK;
    if (!webhookUrl) {
      console.error(
        "N8N_FILMPRO_WEBHOOK não está definida nas variáveis de ambiente",
      );
      return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }

    // Correlaciona o log da Vercel com a execução no n8n. O IP não vai junto:
    // é PII, e o rate limit já foi resolvido acima.
    const requestId = crypto.randomUUID();

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ preferences: texto, limit: quantos, requestId }),
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`n8n respondeu ${response.status} (requestId ${requestId})`);

      // O workflow devolve 503 com `{error}` quando o modelo principal e a
      // reserva falham juntos — cota estourada, provedor fora. Repassar essa
      // frase importa: ela diz que é indisponibilidade momentânea e que vale
      // tentar de novo, enquanto a genérica sugere defeito e não sugere ação.
      //
      // Mesmo vindo do nosso workflow, o texto passa pela validação de texto
      // autoral antes de ser renderizado. É a mesma regra do `reason`: nada
      // que vá para a tela escapa dela só por vir de dentro de casa.
      const doN8n = await response
        .json()
        .then((corpo: unknown) => (corpo as { error?: unknown })?.error)
        .catch(() => null);

      const mensagem = sanitizeAuthoredText(doN8n, {
        maxLength: 160,
        fallback: "O serviço de recomendação falhou. Tente de novo.",
      });

      return NextResponse.json(
        { error: mensagem },
        { status: response.status === 503 ? 503 : 502 },
      );
    }

    const data = (await response.json()) as RecommendationsResponse;
    return NextResponse.json(limparTextoAutoral(data));
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("n8n estourou o tempo na busca de recomendações");
      return NextResponse.json(
        { error: "A busca demorou demais. Tente de novo em instantes." },
        { status: 504 },
      );
    }
    console.error("Erro ao buscar recomendações:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/**
 * Segunda passagem sobre os dois campos que o modelo escreve.
 *
 * O n8n já valida antes de gravar no cache; isto roda de novo antes de a
 * resposta sair, porque um registro envenenado que tenha entrado no cache
 * antes desta regra existir continuaria sendo servido.
 */
function limparTextoAutoral(
  data: RecommendationsResponse,
): RecommendationsResponse {
  return {
    ...data,
    collectionTitle: sanitizeAuthoredText(data.collectionTitle, {
      maxLength: LIMITS.MAX_COLLECTION_TITLE,
      fallback: "Recomendações",
    }),
    // `enxugarFilme` no mesmo passo: os campos que a interface não desenha
    // saem aqui, antes de o JSON descer para o browser.
    movies: (data.movies ?? []).map(
      (movie: Movie): Movie => ({
        ...enxugarFilme(movie),
        reason: sanitizeAuthoredText(movie.reason, {
          maxLength: LIMITS.MAX_REASON,
          fallback: "Escolhido pela curadoria para esta busca.",
        }),
      }),
    ),
  };
}
