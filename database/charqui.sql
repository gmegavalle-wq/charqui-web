CREATE DATABASE IF NOT EXISTS charqui_web;
USE charqui_web;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  rol ENUM('cliente', 'administrador') NOT NULL DEFAULT 'cliente'
);

CREATE TABLE IF NOT EXISTS productos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  imagen VARCHAR(255),
  estado ENUM('disponible', 'agotado', 'inactivo') NOT NULL DEFAULT 'disponible'
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  direccion_entrega VARCHAR(255) NOT NULL,
  estado ENUM(
    'recibido_y_confirmado',
    'en_preparacion',
    'en_reparto_local',
    'en_tu_puerta',
    'cancelado'
  ) NOT NULL DEFAULT 'recibido_y_confirmado',
  total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Estas modificaciones se pueden ejecutar también en la base ya creada.
ALTER TABLE usuarios
  MODIFY contrasena VARCHAR(255) NULL;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo_mascota ENUM('perro', 'gato', 'ambos') NOT NULL DEFAULT 'ambos',
  ADD COLUMN IF NOT EXISTS info_nutricional TEXT,
  ADD COLUMN IF NOT EXISTS presentaciones VARCHAR(255),
  ADD COLUMN IF NOT EXISTS precio_oferta DECIMAL(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS textura ENUM('crujiente', 'suave', 'sin_clasificar') NOT NULL DEFAULT 'sin_clasificar';

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS zona_entrega VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS costo_envio DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS pago_confirmado TINYINT NOT NULL DEFAULT 0;
