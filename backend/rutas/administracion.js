const express = require('express');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');

const rutas = express.Router();
const estadosPedido = [
  'recibido_y_confirmado', 'en_preparacion', 'listo_para_despacho',
  'en_reparto_local', 'entregado', 'cancelado'
];
const limiteStockBajo = 5;

rutas.use(verificarAdministrador);

function fechaValida(fecha) {
  return !fecha || /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

function adjuntarDetalles(pedidos, detalles) {
  const porPedido = new Map(pedidos.map((pedido) => [Number(pedido.id), []]));
  for (const detalle of detalles) porPedido.get(Number(detalle.pedido_id))?.push(detalle);
  return pedidos.map((pedido) => ({ ...pedido, productos: porPedido.get(Number(pedido.id)) || [] }));
}

async function cargarPedidos(consulta, parametros = []) {
  const [pedidos] = await conexion.execute(consulta, parametros);
  if (!pedidos.length) return pedidos;
  const ids = pedidos.map((pedido) => pedido.id);
  const marcas = ids.map(() => '?').join(', ');
  const [detalles] = await conexion.execute(
    `SELECT d.pedido_id, d.producto_id, d.cantidad, d.subtotal,
       COALESCE(dm.precio_unitario, ROUND(d.subtotal / NULLIF(d.cantidad, 0), 2)) AS precio_unitario,
       COALESCE(dm.nombre_producto, p.nombre) AS nombre,
       CASE WHEN dm.detalle_pedido_id IS NULL THEN 0 ELSE 1 END AS precio_mayorista
     FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
     LEFT JOIN detalle_pedido_mayorista dm ON dm.detalle_pedido_id = d.id
     WHERE d.pedido_id IN (${marcas}) ORDER BY d.id`, ids
  );
  return adjuntarDetalles(pedidos, detalles);
}

async function cargarPedidoDetalle(id) {
  const [pedidos] = await conexion.execute(
    `SELECT p.*, u.nombre, u.correo, u.telefono, u.cedula,
       pm.cotizacion_id AS cotizacion_mayorista_id, pm.fecha_entrega AS fecha_entrega_mayorista,
       pm.condiciones_pago AS condiciones_mayoristas, pm.descuento AS descuento_mayorista,
       pm.envio AS envio_mayorista, cm.solicitud_id AS solicitud_mayorista_id
     FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN pedidos_mayoristas pm ON pm.pedido_id = p.id
     LEFT JOIN cotizaciones_mayoristas cm ON cm.id = pm.cotizacion_id
     WHERE p.id = ?`, [id]
  );
  if (!pedidos.length) return null;
  const [productos] = await conexion.execute(
    `SELECT d.producto_id, d.cantidad, d.subtotal,
       COALESCE(dm.precio_unitario, ROUND(d.subtotal / NULLIF(d.cantidad, 0), 2)) AS precio_unitario,
       COALESCE(dm.nombre_producto, p.nombre) AS nombre,
       CASE WHEN dm.detalle_pedido_id IS NULL THEN 0 ELSE 1 END AS precio_mayorista
     FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
     LEFT JOIN detalle_pedido_mayorista dm ON dm.detalle_pedido_id = d.id
     WHERE d.pedido_id = ? ORDER BY d.id`, [id]
  );
  const [historial] = await conexion.execute(
    `SELECT h.estado_anterior, h.estado_nuevo, h.fecha_hora, h.observacion, h.visible_cliente,
       u.nombre AS administrador
     FROM historial_pedidos h LEFT JOIN usuarios u ON u.id = h.administrador_id
     WHERE h.pedido_id = ? ORDER BY h.fecha_hora, h.id`, [id]
  );
  return { ...pedidos[0], productos, historial };
}

rutas.get('/dashboard', async (req, res) => {
  try {
    const [conteos] = await conexion.execute(
      'SELECT estado, COUNT(*) AS cantidad FROM pedidos GROUP BY estado'
    );
    const cantidadPorEstado = Object.fromEntries(conteos.map((fila) => [fila.estado, Number(fila.cantidad)]));
    const [[finanzas]] = await conexion.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos_hoy,
        COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos_mes,
        COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes_hoy,
        COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes_mes,
        COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados_hoy,
        COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados_mes
       FROM pedidos`
    );
    const [[bajoStock]] = await conexion.execute(
      "SELECT COUNT(*) AS cantidad FROM productos WHERE estado <> 'inactivo' AND stock <= ?", [limiteStockBajo]
    );
    return res.json({
      pedidos: Object.fromEntries(estadosPedido.map((estado) => [estado, cantidadPorEstado[estado] || 0])),
      pedidos_legacy: cantidadPorEstado.en_tu_puerta || 0,
      valor_pedidos_hoy: Number(finanzas.valor_pedidos_hoy),
      valor_pedidos_mes: Number(finanzas.valor_pedidos_mes),
      pagos_pendientes_hoy: Number(finanzas.pagos_pendientes_hoy),
      pagos_pendientes_mes: Number(finanzas.pagos_pendientes_mes),
      pagos_confirmados_hoy: Number(finanzas.pagos_confirmados_hoy),
      pagos_confirmados_mes: Number(finanzas.pagos_confirmados_mes),
      productos_stock_bajo: Number(bajoStock.cantidad), limite_stock_bajo: limiteStockBajo
    });
  } catch (error) {
    console.error('Error al cargar el resumen administrativo:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el resumen del administrador.' });
  }
});

rutas.get('/pedidos', async (req, res) => {
  const busqueda = String(req.query.buscar || '').trim();
  const estado = String(req.query.estado || '').trim();
  const desde = String(req.query.desde || '').trim();
  const hasta = String(req.query.hasta || '').trim();
  if ((estado && !estadosPedido.includes(estado) && estado !== 'en_tu_puerta') || !fechaValida(desde) || !fechaValida(hasta)) {
    return res.status(400).json({ error: 'Revisa los filtros de pedidos.' });
  }
  const orden = req.query.orden === 'antiguos' ? 'ASC' : 'DESC';
  const condiciones = [];
  const parametros = [];
  if (busqueda) {
    condiciones.push('(CAST(p.id AS CHAR) LIKE ? OR u.nombre LIKE ? OR u.telefono LIKE ?)');
    const valor = `%${busqueda}%`;
    parametros.push(valor, valor, valor);
  }
  if (estado) { condiciones.push('p.estado = ?'); parametros.push(estado); }
  if (desde) { condiciones.push('p.fecha >= ?'); parametros.push(`${desde} 00:00:00`); }
  if (hasta) { condiciones.push('p.fecha < DATE_ADD(?, INTERVAL 1 DAY)'); parametros.push(hasta); }
  try {
    const consulta = `SELECT p.*, u.nombre, u.correo, u.telefono, u.cedula,
      pm.cotizacion_id AS cotizacion_mayorista_id
      FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
      LEFT JOIN pedidos_mayoristas pm ON pm.pedido_id = p.id
      ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
      ORDER BY p.fecha ${orden}, p.id ${orden}`;
    return res.json(await cargarPedidos(consulta, parametros));
  } catch (error) {
    console.error('Error al buscar pedidos administrativos:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron cargar los pedidos.' });
  }
});

rutas.get('/pedidos/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'El número de pedido no es válido.' });
  try {
    const pedido = await cargarPedidoDetalle(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
    return res.json(pedido);
  } catch (error) {
    console.error('Error al consultar el detalle del pedido:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el detalle del pedido.' });
  }
});

rutas.put('/pedidos/:id/entrega', async (req, res) => {
  const repartidor = String(req.body.repartidor_nombre || '').trim().slice(0, 120) || null;
  const observacion = String(req.body.observaciones_entrega || '').trim() || null;
  const salida = String(req.body.salida_reparto || '').trim();
  if (salida && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(salida)) {
    return res.status(400).json({ error: 'La fecha de salida no es válida.' });
  }
  try {
    const [pedidos] = await conexion.execute('SELECT estado FROM pedidos WHERE id = ?', [req.params.id]);
    if (!pedidos.length) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (!['listo_para_despacho', 'en_reparto_local'].includes(pedidos[0].estado)) {
      return res.status(409).json({ error: 'La entrega se organiza cuando el pedido está listo para despacho o en reparto.' });
    }
    await conexion.execute(
      `UPDATE pedidos SET repartidor_nombre = ?, salida_reparto = COALESCE(?, salida_reparto),
       observaciones_entrega = ? WHERE id = ?`,
      [repartidor, salida ? `${salida.replace('T', ' ')}:00` : null, observacion, req.params.id]
    );
    return res.json({ mensaje: 'Datos de entrega guardados.' });
  } catch (error) {
    console.error('Error al guardar datos de entrega:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron guardar los datos de entrega.' });
  }
});

rutas.get('/entregas', async (req, res) => {
  try {
    const pedidos = await cargarPedidos(
      `SELECT p.*, u.nombre, u.correo, u.telefono, u.cedula
       FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.estado IN ('listo_para_despacho', 'en_reparto_local')
       ORDER BY p.estado, p.fecha`
    );
    return res.json(pedidos);
  } catch (error) {
    console.error('Error al cargar entregas:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron cargar las entregas.' });
  }
});

rutas.get('/inventario', async (req, res) => {
  try {
    const [productos] = await conexion.execute(
      `SELECT p.id, p.nombre, p.stock, p.estado,
       (SELECT MAX(m.fecha_hora) FROM movimientos_inventario m WHERE m.producto_id = p.id) AS ultimo_movimiento
       FROM productos p WHERE p.estado <> 'inactivo' ORDER BY p.nombre`
    );
    return res.json(productos.map((producto) => ({
      ...producto, stock_bajo: Number(producto.stock) <= limiteStockBajo
    })));
  } catch (error) {
    console.error('Error al cargar inventario:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el inventario.' });
  }
});

rutas.get('/inventario/:id/movimientos', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'El producto no es válido.' });
  try {
    const [movimientos] = await conexion.execute(
      `SELECT m.*, u.nombre AS administrador
       FROM movimientos_inventario m LEFT JOIN usuarios u ON u.id = m.administrador_id
       WHERE m.producto_id = ? ORDER BY m.fecha_hora DESC, m.id DESC`, [req.params.id]
    );
    return res.json(movimientos);
  } catch (error) {
    console.error('Error al cargar movimientos:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el historial de inventario.' });
  }
});

rutas.post('/inventario/:id/movimientos', async (req, res) => {
  const tipo = req.body.tipo;
  const motivo = String(req.body.motivo || '').trim();
  const cantidad = Number(req.body.cantidad);
  const objetivo = Number(req.body.stock_objetivo);
  if (!['entrada', 'salida', 'ajuste'].includes(tipo) || !motivo || motivo.length > 500 ||
      (tipo === 'ajuste' ? !Number.isInteger(objetivo) || objetivo < 0 : !Number.isInteger(cantidad) || cantidad < 1)) {
    return res.status(400).json({ error: 'Indica un tipo, una cantidad válida y el motivo del movimiento.' });
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute(
      'SELECT id, stock, estado FROM productos WHERE id = ? FOR UPDATE', [req.params.id]
    );
    if (!filas.length) {
      await transaccion.rollback();
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    const producto = filas[0];
    const anterior = Number(producto.stock);
    const nuevo = tipo === 'entrada' ? anterior + cantidad
      : tipo === 'salida' ? anterior - cantidad : objetivo;
    if (nuevo < 0) {
      await transaccion.rollback();
      return res.status(409).json({ error: 'La salida supera el stock disponible.' });
    }
    const unidades = Math.abs(nuevo - anterior);
    if (!unidades) {
      await transaccion.rollback();
      return res.status(400).json({ error: 'El ajuste no cambia el stock actual.' });
    }
    const estado = nuevo === 0 ? 'agotado' : producto.estado === 'agotado' ? 'disponible' : producto.estado;
    await transaccion.execute('UPDATE productos SET stock = ?, estado = ? WHERE id = ?', [nuevo, estado, req.params.id]);
    await transaccion.execute(
      `INSERT INTO movimientos_inventario
       (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, administrador_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, tipo, unidades, anterior, nuevo, motivo, req.administrador.id]
    );
    await transaccion.commit();
    return res.status(201).json({ mensaje: 'Movimiento de inventario registrado.', stock: nuevo });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    console.error('Error al registrar inventario:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo guardar el movimiento de inventario.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.get('/clientes', async (req, res) => {
  const buscar = `%${String(req.query.buscar || '').trim()}%`;
  try {
    const [clientes] = await conexion.execute(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.cedula,
       COUNT(p.id) AS cantidad_pedidos,
       COALESCE(SUM(CASE WHEN p.estado <> 'cancelado' THEN p.total ELSE 0 END), 0) AS total_compras
       FROM usuarios u LEFT JOIN pedidos p ON p.usuario_id = u.id
       WHERE u.rol = 'cliente' AND (? = '%%' OR u.nombre LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ?)
       GROUP BY u.id ORDER BY u.nombre`, [buscar, buscar, buscar, buscar]
    );
    return res.json(clientes);
  } catch (error) {
    console.error('Error al cargar clientes:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron cargar los clientes.' });
  }
});

rutas.get('/clientes/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'El cliente no es válido.' });
  try {
    const [clientes] = await conexion.execute(
      'SELECT id, nombre, correo, telefono, cedula FROM usuarios WHERE id = ? AND rol = ?',
      [req.params.id, 'cliente']
    );
    if (!clientes.length) return res.status(404).json({ error: 'Cliente no encontrado.' });
    const pedidos = await cargarPedidos(
      `SELECT p.*, u.nombre, u.correo, u.telefono, u.cedula
       FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
       WHERE u.id = ? ORDER BY p.fecha DESC`, [req.params.id]
    );
    return res.json({ cliente: clientes[0], pedidos });
  } catch (error) {
    console.error('Error al consultar el cliente:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el historial del cliente.' });
  }
});

function obtenerRango(desde, hasta) {
  if (!fechaValida(desde) || !fechaValida(hasta) || (desde && hasta && desde > hasta)) return null;
  return { desde: desde || '2000-01-01', hasta: hasta || '2099-12-31' };
}

async function datosReporte(rango) {
  const [resumen] = await conexion.execute(
    `SELECT COUNT(*) AS pedidos_registrados,
       SUM(estado = 'entregado') AS pedidos_entregados,
       SUM(estado = 'cancelado') AS pedidos_cancelados,
       COALESCE(SUM(CASE WHEN estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos,
       COALESCE(SUM(CASE WHEN estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes,
       COALESCE(SUM(CASE WHEN pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados
     FROM pedidos WHERE fecha >= ? AND fecha < DATE_ADD(?, INTERVAL 1 DAY)`, [rango.desde, rango.hasta]
  );
  const [productos] = await conexion.execute(
    `SELECT p.id, p.nombre, SUM(d.cantidad) AS unidades,
       COALESCE(SUM(d.subtotal), 0) AS valor_pedidos
     FROM detalle_pedido d JOIN pedidos o ON o.id = d.pedido_id
     JOIN productos p ON p.id = d.producto_id
     WHERE o.estado <> 'cancelado' AND o.fecha >= ? AND o.fecha < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY p.id, p.nombre ORDER BY unidades DESC, valor_pedidos DESC LIMIT 20`, [rango.desde, rango.hasta]
  );
  const [[periodos]] = await conexion.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos_hoy,
       COALESCE(SUM(CASE WHEN fecha >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos_semana,
       COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND estado <> 'cancelado' THEN total ELSE 0 END), 0) AS valor_pedidos_mes,
       COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes_hoy,
       COALESCE(SUM(CASE WHEN fecha >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes_semana,
       COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND estado <> 'cancelado' AND pago_confirmado = 0 THEN total ELSE 0 END), 0) AS pagos_pendientes_mes,
       COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() AND pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados_hoy,
       COALESCE(SUM(CASE WHEN fecha >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados_semana,
       COALESCE(SUM(CASE WHEN YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND pago_confirmado = 1 THEN total ELSE 0 END), 0) AS pagos_confirmados_mes,
       SUM(DATE(fecha) = CURDATE() AND estado <> 'cancelado') AS pedidos_hoy,
       SUM(fecha >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND estado <> 'cancelado') AS pedidos_semana,
       SUM(YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE()) AND estado <> 'cancelado') AS pedidos_mes
     FROM pedidos`
  );
  return { desde: rango.desde, hasta: rango.hasta, resumen: resumen[0], periodos, productos };
}

rutas.get('/reportes', async (req, res) => {
  const rango = obtenerRango(String(req.query.desde || ''), String(req.query.hasta || ''));
  if (!rango) return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  try { return res.json(await datosReporte(rango)); }
  catch (error) {
    console.error('Error al crear reporte:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo generar el reporte.' });
  }
});

rutas.get('/reportes.csv', async (req, res) => {
  const rango = obtenerRango(String(req.query.desde || ''), String(req.query.hasta || ''));
  if (!rango) return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  try {
    const reporte = await datosReporte(rango);
    const escaparCsv = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['Desde', reporte.desde], ['Hasta', reporte.hasta],
      ['Pedidos registrados', reporte.resumen.pedidos_registrados],
      ['Pedidos entregados', reporte.resumen.pedidos_entregados || 0],
      ['Pedidos cancelados', reporte.resumen.pedidos_cancelados || 0],
      ['Valor en pedidos (excluye cancelados)', reporte.resumen.valor_pedidos],
      ['Pagos pendientes (excluye cancelados)', reporte.resumen.pagos_pendientes],
      ['Pagos marcados como confirmados', reporte.resumen.pagos_confirmados], [],
      ['Producto', 'Unidades', 'Valor en pedidos'],
      ...reporte.productos.map((producto) => [producto.nombre, producto.unidades, producto.valor_pedidos])
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-charqui-${rango.desde}-${rango.hasta}.csv"`);
    return res.send('\uFEFF' + filas.map((fila) => fila.map(escaparCsv).join(',')).join('\r\n'));
  } catch (error) {
    console.error('Error al exportar reporte:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo exportar el reporte.' });
  }
});

async function leerConfiguracionEnvios(base = conexion) {
  const [[configuracion]] = await base.execute(
    "SELECT valor FROM configuracion_tienda WHERE clave = 'envio_gratis_desde'"
  );
  const [zonas] = await base.execute('SELECT nombre, tarifa, envio_gratis FROM zonas_envio WHERE activa = 1 ORDER BY nombre');
  const [formas] = await base.execute('SELECT nombre FROM formas_pago WHERE activa = 1 ORDER BY nombre');
  return {
    tarifas: Object.fromEntries(zonas.map((zona) => [zona.nombre, Number(zona.tarifa)])),
    envio_gratis_desde: Number(configuracion?.valor || 20),
    zonas_envio_gratis: zonas.filter((zona) => Number(zona.envio_gratis)).map((zona) => zona.nombre),
    formas_pago: formas.map((forma) => forma.nombre)
  };
}

rutas.get('/configuracion/envios', async (req, res) => {
  try {
    const configuracion = await leerConfiguracionEnvios();
    const [zonas] = await conexion.execute('SELECT id, nombre, tarifa, envio_gratis, activa FROM zonas_envio ORDER BY nombre');
    const [formas] = await conexion.execute('SELECT id, nombre, activa FROM formas_pago ORDER BY nombre');
    return res.json({ ...configuracion, zonas, formas_pago_detalle: formas });
  } catch (error) {
    console.error('Error al cargar configuración:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar la configuración de entrega.' });
  }
});

rutas.put('/configuracion/envios', async (req, res) => {
  const minimo = Number(req.body.envio_gratis_desde);
  const zonas = req.body.zonas;
  const formas = req.body.formas_pago;
  if (!Number.isFinite(minimo) || minimo < 0 || !Array.isArray(zonas) || !zonas.length || !Array.isArray(formas)) {
    return res.status(400).json({ error: 'Revisa las tarifas, zonas y formas de pago.' });
  }
  const nombres = new Set();
  for (const zona of zonas) {
    const nombre = String(zona.nombre || '').trim();
    const tarifa = Number(zona.tarifa);
    if (!nombre || nombre.length > 100 || !Number.isFinite(tarifa) || tarifa < 0 || nombres.has(nombre.toLowerCase())) {
      return res.status(400).json({ error: 'Cada zona requiere un nombre único y una tarifa válida.' });
    }
    nombres.add(nombre.toLowerCase());
  }
  const pagosUnicos = new Set();
  for (const nombrePago of formas) {
    const nombre = String(nombrePago || '').trim();
    if (!nombre || nombre.length > 80 || pagosUnicos.has(nombre.toLowerCase())) {
      return res.status(400).json({ error: 'Las formas de pago deben tener nombres únicos.' });
    }
    pagosUnicos.add(nombre.toLowerCase());
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const activas = zonas.map((zona) => String(zona.nombre).trim());
    for (const zona of zonas) {
      await transaccion.execute(
        `INSERT INTO zonas_envio (nombre, tarifa, envio_gratis, activa) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE tarifa = VALUES(tarifa), envio_gratis = VALUES(envio_gratis), activa = 1`,
        [String(zona.nombre).trim(), Number(zona.tarifa), Boolean(zona.envio_gratis) ? 1 : 0]
      );
    }
    if (activas.length) {
      const marcas = activas.map(() => '?').join(', ');
      await transaccion.execute(`UPDATE zonas_envio SET activa = 0 WHERE nombre NOT IN (${marcas})`, activas);
    }
    for (const forma of formas) {
      await transaccion.execute(
        `INSERT INTO formas_pago (nombre, activa) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE activa = 1`, [String(forma).trim()]
      );
    }
    if (pagosUnicos.size) {
      const valores = [...pagosUnicos];
      const marcas = valores.map(() => '?').join(', ');
      await transaccion.execute(`UPDATE formas_pago SET activa = 0 WHERE LOWER(nombre) NOT IN (${marcas})`, valores);
    } else {
      await transaccion.execute('UPDATE formas_pago SET activa = 0');
    }
    await transaccion.execute(
      `INSERT INTO configuracion_tienda (clave, valor) VALUES ('envio_gratis_desde', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`, [minimo.toFixed(2)]
    );
    await transaccion.commit();
    return res.json({ mensaje: 'Configuración de entrega guardada.' });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    console.error('Error al guardar configuración:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

module.exports = rutas;
