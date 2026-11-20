const express = require('express');
const bcrypt = require('bcrypt');
const { createHash, randomBytes } = require('crypto');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');

const rutas = express.Router();

function limpiar(texto, limite = 255) {
  return String(texto || '').trim().slice(0, limite);
}

function dineroCentavos(valor, permitirVacio = false) {
  const texto = String(valor == null ? '' : valor).trim().replace(',', '.');
  if (permitirVacio && !texto) return 0n;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(texto)) return null;
  const [entero, decimales = ''] = texto.split('.');
  return BigInt(entero) * 100n + BigInt((decimales + '00').slice(0, 2));
}

function decimalCentavos(centavos) {
  const signo = centavos < 0n ? '-' : '';
  const valor = centavos < 0n ? -centavos : centavos;
  return `${signo}${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;
}

function decimalMilenimos(milenimos) {
  return `${milenimos / 1000n}.${String(milenimos % 1000n).padStart(3, '0')}`;
}

function precioMilenimos(valor, permitirVacio = false) {
  const texto = String(valor == null ? '' : valor).trim().replace(',', '.');
  if (permitirVacio && !texto) return 0n;
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(texto)) return null;
  const [entero, decimales = ''] = texto.split('.');
  return BigInt(entero) * 1000n + BigInt((decimales + '000').slice(0, 3));
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function fechaHoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

function fechaComoTexto(fecha) {
  return fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha || '').slice(0, 10);
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const valor = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(valor.getTime()) && valor.toISOString().slice(0, 10) === fecha;
}

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function telefonoValido(telefono) {
  const digitos = telefono.replace(/\D/g, '');
  return /^[+0-9 ()-]{7,30}$/.test(telefono) && digitos.length >= 7 && digitos.length <= 15;
}

async function agregarHistorial(base, solicitudId, administradorId, evento, detalle = null, cotizacionId = null) {
  await base.execute(
    `INSERT INTO historial_mayoristas
     (solicitud_id, cotizacion_id, administrador_id, evento, detalle)
     VALUES (?, ?, ?, ?, ?)`,
    [solicitudId, cotizacionId, administradorId || null, evento, detalle]
  );
}

function calcularCotizacion(lineas, descuento, envio) {
  let subtotal = 0n;
  for (const linea of lineas) {
    subtotal += (linea.precio_milenimos * BigInt(linea.cantidad) + 5n) / 10n;
  }
  if (descuento < 0n || envio < 0n || descuento > subtotal) return null;
  return { subtotal, descuento, envio, total: subtotal - descuento + envio };
}

function detallesPatitas(lineas) {
  return lineas.filter((linea) => Number(linea.gestiona_produccion) === 1);
}

async function guardarLineasCotizacion(base, cotizacionId, lineas) {
  const ids = [...new Set(lineas.map((linea) => linea.producto_id))];
  const signos = ids.map(() => '?').join(',');
  const [productos] = await base.execute(
    `SELECT p.id, p.nombre, p.presentaciones, p.estado,
     COALESCE(c.unidad, 'presentacion') AS unidad,
     COALESCE(c.gestiona_produccion, 0) AS gestiona_produccion
     FROM productos p LEFT JOIN configuracion_producto_mayorista c ON c.producto_id = p.id
     WHERE p.id IN (${signos})`, ids
  );
  const porId = new Map(productos.map((producto) => [Number(producto.id), producto]));
  for (const linea of lineas) {
    const producto = porId.get(linea.producto_id);
    if (!producto) throw new Error('Uno de los productos ya no existe en el catálogo.');
    if (producto.estado === 'inactivo' || (producto.estado === 'agotado' && !Number(producto.gestiona_produccion))) {
      throw new Error(`El producto ${producto.nombre} ya no está disponible para cotizar.`);
    }
    await base.execute(
      `INSERT INTO detalle_cotizacion_mayorista
       (cotizacion_id, producto_id, nombre_producto, presentacion, unidad, gestiona_produccion, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cotizacionId, producto.id, producto.nombre, producto.presentaciones, producto.unidad, producto.gestiona_produccion,
        linea.cantidad, decimalMilenimos(linea.precio_milenimos), decimalCentavos(linea.subtotal_centavos)]
    );
  }
}

// Catálogo real, sin precios ni existencias públicas.
rutas.get('/productos', async (req, res) => {
  try {
    const [productos] = await conexion.execute(
      `SELECT p.id, p.nombre, p.descripcion, p.presentaciones, p.imagen,
       COALESCE(c.unidad, 'presentacion') AS unidad,
       COALESCE(c.gestiona_produccion, 0) AS gestiona_produccion,
       COALESCE(c.gestiona_produccion, 0) AS destacado
       FROM productos p LEFT JOIN configuracion_producto_mayorista c ON c.producto_id = p.id
       WHERE p.estado = 'disponible' OR (p.estado = 'agotado' AND COALESCE(c.gestiona_produccion, 0) = 1)
       ORDER BY destacado DESC, p.nombre ASC`
    );
    return res.json(productos);
  } catch (error) {
    console.error('Error al cargar catálogo mayorista:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el catálogo.' });
  }
});

rutas.post('/solicitudes', async (req, res) => {
  const datos = req.body || {};
  const negocio = limpiar(datos.negocio, 150);
  const contacto = limpiar(datos.contacto, 120);
  const telefono = limpiar(datos.telefono, 30);
  const whatsapp = limpiar(datos.whatsapp, 30);
  const correo = limpiar(datos.correo, 150).toLowerCase();
  const provincia = limpiar(datos.provincia, 100);
  const ciudad = limpiar(datos.ciudad, 100);
  const tipoNegocio = limpiar(datos.tipo_negocio, 80);
  const otroTipo = limpiar(datos.otro_tipo_negocio, 100);
  const clave = limpiar(datos.clave_solicitud, 36);
  const articulos = datos.productos;

  const tiposNegocio = ['Tienda de mascotas', 'Distribuidor', 'Veterinaria', 'Emprendimiento', 'Otro'];
  if (!negocio || !contacto || !telefonoValido(telefono) || !telefonoValido(whatsapp) ||
      !correoValido(correo) || !provincia || !ciudad || !tiposNegocio.includes(tipoNegocio) ||
      (tipoNegocio === 'Otro' && !otroTipo) ||
      !/^[0-9a-f-]{36}$/i.test(clave) || datos.consentimiento !== true ||
      !Array.isArray(articulos) || !articulos.length || articulos.length > 30) {
    return res.status(400).json({ error: 'Revisa los datos, productos y consentimiento antes de enviar.' });
  }

  const cantidades = new Map();
  for (const articulo of articulos) {
    const id = Number(articulo.producto_id);
    const cantidad = Number(articulo.cantidad);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1000000) {
      return res.status(400).json({ error: 'Revisa las cantidades seleccionadas.' });
    }
    cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
  }

  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [existentes] = await transaccion.execute(
      'SELECT id FROM solicitudes_mayoristas WHERE clave_solicitud = ? FOR UPDATE', [clave]
    );
    if (existentes.length) {
      await transaccion.commit();
      return res.status(200).json({ id: existentes[0].id, mensaje: 'La solicitud ya fue recibida.' });
    }

    const ids = [...cantidades.keys()];
    const [productos] = await transaccion.execute(
      `SELECT p.id, p.nombre, p.presentaciones,
       COALESCE(c.unidad, 'presentacion') AS unidad,
       COALESCE(c.gestiona_produccion, 0) AS gestiona_produccion
       FROM productos p LEFT JOIN configuracion_producto_mayorista c ON c.producto_id = p.id
       WHERE (p.estado = 'disponible' OR (p.estado = 'agotado' AND COALESCE(c.gestiona_produccion, 0) = 1))
         AND p.id IN (${ids.map(() => '?').join(',')})`, ids
    );
    if (productos.length !== ids.length) throw Object.assign(new Error('Un producto ya no está disponible.'), { status: 409 });

    const [resultado] = await transaccion.execute(
      `INSERT INTO solicitudes_mayoristas
       (clave_solicitud, negocio, contacto, telefono, whatsapp, correo, provincia, ciudad,
        sector_direccion, tipo_negocio, otro_tipo_negocio, observaciones, consentimiento_datos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [clave, negocio, contacto, telefono, whatsapp, correo, provincia, ciudad,
        limpiar(datos.sector_direccion, 255) || null, tipoNegocio,
        otroTipo || null, limpiar(datos.observaciones, 2000) || null]
    );
    const porId = new Map(productos.map((producto) => [Number(producto.id), producto]));
    for (const [id, cantidad] of cantidades) {
      const producto = porId.get(id);
      await transaccion.execute(
        `INSERT INTO detalle_solicitud_mayorista
         (solicitud_id, producto_id, nombre_producto, presentacion, unidad, gestiona_produccion, cantidad)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [resultado.insertId, id, producto.nombre, producto.presentaciones, producto.unidad,
          producto.gestiona_produccion, cantidad]
      );
    }
    await agregarHistorial(transaccion, resultado.insertId, null, 'solicitud_recibida');
    await transaccion.commit();
    return res.status(201).json({
      id: resultado.insertId,
      mensaje: 'Recibimos tu solicitud. CHARQUI revisará los productos y preparará una cotización personalizada.'
    });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        const [filas] = await conexion.execute('SELECT id FROM solicitudes_mayoristas WHERE clave_solicitud = ?', [clave]);
        if (filas.length) return res.status(200).json({ id: filas[0].id, mensaje: 'La solicitud ya fue recibida.' });
      } catch (errorConsulta) {}
    }
    const estado = error.status || (error.code ? 500 : 400);
    return res.status(estado).json({ error: error.code ? 'No se pudo registrar la solicitud.' : error.message });
  } finally {
    if (transaccion) transaccion.release();
  }
});

// En el navegador solo se consulta una cotización con su token privado.
rutas.get('/cotizacion/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: 'Cotización no encontrada.' });
  try {
    const [filas] = await conexion.execute(
      `SELECT c.id, c.solicitud_id, c.estado, c.subtotal, c.descuento, c.envio, c.total, c.condiciones_pago,
              c.vigencia, c.fecha, s.negocio, s.contacto, s.correo, s.provincia, s.ciudad
       FROM cotizaciones_mayoristas c JOIN solicitudes_mayoristas s ON s.id = c.solicitud_id
       WHERE c.token_hash = ?`, [tokenHash(token)]
    );
    if (!filas.length) return res.status(404).json({ error: 'Cotización no encontrada.' });
    const cotizacion = filas[0];
    if (cotizacion.vigencia && fechaComoTexto(cotizacion.vigencia) < fechaHoy()) {
      await conexion.execute("UPDATE cotizaciones_mayoristas SET estado = 'vencida', token_hash = NULL WHERE id = ? AND estado = 'enviada'", [cotizacion.id]);
      await conexion.execute("UPDATE solicitudes_mayoristas SET estado = 'vencida' WHERE id = ? AND estado = 'cotizacion_enviada'", [cotizacion.solicitud_id]);
      await agregarHistorial(conexion, cotizacion.solicitud_id, null, 'cotizacion_vencida', null, cotizacion.id);
      return res.status(410).json({ error: 'La cotización venció. Comunícate con CHARQUI para solicitar una actualización.' });
    }
    const [productos] = await conexion.execute(
      `SELECT nombre_producto, presentacion, cantidad, precio_unitario, subtotal
       FROM detalle_cotizacion_mayorista WHERE cotizacion_id = ? ORDER BY id`, [cotizacion.id]
    );
    delete cotizacion.correo;
    return res.json({ ...cotizacion, codigo: `COT-${String(cotizacion.id).padStart(6, '0')}`, productos });
  } catch (error) {
    console.error('Error al consultar cotización privada:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo consultar la cotización.' });
  }
});

rutas.put('/cotizacion/:token/respuesta', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token || '');
  const decision = req.body && req.body.decision;
  if (!/^[a-f0-9]{64}$/i.test(token) || !['aceptada', 'rechazada'].includes(decision)) {
    return res.status(400).json({ error: 'La respuesta no es válida.' });
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute(
      `SELECT c.id, c.solicitud_id, c.estado, c.vigencia
       FROM cotizaciones_mayoristas c WHERE c.token_hash = ? FOR UPDATE`, [tokenHash(token)]
    );
    if (!filas.length) throw Object.assign(new Error('Cotización no encontrada.'), { status: 404 });
    const cotizacion = filas[0];
    if (cotizacion.estado !== 'enviada') throw Object.assign(new Error('Esta cotización ya recibió una respuesta.'), { status: 409 });
    if (cotizacion.vigencia && fechaComoTexto(cotizacion.vigencia) < fechaHoy()) {
      await transaccion.execute("UPDATE cotizaciones_mayoristas SET estado = 'vencida', token_hash = NULL WHERE id = ?", [cotizacion.id]);
      await transaccion.execute("UPDATE solicitudes_mayoristas SET estado = 'vencida' WHERE id = ?", [cotizacion.solicitud_id]);
      await agregarHistorial(transaccion, cotizacion.solicitud_id, null, 'cotizacion_vencida', null, cotizacion.id);
      await transaccion.commit();
      return res.status(410).json({ error: 'La cotización venció. Comunícate con CHARQUI.' });
    }
    await transaccion.execute('UPDATE cotizaciones_mayoristas SET estado = ? WHERE id = ?', [decision, cotizacion.id]);
    await transaccion.execute('UPDATE solicitudes_mayoristas SET estado = ? WHERE id = ?', [decision, cotizacion.solicitud_id]);
    await agregarHistorial(transaccion, cotizacion.solicitud_id, null, `cotizacion_${decision}`, null, cotizacion.id);
    await transaccion.commit();
    return res.json({ mensaje: decision === 'aceptada' ? 'Aceptaste la cotización. CHARQUI coordinará contigo el pedido.' : 'Registramos que no aceptas la cotización.' });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo registrar tu respuesta.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.use('/admin', verificarAdministrador);

rutas.get('/admin/productos', async (req, res) => {
  try {
    const [productos] = await conexion.execute(
      `SELECT p.id, p.nombre, p.presentaciones, p.estado, p.stock,
       COALESCE(c.unidad, 'presentacion') AS unidad,
       COALESCE(c.gestiona_produccion, 0) AS gestiona_produccion
       FROM productos p LEFT JOIN configuracion_producto_mayorista c ON c.producto_id = p.id
       WHERE p.estado = 'disponible' OR (p.estado = 'agotado' AND COALESCE(c.gestiona_produccion, 0) = 1)
       ORDER BY p.nombre`
    );
    return res.json(productos);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar la lista de productos.' });
  }
});

rutas.get('/admin/solicitudes', async (req, res) => {
  const buscar = limpiar(req.query.buscar, 150);
  const estado = limpiar(req.query.estado, 40);
  const desde = limpiar(req.query.desde, 10);
  const hasta = limpiar(req.query.hasta, 10);
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
    return res.status(400).json({ error: 'Las fechas no son válidas.' });
  }
  try {
    let consulta = `SELECT s.id, s.fecha, s.negocio, s.contacto, s.correo, s.telefono, s.whatsapp,
      s.ciudad, s.provincia, s.estado,
      GROUP_CONCAT(CONCAT(d.nombre_producto, ' × ', d.cantidad) ORDER BY d.id SEPARATOR ', ') AS productos
      FROM solicitudes_mayoristas s LEFT JOIN detalle_solicitud_mayorista d ON d.solicitud_id = s.id WHERE 1 = 1`;
    const parametros = [];
    if (buscar) {
      consulta += ' AND (s.negocio LIKE ? OR s.contacto LIKE ? OR s.correo LIKE ? OR s.telefono LIKE ?)';
      parametros.push(...Array(4).fill(`%${buscar}%`));
    }
    if (estado) { consulta += ' AND s.estado = ?'; parametros.push(estado); }
    if (desde) { consulta += ' AND s.fecha >= ?'; parametros.push(`${desde} 00:00:00`); }
    if (hasta) { consulta += ' AND s.fecha < DATE_ADD(?, INTERVAL 1 DAY)'; parametros.push(`${hasta} 00:00:00`); }
    consulta += ' GROUP BY s.id ORDER BY s.fecha DESC';
    const [solicitudes] = await conexion.execute(consulta, parametros);
    return res.json(solicitudes);
  } catch (error) {
    console.error('Error al cargar solicitudes mayoristas:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudieron cargar las solicitudes.' });
  }
});

rutas.get('/admin/solicitudes/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'La solicitud no es válida.' });
  try {
    const [solicitudes] = await conexion.execute('SELECT * FROM solicitudes_mayoristas WHERE id = ?', [req.params.id]);
    if (!solicitudes.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    const solicitud = solicitudes[0];
    const [productos] = await conexion.execute(
      `SELECT id, producto_id, nombre_producto, presentacion, unidad, gestiona_produccion, cantidad
       FROM detalle_solicitud_mayorista WHERE solicitud_id = ? ORDER BY id`, [solicitud.id]
    );
    const [cotizaciones] = await conexion.execute(
      `SELECT id, estado, subtotal, descuento, envio, total, condiciones_pago, vigencia, observaciones_internas, fecha, actualizado_en
       FROM cotizaciones_mayoristas WHERE solicitud_id = ? ORDER BY fecha DESC, id DESC`, [solicitud.id]
    );
    for (const cotizacion of cotizaciones) {
      const [lineas] = await conexion.execute(
        `SELECT producto_id, nombre_producto, presentacion, unidad, gestiona_produccion, cantidad, precio_unitario, subtotal
         FROM detalle_cotizacion_mayorista WHERE cotizacion_id = ? ORDER BY id`, [cotizacion.id]
      );
      cotizacion.productos = lineas;
    }
    const [historial] = await conexion.execute(
      `SELECT h.evento, h.detalle, h.fecha, u.nombre AS administrador
       FROM historial_mayoristas h LEFT JOIN usuarios u ON u.id = h.administrador_id
       WHERE h.solicitud_id = ? ORDER BY h.fecha, h.id`, [solicitud.id]
    );
    const [historicoCliente] = await conexion.execute(
      `SELECT s.id, s.negocio, s.estado, s.fecha, c.id AS cotizacion_id, c.estado AS estado_cotizacion,
              c.total, c.fecha AS fecha_cotizacion, GROUP_CONCAT(CONCAT(d.nombre_producto, ' × ', d.cantidad) SEPARATOR ', ') AS productos
       FROM solicitudes_mayoristas s LEFT JOIN cotizaciones_mayoristas c ON c.solicitud_id = s.id
       LEFT JOIN detalle_solicitud_mayorista d ON d.solicitud_id = s.id
       WHERE s.correo = ? GROUP BY s.id, c.id ORDER BY s.fecha DESC, c.fecha DESC`, [solicitud.correo]
    );
    return res.json({ solicitud, productos, cotizaciones, historial, historico_cliente: historicoCliente });
  } catch (error) {
    console.error('Error al consultar solicitud mayorista:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo consultar la solicitud.' });
  }
});

rutas.put('/admin/solicitudes/:id/estado', async (req, res) => {
  const estadosPermitidos = ['nueva', 'en_revision', 'rechazada'];
  const estado = req.body && req.body.estado;
  if (!/^\d+$/.test(req.params.id) || !estadosPermitidos.includes(estado)) {
    return res.status(400).json({ error: 'El estado solicitado no es válido.' });
  }
  try {
    const [resultado] = await conexion.execute(
      'UPDATE solicitudes_mayoristas SET estado = ? WHERE id = ?', [estado, req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await agregarHistorial(conexion, req.params.id, req.administrador.id, 'estado_actualizado', estado);
    return res.json({ mensaje: 'Estado actualizado.' });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el estado.' });
  }
});

rutas.post('/admin/solicitudes/:id/cotizaciones', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'La solicitud no es válida.' });
  const datos = req.body || {};
  if (!Array.isArray(datos.productos) || !datos.productos.length || datos.productos.length > 30) {
    return res.status(400).json({ error: 'Agrega al menos un producto a la cotización.' });
  }
  const lineas = [];
  for (const articulo of datos.productos) {
    const productoId = Number(articulo.producto_id);
    const cantidad = Number(articulo.cantidad);
    const precioM = precioMilenimos(articulo.precio_unitario, true);
    if (!Number.isSafeInteger(productoId) || productoId < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1000000 || precioM === null) {
      return res.status(400).json({ error: 'Revisa productos, cantidades y precios unitarios.' });
    }
    lineas.push({ producto_id: productoId, cantidad, precio_milenimos: precioM,
      subtotal_centavos: (precioM * BigInt(cantidad) + 5n) / 10n });
  }
  if (new Set(lineas.map((linea) => linea.producto_id)).size !== lineas.length) {
    return res.status(400).json({ error: 'Cada producto debe aparecer una sola vez en la cotización.' });
  }
  const descuento = dineroCentavos(datos.descuento, true);
  const envio = dineroCentavos(datos.envio, true);
  if (descuento === null || envio === null) return res.status(400).json({ error: 'El descuento o envío no es válido.' });
  const totales = calcularCotizacion(lineas, descuento, envio);
  if (!totales) return res.status(400).json({ error: 'El descuento no puede superar el subtotal.' });
  const vigencia = limpiar(datos.vigencia, 10);
  if (vigencia && (!fechaValida(vigencia) || vigencia < fechaHoy())) return res.status(400).json({ error: 'La vigencia debe ser una fecha válida igual o posterior a hoy.' });
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [solicitudes] = await transaccion.execute('SELECT id, estado FROM solicitudes_mayoristas WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!solicitudes.length) throw Object.assign(new Error('Solicitud no encontrada.'), { status: 404 });
    if (['convertida_en_pedido', 'aceptada'].includes(solicitudes[0].estado)) throw Object.assign(new Error('La solicitud ya fue aceptada o convertida.'), { status: 409 });
    const completa = lineas.every((linea) => linea.precio_milenimos > 0n);
    const estado = completa ? 'preparada' : 'borrador';
    const [resultado] = await transaccion.execute(
      `INSERT INTO cotizaciones_mayoristas
       (solicitud_id, estado, subtotal, descuento, envio, total, condiciones_pago, vigencia, observaciones_internas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, estado, decimalCentavos(totales.subtotal), decimalCentavos(descuento),
        decimalCentavos(envio), decimalCentavos(totales.total), limpiar(datos.condiciones_pago, 500) || null,
        vigencia || null, limpiar(datos.observaciones_internas, 4000) || null]
    );
    await guardarLineasCotizacion(transaccion, resultado.insertId, lineas);
    const estadoSolicitud = completa ? 'cotizacion_preparada' : 'en_revision';
    await transaccion.execute('UPDATE solicitudes_mayoristas SET estado = ? WHERE id = ?', [estadoSolicitud, req.params.id]);
    await agregarHistorial(transaccion, req.params.id, req.administrador.id,
      completa ? 'cotizacion_preparada' : 'borrador_guardado', null, resultado.insertId);
    await transaccion.commit();
    return res.status(201).json({ id: resultado.insertId, estado, subtotal: decimalCentavos(totales.subtotal), total: decimalCentavos(totales.total) });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    console.error('Error al guardar cotización:', error.code || 'Error');
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar la cotización.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.post('/admin/cotizaciones/:id/enviar', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'La cotización no es válida.' });
  const token = randomBytes(32).toString('hex');
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute(
      `SELECT c.id, c.solicitud_id, c.estado, c.vigencia, s.whatsapp, s.negocio
       FROM cotizaciones_mayoristas c JOIN solicitudes_mayoristas s ON s.id = c.solicitud_id
       WHERE c.id = ? FOR UPDATE`, [req.params.id]
    );
    if (!filas.length) throw Object.assign(new Error('Cotización no encontrada.'), { status: 404 });
    const cotizacion = filas[0];
    if (!['preparada', 'enviada'].includes(cotizacion.estado)) throw Object.assign(new Error('Completa todos los precios antes de enviar.'), { status: 409 });
    if (cotizacion.vigencia && fechaComoTexto(cotizacion.vigencia) < fechaHoy()) throw Object.assign(new Error('La fecha de vigencia ya pasó.'), { status: 409 });
    const [[lineas]] = await transaccion.execute(
      'SELECT COUNT(*) AS total, SUM(precio_unitario = 0) AS sin_precio FROM detalle_cotizacion_mayorista WHERE cotizacion_id = ?', [cotizacion.id]
    );
    if (!Number(lineas.total) || Number(lineas.sin_precio)) throw Object.assign(new Error('Completa los precios unitarios antes de enviar.'), { status: 409 });
    await transaccion.execute(
      `UPDATE cotizaciones_mayoristas SET estado = 'vencida', token_hash = NULL
       WHERE solicitud_id = ? AND estado = 'enviada' AND id <> ?`, [cotizacion.solicitud_id, cotizacion.id]
    );
    await transaccion.execute(
      `UPDATE cotizaciones_mayoristas SET estado = 'enviada', token_hash = ? WHERE id = ?`,
      [tokenHash(token), cotizacion.id]
    );
    await transaccion.execute("UPDATE solicitudes_mayoristas SET estado = 'cotizacion_enviada' WHERE id = ?", [cotizacion.solicitud_id]);
    await agregarHistorial(transaccion, cotizacion.solicitud_id, req.administrador.id, 'cotizacion_enviada', null, cotizacion.id);
    await transaccion.commit();
    return res.json({
      token,
      whatsapp: cotizacion.whatsapp,
      negocio: cotizacion.negocio,
      mensaje: 'La cotización está lista para compartir por WhatsApp.'
    });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo preparar el envío.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.post('/admin/cotizaciones/:id/convertir', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'La cotización no es válida.' });
  const fechaEntrega = limpiar(req.body && req.body.fecha_entrega, 10);
  if (!fechaValida(fechaEntrega) || fechaEntrega < fechaHoy()) {
    return res.status(400).json({ error: 'Indica una fecha de entrega igual o posterior a hoy.' });
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute(
      `SELECT c.*, s.negocio, s.contacto, s.telefono, s.correo, s.whatsapp, s.provincia, s.ciudad, s.sector_direccion, s.id AS solicitud_id
       FROM cotizaciones_mayoristas c JOIN solicitudes_mayoristas s ON s.id = c.solicitud_id
       WHERE c.id = ? FOR UPDATE`, [req.params.id]
    );
    if (!filas.length) throw Object.assign(new Error('Cotización no encontrada.'), { status: 404 });
    const cotizacion = filas[0];
    if (cotizacion.estado !== 'aceptada') throw Object.assign(new Error('El cliente debe aceptar la cotización antes de convertirla.'), { status: 409 });
    if (cotizacion.vigencia && fechaComoTexto(cotizacion.vigencia) < fechaHoy()) {
      throw Object.assign(new Error('La cotización venció; prepara una nueva antes de convertirla.'), { status: 409 });
    }
    const [yaConvertida] = await transaccion.execute('SELECT pedido_id FROM pedidos_mayoristas WHERE cotizacion_id = ?', [cotizacion.id]);
    if (yaConvertida.length) {
      await transaccion.commit();
      return res.json({ pedido_id: yaConvertida[0].pedido_id, mensaje: 'La cotización ya fue convertida.' });
    }
    const [lineas] = await transaccion.execute(
      `SELECT producto_id, nombre_producto, unidad, gestiona_produccion, cantidad, precio_unitario, subtotal
       FROM detalle_cotizacion_mayorista WHERE cotizacion_id = ? ORDER BY producto_id FOR UPDATE`, [cotizacion.id]
    );
    if (!lineas.length) throw Object.assign(new Error('La cotización no tiene productos.'), { status: 409 });
    const ids = lineas.map((linea) => Number(linea.producto_id));
    const [productos] = await transaccion.execute(
      `SELECT id, stock, estado FROM productos WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, ids
    );
    const porId = new Map(productos.map((producto) => [Number(producto.id), producto]));
    const cantidadPatitas = detallesPatitas(lineas).reduce((total, linea) => total + Number(linea.cantidad), 0);
    if (cantidadPatitas) {
      const [capacidades] = await transaccion.execute(
        'SELECT capacidad_unidades FROM capacidad_produccion_patitas WHERE fecha_entrega = ? FOR UPDATE', [fechaEntrega]
      );
      if (!capacidades.length) throw Object.assign(new Error('Registra primero la capacidad de producción para esa fecha.'), { status: 409 });
      const [[compromisos]] = await transaccion.execute(
        `SELECT COALESCE(SUM(m.unidades_pedidas), 0) AS unidades
         FROM produccion_patitas_mayorista m
         JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
         JOIN pedidos p ON p.id = d.pedido_id
         WHERE m.fecha_entrega = ? AND p.estado <> 'cancelado'`, [fechaEntrega]
      );
      if (Number(compromisos.unidades) + cantidadPatitas > Number(capacidades[0].capacidad_unidades)) {
        throw Object.assign(new Error('La cantidad supera la capacidad libre de producción para esa fecha.'), { status: 409 });
      }
    }
    for (const linea of lineas) {
      const producto = porId.get(Number(linea.producto_id));
      if (!producto || producto.estado === 'inactivo' || (!Number(linea.gestiona_produccion) &&
          (producto.estado !== 'disponible' || Number(producto.stock) < Number(linea.cantidad)))) {
        throw Object.assign(new Error(`No hay existencias suficientes para ${linea.nombre_producto}.`), { status: 409 });
      }
    }
    let subtotal = 0n;
    const detalles = lineas.map((linea) => {
      const mil = precioMilenimos(linea.precio_unitario);
      const centavos = (mil * BigInt(linea.cantidad) + 5n) / 10n;
      subtotal += centavos;
      return { ...linea, centavos, precio_milenimos: mil };
    });
    const descuento = dineroCentavos(cotizacion.descuento);
    const envio = dineroCentavos(cotizacion.envio);
    const totales = calcularCotizacion(detalles.map((linea) => ({ ...linea, precio_milenimos: linea.precio_milenimos })), descuento, envio);
    if (!totales || totales.subtotal !== subtotal || totales.total !== dineroCentavos(cotizacion.total)) {
      throw Object.assign(new Error('Los valores de la cotización no coinciden; revísala antes de convertir.'), { status: 409 });
    }

    const correo = String(cotizacion.correo).trim().toLowerCase();
    const [usuarios] = await transaccion.execute('SELECT id, rol FROM usuarios WHERE correo = ? FOR UPDATE', [correo]);
    let usuarioId;
    if (usuarios.length) {
      if (usuarios[0].rol !== 'cliente') throw Object.assign(new Error('El correo del negocio no está disponible para pedidos.'), { status: 409 });
      usuarioId = usuarios[0].id;
      await transaccion.execute('UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?', [cotizacion.contacto, cotizacion.telefono, usuarioId]);
    } else {
      const clave = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      const [usuario] = await transaccion.execute(
        "INSERT INTO usuarios (nombre, correo, contrasena, telefono, rol) VALUES (?, ?, ?, ?, 'cliente')",
        [cotizacion.contacto, correo, clave, cotizacion.telefono]
      );
      usuarioId = usuario.insertId;
    }

    const direccion = cotizacion.sector_direccion || `${cotizacion.negocio} · ${cotizacion.ciudad}, ${cotizacion.provincia}`;
    const [pedido] = await transaccion.execute(
      `INSERT INTO pedidos (usuario_id, direccion_entrega, estado, total, costo_envio, forma_pago, provincia, ciudad, sector)
       VALUES (?, ?, 'recibido_y_confirmado', ?, ?, ?, ?, ?, ?)`,
      [usuarioId, direccion.slice(0, 255), decimalCentavos(totales.total), decimalCentavos(envio),
        'Cotización mayorista', cotizacion.provincia, cotizacion.ciudad,
        cotizacion.sector_direccion]
    );
    for (const linea of detalles) {
      const producto = porId.get(Number(linea.producto_id));
      const [detalle] = await transaccion.execute(
        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
        [pedido.insertId, linea.producto_id, linea.cantidad, decimalCentavos(linea.centavos)]
      );
      await transaccion.execute(
        'INSERT INTO detalle_pedido_mayorista (detalle_pedido_id, nombre_producto, precio_unitario) VALUES (?, ?, ?)',
        [detalle.insertId, linea.nombre_producto, decimalMilenimos(linea.precio_milenimos)]
      );
      if (Number(linea.gestiona_produccion)) {
        await transaccion.execute(
          `INSERT INTO produccion_patitas_mayorista
           (detalle_pedido_id, fecha_entrega, unidades_pedidas) VALUES (?, ?, ?)`,
          [detalle.insertId, fechaEntrega, linea.cantidad]
        );
      } else {
        const nuevoStock = Number(producto.stock) - Number(linea.cantidad);
        await transaccion.execute('UPDATE productos SET stock = ?, estado = ? WHERE id = ?',
          [nuevoStock, nuevoStock === 0 ? 'agotado' : 'disponible', linea.producto_id]);
        await transaccion.execute(
          `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, pedido_id, administrador_id)
           VALUES (?, 'venta', ?, ?, ?, ?, ?, ?)`,
          [linea.producto_id, linea.cantidad, producto.stock, nuevoStock,
            `Pedido mayorista por cotización #${cotizacion.id}`, pedido.insertId, req.administrador.id]
        );
      }
    }
    await transaccion.execute(
      `INSERT INTO pedidos_mayoristas (pedido_id, cotizacion_id, fecha_entrega, condiciones_pago, descuento, envio)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [pedido.insertId, cotizacion.id, fechaEntrega, cotizacion.condiciones_pago, decimalCentavos(descuento), decimalCentavos(envio)]
    );
    await transaccion.execute(
      `INSERT INTO historial_pedidos (pedido_id, estado_anterior, estado_nuevo, administrador_id, observacion, visible_cliente)
       VALUES (?, NULL, 'recibido_y_confirmado', ?, ?, 1)`,
      [pedido.insertId, req.administrador.id, `Pedido mayorista · Cotización #${cotizacion.id}`]
    );
    await transaccion.execute("UPDATE cotizaciones_mayoristas SET estado = 'convertida_en_pedido' WHERE id = ?", [cotizacion.id]);
    await transaccion.execute("UPDATE solicitudes_mayoristas SET estado = 'convertida_en_pedido', usuario_id = ? WHERE id = ?", [usuarioId, cotizacion.solicitud_id]);
    await agregarHistorial(transaccion, cotizacion.solicitud_id, req.administrador.id, 'pedido_creado', `Pedido #${pedido.insertId}`, cotizacion.id);
    await transaccion.commit();
    return res.status(201).json({ pedido_id: pedido.insertId, total: decimalCentavos(totales.total), fecha_entrega: fechaEntrega, mensaje: 'Pedido mayorista creado. Las patitas quedan registradas como producción pendiente, separadas del inventario minorista.' });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    console.error('Error al convertir cotización mayorista:', error.code || 'Error');
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo convertir la cotización.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

// Resume la capacidad y los pedidos de patitas para el rango consultado.
rutas.get('/admin/produccion', async (req, res) => {
  const desde = limpiar(req.query.desde, 10) || fechaHoy();
  const hasta = limpiar(req.query.hasta, 10) || desde;
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  }
  try {
    const [dias] = await conexion.execute(
      `SELECT c.fecha_entrega, c.capacidad_unidades,
       COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN m.unidades_pedidas ELSE 0 END), 0) AS comprometidas
       FROM capacidad_produccion_patitas c LEFT JOIN produccion_patitas_mayorista m ON m.fecha_entrega = c.fecha_entrega
       LEFT JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
       LEFT JOIN pedidos p ON p.id = d.pedido_id AND p.estado <> 'cancelado'
       WHERE c.fecha_entrega BETWEEN ? AND ? GROUP BY c.fecha_entrega, c.capacidad_unidades ORDER BY c.fecha_entrega`, [desde, hasta]
    );
    const [compromisos] = await conexion.execute(
      `SELECT m.detalle_pedido_id, m.fecha_entrega, m.unidades_pedidas, m.unidades_producidas,
       m.unidades_listas, m.unidades_entregadas, d.pedido_id, s.negocio, s.contacto,
       dp.nombre_producto
       FROM produccion_patitas_mayorista m JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
       JOIN detalle_pedido_mayorista dp ON dp.detalle_pedido_id = d.id
       JOIN pedidos p ON p.id = d.pedido_id JOIN pedidos_mayoristas pm ON pm.pedido_id = p.id
       JOIN cotizaciones_mayoristas c ON c.id = pm.cotizacion_id
       JOIN solicitudes_mayoristas s ON s.id = c.solicitud_id
       WHERE m.fecha_entrega BETWEEN ? AND ? AND p.estado <> 'cancelado'
       ORDER BY m.fecha_entrega, p.id`, [desde, hasta]
    );
    return res.json({ dias, compromisos });
  } catch (error) {
    console.error('Error al cargar el plan de producción:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar el plan de producción.' });
  }
});

rutas.put('/admin/produccion/capacidad', async (req, res) => {
  const fecha = limpiar(req.body && req.body.fecha_entrega, 10);
  const capacidad = Number(req.body && req.body.capacidad_unidades);
  if (!fechaValida(fecha) || !Number.isSafeInteger(capacidad) || capacidad < 0 || capacidad > 10000000) {
    return res.status(400).json({ error: 'Indica una fecha y capacidad válida.' });
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    await transaccion.execute(
      'INSERT IGNORE INTO capacidad_produccion_patitas (fecha_entrega, capacidad_unidades) VALUES (?, 0)', [fecha]
    );
    await transaccion.execute(
      'SELECT capacidad_unidades FROM capacidad_produccion_patitas WHERE fecha_entrega = ? FOR UPDATE', [fecha]
    );
    const [[compromisos]] = await transaccion.execute(
      `SELECT COALESCE(SUM(m.unidades_pedidas), 0) AS unidades
       FROM produccion_patitas_mayorista m JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
       JOIN pedidos p ON p.id = d.pedido_id
       WHERE m.fecha_entrega = ? AND p.estado <> 'cancelado'`, [fecha]
    );
    if (capacidad < Number(compromisos.unidades)) throw Object.assign(new Error('La capacidad no puede ser menor que los pedidos ya comprometidos.'), { status: 409 });
    await transaccion.execute('UPDATE capacidad_produccion_patitas SET capacidad_unidades = ? WHERE fecha_entrega = ?', [capacidad, fecha]);
    await transaccion.commit();
    return res.json({ mensaje: 'Capacidad de producción guardada.', capacidad_unidades: capacidad, comprometidas: Number(compromisos.unidades) });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar la capacidad.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

rutas.put('/admin/produccion/:detalleId', async (req, res) => {
  if (!/^\d+$/.test(req.params.detalleId)) return res.status(400).json({ error: 'El detalle no es válido.' });
  const producidas = Number(req.body && req.body.unidades_producidas);
  const listas = Number(req.body && req.body.unidades_listas);
  const entregadas = Number(req.body && req.body.unidades_entregadas);
  if (![producidas, listas, entregadas].every(Number.isSafeInteger) || [producidas, listas, entregadas].some((valor) => valor < 0)) {
    return res.status(400).json({ error: 'Las cantidades deben ser números enteros iguales o mayores que cero.' });
  }
  let transaccion;
  try {
    transaccion = await conexion.getConnection();
    await transaccion.beginTransaction();
    const [filas] = await transaccion.execute(
      `SELECT m.*, d.pedido_id, pm.cotizacion_id, c.solicitud_id
       FROM produccion_patitas_mayorista m JOIN detalle_pedido d ON d.id = m.detalle_pedido_id
       JOIN pedidos_mayoristas pm ON pm.pedido_id = d.pedido_id
       JOIN cotizaciones_mayoristas c ON c.id = pm.cotizacion_id
       WHERE m.detalle_pedido_id = ? FOR UPDATE`, [req.params.detalleId]
    );
    if (!filas.length) throw Object.assign(new Error('Compromiso de producción no encontrado.'), { status: 404 });
    const fila = filas[0];
    if (producidas < Number(fila.unidades_producidas) || listas < Number(fila.unidades_listas) || entregadas < Number(fila.unidades_entregadas) ||
        producidas > Number(fila.unidades_pedidas) || listas > producidas || entregadas > listas) {
      throw Object.assign(new Error('Las cantidades deben avanzar sin superar lo pedido: entregadas ≤ listas ≤ producidas ≤ solicitadas.'), { status: 400 });
    }
    await transaccion.execute(
      `UPDATE produccion_patitas_mayorista SET unidades_producidas = ?, unidades_listas = ?, unidades_entregadas = ?
       WHERE detalle_pedido_id = ?`, [producidas, listas, entregadas, req.params.detalleId]
    );
    await agregarHistorial(transaccion, fila.solicitud_id, req.administrador.id, 'produccion_actualizada',
      `Pedido #${fila.pedido_id}: ${producidas} producidas, ${listas} listas y ${entregadas} entregadas.`, fila.cotizacion_id);
    await transaccion.commit();
    return res.json({ mensaje: 'Progreso de producción actualizado.' });
  } catch (error) {
    if (transaccion) { try { await transaccion.rollback(); } catch (errorRollback) {} }
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo actualizar la producción.' });
  } finally {
    if (transaccion) transaccion.release();
  }
});

module.exports = rutas;
