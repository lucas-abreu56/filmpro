// Nó "Enfileirar temas" — n8n-nodes-base.code
// Um item por fileira, para o no HTTP seguinte fazer uma chamada por recorte.
const saida = ($input.first().json || {}).output || {};
const temas = Array.isArray(saida.temas) ? saida.temas : [];
if (!temas.length) throw new Error('O programador nao devolveu tema nenhum.');

// requestId de verdade, e nao o uuid nulo: a telemetria em 'searches' precisa
// distinguir uma busca da home semanal de outra. 'Preparar registro' aceita
// qualquer coisa e cai no uuid zerado, o que juntaria as cinco num balaio so.
function uuid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () {
    return Math.floor(Math.random() * 16).toString(16);
  });
}

return temas.slice(0, 5).map(function (t, i) {
  // O parser devolve {recorte, rotulo}. Aceita string solta tambem, caso o
  // autoFix caia no formato antigo — semana sem rotulo e melhor que sem fileira.
  const obj = t && typeof t === 'object' ? t : { recorte: t, rotulo: '' };
  return {
    json: {
      position: i + 1,
      tema: String(obj.recorte == null ? '' : obj.recorte),
      rotulo: String(obj.rotulo == null ? '' : obj.rotulo),
      requestId: uuid(),
    },
  };
});
