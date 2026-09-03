import type { Metadata } from "next";
import { Big_Shoulders, Inter } from "next/font/google";
import Cursor from "@/components/ui/Cursor";
import "./globals.css";

// Founders Grotesk X-Condensed (kirlian) e Schabo Condensed (Awwwocado) são
// pagas. A documentação da kirlian aponta Big Shoulders Display como substituta
// livre; o Google desde então fundiu a variante Display na família "Big
// Shoulders", que é a que o next/font conhece — `Big_Shoulders_Display` dá
// "Unknown font".
//
// Duas vozes, e a distinção carrega a tese do projeto: a display é a voz do
// produto; Inter carrega tudo que se lê em linha, com curadoria e metadado
// separados por tamanho e peso, não por família.
const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${display.variable} h-full antialiased`}
    >
      <body className="bg-papel text-tinta flex min-h-full flex-col font-sans">
        {/* Grão de película sobre a página inteira. Não recebe clique e some
            para quem pediu menos movimento. */}
        <div className="grao" aria-hidden="true" />
        <Cursor />
        {children}
        {modal}
      </body>
    </html>
  );
}
