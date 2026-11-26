const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs');

test('integración HTTP real contra MariaDB aislada', { skip: !process.env.CHARQUI_TEST_DB_ENV }, async () => {
  const configuracionPruebas = dotenv.parse(fs.readFileSync(process.env.CHARQUI_TEST_DB_ENV));
  assert.equal(configuracionPruebas.DB_NAME, 'charqui_web_test', 'La configuración debe apuntar exactamente a charqui_web_test.');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(configuracionPruebas.DB_HOST), 'La base de pruebas debe ser local.');
  Object.assign(process.env, configuracionPruebas);
  process.env.JWT_SECRETO = crypto.randomBytes(48).toString('hex');
  process.env.CORS_ORIGINS = '';
  process.env.PUERTO = '0';

  const pool = require('../base_datos');
  let servidor;
  try {
    const [[baseSeleccionada]] = await pool.query('SELECT DATABASE() AS nombre');
    assert.equal(baseSeleccionada.nombre, 'charqui_web_test', 'El pool no seleccionó la base aislada.');
    const [tablaIdempotencia] = await pool.query("SHOW TABLES LIKE 'idempotencia_pedidos'");
    assert.equal(tablaIdempotencia.length, 1, 'Aplica primero la migración de idempotencia a charqui_web_test.');
    const [[fixtureOriginalAntes]] = await pool.execute(
      'SELECT stock FROM productos WHERE nombre = ?',
      ['Patitas de pollo QA fixture']
    );
    assert.ok(fixtureOriginalAntes, 'El fixture de inventario debe existir antes de la prueba.');
    const stockFixtureOriginalAntes = Number(fixtureOriginalAntes.stock);

    const tag = crypto.randomUUID();
    const correoAdmin = `admin-${tag}@example.invalid`;
    const contrasenaAdmin = crypto.randomBytes(24).toString('hex');
    const hashAdmin = await bcrypt.hash(contrasenaAdmin, 10);
    const [admin] = await pool.execute(
      "INSERT INTO usuarios (nombre, correo, contrasena, telefono, rol) VALUES (?, ?, ?, ?, 'administrador')",
      ['Administrador QA MariaDB', correoAdmin, hashAdmin, '0999000101']
    );
    const [producto] = await pool.execute(
      `INSERT INTO productos
       (nombre, descripcion, precio, stock, imagen, estado, tipo_mascota, info_nutricional, presentaciones, textura)
       VALUES (?, ?, 4.25, 20, 'patitas-pollo.png', 'disponible', 'perro', 'Fixture QA', 'Paquete QA', 'crujiente')`,
      [`Producto QA MariaDB ${tag}`, 'Producto ficticio para integración real.']
    );

    const { iniciarServidor } = require('../servidor');
    servidor = iniciarServidor();
    await new Promise((resolve, reject) => {
      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });
    const origen = `http://127.0.0.1:${servidor.address().port}`;
    let solicitudesCreacionPedidos = 0;
    const consultar = async (ruta, opciones = {}) => {
      if (ruta === '/api/pedidos' && String(opciones.method || 'GET').toUpperCase() === 'POST') {
        solicitudesCreacionPedidos += 1;
      }
      const { token, idempotencyKey, ...opcionesFetch } = opciones;
      const respuesta = await fetch(`${origen}${ruta}`, {
        ...opcionesFetch,
        headers: {
          ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...opciones.headers
        },
        body: opciones.body ? JSON.stringify(opciones.body) : undefined
      });
      const texto = await respuesta.text();
      let datos;
      try { datos = texto ? JSON.parse(texto) : {}; }
      catch { datos = texto; }
      return { respuesta, datos };
    };
    const fechaSql = async () => {
      const [[fila]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS fecha");
      return fila.fecha;
    };

    const catalogo = await consultar('/api/productos');
    assert.equal(catalogo.respuesta.status, 200);
    assert.ok(catalogo.datos.some((item) => item.id === producto.insertId));
    const detalleProducto = await consultar(`/api/productos/${producto.insertId}`);
    assert.equal(detalleProducto.respuesta.status, 200);

    const envios = await consultar('/api/envios');
    assert.equal(envios.respuesta.status, 200);
    assert.equal(envios.datos.tarifas['Quito QA'], 2.5);
    assert.ok(envios.datos.formas_pago.includes('Transferencia QA'));

    const login = await consultar('/api/auth/login', {
      method: 'POST',
      body: { correo: correoAdmin, contrasena: contrasenaAdmin }
    });
    assert.equal(login.respuesta.status, 200);
    assert.ok(login.datos.token);
    const tokenAdmin = login.datos.token;
    const catalogoAdmin = await consultar('/api/productos?todos=1', { token: tokenAdmin });
    assert.equal(catalogoAdmin.respuesta.status, 200);

    const pedido = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: {
        cliente: { nombre: 'Cliente ficticio QA', telefono: '0999000102', correo: `cliente-${tag}@example.invalid` },
        direccion_entrega: 'Dirección ficticia QA',
        zona_entrega: 'Quito QA',
        forma_pago: 'Transferencia QA',
        consentimiento: true,
        productos: [{ id: producto.insertId, cantidad: 2 }]
      }
    });
    assert.equal(pedido.respuesta.status, 201);
    assert.equal(Number(pedido.datos.subtotal), 8.5);
    assert.equal(Number(pedido.datos.costo_envio), 2.5);
    assert.equal(Number(pedido.datos.total), 11);

    const [[estadoPedido]] = await pool.execute(
      `SELECT p.estado, p.pago_confirmado, p.total, pr.stock,
       (SELECT COUNT(*) FROM detalle_pedido d WHERE d.pedido_id = p.id) AS detalles,
       (SELECT COUNT(*) FROM movimientos_inventario m WHERE m.pedido_id = p.id AND m.tipo = 'venta') AS ventas,
       (SELECT COUNT(*) FROM historial_pedidos h WHERE h.pedido_id = p.id) AS historial
       FROM pedidos p JOIN detalle_pedido dp ON dp.pedido_id = p.id
       JOIN productos pr ON pr.id = dp.producto_id WHERE p.id = ?`,
      [pedido.datos.id]
    );
    assert.equal(estadoPedido.estado, 'recibido_y_confirmado');
    assert.equal(Number(estadoPedido.pago_confirmado), 0);
    assert.equal(Number(estadoPedido.total), 11);
    assert.equal(Number(estadoPedido.stock), 18);
    assert.equal(Number(estadoPedido.detalles), 1);
    assert.equal(Number(estadoPedido.ventas), 1);
    assert.equal(Number(estadoPedido.historial), 1);

    const seguimiento = await consultar('/api/pedidos/cliente', {
      method: 'POST',
      body: { token_seguimiento: pedido.datos.token_seguimiento }
    });
    assert.equal(seguimiento.respuesta.status, 200);
    assert.equal(seguimiento.datos.pedido.id, pedido.datos.id);
    assert.equal(seguimiento.datos.pedido.productos.length, 1);
    const seguimientoInvalido = await consultar('/api/pedidos/cliente', {
      method: 'POST',
      body: { token_seguimiento: 'token-no-valido' }
    });
    assert.equal(seguimientoInvalido.respuesta.status, 404);

    const estadoActualizado = await consultar(`/api/pedidos/${pedido.datos.id}/estado`, {
      method: 'PUT',
      token: tokenAdmin,
      body: { estado: 'en_preparacion', observacion: 'Transición QA', visible_cliente: true }
    });
    assert.equal(estadoActualizado.respuesta.status, 200);
    const transicionInvalida = await consultar(`/api/pedidos/${pedido.datos.id}/estado`, {
      method: 'PUT',
      token: tokenAdmin,
      body: { estado: 'entregado' }
    });
    assert.equal(transicionInvalida.respuesta.status, 409);

    const pago = await consultar(`/api/pedidos/${pedido.datos.id}/pago`, {
      method: 'PUT',
      token: tokenAdmin,
      body: {}
    });
    assert.equal(pago.respuesta.status, 200);
    const pagoDuplicado = await consultar(`/api/pedidos/${pedido.datos.id}/pago`, {
      method: 'PUT',
      token: tokenAdmin,
      body: {}
    });
    assert.equal(pagoDuplicado.respuesta.status, 409);

    const trackingActualizado = await consultar('/api/pedidos/cliente', {
      method: 'POST',
      body: { token_seguimiento: pedido.datos.token_seguimiento }
    });
    assert.equal(trackingActualizado.respuesta.status, 200);
    assert.equal(trackingActualizado.datos.pedido.estado, 'en_preparacion');
    assert.equal(trackingActualizado.datos.pedido.historial.length, 2);

    const movimientosAntes = await consultar(`/api/administracion/inventario/${producto.insertId}/movimientos`, { token: tokenAdmin });
    assert.equal(movimientosAntes.respuesta.status, 200);
    const movimiento = await consultar(`/api/administracion/inventario/${producto.insertId}/movimientos`, {
      method: 'POST',
      token: tokenAdmin,
      body: { tipo: 'entrada', cantidad: 3, motivo: 'Entrada ficticia QA' }
    });
    assert.equal(movimiento.respuesta.status, 201);
    assert.equal(Number(movimiento.datos.stock), 21);

    const correoRollback = `rollback-${tag}@example.invalid`;
    const pedidoFallido = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: {
        cliente: { nombre: 'Cliente rollback QA', telefono: '0999000103', correo: correoRollback },
        direccion_entrega: 'Dirección ficticia rollback',
        zona_entrega: 'Quito QA',
        forma_pago: 'Transferencia QA',
        consentimiento: true,
        productos: [{ id: 4294967295, cantidad: 1 }]
      }
    });
    assert.equal(pedidoFallido.respuesta.status, 409);
    const [[usuarioRollback]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM usuarios WHERE correo = ?', [correoRollback]);
    assert.equal(Number(usuarioRollback.cantidad), 0, 'El rollback debe quitar el cliente insertado dentro de la transacción fallida.');

    const crearCuerpoPedido = (correo, cantidad, productoId = producto.insertId) => ({
      cliente: { nombre: 'Cliente idempotencia QA', telefono: '0999000105', correo },
      direccion_entrega: 'Dirección ficticia idempotencia',
      zona_entrega: 'Quito QA',
      forma_pago: 'Transferencia QA',
      consentimiento: true,
      productos: [{ id: productoId, cantidad }]
    });

    const claveRecuperable = crypto.randomUUID();
    const correoRecuperable = `reintento-${tag}@example.invalid`;
    const falloRecuperable = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: claveRecuperable,
      body: crearCuerpoPedido(correoRecuperable, 1, 4294967295)
    });
    assert.equal(falloRecuperable.respuesta.status, 409);
    const reintentoRecuperable = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: claveRecuperable,
      body: crearCuerpoPedido(correoRecuperable, 1)
    });
    assert.equal(reintentoRecuperable.respuesta.status, 201);
    const [[registroReintento]] = await pool.execute(
      'SELECT pedido_id FROM idempotencia_pedidos WHERE clave = ?',
      [claveRecuperable]
    );
    assert.equal(Number(registroReintento.pedido_id), reintentoRecuperable.datos.id);

    const claveSecuencial = crypto.randomUUID();
    const cuerpoSecuencial = crearCuerpoPedido(`secuencial-${tag}@example.invalid`, 1);
    const pedidoSecuencial = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: claveSecuencial,
      body: cuerpoSecuencial
    });
    assert.equal(pedidoSecuencial.respuesta.status, 201);
    const repeticionSecuencial = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: claveSecuencial,
      body: cuerpoSecuencial
    });
    assert.equal(repeticionSecuencial.respuesta.status, 200);
    assert.equal(repeticionSecuencial.datos.id, pedidoSecuencial.datos.id);
    assert.equal(repeticionSecuencial.datos.total, pedidoSecuencial.datos.total);
    assert.equal(repeticionSecuencial.datos.token_seguimiento, pedidoSecuencial.datos.token_seguimiento);
    const mismaClaveDatosDistintos = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: claveSecuencial,
      body: crearCuerpoPedido(`secuencial-${tag}@example.invalid`, 2)
    });
    assert.equal(mismaClaveDatosDistintos.respuesta.status, 409);
    const [[detalleSecuencial]] = await pool.execute(
      `SELECT COUNT(*) AS cantidad FROM detalle_pedido WHERE pedido_id = ?`,
      [pedidoSecuencial.datos.id]
    );
    const [[movimientoSecuencial]] = await pool.execute(
      `SELECT COUNT(*) AS cantidad FROM movimientos_inventario WHERE pedido_id = ? AND tipo = 'venta'`,
      [pedidoSecuencial.datos.id]
    );
    assert.equal(Number(detalleSecuencial.cantidad), 1);
    assert.equal(Number(movimientoSecuencial.cantidad), 1);

    const claveConcurrente = crypto.randomUUID();
    const cuerpoConcurrente = crearCuerpoPedido(`concurrente-${tag}@example.invalid`, 1);
    const pedidosConcurrentes = await Promise.all([
      consultar('/api/pedidos', { method: 'POST', idempotencyKey: claveConcurrente, body: cuerpoConcurrente }),
      consultar('/api/pedidos', { method: 'POST', idempotencyKey: claveConcurrente, body: cuerpoConcurrente })
    ]);
    assert.deepEqual(pedidosConcurrentes.map((resultado) => resultado.respuesta.status).sort(), [200, 201]);
    assert.equal(pedidosConcurrentes[0].datos.id, pedidosConcurrentes[1].datos.id);
    assert.equal(pedidosConcurrentes[0].datos.token_seguimiento, pedidosConcurrentes[1].datos.token_seguimiento);
    const idPedidoConcurrente = pedidosConcurrentes[0].datos.id;
    const [[registroConcurrente]] = await pool.execute(
      'SELECT COUNT(*) AS cantidad, MAX(pedido_id) AS pedido_id FROM idempotencia_pedidos WHERE clave = ?',
      [claveConcurrente]
    );
    assert.equal(Number(registroConcurrente.cantidad), 1);
    assert.equal(Number(registroConcurrente.pedido_id), idPedidoConcurrente);
    const [[movimientoConcurrente]] = await pool.execute(
      `SELECT COUNT(*) AS cantidad FROM movimientos_inventario WHERE pedido_id = ? AND tipo = 'venta'`,
      [idPedidoConcurrente]
    );
    assert.equal(Number(movimientoConcurrente.cantidad), 1);

    const pedidoClaveNueva = await consultar('/api/pedidos', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: cuerpoSecuencial
    });
    assert.equal(pedidoClaveNueva.respuesta.status, 201);
    assert.notEqual(pedidoClaveNueva.datos.id, pedidoSecuencial.datos.id);

    while (solicitudesCreacionPedidos < 15) {
      const dentroDelLimite = await consultar('/api/pedidos', { method: 'POST', body: {} });
      assert.equal(dentroDelLimite.respuesta.status, 400);
    }
    const excedido = await consultar('/api/pedidos', { method: 'POST', body: {} });
    assert.equal(excedido.respuesta.status, 429);
    assert.ok(Number(excedido.respuesta.headers.get('retry-after')) > 0);

    const productosMayoristas = await consultar('/api/mayoristas/productos');
    assert.equal(productosMayoristas.respuesta.status, 200);
    assert.ok(productosMayoristas.datos.some((item) => item.id === producto.insertId));
    const solicitud = await consultar('/api/mayoristas/solicitudes', {
      method: 'POST',
      body: {
        negocio: 'Negocio ficticio QA',
        contacto: 'Contacto QA',
        telefono: '0999000104',
        whatsapp: '0999000104',
        correo: `mayorista-${tag}@example.invalid`,
        provincia: 'Pichincha',
        ciudad: 'Quito',
        tipo_negocio: 'Tienda de mascotas',
        clave_solicitud: crypto.randomUUID(),
        consentimiento: true,
        productos: [{ producto_id: producto.insertId, cantidad: 10 }]
      }
    });
    assert.equal(solicitud.respuesta.status, 201);

    const detalleSolicitud = await consultar(`/api/mayoristas/admin/solicitudes/${solicitud.datos.id}`, { token: tokenAdmin });
    assert.equal(detalleSolicitud.respuesta.status, 200);
    assert.equal(detalleSolicitud.datos.productos.length, 1);
    const crearCotizacion = await consultar(`/api/mayoristas/admin/solicitudes/${solicitud.datos.id}/cotizaciones`, {
      method: 'POST',
      token: tokenAdmin,
      body: {
        productos: [{ producto_id: producto.insertId, cantidad: 10, precio_unitario: '1.250' }],
        descuento: '1.00',
        envio: '2.50',
        condiciones_pago: 'Condiciones ficticias QA'
      }
    });
    assert.equal(crearCotizacion.respuesta.status, 201);
    assert.equal(Number(crearCotizacion.datos.subtotal), 12.5);
    assert.equal(Number(crearCotizacion.datos.total), 14);

    const enviada = await consultar(`/api/mayoristas/admin/cotizaciones/${crearCotizacion.datos.id}/enviar`, {
      method: 'POST',
      token: tokenAdmin,
      body: {}
    });
    assert.equal(enviada.respuesta.status, 200);
    const cotizacionPrivada = await consultar(`/api/mayoristas/cotizacion/${enviada.datos.token}`);
    assert.equal(cotizacionPrivada.respuesta.status, 200);
    assert.equal(Number(cotizacionPrivada.datos.total), 14);
    assert.equal(Object.hasOwn(cotizacionPrivada.datos, 'correo'), false);
    const respuestaCotizacion = await consultar(`/api/mayoristas/cotizacion/${enviada.datos.token}/respuesta`, {
      method: 'PUT',
      body: { decision: 'aceptada' }
    });
    assert.equal(respuestaCotizacion.respuesta.status, 200);

    const dashboard = await consultar('/api/administracion/dashboard', { token: tokenAdmin });
    assert.equal(dashboard.respuesta.status, 200);
    const reporte = await consultar(`/api/administracion/reportes?desde=${await fechaSql()}&hasta=${await fechaSql()}`, { token: tokenAdmin });
    assert.equal(reporte.respuesta.status, 200);
    const reporteCsv = await consultar(`/api/administracion/reportes.csv?desde=${await fechaSql()}&hasta=${await fechaSql()}`, { token: tokenAdmin });
    assert.equal(reporteCsv.respuesta.status, 200);
    assert.match(reporteCsv.respuesta.headers.get('content-type'), /text\/csv/i);

    const [[fixtureOriginal]] = await pool.execute(
      'SELECT stock FROM productos WHERE nombre = ?',
      ['Patitas de pollo QA fixture']
    );
    assert.equal(Number(fixtureOriginal.stock), stockFixtureOriginalAntes, 'Los fixtures existentes no deben modificarse.');
    const [[mayoristaFinal]] = await pool.execute(
      `SELECT s.estado AS solicitud_estado, c.estado AS cotizacion_estado
       FROM solicitudes_mayoristas s JOIN cotizaciones_mayoristas c ON c.solicitud_id = s.id
       WHERE s.id = ? AND c.id = ?`,
      [solicitud.datos.id, crearCotizacion.datos.id]
    );
    assert.equal(mayoristaFinal.solicitud_estado, 'aceptada');
    assert.equal(mayoristaFinal.cotizacion_estado, 'aceptada');
    assert.ok(admin.insertId > 0);

    console.log(JSON.stringify({
      database: baseSeleccionada.nombre,
      catalog: 'ok',
      login: 'ok',
      orderAndShipping: 'ok',
      stockDiscountAndMovement: 'ok',
      invalidOrderRollback: 'ok',
      idempotencySequentialAndRecovery: 'ok',
      idempotencyConcurrentSingleOrder: 'ok',
      orderRateLimit15AndRetryAfter: 'ok',
      trackingAndStatusHistory: 'ok',
      paymentConfirmation: 'ok',
      dashboardAndReports: 'ok',
      wholesaleRequestAndQuote: 'ok',
      priorFixturesUnchanged: true
    }));
  } finally {
    if (servidor) {
      await new Promise((resolve) => servidor.close(resolve));
    }
    await pool.end();
  }
});
