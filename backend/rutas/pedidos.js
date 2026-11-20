const express = require('express');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');
const { cargarConfiguracion } = require('./envios');

const rutas = express.Router();
const transiciones = {
  recibido_y_confirmado: ['en_preparacion'],
  en_preparacion: ['listo_para_despacho'],
  listo_para_despacho: ['en_reparto_local'],
  en_reparto_local: ['entregado'],
  entregado: [],
  en_tu_puerta: [],
  cancelado: []
};
const estadosNuevos = Object.keys(transiciones).filter((estado) => estado !== 'en_tu_puerta');

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

function telefonoValido(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return /^[+0-9 ()-]{7,20}$/.test(String(telefono || '')) && digitos.length >= 7 && digitos.length <= 15;
}

function coordenadasValidas(latitud, longitud) {
  if ((latitud === '' || latitud == null) && (longitud === '' || longitud == null)) return true;
  const lat = Number(latitud);
  const lon = Number(longitud);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

async function cargarDetalles(idPedido, base = conexion) {
  const [detalles] = await base.execute(
    `SELECT d.producto_id, d.cantidad, d.subtotal,
       COALESCE(dm.precio_unitario, ROUND(d.subtotal / NULLIF(d.cantidad, 0), 2)) AS precio_unitario,
       COALESCE(dm.nombre_producto, p.nombre) AS nombre
     FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
     LEFT JOIN detalle_pedido_mayorista dm ON dm.detalle_pedido_id = d.id
     WHERE d.pedido_id = ? ORDER BY d.id`, [idPedido]
  );
  return detalles;
}

async function cargarHistorial(idPedido, base = conexion, soloVisible = false) {
  const [historial] = await base.execute(
    `SELECT h.estado_anterior, h.estado_nuevo, h.fecha_hora, h.observacion,
       u.nombre AS administrador
     FROM historial_pedidos h LEFT JOIN usuarios u ON u.id = h.administrador_id
     WHERE h.pedido_id = ? ${soloVisible ? 'AND h.visible_cliente = 1' : ''}
     ORDER BY h.fecha_hora, h.id`, [idPedido]
  );
  return historial;
}

rutas.post('/', async (req, res) => {
  const datos = req.body || {};
  const cliente = datos.cliente || {};
  const articulos = datos.productos;
  const cedula = String(cliente.cedula || '').replace(/\D/g, '');
  const direccion = String(datos.direccion_entrega || '').trim();
  const zona = String(datos.zona_entrega || '');
  const formaPago = String(datos.forma_pago || '');
  const latitud = datos.latitud == null || datos.latitud === '' ? null : Number(datos.latitud);
  const longitud = datos.longitud == null || datos.longitud === '' ? null : Number(datos.longitud);

  if (!String(cliente.nombre || '').trim() || !telefonoValido(cliente.telefono) || !correoValido(cliente.correo) ||
      !direccion || !datos.consentimiento || (cedula && !/^\d{6,20}$/.test(cedula)) ||
      !coordenadasValidas(latitud, longitud) || !Array.isArray(articulos) || !articulos.length) {
    return res.status(400).json({ error: 'Revisa tus datos, dirección y consentimiento antes de confirmar.' });
  }

  const correo = cliente.correo.trim().toLowerCase();
  const telefono = cliente.telefono.trim();
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const configuracion = await cargarConfiguracion(transaccion);
    if (!Object.hasOwn(configuracion.tarifas, zona) || !configuracion.formas_pago.includes(formaPago)) {
      const error = new Error('La zona o forma de pago ya no está disponible. Actualiza la página.');
      error.status = 409;
      throw error;
    }

    const [usuarios] = await transaccion.execute(
      'SELECT id, rol, cedula FROM usuarios WHERE correo = ? FOR UPDATE', [correo]
    );
    let usuarioId;
    if (usuarios.length) {
      if (usuarios[0].rol !== 'cliente') {
        const error = new Error('Ese correo no está disponible para pedidos.');
        error.status = 409;
        throw error;
      }
      usuarioId = usuarios[0].id;
      if (cedula) {
        const [duplicados] = await transaccion.execute('SELECT id FROM usuarios WHERE cedula = ? AND id <> ?', [cedula, usuarioId]);
        if (duplicados.length) {
          const error = new Error('Esa cédula ya está registrada con otro correo.');
          error.status = 409;
          throw error;
        }
      }
      await transaccion.execute(
        'UPDATE usuarios SET nombre = ?, telefono = ?, cedula = COALESCE(?, cedula) WHERE id = ?',
        [cliente.nombre.trim(), telefono, cedula || null, usuarioId]
      );
    } else {
      if (cedula) {
        const [duplicados] = await transaccion.execute('SELECT id FROM usuarios WHERE cedula = ? FOR UPDATE', [cedula]);
        if (duplicados.length) {
          const error = new Error('Esa cédula ya está registrada con otro correo.');
          error.status = 409;
          throw error;
        }
      }
      const claveAleatoria = randomBytes(32).toString('hex');
      const claveCifrada = await bcrypt.hash(claveAleatoria, 10);
      const [nuevoUsuario] = await transaccion.execute(
        "INSERT INTO usuarios (nombre, correo, contrasena, telefono, cedula, rol) VALUES (?, ?, ?, ?, ?, 'cliente')",
        [cliente.nombre.trim(), correo, claveCifrada, telefono, cedula || null]
      );
      usuarioId = nuevoUsuario.insertId;
    }

    const cantidades = new Map();
    for (const articulo of articulos) {
      const id = Number(articulo.id);
      const cantidad = Number(articulo.cantidad);
      if (!Number.isInteger(id) || id < 1 || !Number.isInteger(cantidad) || cantidad < 1) {
        const error = new Error('Hay un producto o cantidad no válida.');
        error.status = 400;
        throw error;
      }
      cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
    }

    let subtotalPedido = 0;
    const detalles = [];
    for (const [id, cantidad] of cantidades) {
      const [productos] = await transaccion.execute(
        'SELECT id, nombre, precio, precio_oferta, stock, estado FROM productos WHERE id = ? FOR UPDATE', [id]
      );
      const producto = productos[0];
      if (!producto || producto.estado !== 'disponible' || Number(producto.stock) < cantidad) {
        const error = new Error('Un producto está agotado o no tiene suficiente stock.');
        error.status = 409;
        throw error;
      }
      const precio = producto.precio_oferta == null ? Number(producto.precio) : Number(producto.precio_oferta);
      const subtotal = Number((precio * cantidad).toFixed(2));
      subtotalPedido += subtotal;
      detalles.push({ id, cantidad, subtotal, nombre: producto.nombre, stock: Number(producto.stock) });
    }

    const envioGratis = configuracion.zonas_envio_gratis.includes(zona) && subtotalPedido >= configuracion.envio_gratis_desde;
    const costoEnvio = envioGratis ? 0 : Number(configuracion.tarifas[zona]);
    const total = Number((subtotalPedido + costoEnvio).toFixed(2));
    const campos = [
      'usuario_id', 'direccion_entrega', 'estado', 'total', 'zona_entrega', 'costo_envio', 'forma_pago',
      'provincia', 'ciudad', 'sector', 'calle_principal', 'numero_domicilio', 'calle_secundaria',
      'referencia', 'latitud', 'longitud'
    ];
    const valores = [
      usuarioId, direccion, 'recibido_y_confirmado', total, zona, costoEnvio, formaPago,
      datos.provincia || null, datos.ciudad || null, datos.sector || null,
      datos.calle_principal || null, datos.numero_domicilio || null, datos.calle_secundaria || null,
      datos.referencia || null, latitud, longitud
    ];
    const [nuevoPedido] = await transaccion.execute(
      `INSERT INTO pedidos (${campos.map((campo) => `\`${campo}\``).join(', ')})
       VALUES (${campos.map(() => '?').join(', ')})`, valores
    );

    for (const detalle of detalles) {
      await transaccion.execute(
        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
        [nuevoPedido.insertId, detalle.id, detalle.cantidad, detalle.subtotal]
      );
      const stockNuevo = detalle.stock - detalle.cantidad;
      await transaccion.execute(
        'UPDATE productos SET stock = ?, estado = ? WHERE id = ?',
        [stockNuevo, stockNuevo === 0 ? 'agotado' : 'disponible', detalle.id]
      );
      await transaccion.execute(
        `INSERT INTO movimientos_inventario
         (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, pedido_id)
         VALUES (?, 'venta', ?, ?, ?, ?, ?)`,
        [detalle.id, detalle.cantidad, detalle.stock, stockNuevo, 'Descuento automático por pedido', nuevoPedido.insertId]
      );
    }
    await transaccion.execute(
      `INSERT INTO historial_pedidos
       (pedido_id, estado_anterior, estado_nuevo, observacion, visible_cliente)
       VALUES (?, NULL, 'recibido_y_confirmado', 'Pedido creado desde la tienda.', 1)`, [nuevoPedido.insertId]
    );

    await transaccion.commit();
    return res.status(201).json({
      id: nuevoPedido.insertId, total, subtotal: subtotalPedido, costo_envio: costoEnvio,
      zona_entrega: zona, forma_pago: formaPago,
      productos: detalles.map(({ id, cantidad, subtotal, nombre }) => ({ id, cantidad, subtotal, nombre }))
    });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    if (error.code) console.error('Error al registrar el pedido:', error.code);
    const estado = error.status || (error.code ? 500 : 400);
    const mensaje = error.code ? 'No se pudo registrar el pedido.' : error.message || 'No se pudo registrar el pedido.';
    return res.status(estado).json({ error: mensaje });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.get('/cliente', async (req, res) => {
  const numeroPedido = String(req.query.numero_pedido || '').trim();
  const cedula = String(req.query.cedula || '').replace(/\D/g, '');
  const correo = String(req.query.correo || '').trim().toLowerCase();
  const telefono = String(req.query.telefono || '').trim();
  if (!/^\d+$/.test(numeroPedido)) return res.status(400).json({ error: 'Escribe el número de pedido.' });
  if ((!cedula || !/^\d{6,20}$/.test(cedula)) && !correo && !telefono) {
    return res.status(400).json({ error: 'Verifica con tu cédula, correo o teléfono.' });
  }
  try {
    let consulta;
    let parametros;
    if (cedula) {
      consulta = `SELECT p.*, u.nombre, u.correo, u.telefono
        FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.id = ? AND u.cedula = ?`;
      parametros = [numeroPedido, cedula];
    } else {
      consulta = `SELECT p.*, u.nombre, u.correo, u.telefono
        FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.id = ? AND (u.correo = ? OR u.telefono = ?)`;
      parametros = [numeroPedido, correo, telefono];
    }
    const [pedidos] = await conexion.execute(consulta, parametros);
    if (!pedidos.length) return res.status(404).json({ error: 'No encontramos un pedido con esos datos de verificación.' });
    const pedido = pedidos[0];
    pedido.productos = await cargarDetalles(pedido.id);
    pedido.historial = await cargarHistorial(pedido.id, conexion, true);
    return res.json([pedido]);
  } catch (error) {
    console.error('Error al buscar el pedido del cliente:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo buscar el pedido.' });
  }
});

rutas.get('/', verificarAdministrador, async (req, res) => {
  try {
    const [pedidos] = await conexion.execute(
      `SELECT p.*, u.nombre, u.correo, u.telefono, u.cedula
       FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id ORDER BY p.fecha DESC`
    );
    for (const pedido of pedidos) {
      pedido.productos = await cargarDetalles(pedido.id);
      pedido.historial = await cargarHistorial(pedido.id);
    }
    return res.json(pedidos);
  } catch (error) {
    console.error('Error al cargar pedidos:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron cargar los pedidos.' });
  }
});

rutas.put('/:id/estado', verificarAdministrador, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'El número de pedido no es válido.' });
  const estadoNuevo = String(req.body.estado || '');
  const observacion = String(req.body.observacion || '').trim().slice(0, 500) || null;
  const visibleCliente = req.body.visible_cliente ? 1 : 0;
  if (!estadosNuevos.includes(estadoNuevo)) return res.status(400).json({ error: 'El estado del pedido no es válido.' });
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!filas.length) {
      await transaccion.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const estadoAnterior = filas[0].estado;
    const siguiente = transiciones[estadoAnterior]?.includes(estadoNuevo);
    const cancelar = estadoNuevo === 'cancelado' && !['entregado', 'cancelado'].includes(estadoAnterior);
    if (!siguiente && !cancelar) {
      await transaccion.rollback();
      return res.status(409).json({ error: 'El cambio no sigue el orden permitido. Avanza al siguiente estado o cancela el pedido.' });
    }
    if (cancelar) {
      const [produccionIniciada] = await transaccion.execute(
        `SELECT m.detalle_pedido_id FROM produccion_patitas_mayorista m
         JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
         WHERE d.pedido_id = ? AND (m.unidades_producidas > 0 OR m.unidades_listas > 0 OR m.unidades_entregadas > 0)
         LIMIT 1 FOR UPDATE`, [req.params.id]
      );
      if (produccionIniciada.length) {
        await transaccion.rollback();
        return res.status(409).json({ error: 'No se puede cancelar este pedido: la producción de patitas ya comenzó.' });
      }
      const [detalles] = await transaccion.execute(
        `SELECT d.producto_id, d.cantidad, p.stock
         FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
         LEFT JOIN produccion_patitas_mayorista pm ON pm.detalle_pedido_id = d.id
         WHERE d.pedido_id = ? AND pm.detalle_pedido_id IS NULL FOR UPDATE`, [req.params.id]
      );
      for (const detalle of detalles) {
        const anterior = Number(detalle.stock);
        const nuevo = anterior + Number(detalle.cantidad);
        await transaccion.execute(
          "UPDATE productos SET stock = ?, estado = CASE WHEN estado = 'agotado' THEN 'disponible' ELSE estado END WHERE id = ?",
          [nuevo, detalle.producto_id]
        );
        await transaccion.execute(
          `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, pedido_id, administrador_id)
           VALUES (?, 'devolucion', ?, ?, ?, 'Devolución por cancelación', ?, ?)`,
          [detalle.producto_id, detalle.cantidad, anterior, nuevo, req.params.id, req.administrador.id]
        );
      }
    }
    await transaccion.execute(
      `UPDATE pedidos SET estado = ?,
       salida_reparto = CASE WHEN ? = 'en_reparto_local' THEN COALESCE(salida_reparto, NOW()) ELSE salida_reparto END,
       entregado_en = CASE WHEN ? = 'entregado' THEN NOW() ELSE entregado_en END WHERE id = ?`,
      [estadoNuevo, estadoNuevo, estadoNuevo, req.params.id]
    );
    await transaccion.execute(
      `INSERT INTO historial_pedidos
       (pedido_id, estado_anterior, estado_nuevo, administrador_id, observacion, visible_cliente)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, estadoAnterior, estadoNuevo, req.administrador.id, observacion, visibleCliente]
    );
    await transaccion.commit();
    return res.json({ mensaje: 'Estado actualizado.', estado: estadoNuevo });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    console.error('Error al actualizar el estado del pedido:', error.code || 'Error');
    return res.status(error.code ? 500 : 400).json({ error: error.code ? 'No se pudo cambiar el estado del pedido.' : error.message });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.put('/:id/pago', verificarAdministrador, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'El número de pedido no es válido.' });
  try {
    const [resultado] = await conexion.execute(
      `UPDATE pedidos SET pago_confirmado = 1, pago_confirmado_en = NOW(), pago_confirmado_por = ?
       WHERE id = ? AND pago_confirmado = 0`, [req.administrador.id, req.params.id]
    );
    if (!resultado.affectedRows) {
      const [[pedido]] = await conexion.execute('SELECT id FROM pedidos WHERE id = ?', [req.params.id]);
      if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
      return res.status(409).json({ error: 'El pago ya estaba confirmado.' });
    }
    return res.json({ mensaje: 'Pago confirmado.' });
  } catch (error) {
    console.error('Error al confirmar el pago:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo confirmar el pago.' });
  }
});

module.exports = rutas;
