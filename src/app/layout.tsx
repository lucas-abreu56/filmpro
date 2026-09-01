import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

// Archivo no lugar de Korolev (República Pureza) e Riforma (MUBI) — as duas são
// pagas, e as duas documentações apontam Archivo como substituta justamente por
// ter eixo de largura. `axes: ["wdth"]` traz a variável completa, para poder
// condensar os títulos (font-variation-settings: "wdth" 80) como no original.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FilmPro",
  description:
    "Descreva o que você quer assistir. Um agente de IA cura a lista e explica cada escolha; pôster, nota e onde assistir vêm do TMDB.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${archivo.variable} h-full antialiased`}
    >
      {/* Preto de projeção e nada mais no fundo: a imagem do filme é a única
          fonte de luz da tela. Sem halo, sem gradiente — foi o que motivou
          descartar o Luminous. */}
      <body className="bg-projecao text-gelo flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
