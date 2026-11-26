const express = require('express');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');
const crearLimitadorSolicitudes = require('../middleware/limitador_solicitudes');
const { crearTokenSeguimiento, verificarTokenSeguimiento } = require('../servicios/seguimiento_pedido');
const { coordenadasValidas } = require('../utilidades/validaciones_pedido');
const { cargarConfiguracion } = require('./envios');

const rutas = express.Router();
const limitarCreacionPedido = crearLimitadorSolicitudes({ limite: 5, ventanaMs: 10 * 60 * 1000 });
const limitarConsultaPedido = crearLimitadorSolicitudes({ limite: 30, ventanaMs: 60 * 1000 });
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

function leerTexto(valor, limite) {
  if (valor == null) return '';
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto.length <= limite ? texto : null;
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

rutas.post('/', limitarCreacionPedido, async (req, res) => {
  const datos = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const cliente = datos.cliente && typeof datos.cliente === 'object' && !Array.isArray(datos.cliente)
    ? datos.cliente
    : {};
  const articulos = datos.productos;
  const nombre = leerTexto(cliente.nombre, 100);
  const telefono = leerTexto(cliente.telefono, 30);
  const correoEntrada = leerTexto(cliente.correo, 150);
  const cedulaEntrada = leerTexto(cliente.cedula, 20);
  const direccion = leerTexto(datos.direccion_entrega, 255);
  const zona = leerTexto(datos.zona_entrega, 100);
  const formaPago = leerTexto(datos.forma_pago, 80);
  const latitudEntrada = datos.latitud == null || datos.latitud === '' ? null : datos.latitud;
  const longitudEntrada = datos.longitud == null || datos.longitud === '' ? null : datos.longitud;
  const latitud = latitudEntrada === null ? null : Number(latitudEntrada);
  const longitud = longitudEntrada === null ? null : Number(longitudEntrada);
  const camposAdicionales = {
    provincia: leerTexto(datos.provincia, 100),
    ciudad: leerTexto(datos.ciudad, 100),
    sector: leerTexto(datos.sector, 150),
    calle_principal: leerTexto(datos.calle_principal, 180),
    numero_domicilio: leerTexto(datos.numero_domicilio, 40),
    calle_secundaria: leerTexto(datos.calle_secundaria, 180),
    referencia: leerTexto(datos.referencia, 255)
  };
  const cedula = cedulaEntrada || '';

  if (!nombre || !telefonoValido(telefono) || !correoValido(correoEntrada) ||
      !direccion || !zona || !formaPago || Object.values(camposAdicionales).some((valor) => valor === null) ||
      datos.consentimiento !== true ||
      (cliente.cedula != null && cedulaEntrada === null) ||
      (cedula && !/^\d{6,20}$/.test(cedula)) ||
      !coordenadasValidas(latitudEntrada, longitudEntrada) ||
      !Array.isArray(articulos) || !articulos.length) {
    return res.status(400).json({ error: 'Revisa tus datos, dirección y consentimiento antes de confirmar.' });
  }
  if (articulos.length > 30 || articulos.some((articulo) =>
    !articulo || typeof articulo !== 'object' || Array.isArray(articulo)
  )) {
    return res.status(400).json({ error: 'La cantidad de productos de la solicitud no es válida.' });
  }

  const correo = correoEntrada.toLowerCase();
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
      if (!Number.isSafeInteger(id) || id < 1 ||
          !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1000000) {
        const error = new Error('Hay un producto o cantidad no válida.');
        error.status = 400;
        throw error;
      }
      const acumulada = (cantidades.get(id) || 0) + cantidad;
      if (!Number.isSafeInteger(acumulada) || acumulada > 1000000) {
        const error = new Error('La cantidad total de un producto supera el máximo permitido.');
        error.status = 400;
        throw error;
      }
      cantidades.set(id, acumulada);
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
    if (!Number.isFinite(total) || total > 99999999.99) {
      const error = new Error('El total del pedido supera el máximo permitido.');
      error.status = 400;
      throw error;
    }
    const campos = [
      'usuario_id', 'direccion_entrega', 'estado', 'total', 'zona_entrega', 'costo_envio', 'forma_pago',
      'provincia', 'ciudad', 'sector', 'calle_principal', 'numero_domicilio', 'calle_secundaria',
      'referencia', 'latitud', 'longitud'
    ];
    const valores = [
      usuarioId, direccion, 'recibido_y_confirmado', total, zona, costoEnvio, formaPago,
      camposAdicionales.provincia || null, camposAdicionales.ciudad || null, camposAdicionales.sector || null,
      camposAdicionales.calle_principal || null, camposAdicionales.numero_domicilio || null,
      camposAdicionales.calle_secundaria || null, camposAdicionales.referencia || null, latitud, longitud
    ];
    const [nuevoPedido] = await transaccion.execute(
      `INSERT INTO pedidos (${campos.map((campo) => `\`${campo}\``).join(', ')})
       VALUES (${campos.map(() => '?').join(', ')})`, valores
    );
    const tokenSeguimiento = crearTokenSeguimiento(nuevoPedido.insertId, process.env.JWT_SECRETO);

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
      token_seguimiento: tokenSeguimiento,
      productos: detalles.map(({ id, cantidad, subtotal, nombre }) => ({ id, cantidad, subtotal, nombre }))
    });
  } catch (error) {
    if (transaccion) {
      try { await transaccion.rollback(); }
      catch (errorRollback) { console.error('No se pudo revertir la transacción del pedido:', errorRollback.code || 'Error'); }
    }
    if (error.code) console.error('Error al registrar el pedido:', error.code);
    const estado = error.status || 500;
    const mensaje = error.status ? error.message : 'No se pudo registrar el pedido.';
    return res.status(estado).json({ error: mensaje });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.post('/cliente', limitarConsultaPedido, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = req.body && typeof req.body.token_seguimiento === 'string'
    ? req.body.token_seguimiento
    : '';
  if (!token || token.length > 2048) {
    return res.status(404).json({ error: 'El enlace de seguimiento no es válido.' });
  }

  let idPedido;
  try {
    idPedido = verificarTokenSeguimiento(token, process.env.JWT_SECRETO);
  } catch (error) {
    return res.status(404).json({ error: 'El enlace de seguimiento no es válido o ha vencido.' });
  }

  try {
    const [pedidos] = await conexion.execute(
      `SELECT id, fecha, estado, total, costo_envio, zona_entrega, forma_pago
       FROM pedidos WHERE id = ?`, [idPedido]
    );
    if (!pedidos.length) return res.status(404).json({ error: 'No encontramos ese pedido.' });
    const pedido = pedidos[0];
    const detalles = await cargarDetalles(pedido.id);
    const historial = await cargarHistorial(pedido.id, conexion, true);
    return res.json({
      pedido: {
        id: pedido.id,
        fecha: pedido.fecha,
        estado: pedido.estado,
        total: pedido.total,
        costo_envio: pedido.costo_envio,
        zona_entrega: pedido.zona_entrega,
        forma_pago: pedido.forma_pago,
        productos: detalles.map(({ producto_id, cantidad, subtotal, nombre }) =>
          ({ producto_id, cantidad, subtotal, nombre })
        ),
        historial: historial.map(({ estado_nuevo, fecha_hora, observacion }) =>
          ({ estado_nuevo, fecha_hora, observacion })
        )
      }
    });
  } catch (error) {
    console.error('Error al buscar el pedido con enlace privado:', error.code || 'Error');
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
