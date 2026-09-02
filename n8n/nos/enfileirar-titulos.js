// Nó "Enfileirar titulos" — n8n-nodes-base.code
const saida = $input.first().json.output || {};
const filmes = Array.isArray(saida.movies) ? saida.movies : [];
if (!filmes.length) throw new Error('O agente nao devolveu filmes.');
return filmes.map(function (f, i) {
  return { json: {
    rank: i,
    title: String(f.title || ''),
    originalTitle: String(f.originalTitle || f.title || ''),
    year: Number(f.year) || null,
    reason: String(f.reason || ''),
  } };
});
