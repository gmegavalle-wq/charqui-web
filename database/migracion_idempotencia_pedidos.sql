-- Idempotency records for checkout order creation.
-- Select the intended database before applying. Test against charqui_web_test first;
-- do not apply to a production database without a separately approved deployment.
CREATE TABLE IF NOT EXISTS idempotencia_pedidos (
  clave CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  huella_solicitud CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  pedido_id INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  UNIQUE KEY uq_idempotencia_pedidos_pedido (pedido_id),
  CONSTRAINT fk_idempotencia_pedidos_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
