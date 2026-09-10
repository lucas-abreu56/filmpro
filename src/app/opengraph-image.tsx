import { ImageResponse } from "next/og";

/**
 * A imagem que aparece quando um link do FilmPro é colado no WhatsApp, Slack,
 * LinkedIn. Antes disto o unfurl vinha nu — sem imagem, título "FilmPro".
 *
 * A identidade é a mesma da página: papel creme (`--color-papel`), tinta
 * marrom-vinho (`--color-tinta`), uma palavra em acento vermelho
 * (`--color-acento`), e a display condensada (Big Shoulders) na voz do
 * produto. Os valores são literais, não os tokens CSS — `ImageResponse` roda
 * no satori, que não lê `globals.css`.
 *
 * A fonte vem do mesmo lugar que o `next/font` a busca (fonts.gstatic.com),
 * pelo `fetch` abaixo. Não é dependência nova: é a fonte que o projeto já usa,
 * pelo mesmo caminho. O `User-Agent` de browser é necessário — sem ele o
 * Google serve WOFF2, que o satori não decodifica.
 */

export const alt = "FilmPro — cinema por curadoria de IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPEL = "#fdf6e4";
const TINTA = "#531a0f";
const ACENTO = "#c52e2e";

async function carregarDisplay(): Promise<ArrayBuffer> {
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600&display=swap";
  const css = await fetch(cssUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }).then((r) => r.text());

  const ttfUrl = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1];
  if (!ttfUrl) throw new Error("URL do TTF não encontrada no CSS do Google Fonts");

  return fetch(ttfUrl).then((r) => r.arrayBuffer());
}

export default async function Image() {
  const display = await carregarDisplay();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPEL,
          color: TINTA,
          padding: "72px 80px",
          fontFamily: "Big Shoulders",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          FilmPro
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 128,
            fontWeight: 600,
            lineHeight: 0.9,
            textTransform: "uppercase",
          }}
        >
          <span>O que você</span>
          <span style={{ display: "flex", gap: "0.28em" }}>
            <span>quer</span>
            <span style={{ color: ACENTO }}>sentir</span>
          </span>
          <span>hoje?</span>
        </div>

        <div style={{ fontSize: 30, lineHeight: 1.35, maxWidth: 820 }}>
          Um agente de IA cura a lista e explica cada escolha. Pôster, nota e
          onde assistir vêm do TMDB.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Big Shoulders", data: display, style: "normal", weight: 600 }],
    },
  );
}
