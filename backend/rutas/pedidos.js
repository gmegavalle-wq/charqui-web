const express = require('express');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');
const { tarifas, envioGratisDesde, zonasEnvioGratis, formasPago } = require('./envios');

const rutas = express.Router();

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

function telefonoValido(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return /^[+0-9 ()-]{7,20}$/.test(String(telefono || '')) && digitos.length >= 7 && digitos.length <= 15;
}

async function cargarDetalles(idPedido, base = conexion) {
  const [detalles] = await base.execute(
    `SELECT d.producto_id, d.cantidad, d.subtotal, p.nombre
     FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
     WHERE d.pedido_id = ?`,
    [idPedido]
  );
  return detalles;
}

rutas.post('/', async (req, res) => {
  const datos = req.body;
  const cliente = datos.cliente || {};
  const articulos = datos.productos;
  const zona = datos.zona_entrega;
  const formaPago = datos.forma_pago;

  if (!String(cliente.nombre || '').trim() || !telefonoValido(cliente.telefono) || !correoValido(cliente.correo) ||
      !String(datos.direccion_entrega || '').trim() || !datos.consentimiento || !Object.hasOwn(tarifas, zona) ||
      !formasPago.includes(formaPago) || !Array.isArray(articulos) || !articulos.length) {
    return res.status(400).json({ error: 'Revisa los datos del pedido y acepta el uso de tus datos.' });
  }

  const correo = cliente.correo.trim().toLowerCase();
  const telefono = cliente.telefono.trim();
  let connection;

  try {
    connection = await conexion.getConnection();
    await connection.beginTransaction();
    const [usuarios] = await connection.execute(
      'SELECT id, rol FROM usuarios WHERE correo = ? FOR UPDATE', [correo]
    );
    let usuarioId;
    if (usuarios.length) {
      if (usuarios[0].rol !== 'cliente') throw new Error('Ese correo no está disponible para pedidos.');
      usuarioId = usuarios[0].id;
      await connection.execute(
        'UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?',
        [cliente.nombre.trim(), telefono, usuarioId]
      );
    } else {
      const [nuevoUsuario] = await connection.execute(
        "INSERT INTO usuarios (nombre, correo, contrasena, telefono, rol) VALUES (?, ?, NULL, ?, 'cliente')",
        [cliente.nombre.trim(), correo, telefono]
      );
      usuarioId = nuevoUsuario.insertId;
    }

    const cantidades = new Map();
    for (const articulo of articulos) {
      const id = Number(articulo.id);
      const cantidad = Number(articulo.cantidad);
      if (!Number.isInteger(id) || id < 1 || !Number.isInteger(cantidad) || cantidad < 1) {
        throw new Error('Hay un producto o cantidad no válida.');
      }
      cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
    }

    let subtotalPedido = 0;
    const detalles = [];
    for (const [id, cantidad] of cantidades) {
      const [productos] = await connection.execute(
        'SELECT id, nombre, precio, precio_oferta, stock, estado FROM productos WHERE id = ? FOR UPDATE',
        [id]
      );
      const producto = productos[0];
      if (!producto || producto.estado !== 'disponible' || Number(producto.stock) < cantidad) {
        throw new Error('Un producto está agotado o no tiene suficiente stock.');
      }
      const precio = producto.precio_oferta == null ? Number(producto.precio) : Number(producto.precio_oferta);
      const subtotal = Number((precio * cantidad).toFixed(2));
      subtotalPedido += subtotal;
      detalles.push({ id, cantidad, subtotal, nombre: producto.nombre, stock: Number(producto.stock) });
    }

    const envioGratis = zonasEnvioGratis.includes(zona) && subtotalPedido >= envioGratisDesde;
    const costoEnvio = envioGratis ? 0 : Number(tarifas[zona]);
    const total = Number((subtotalPedido + costoEnvio).toFixed(2));
    const [nuevoPedido] = await connection.execute(
      `INSERT INTO pedidos
       (usuario_id, direccion_entrega, estado, total, zona_entrega, costo_envio, forma_pago)
       VALUES (?, ?, 'recibido_y_confirmado', ?, ?, ?, ?)`,
      [usuarioId, datos.direccion_entrega.trim(), total, zona, costoEnvio, formaPago]
    );

    for (const detalle of detalles) {
      await connection.execute(
        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
        [nuevoPedido.insertId, detalle.id, detalle.cantidad, detalle.subtotal]
      );
      const stockNuevo = detalle.stock - detalle.cantidad;
      await connection.execute(
        'UPDATE productos SET stock = ?, estado = ? WHERE id = ?',
        [stockNuevo, stockNuevo === 0 ? 'agotado' : 'disponible', detalle.id]
      );
    }

    await connection.commit();
    res.status(201).json({
      id: nuevoPedido.insertId,
      total,
      subtotal: subtotalPedido,
      costo_envio: costoEnvio,
      zona_entrega: zona,
      forma_pago: formaPago,
      productos: detalles.map(({ id, cantidad, subtotal, nombre }) => ({ id, cantidad, subtotal, nombre }))
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(400).json({ error: error.message || 'No se pudo registrar el pedido.' });
  } finally {
    if (connection) connection.release();
  }
});

rutas.get('/cliente', async (req, res) => {
  const dato = (req.query.correo || req.query.telefono || '').trim();
  if (!dato) return res.status(400).json({ error: 'Escribe un correo o teléfono.' });
  try {
    const [pedidos] = await conexion.execute(
      `SELECT p.*, u.nombre, u.correo, u.telefono FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE u.correo = ? OR u.telefono = ? ORDER BY p.fecha DESC`,
      [dato.toLowerCase(), dato]
    );
    for (const pedido of pedidos) pedido.productos = await cargarDetalles(pedido.id);
    res.status(200).json(pedidos);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron buscar los pedidos.' });
  }
});

rutas.get('/', verificarAdministrador, async (req, res) => {
  try {
    const [pedidos] = await conexion.execute(
      `SELECT p.*, u.nombre, u.correo, u.telefono FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id ORDER BY p.fecha DESC`
    );
    for (const pedido of pedidos) pedido.productos = await cargarDetalles(pedido.id);
    res.status(200).json(pedidos);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los pedidos.' });
  }
});

rutas.put('/:id/estado', verificarAdministrador, async (req, res) => {
  const estados = ['recibido_y_confirmado', 'en_preparacion', 'en_reparto_local', 'en_tu_puerta', 'cancelado'];
  if (!estados.includes(req.body.estado)) return res.status(400).json({ error: 'El estado no es válido.' });
  let connection;
  try {
    connection = await conexion.getConnection();
    await connection.beginTransaction();
    const [pedidos] = await connection.execute('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!pedidos.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (pedidos[0].estado === 'cancelado' && req.body.estado !== 'cancelado') {
      await connection.rollback();
      return res.status(400).json({ error: 'Un pedido cancelado no puede reabrirse.' });
    }
    if (req.body.estado === 'cancelado' && pedidos[0].estado !== 'cancelado') {
      const detalles = await cargarDetalles(req.params.id, connection);
      for (const detalle of detalles) {
        await connection.execute(
          "UPDATE productos SET stock = stock + ?, estado = CASE WHEN estado = 'agotado' THEN 'disponible' ELSE estado END WHERE id = ?",
          [detalle.cantidad, detalle.producto_id]
        );
      }
    }
    await connection.execute('UPDATE pedidos SET estado = ? WHERE id = ?', [req.body.estado, req.params.id]);
    await connection.commit();
    res.status(200).json({ mensaje: 'Estado del pedido actualizado.' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'No se pudo cambiar el estado del pedido.' });
  } finally {
    if (connection) connection.release();
  }
});

rutas.put('/:id/pago', verificarAdministrador, async (req, res) => {
  try {
    const [resultado] = await conexion.execute(
      'UPDATE pedidos SET pago_confirmado = 1 WHERE id = ?', [req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.status(200).json({ mensaje: 'Pago confirmado.' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo confirmar el pago.' });
  }
});

module.exports = rutas;
