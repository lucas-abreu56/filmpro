import FilmStrip from "@/components/features/FilmStrip";
import SearchPanel from "@/components/features/SearchPanel";
import { sanitizeAuthoredText, sanitizeReasonOrNull } from "@/lib/sanitize";
import { LIMITS, type HomeSection, type HomeSectionsResponse } from "@/lib/types";

/**
 * O webhook de leitura das fileiras semanais (`FilmPro — Fileiras da Home`).
 * Sem LLM e sem TMDB do lado do n8n: ele lê `home_sections` já junto com
 * `movies`. Mesma convenção de fallback dos outros dois webhooks.
 */
const HOME_WEBHOOK_URL =
  process.env.N8N_FILMPRO_HOME_WEBHOOK ??
  "https://<seu-n8n>/webhook/filmpro/home";

/**
 * As fileiras mudam uma vez por semana, segunda às 6h. Não há motivo para
 * revalidar a cada visita como um dado ao vivo — mas também não convém o TTL
 * de dias que os *fatos* de um filme usam (`REVALIDA_S` em `/filme`), porque
 * aqui o que muda é a curadoria inteira, não só nota e provedor. Uma hora dá
 * folga para conferir a estreia de uma semana nova sem esperar o dia inteiro.
 */
const REVALIDA_HOME_S = 3600;

async function buscarFileiras(): Promise<HomeSection[]> {
  if (process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1") {
    const { FILEIRAS_FALSAS } = await import("@/lib/mock");
    return FILEIRAS_FALSAS;
  }

  // Mesma postura dos outros dois webhooks: sem chave, reclame no log em vez
  // de mandar header vazio e receber um 403 que parece problema do n8n.
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    console.error("N8N_API_KEY não está definida nas variáveis de ambiente");
    return [];
  }

  try {
    const res = await fetch(HOME_WEBHOOK_URL, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: REVALIDA_HOME_S },
    });

    if (!res.ok) {
      console.error(`Webhook de fileiras da home respondeu ${res.status}`);
      return [];
    }

    const corpo = (await res.json()) as HomeSectionsResponse;

    // Terceira passagem sobre o texto autoral (as outras duas: `Montar
    // fileiras` no n8n, e o `/api/recommendations` que gerou a curadoria
    // originalmente). A regra do projeto é que nada escrito por modelo chega
    // à tela só por já ter passado por outra camada antes.
    return (corpo.sections ?? []).map((secao) => ({
      ...secao,
      collectionTitle: sanitizeAuthoredText(secao.collectionTitle, {
        maxLength: LIMITS.MAX_COLLECTION_TITLE,
        fallback: "Seleção da semana",
      }),
      movies: secao.movies.map((m) => ({
        ...m,
        reason: sanitizeReasonOrNull(m.reason),
      })),
    }));
  } catch (err) {
    console.error("Falha ao buscar fileiras da home:", err);
    return [];
  }
}

export default async function Home() {
  const fileiras = await buscarFileiras();

  return (
    // A mesa de montagem precisa de largura: em `max-w-5xl` cabiam três
    // fotogramas de oito. O cabeçalho e a busca continuam estreitos logo
    // abaixo — texto corrido em 1344 px vira linha longa demais para ler.
    <main className="mx-auto flex w-full max-w-[84rem] flex-1 flex-col px-6 py-16 sm:py-24">
      <header className="mb-16 w-full max-w-5xl">
        <p className="text-acento font-display text-xs tracking-[0.16em] uppercase">
          FilmPro
        </p>

        {/* Display condensada em vw, para o título tocar as margens em
            qualquer largura.
            A entrelinha é 0.88, não os 0.75 do sistema da kirlian: aquele
            valor foi medido sobre caixa alta em inglês, e em português os
            diacríticos sobem acima da altura de maiúscula — a 0.78 o
            circunflexo de "VOCÊ" colidia com a linha de cima. */}
        <h1 className="font-display mt-3 text-[clamp(2.75rem,9vw,7rem)] leading-[0.88] font-medium uppercase">
          O que você
          <br />
          quer sentir
          <br />
          hoje?
        </h1>

        <p className="text-apoio mt-8 max-w-md text-sm leading-relaxed">
          Descreva o filme que você procura. Um agente cura a lista e escreve o
          motivo de cada escolha — pôster, nota, duração e onde assistir vêm do
          TMDB, não do modelo.
        </p>
      </header>

      <SearchPanel />

      {/* As fileiras semanais: abaixo da busca, de propósito — quem já sabe o
          que quer digita e nunca precisa rolar até aqui. Isto é para quem
          ainda não sabe, e prefere descobrir a descrever. */}
      {fileiras.length > 0 && (
        <div className="mt-24 flex w-full flex-col gap-20">
          {fileiras.map((secao) => (
            <section key={secao.position}>
              <header className="mb-6 max-w-5xl">
                <p className="text-apoio font-display text-xs tracking-[0.16em] uppercase">
                  Recorte da semana
                </p>
                <h2 className="font-display mt-1 text-[clamp(2.5rem,7vw,5rem)] leading-[0.85] font-medium uppercase">
                  {secao.collectionTitle}
                </h2>
              </header>

              <FilmStrip movies={secao.movies} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
