-- Nó "Buscar semana" — n8n-nodes-base.postgres
-- A home le a semana mais recente que EXISTE, nunca a semana atual: se o
-- job semanal falhar (modelo fora do ar, TMDB lento), a home mostra a
-- semana anterior em vez de vazia. Mesma doutrina do resto do produto.
SELECT week, position, title AS collection_title, label, theme, picks
  FROM home_sections
 WHERE week = (SELECT max(week) FROM home_sections)
 ORDER BY position
