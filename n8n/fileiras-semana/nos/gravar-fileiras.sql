-- Nó "Gravar fileiras" — n8n-nodes-base.postgres
-- A semana vem do POSTGRES, nao de JavaScript: date_trunc('week') ja
-- comeca na segunda, e calcular isso em JS abriria fuso horario e virada de
-- ano como duas fontes de erro que nao precisam existir.
INSERT INTO home_sections (week, position, theme, title, label, picks)
SELECT date_trunc('week', now())::date,
       (d->>'position')::smallint,
       d->>'theme',
       d->>'title',
       nullif(d->>'label', ''),
       d->'picks'
  FROM jsonb_array_elements($1::jsonb) AS d
-- Reexecutar a mesma semana reescreve, em vez de estourar na chave primaria.
-- E o que permite rodar de novo a mao quando uma semana saiu ruim.
ON CONFLICT (week, position) DO UPDATE
   SET theme = EXCLUDED.theme,
       title = EXCLUDED.title,
       label = EXCLUDED.label,
       picks = EXCLUDED.picks,
       created_at = now()
