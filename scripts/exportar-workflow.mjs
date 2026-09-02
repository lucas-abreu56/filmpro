/**
 * Extrai o workflow do n8n em arquivos legíveis e diffáveis.
 *
 * Por que existe: o `n8n/filmpro-recomendacoes.ts` era um espelho escrito à
 * mão do workflow. Espelho escrito à mão diverge — e divergiu, em um dia. Um
 * arquivo que se anuncia como fonte de verdade e não é vale menos que arquivo
 * nenhum, porque alguém age em cima dele.
 *
 * A saída daqui é GERADA, então não pode mentir. E resolve a queixa contra o
 * backup diário em `lucas-abreu56/n8n`: lá o JSON preserva tudo e é ilegível
 * num diff, com o prompt e o SQL escondidos dentro de strings escapadas.
 * Aqui cada código sai no seu próprio arquivo, com a extensão certa.
 *
 *   node scripts/exportar-workflow.mjs n8n/workflow.json
 *
 * O JSON de entrada vem do MCP do n8n (get_workflow_details) ou do botão
 * "Download" na interface.
 */
import fs from "node:fs";
import path from "node:path";

const entrada = process.argv[2];
if (!entrada) {
  console.error("uso: node scripts/exportar-workflow.mjs <workflow.json>");
  process.exit(1);
}

const bruto = JSON.parse(fs.readFileSync(entrada, "utf8"));
const wf = bruto.workflow ?? bruto;
const destino = path.join(path.dirname(entrada), "nos");

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

/** Nome de arquivo previsível a partir do nome do nó, para o diff ser estável. */
const arquivo = (nome, ext) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + ext;

const escritos = [];
const escrever = (nome, ext, conteudo, cabecalho) => {
  const f = arquivo(nome, ext);
  fs.writeFileSync(
    path.join(destino, f),
    `${cabecalho}\n${String(conteudo).trimEnd()}\n`,
    "utf8",
  );
  escritos.push(f);
};

for (const no of wf.nodes ?? []) {
  const p = no.parameters ?? {};

  if (typeof p.jsCode === "string") {
    escrever(no.name, ".js", p.jsCode, `// Nó "${no.name}" — ${no.type}`);
  }
  if (typeof p.query === "string") {
    escrever(no.name, ".sql", p.query, `-- Nó "${no.name}" — ${no.type}`);
  }
  if (typeof p.options?.systemMessage === "string") {
    escrever(
      no.name,
      ".prompt.md",
      p.options.systemMessage,
      `<!-- System message do nó "${no.name}" -->`,
    );
  }
  if (typeof p.inputSchema === "string") {
    escrever(no.name, ".schema.json", p.inputSchema, "");
  }
}

// O mapa de ligações é o que um diff de JSON esconde pior: uma conexão movida
// vira um bloco inteiro reescrito. Em texto, vira uma linha.
const ligacoes = [];
for (const [origem, saidas] of Object.entries(wf.connections ?? {})) {
  for (const [tipo, ramos] of Object.entries(saidas)) {
    ramos.forEach((ramo, indiceSaida) => {
      for (const alvo of ramo ?? []) {
        const rotulo =
          tipo === "main" ? (ramos.length > 1 ? `[${indiceSaida}]` : "") : ` (${tipo})`;
        ligacoes.push(`${origem}${rotulo} -> ${alvo.node}`);
      }
    });
  }
}
fs.writeFileSync(
  path.join(destino, "ligacoes.txt"),
  ligacoes.sort().join("\n") + "\n",
  "utf8",
);
escritos.push("ligacoes.txt");

console.log(`${wf.name} — ${(wf.nodes ?? []).length} nós`);
console.log(`versão publicada: ${wf.activeVersionId ?? "(nenhuma)"}`);
console.log(`\n${escritos.length} arquivos em ${destino}:`);
for (const f of escritos.sort()) console.log("  " + f);
