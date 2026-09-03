// Nó "Validar id" — n8n-nodes-base.code
// O id chega da query string de um webhook PUBLICO. So pode ser inteiro
// positivo; qualquer outra coisa vira 0, que nao casa com linha nenhuma e
// termina em 404 honesto. A defesa de verdade contra injecao e o $1
// parametrizado no no seguinte — isto aqui e o cinto de seguranca.
//
// Ate 03/09/2026 este workflow concatenava o valor cru dentro do SELECT.
const bruto = ($input.first().json.query || {}).id;
const n = Number(bruto);
const tmdbId = Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0;

return [{ json: { tmdbId: tmdbId } }];
