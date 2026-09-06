-- Nó "Temas anteriores" — n8n-nodes-base.postgres
-- Agrega de proposito: um agregado sobre conjunto vazio devolve UMA
-- linha com NULL, entao a primeira semana — tabela vazia — nao interrompe o
-- fluxo. Sem isso o no devolveria zero itens e todo o resto seria pulado,
-- justamente na estreia.
SELECT coalesce(
         nullif(string_agg(t.theme, E'\n' ORDER BY t.week DESC, t.position), ''),
         '(nenhum ainda — esta e a primeira semana)'
       ) AS anteriores
  FROM (SELECT theme, week, position
          FROM home_sections
         ORDER BY week DESC, position
         LIMIT 40) t
