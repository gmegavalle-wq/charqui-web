USE charqui_web;

-- La textura se clasifica solo cuando existe información explícita.
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS textura ENUM('crujiente', 'suave', 'sin_clasificar')
  NOT NULL DEFAULT 'sin_clasificar';

UPDATE productos
SET textura = 'crujiente'
WHERE LOWER(descripcion) LIKE '%textura%'
  AND LOWER(descripcion) LIKE '%crujiente%';

UPDATE productos
SET textura = 'suave'
WHERE LOWER(descripcion) LIKE '%textura suave%';
