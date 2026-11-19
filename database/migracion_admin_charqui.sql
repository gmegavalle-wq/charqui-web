USE charqui_web;

-- Datos opcionales del cliente; los clientes existentes quedan sin cédula.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cedula VARCHAR(20) NULL AFTER telefono;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_cedula ON usuarios (cedula);

-- Se amplían estados y datos del pedido sin convertir valores antiguos.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS zona_entrega VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS costo_envio DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS pago_confirmado TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pago_confirmado_en DATETIME NULL,
  ADD COLUMN IF NOT EXISTS pago_confirmado_por INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS sector VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS calle_principal VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS numero_domicilio VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS calle_secundaria VARCHAR(180) NULL,
  ADD COLUMN IF NOT EXISTS referencia VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS latitud DECIMAL(10, 7) NULL,
  ADD COLUMN IF NOT EXISTS longitud DECIMAL(10, 7) NULL,
  ADD COLUMN IF NOT EXISTS repartidor_nombre VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS salida_reparto DATETIME NULL,
  ADD COLUMN IF NOT EXISTS entregado_en DATETIME NULL,
  ADD COLUMN IF NOT EXISTS observaciones_entrega TEXT NULL,
  MODIFY COLUMN estado ENUM(
    'recibido_y_confirmado',
    'en_preparacion',
    'listo_para_despacho',
    'en_reparto_local',
    'entregado',
    'en_tu_puerta',
    'cancelado'
  ) NOT NULL DEFAULT 'recibido_y_confirmado';

CREATE TABLE IF NOT EXISTS historial_pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT UNSIGNED NOT NULL,
  estado_anterior VARCHAR(40) NULL,
  estado_nuevo VARCHAR(40) NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  administrador_id INT UNSIGNED NULL,
  observacion VARCHAR(500) NULL,
  visible_cliente TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_historial_pedido_fecha (pedido_id, fecha_hora),
  CONSTRAINT fk_historial_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT fk_historial_administrador FOREIGN KEY (administrador_id) REFERENCES usuarios(id)
);

-- Permite controlar si una observación se muestra al cliente, también al actualizar una instalación existente.
ALTER TABLE historial_pedidos
  ADD COLUMN IF NOT EXISTS visible_cliente TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  tipo ENUM('entrada', 'salida', 'ajuste', 'venta', 'devolucion') NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  stock_anterior INT UNSIGNED NOT NULL,
  stock_nuevo INT UNSIGNED NOT NULL,
  motivo VARCHAR(500) NULL,
  pedido_id INT UNSIGNED NULL,
  administrador_id INT UNSIGNED NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_movimiento_pedido_producto_tipo (pedido_id, producto_id, tipo),
  INDEX idx_movimiento_producto_fecha (producto_id, fecha_hora),
  CONSTRAINT fk_movimiento_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_movimiento_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT fk_movimiento_administrador FOREIGN KEY (administrador_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS zonas_envio (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  tarifa DECIMAL(10, 2) NOT NULL,
  envio_gratis TINYINT(1) NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS formas_pago (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  activa TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS configuracion_tienda (
  clave VARCHAR(80) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL
);

-- Valores iniciales iguales a las condiciones vigentes de la tienda.
INSERT IGNORE INTO zonas_envio (nombre, tarifa, envio_gratis, activa) VALUES
  ('Quito', 2.50, 0, 1),
  ('Sur de Quito', 2.50, 1, 1),
  ('Valles', 2.50, 0, 1);

INSERT IGNORE INTO formas_pago (nombre, activa)
VALUES ('Transferencia bancaria', 1);

INSERT IGNORE INTO configuracion_tienda (clave, valor)
VALUES ('envio_gratis_desde', '20.00');
