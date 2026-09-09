// Trava as invariantes que existem em CÓPIA entre o Next e os nós do n8n.
//
// Por que este arquivo existe, e por que ele lê texto em vez de importar:
//
// A lista de invisíveis, o regex de texto suspeito e os limites de tamanho
// vivem em cinco arquivos diferentes, porque nó Code do n8n não resolve import
// do repositório. Já divergiram: por semanas o U+00AD existiu só do lado do
// TypeScript, e ninguém viu — não se confere a olho o que não se vê.
//
// Divergir NÃO quebra build, NÃO falha lint e NÃO dá erro em produção. O
// sintoma é um hash de cache diferente dos dois lados: nenhum acerto, nunca, e
// a conta do LLM subindo. `sanitize.ts` admite isso por escrito ("o teste
// garante o formato, não a paridade entre os dois lados"). Este arquivo é a
// paridade que faltava.
//
// Os arquivos do n8n não são módulos — referenciam `$input` e `$('Nó')` no
// escopo superior e não exportam nada. Importá-los lança ReferenceError antes
// de qualquer teste rodar. Por isso a leitura é textual, e por isso a lista de
// invisíveis é declarada POR NÚMERO nos cinco lugares: essa decisão, tomada
// antes, é o que torna a comparação possível agora.
//
// Mora em `n8n/logica/` e não em `n8n/nos/` porque
// `scripts/exportar-workflow.mjs` faz `rmSync(nos, {recursive: true})` antes de
// reescrever — um teste ali seria apagado no próximo export, sem aviso.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { LIMITS } from "../../src/lib/types.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ler(caminhoRelativo) {
  return readFileSync(join(RAIZ, caminhoRelativo), "utf8");
}

/** Todo .js sob n8n/, para que uma cópia NOVA nasça coberta em vez de invisível. */
function jsDoN8n(dir = join(RAIZ, "n8n"), achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) jsDoN8n(caminho, achados);
    else if (nome.endsWith(".js") && !nome.endsWith(".test.js")) {
      achados.push(relative(RAIZ, caminho).replace(/\\/g, "/"));
    }
  }
  return achados;
}

const ARQUIVOS_N8N = jsDoN8n();

// ---------------------------------------------------------------------------
// 1. A lista de invisíveis
// ---------------------------------------------------------------------------

/** Extrai `[0x200b, 0x200c, ...]` da declaração, seja qual for o nome dela. */
function invisiveisDe(fonte) {
  const m = fonte.match(/(?:INVISIVEIS|PROIBIDO_INVISIVEL)\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const numeros = m[1].match(/0x[0-9a-f]+/gi);
  return numeros ? numeros.map((n) => parseInt(n, 16)).sort((a, b) => a - b) : [];
}

describe("paridade — a lista de caracteres invisíveis", () => {
  const daFonte = invisiveisDe(ler("src/lib/sanitize.ts"));

  it("está declarada em src/lib/sanitize.ts, a fonte de verdade", () => {
    assert.ok(
      daFonte && daFonte.length > 0,
      "não achei a lista em sanitize.ts — se ela mudou de nome ou de formato, " +
        "esta regex parou de casar e todos os testes abaixo passariam à toa",
    );
    // O U+00AD (soft hyphen) é justamente o que faltava do lado do n8n.
    assert.ok(daFonte.includes(0x00ad), "o soft hyphen U+00AD sumiu da fonte");
  });

  const comLista = ARQUIVOS_N8N.filter((f) => invisiveisDe(ler(f)) !== null);

  it("é copiada em pelo menos três nós do n8n", () => {
    assert.ok(
      comLista.length >= 3,
      `só ${comLista.length} arquivo(s) do n8n declaram a lista. Ou um nó parou ` +
        "de limpar invisível, ou a regex daqui parou de casar.",
    );
  });

  for (const arquivo of comLista) {
    it(`${arquivo} tem exatamente a mesma lista`, () => {
      assert.deepEqual(
        invisiveisDe(ler(arquivo)),
        daFonte,
        `${arquivo} divergiu de src/lib/sanitize.ts. Isso não gera erro em ` +
          "produção: só um hash de cache diferente e um acerto que nunca acontece.",
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 2. O regex de texto suspeito
// ---------------------------------------------------------------------------

/**
 * `sanitize.ts` escreve `<[a-z/]` e os nós escrevem `<[a-z\/]`. É o mesmo
 * regex — a barra escapada dentro da classe é redundante. Normalizar antes de
 * comparar, senão o teste nasce vermelho por um não-problema e alguém o desliga.
 *
 * Casa até o `;` e não até a primeira `/` porque o próprio regex contém `/`
 * literal dentro de classe (`<[a-z/]`), e o Prettier quebra a declaração de
 * `sanitize.ts` em duas linhas.
 */
function regexSuspeito(fonte) {
  const m = fonte.match(/(?:SUSPEITO|PROIBIDO)\s*=\s*(\/.+\/[a-z]*);/s);
  return m ? m[1].replace(/\\\//g, "/") : null;
}

describe("paridade — o regex de link, tag e esquema perigoso", () => {
  const daFonte = regexSuspeito(ler("src/lib/sanitize.ts"));

  it("está declarado em src/lib/sanitize.ts", () => {
    assert.ok(daFonte, "não achei o regex SUSPEITO em sanitize.ts");
  });

  const comRegex = ARQUIVOS_N8N.filter((f) => regexSuspeito(ler(f)) !== null);

  it("é copiado em pelo menos três nós do n8n", () => {
    assert.ok(comRegex.length >= 3, `só ${comRegex.length} arquivo(s) o declaram`);
  });

  for (const arquivo of comRegex) {
    it(`${arquivo} tem o mesmo regex`, () => {
      assert.equal(
        regexSuspeito(ler(arquivo)),
        daFonte,
        `${arquivo} filtra texto suspeito com regra diferente do Next. Um dos ` +
          "dois lados deixa passar o que o outro barra.",
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Os números assados em mais de um lugar
// ---------------------------------------------------------------------------

describe("paridade — os limites de tamanho", () => {
  const respostaSchema = JSON.parse(ler("n8n/nos/formato-da-resposta.schema.json"));
  const temasSchema = JSON.parse(
    ler("n8n/fileiras-semana/nos/formato-dos-temas.schema.json"),
  );

  it("MAX_REASON bate no schema do curador", () => {
    assert.equal(
      respostaSchema.properties.movies.items.properties.reason.maxLength,
      LIMITS.MAX_REASON,
    );
  });

  it("MAX_COLLECTION_TITLE bate no schema do curador", () => {
    assert.equal(
      respostaSchema.properties.collectionTitle.maxLength,
      LIMITS.MAX_COLLECTION_TITLE,
    );
  });

  it("MAX_SECTION_LABEL bate no schema dos temas", () => {
    const props = temasSchema.properties.temas.items.properties;
    const label = props.label ?? props.rotulo;
    assert.ok(label, "o schema de temas não tem mais a propriedade do rótulo");
    assert.equal(label.maxLength, LIMITS.MAX_SECTION_LABEL);
  });

  /** Os `limpar(campo, N)` espalhados pelos montadores. */
  function limitesDe(fonte, campo) {
    const re = new RegExp(
      `limpar\\(\\s*[\\w.]*\\b${campo}\\s*,\\s*(\\d+)\\s*\\)`,
      "g",
    );
    return [...fonte.matchAll(re)].map((m) => Number(m[1]));
  }

  it("todo limpar(reason, N) usa MAX_REASON", () => {
    let achou = 0;
    for (const arquivo of ARQUIVOS_N8N) {
      for (const n of limitesDe(ler(arquivo), "reason")) {
        achou++;
        assert.equal(
          n,
          LIMITS.MAX_REASON,
          `${arquivo} corta reason em ${n}, e LIMITS.MAX_REASON é ${LIMITS.MAX_REASON}`,
        );
      }
    }
    assert.ok(achou >= 3, `só ${achou} chamada(s) de limpar(reason, N) encontradas`);
  });

  it("todo limpar(label, N) usa MAX_SECTION_LABEL", () => {
    let achou = 0;
    for (const arquivo of ARQUIVOS_N8N) {
      for (const n of limitesDe(ler(arquivo), "label")) {
        achou++;
        assert.equal(n, LIMITS.MAX_SECTION_LABEL, `${arquivo} corta label em ${n}`);
      }
    }
    assert.ok(achou >= 1, "nenhuma chamada de limpar(s.label, N) encontrada");
  });

  /**
   * A folga de candidatos e o teto do schema TÊM de andar juntos: o curador
   * devolve `limit + folga` títulos, e se `maxItems` for menor o parser recusa
   * a resposta inteira no limit máximo. Já aconteceu na execução 2092.
   */
  it("maxItems do schema comporta o pedido máximo (MAX_LIMIT + folga)", () => {
    const folga = ler("n8n/nos/validar-entrada.js").match(
      /pedir:\s*limit\s*\+\s*(\d+)/,
    );
    assert.ok(folga, "não achei `pedir: limit + N` em validar-entrada.js");
    assert.equal(
      respostaSchema.properties.movies.maxItems,
      LIMITS.MAX_LIMIT + Number(folga[1]),
      `o curador pode devolver ${LIMITS.MAX_LIMIT} + ${folga[1]} títulos, e o ` +
        `schema aceita no máximo ${respostaSchema.properties.movies.maxItems}. ` +
        "No limit máximo o parser recusaria a resposta (execução 2092).",
    );
  });
});

// ---------------------------------------------------------------------------
// 4. O módulo testável contra o nó publicado
// ---------------------------------------------------------------------------

describe("paridade — n8n/logica/ contra o nó que roda em produção", () => {
  // `pontuar()` é testada em pontuar-correspondencia.test.js, mas quem roda em
  // produção é a cópia dentro do `jsCode`. Sem esta comparação, o teste de
  // mesa passaria verde enquanto o nó fizesse outra conta — que é a ilusão
  // mais perigosa que um teste pode dar.
  //
  // Compara o corpo com espaço colapsado: indentação difere sem mudar
  // comportamento, e um teste que falha por espaço acaba desligado.
  function corpoDe(fonte, assinatura) {
    const i = fonte.indexOf(assinatura);
    if (i === -1) return null;
    // Do início da função até a linha que fecha na coluna 0.
    const resto = fonte.slice(i);
    const fim = resto.indexOf("\n}");
    return fim === -1 ? null : resto.slice(0, fim + 2).replace(/\s+/g, " ").trim();
  }

  const modulo = ler("n8n/logica/pontuar-correspondencia.js");
  const no = ler("n8n/nos/escolher-correspondencia.js");

  it("a função pontuar() é idêntica nos dois lados", () => {
    const doModulo = corpoDe(modulo, "function pontuar(");
    const doNo = corpoDe(no, "function pontuar(");
    assert.ok(doModulo, "não achei pontuar() em n8n/logica/");
    assert.ok(doNo, "não achei pontuar() no nó");
    assert.equal(
      doNo,
      doModulo,
      "a pontuação do nó divergiu do módulo testado. Os testes de mesa estariam " +
        "validando código que não é o que roda em produção.",
    );
  });

  it("a função normalizar() é idêntica nos dois lados", () => {
    const doModulo = corpoDe(modulo, "function normalizar(");
    const doNo = corpoDe(no, "function normalizar(");
    assert.ok(doModulo && doNo, "não achei normalizar() em um dos lados");
    assert.equal(doNo, doModulo, "normalizar() divergiu entre módulo e nó");
  });
});

// ---------------------------------------------------------------------------
// 5. Lixo do ciclo export → cola → export
// ---------------------------------------------------------------------------

describe("higiene dos arquivos gerados", () => {
  // `escolher-correspondencia.js` e `montar-resposta.js` já nasceram com o
  // cabeçalho duplicado: alguém colou no n8n um arquivo que o export tinha
  // gerado, e o cabeçalho entrou no jsCode publicado. Sem isto, acumula.
  for (const arquivo of ARQUIVOS_N8N) {
    it(`${arquivo} não tem o cabeçalho do export duplicado`, () => {
      const cabecalhos = ler(arquivo)
        .split("\n")
        .slice(0, 5)
        .filter((l) => l.startsWith('// Nó "'));
      assert.ok(
        cabecalhos.length <= 1,
        `${cabecalhos.length} cabeçalhos. O jsCode publicado no n8n já contém ` +
          "um cabeçalho de exportação anterior — tire a linha repetida lá.",
      );
    });
  }
});
