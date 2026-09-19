#!/usr/bin/env node
// Controlador mínimo de Chrome headless via CDP, sem depender de puppeteer.
// Deliberadamente sem dependência: puppeteer baixa um Chromium de ~170 MB para
// fazer o que 200 linhas de CDP fazem, e captura de tela não justifica isso.
//
// Mora em scripts/, versionado, e não no scratchpad da sessão. Duas razões: a
// versão anterior foi perdida quando o scratchpad de uma sessão evaporou, e
// script escrito na hora sai em PNG — ninguém lembra da flag. É por aí que a
// regra do JPEG vaza.
//
// Uso:
//   node scripts/shot.mjs <url> <saida.jpg> [--width=1440] [--height=900] [--reduced-motion] [--delay=800] [--png] [--max-width=900] [--full]
//
// Grava JPEG q72 por padrão. Medido em 09/09/2026: a mesma tela em PNG sem
// compressão dá 5.455 KB e em JPEG q72 dá 207 KB — 96% menor, sem perder o que
// se julga numa captura (tipografia, hierarquia, espaçamento, contraste). Como
// toda captura é lida de volta por um modelo, esses megabytes viram contexto:
// eram 92% de tudo que o projeto de origem consumia, sobre 243 MB de
// transcrições. Use --png só quando o pixel exato for a pergunta (comparar
// antialiasing, renderização de fonte).
//
// --reduced-motion existe porque prefers-reduced-motion é obrigação de
// acessibilidade e precisa ser verificado com a preferência LIGADA de fato, não
// por leitura do CSS.
//
// O que este script NÃO resolve: captura estática não verifica componente com
// estado. Para isso, exercite o fluxo real.
//
// E nunca reduza a imagem mexendo no viewport (--width menor): em site
// responsivo isso captura OUTRO breakpoint, não a mesma tela menor. A redução
// tem de ser sobre o BITMAP, mantendo o viewport onde está.
//
// É o que --max-width faz, e por isso ele é o padrão (900px). Medido em
// 09/09/2026 sobre a mesma tela de 1440x2400: JPEG q72 em largura cheia dá
// 207 KB, e a 900px dá 104 KB — outra metade, com tipografia e hierarquia
// ainda legíveis. A escala é aplicada por `Page.captureScreenshot`, que
// reamostra o bitmap DEPOIS de a página renderizar no viewport pedido: o
// breakpoint continua sendo o de --width.
//
// Use --full para capturar na resolução cheia, junto com --png, quando o pixel
// exato for a pergunta.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORTA_CDP = 9222;

const CAMINHOS_CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
];

function analisarArgumentos(argv) {
  const [url, saida, ...resto] = argv;
  if (!url || !saida) {
    console.error(
      "Uso: node scripts/shot.mjs <url> <saida.jpg> [--width=1440] [--height=900] [--reduced-motion] [--delay=800] [--png] [--max-width=900] [--full]",
    );
    process.exit(1);
  }
  const opcoes = {
    width: 1440,
    height: 900,
    reducedMotion: false,
    delay: 800,
    png: false,
    maxWidth: 900,
    full: false,
  };
  for (const arg of resto) {
    if (arg === "--reduced-motion") opcoes.reducedMotion = true;
    else if (arg === "--png") opcoes.png = true;
    else if (arg.startsWith("--width=")) opcoes.width = Number(arg.slice(8));
    else if (arg.startsWith("--height=")) opcoes.height = Number(arg.slice(9));
    else if (arg.startsWith("--delay=")) opcoes.delay = Number(arg.slice(8));
    else if (arg === "--full") opcoes.full = true;
    else if (arg.startsWith("--max-width="))
      opcoes.maxWidth = Number(arg.slice(12));
  }
  // A extensão do arquivo decide junto com a flag: quem pede .png quer PNG.
  const png = opcoes.png || saida.toLowerCase().endsWith(".png");
  // --full desliga a redução; nunca amplia uma captura já menor que o alvo.
  const escala =
    opcoes.full || opcoes.maxWidth >= opcoes.width
      ? 1
      : opcoes.maxWidth / opcoes.width;
  return { url, saida, ...opcoes, png, escala };
}

function encontrarChrome() {
  for (const caminho of CAMINHOS_CHROME) {
    if (existsSync(caminho)) return caminho;
  }
  return null;
}

async function esperarCdp(porta, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (res.ok) return;
    } catch {
      // Chrome ainda não subiu o endpoint HTTP do CDP; tenta de novo.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Chrome não respondeu em /json/version a tempo.");
}

async function main() {
  const { url, saida, width, height, reducedMotion, delay, png, escala } =
    analisarArgumentos(process.argv.slice(2));

  const chromePath = encontrarChrome();
  if (!chromePath) {
    throw new Error("Chrome não encontrado nos caminhos conhecidos.");
  }

  const perfilTemp = mkdtempSync(join(tmpdir(), "filmpro-shot-"));

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      `--remote-debugging-port=${PORTA_CDP}`,
      `--user-data-dir=${perfilTemp}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--window-size=${width},${height}`,
    ],
    { stdio: "ignore" },
  );

  try {
    await esperarCdp(PORTA_CDP);

    // A aba abre EM BRANCO de propósito, e a navegação acontece depois que o
    // ouvinte de Page.loadEventFired já está no lugar (ver abaixo). Abrir já com
    // a URL aqui é uma corrida que a página local sempre ganha: o `load` dispara
    // antes do ouvinte existir, e o script espera um evento que já passou —
    // travamento sem mensagem de erro, até o timeout de quem chamou.
    const respostaAba = await fetch(
      `http://127.0.0.1:${PORTA_CDP}/json/new?about:blank`,
      { method: "PUT" },
    );
    const aba = await respostaAba.json();
    const ws = new WebSocket(aba.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let proximoId = 0;
    const pendentes = new Map();
    const mensagensConsole = [];

    ws.addEventListener("message", (evento) => {
      const msg = JSON.parse(evento.data);
      if (msg.id !== undefined && pendentes.has(msg.id)) {
        pendentes.get(msg.id)(msg);
        pendentes.delete(msg.id);
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        const texto = (msg.params.args ?? [])
          .map((a) => a.value ?? a.description ?? "")
          .join(" ");
        mensagensConsole.push({ tipo: msg.params.type, texto });
      } else if (msg.method === "Runtime.exceptionThrown") {
        mensagensConsole.push({
          tipo: "exception",
          texto: msg.params.exceptionDetails?.text ?? "",
        });
      }
    });

    function enviar(method, params = {}) {
      const id = ++proximoId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve) => pendentes.set(id, resolve));
    }

    await enviar("Page.enable");
    await enviar("Runtime.enable");
    await enviar("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    if (reducedMotion) {
      // PEGADINHA, já paga: o Chrome headless reporta "reduce" por PADRÃO. Sem
      // o override abaixo, toda captura sai com a animação desligada — e você
      // conclui que a animação não existe, ou que já respeita a preferência,
      // quando na verdade nunca rodou. Por isso os dois lados são explícitos:
      // este ramo força "reduce" de propósito, e o `else` força
      // "no-preference" para ver a animação de fato.
      await enviar("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
    } else {
      await enviar("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
    }

    // Ouvinte primeiro, navegação depois — nesta ordem, sempre. Invertido, a
    // página local carrega antes do ouvinte existir e o script trava.
    const carregou = new Promise((resolve) => {
      const aoReceber = (evento) => {
        const msg = JSON.parse(evento.data);
        if (msg.method === "Page.loadEventFired") {
          ws.removeEventListener("message", aoReceber);
          resolve();
        }
      };
      ws.addEventListener("message", aoReceber);
    });

    await enviar("Page.navigate", { url });
    await carregou;

    // Um instante depois do load para o primeiro quadro assentar — sem isto
    // a captura pega o flash inicial do CSS ainda aplicando. `--delay` maior
    // serve para capturar um ponto específico de um ciclo de animação.
    await new Promise((r) => setTimeout(r, delay));

    // `clip` cobre o viewport inteiro e `scale` reamostra o bitmap na saída.
    // A página já renderizou em `width`, então o breakpoint é o pedido — só o
    // arquivo sai menor.
    const screenshot = await enviar("Page.captureScreenshot", {
      ...(png ? { format: "png" } : { format: "jpeg", quality: 72 }),
      clip: { x: 0, y: 0, width, height, scale: escala },
      captureBeyondViewport: false,
    });

    writeFileSync(saida, Buffer.from(screenshot.result.data, "base64"));
    const kb = Math.round(
      Buffer.from(screenshot.result.data, "base64").length / 1024,
    );
    const larguraFinal = Math.round(width * escala);
    console.log(
      `Screenshot salva em ${saida} (${png ? "PNG" : "JPEG q72"}, ${larguraFinal}px de largura, ${kb} KB)`,
    );
    if (mensagensConsole.length > 0) {
      console.log("Console do navegador:");
      for (const m of mensagensConsole) console.log(`  [${m.tipo}] ${m.texto}`);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
