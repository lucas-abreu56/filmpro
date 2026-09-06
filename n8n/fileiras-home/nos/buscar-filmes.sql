-- Nó "Buscar filmes" — n8n-nodes-base.postgres
-- Independente de 'Buscar semana': busca os fatos de TODOS os filmes de
-- todas as fileiras da semana numa unica consulta, e nao um SELECT por
-- fileira. executeOnce porque nao depende de item nenhum vindo do no
-- anterior (evitaria multiplicacao N×M se dependesse).
SELECT * FROM movies
 WHERE tmdb_id IN (
   SELECT (p->>'tmdb_id')::int
     FROM home_sections h, jsonb_array_elements(h.picks) p
    WHERE h.week = (SELECT max(week) FROM home_sections)
 )
