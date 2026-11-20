USE charqui_web;

-- La unidad de producción mayorista no cambia la presentación minorista.
CREATE TABLE IF NOT EXISTS configuracion_producto_mayorista (
  producto_id INT UNSIGNED PRIMARY KEY,
  unidad VARCHAR(40) NOT NULL,
  gestiona_produccion TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_config_producto_mayorista FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- CHARQUI vende las patitas minoristas en paquetes; mayoreo las solicita por pieza.
INSERT IGNORE INTO configuracion_producto_mayorista (producto_id, unidad, gestiona_produccion)
SELECT id, 'patita', 1 FROM productos WHERE LOWER(nombre) LIKE '%patitas%pollo%';

-- Solicitudes públicas; la clave evita duplicados por reintento.
CREATE TABLE IF NOT EXISTS solicitudes_mayoristas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave_solicitud CHAR(36) NOT NULL UNIQUE,
  negocio VARCHAR(150) NOT NULL,
  contacto VARCHAR(120) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  whatsapp VARCHAR(30) NOT NULL,
  correo VARCHAR(150) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  sector_direccion VARCHAR(255) NULL,
  tipo_negocio VARCHAR(80) NOT NULL,
  otro_tipo_negocio VARCHAR(100) NULL,
  observaciones TEXT NULL,
  consentimiento_datos TINYINT(1) NOT NULL DEFAULT 0,
  estado ENUM('nueva','en_revision','cotizacion_preparada','cotizacion_enviada','aceptada','rechazada','vencida','convertida_en_pedido') NOT NULL DEFAULT 'nueva',
  usuario_id INT UNSIGNED NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_solicitud_mayorista_estado_fecha (estado, fecha),
  INDEX idx_solicitud_mayorista_correo (correo),
  CONSTRAINT fk_solicitud_mayorista_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS detalle_solicitud_mayorista (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  nombre_producto VARCHAR(150) NOT NULL,
  presentacion VARCHAR(255) NULL,
  unidad VARCHAR(40) NOT NULL,
  gestiona_produccion TINYINT(1) NOT NULL DEFAULT 0,
  cantidad INT UNSIGNED NOT NULL,
  INDEX idx_detalle_solicitud_mayorista_solicitud (solicitud_id),
  CONSTRAINT fk_detalle_solicitud_mayorista_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_mayoristas(id),
  CONSTRAINT fk_detalle_solicitud_mayorista_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS cotizaciones_mayoristas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT UNSIGNED NOT NULL,
  estado ENUM('borrador','preparada','enviada','aceptada','rechazada','vencida','convertida_en_pedido') NOT NULL DEFAULT 'borrador',
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  envio DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  condiciones_pago VARCHAR(500) NULL,
  vigencia DATE NULL,
  observaciones_internas TEXT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cotizacion_mayorista_solicitud (solicitud_id, fecha),
  CONSTRAINT fk_cotizacion_mayorista_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_mayoristas(id)
);

CREATE TABLE IF NOT EXISTS detalle_cotizacion_mayorista (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cotizacion_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  nombre_producto VARCHAR(150) NOT NULL,
  presentacion VARCHAR(255) NULL,
  unidad VARCHAR(40) NOT NULL,
  gestiona_produccion TINYINT(1) NOT NULL DEFAULT 0,
  cantidad INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10,3) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  INDEX idx_detalle_cotizacion_mayorista_cotizacion (cotizacion_id),
  CONSTRAINT fk_detalle_cotizacion_mayorista_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones_mayoristas(id),
  CONSTRAINT fk_detalle_cotizacion_mayorista_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS historial_mayoristas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT UNSIGNED NOT NULL,
  cotizacion_id INT UNSIGNED NULL,
  administrador_id INT UNSIGNED NULL,
  evento VARCHAR(80) NOT NULL,
  detalle TEXT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_historial_mayorista_solicitud_fecha (solicitud_id, fecha),
  CONSTRAINT fk_historial_mayorista_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_mayoristas(id),
  CONSTRAINT fk_historial_mayorista_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones_mayoristas(id),
  CONSTRAINT fk_historial_mayorista_administrador FOREIGN KEY (administrador_id) REFERENCES usuarios(id)
);

-- Enlace a pedidos compartidos y detalle histórico con el precio exacto acordado.
CREATE TABLE IF NOT EXISTS pedidos_mayoristas (
  pedido_id INT UNSIGNED PRIMARY KEY,
  cotizacion_id INT UNSIGNED NOT NULL UNIQUE,
  fecha_entrega DATE NOT NULL,
  condiciones_pago VARCHAR(500) NULL,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  envio DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_pedido_mayorista_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT fk_pedido_mayorista_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones_mayoristas(id)
);

CREATE TABLE IF NOT EXISTS detalle_pedido_mayorista (
  detalle_pedido_id INT UNSIGNED PRIMARY KEY,
  nombre_producto VARCHAR(150) NOT NULL,
  precio_unitario DECIMAL(10,3) NOT NULL,
  CONSTRAINT fk_detalle_pedido_mayorista_detalle FOREIGN KEY (detalle_pedido_id) REFERENCES detalle_pedido(id)
);

-- La capacidad se declara por fecha y se compara al confirmar pedidos de patitas.
CREATE TABLE IF NOT EXISTS capacidad_produccion_patitas (
  fecha_entrega DATE PRIMARY KEY,
  capacidad_unidades INT UNSIGNED NOT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produccion_patitas_mayorista (
  detalle_pedido_id INT UNSIGNED PRIMARY KEY,
  fecha_entrega DATE NOT NULL,
  unidades_pedidas INT UNSIGNED NOT NULL,
  unidades_producidas INT UNSIGNED NOT NULL DEFAULT 0,
  unidades_listas INT UNSIGNED NOT NULL DEFAULT 0,
  unidades_entregadas INT UNSIGNED NOT NULL DEFAULT 0,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_produccion_patitas_fecha (fecha_entrega),
  CONSTRAINT fk_produccion_patitas_detalle FOREIGN KEY (detalle_pedido_id) REFERENCES detalle_pedido(id)
);
