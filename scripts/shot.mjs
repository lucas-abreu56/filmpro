#!/usr/bin/env node
// Controlador mínimo de Chrome headless via CDP, sem depender de puppeteer.
// Reescrito em 07/09/2026: a versão anterior ficou perdida no scratchpad de
// uma sessão antiga (ver docs/NOTES.local.md). Desta vez fica em scripts/.
//
// Uso:
//   node scripts/shot.mjs <url> <saida.png> [--width=1440] [--height=900] [--reduced-motion] [--delay=800]

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
      "Uso: node scripts/shot.mjs <url> <saida.png> [--width=1440] [--height=900] [--reduced-motion]",
    );
    process.exit(1);
  }
  const opcoes = { width: 1440, height: 900, reducedMotion: false, delay: 800 };
  for (const arg of resto) {
    if (arg === "--reduced-motion") opcoes.reducedMotion = true;
    else if (arg.startsWith("--width=")) opcoes.width = Number(arg.slice(8));
    else if (arg.startsWith("--height=")) opcoes.height = Number(arg.slice(9));
    else if (arg.startsWith("--delay=")) opcoes.delay = Number(arg.slice(8));
  }
  return { url, saida, ...opcoes };
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
  const { url, saida, width, height, reducedMotion, delay } = analisarArgumentos(
    process.argv.slice(2),
  );

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

    const respostaAba = await fetch(
      `http://127.0.0.1:${PORTA_CDP}/json/new?${encodeURIComponent(url)}`,
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
      // Sem isto o Chrome headless já reporta "reduce" por padrão — é a
      // pegadinha registrada em docs/planos/plano-home-visual.local.md.
      // Aqui o pedido explícito serve para o caso contrário: forçar "no-preference"
      // quando se quer ver a animação de propósito.
      await enviar("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
    } else {
      await enviar("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
    }

    await new Promise((resolve) => {
      const aoReceber = (evento) => {
        const msg = JSON.parse(evento.data);
        if (msg.method === "Page.loadEventFired") {
          ws.removeEventListener("message", aoReceber);
          resolve();
        }
      };
      ws.addEventListener("message", aoReceber);
    });

    // Um instante depois do load para o primeiro quadro assentar — sem isto
    // a captura pega o flash inicial do CSS ainda aplicando. `--delay` maior
    // serve para capturar um ponto específico de um ciclo de animação.
    await new Promise((r) => setTimeout(r, delay));

    const screenshot = await enviar("Page.captureScreenshot", {
      format: "png",
    });

    writeFileSync(saida, Buffer.from(screenshot.result.data, "base64"));
    console.log(`Screenshot salva em ${saida}`);
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
