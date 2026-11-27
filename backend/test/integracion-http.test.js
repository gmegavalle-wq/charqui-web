const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

process.env.JWT_SECRETO = 'integration-test-secret-with-at-least-32-bytes';
process.env.CORS_ORIGINS = 'https://tienda.test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'isolated-test';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'charqui_isolated_test_not_used';

const pool = require('../base_datos');
const { servidor } = require('../servidor');

const fechaHoy = new Date().toISOString().slice(0, 10);
const usuarioAdministrador = {
  id: 700,
  nombre: 'Admin de prueba',
  correo: 'admin@example.test',
  rol: 'administrador'
};
const producto = {
  id: 1,
  nombre: 'Patitas de pollo',
  descripcion: 'Producto de prueba',
  precio: '5.00',
  precio_oferta: null,
  stock: 50,
  estado: 'disponible',
  imagen: 'patitas.jpg',
  tipo_mascota: 'perro',
  textura: 'crujiente',
  info_nutricional: 'Ingredientes: Patitas de pollo',
  presentaciones: 'Paquete',
  unidad: 'patita',
  gestiona_produccion: 1
};

const estado = {
  usuarios: new Map(),
  pedidos: new Map(),
  idempotencias: new Map(),
  detallesPedido: new Map(),
  historialPedido: new Map(),
  solicitudes: new Map(),
  detallesSolicitud: new Map(),
  cotizaciones: new Map(),
  detallesCotizacion: new Map(),
  siguienteUsuario: 800,
  siguientePedido: 1000,
  siguienteSolicitud: 2000,
  siguienteCotizacion: 3000,
  consultas: []
};

const rows = (items) => [items, []];
const resultado = (cabecera) => [cabecera, []];
const normalizarSql = (sql) => sql.replace(/\s+/g, ' ').trim();

function pedidosEnRango(desde, hasta) {
  return [...estado.pedidos.values()].filter((pedido) => pedido.fecha.slice(0, 10) >= desde &&
    pedido.fecha.slice(0, 10) <= hasta);
}

function calcularImportes(pedidos) {
  const activos = pedidos.filter((pedido) => pedido.estado !== 'cancelado');
  return {
    valor_pedidos: activos.reduce((suma, pedido) => suma + Number(pedido.total), 0),
    pagos_pendientes: activos.filter((pedido) => !pedido.pago_confirmado)
      .reduce((suma, pedido) => suma + Number(pedido.total), 0),
    pagos_confirmados: pedidos.filter((pedido) => pedido.pago_confirmado)
      .reduce((suma, pedido) => suma + Number(pedido.total), 0)
  };
}

function actualizarSolicitud(id, estadoNuevo) {
  const solicitud = estado.solicitudes.get(Number(id));
  if (solicitud) solicitud.estado = estadoNuevo;
}

function actualizarCotizacion(id, cambios) {
  const cotizacion = estado.cotizaciones.get(Number(id));
  if (cotizacion) Object.assign(cotizacion, cambios);
}

async function ejecutarConsulta(sql, parametros = []) {
  const consulta = normalizarSql(sql);
  estado.consultas.push(consulta);

  if (consulta.startsWith('SELECT id, nombre, correo, contrasena, rol FROM usuarios')) {
    return rows([{ ...usuarioAdministrador, contrasena: estado.hashAdministrador }]);
  }
  if (consulta.startsWith('SELECT id, rol, cedula FROM usuarios WHERE correo = ? FOR UPDATE')) {
    const usuario = estado.usuarios.get(parametros[0]);
    return rows(usuario ? [{ id: usuario.id, rol: 'cliente', cedula: null }] : []);
  }
  if (consulta.startsWith('INSERT INTO usuarios')) {
    const usuario = { id: estado.siguienteUsuario++, nombre: parametros[0], correo: parametros[1] };
    estado.usuarios.set(usuario.correo, usuario);
    return resultado({ insertId: usuario.id, affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT * FROM productos WHERE estado = ?')) {
    return rows([producto]);
  }
  if (consulta.startsWith('SELECT * FROM productos WHERE id = ? AND estado = ?')) {
    return rows(Number(parametros[0]) === producto.id && producto.estado === 'disponible' ? [producto] : []);
  }
  if (consulta.startsWith('SELECT p.id, p.nombre, p.descripcion, p.presentaciones, p.imagen')) {
    return rows([producto]);
  }
  if (consulta.startsWith('SELECT s.id, s.fecha, s.negocio')) {
    return rows([]);
  }
  if (consulta.startsWith('SELECT estado, COUNT(*) AS cantidad FROM pedidos')) {
    const conteo = new Map();
    for (const pedido of estado.pedidos.values()) {
      conteo.set(pedido.estado, (conteo.get(pedido.estado) || 0) + 1);
    }
    return rows([...conteo].map(([pedidoEstado, cantidad]) => ({ estado: pedidoEstado, cantidad })));
  }
  if (consulta.startsWith('SELECT COUNT(*) AS pedidos_registrados')) {
    const porFecha = pedidosEnRango(parametros[0], parametros[1]);
    return rows([{
      pedidos_registrados: porFecha.length,
      pedidos_entregados: porFecha.filter((pedido) => pedido.estado === 'entregado').length,
      pedidos_cancelados: porFecha.filter((pedido) => pedido.estado === 'cancelado').length,
      ...calcularImportes(porFecha)
    }]);
  }
  if (consulta.includes('AS valor_pedidos_hoy') && consulta.includes('FROM pedidos')) {
    const todos = [...estado.pedidos.values()];
    const importesHoy = calcularImportes(todos.filter((pedido) => pedido.fecha.slice(0, 10) === fechaHoy));
    const importesMes = calcularImportes(todos.filter((pedido) => pedido.fecha.slice(0, 7) === fechaHoy.slice(0, 7)));
    if (consulta.includes('AS pedidos_hoy')) {
      const activos = todos.filter((pedido) => pedido.estado !== 'cancelado');
      return rows([{
        valor_pedidos_hoy: importesHoy.valor_pedidos,
        valor_pedidos_semana: importesHoy.valor_pedidos,
        valor_pedidos_mes: importesMes.valor_pedidos,
        pagos_pendientes_hoy: importesHoy.pagos_pendientes,
        pagos_pendientes_semana: importesHoy.pagos_pendientes,
        pagos_pendientes_mes: importesMes.pagos_pendientes,
        pagos_confirmados_hoy: importesHoy.pagos_confirmados,
        pagos_confirmados_semana: importesHoy.pagos_confirmados,
        pagos_confirmados_mes: importesMes.pagos_confirmados,
        pedidos_hoy: activos.filter((pedido) => pedido.fecha.slice(0, 10) === fechaHoy).length,
        pedidos_semana: activos.filter((pedido) => pedido.fecha.slice(0, 10) === fechaHoy).length,
        pedidos_mes: activos.filter((pedido) => pedido.fecha.slice(0, 7) === fechaHoy.slice(0, 7)).length
      }]);
    }
    return rows([{
      valor_pedidos_hoy: importesHoy.valor_pedidos,
      valor_pedidos_mes: importesMes.valor_pedidos,
      pagos_pendientes_hoy: importesHoy.pagos_pendientes,
      pagos_pendientes_mes: importesMes.pagos_pendientes,
      pagos_confirmados_hoy: importesHoy.pagos_confirmados,
      pagos_confirmados_mes: importesMes.pagos_confirmados
    }]);
  }
  if (consulta.startsWith('SELECT COUNT(*) AS cantidad FROM productos')) {
    return rows([{ cantidad: 0 }]);
  }
  if (consulta.startsWith('SELECT valor FROM configuracion_tienda')) {
    return rows([{ valor: '20' }]);
  }
  if (consulta.startsWith('SELECT nombre, tarifa, envio_gratis FROM zonas_envio')) {
    return rows([{ nombre: 'Quito', tarifa: '2.50', envio_gratis: 0 }]);
  }
  if (consulta.startsWith('SELECT nombre FROM formas_pago')) {
    return rows([{ nombre: 'Transferencia' }]);
  }
  if (consulta.startsWith('SELECT id, nombre, precio, precio_oferta, stock, estado FROM productos')) {
    return rows(producto.estado === 'disponible' ? [producto] : []);
  }
  if (consulta.startsWith('SELECT huella_solicitud, pedido_id FROM idempotencia_pedidos')) {
    const registro = estado.idempotencias.get(parametros[0]);
    return rows(registro ? [{ ...registro }] : []);
  }
  if (consulta.startsWith('SELECT UNIX_TIMESTAMP(fecha) AS token_emitido_en FROM pedidos WHERE id = ?')) {
    const pedido = estado.pedidos.get(Number(parametros[0]));
    const emitidoEn = pedido ? Math.floor(Date.parse(`${pedido.fecha.replace(' ', 'T')}Z`) / 1000) : null;
    return rows(pedido ? [{ token_emitido_en: emitidoEn }] : []);
  }
  if (consulta.startsWith('INSERT INTO idempotencia_pedidos')) {
    if (estado.idempotencias.has(parametros[0])) {
      const error = new Error('Duplicate idempotency key');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
    estado.idempotencias.set(parametros[0], {
      huella_solicitud: parametros[1],
      pedido_id: null
    });
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('UPDATE idempotencia_pedidos SET pedido_id = ?')) {
    const registro = estado.idempotencias.get(parametros[1]);
    if (!registro || registro.huella_solicitud !== parametros[2] || registro.pedido_id !== null) {
      return resultado({ affectedRows: 0 });
    }
    registro.pedido_id = Number(parametros[0]);
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO pedidos (')) {
    const id = estado.siguientePedido++;
    estado.pedidos.set(id, {
      id,
      usuario_id: parametros[0],
      fecha: `${fechaHoy} 12:00:00`,
      estado: parametros[2],
      total: Number(parametros[3]),
      costo_envio: Number(parametros[5]),
      zona_entrega: parametros[4],
      forma_pago: parametros[6],
      pago_confirmado: false
    });
    estado.detallesPedido.set(id, []);
    estado.historialPedido.set(id, [{
      estado_nuevo: 'recibido_y_confirmado',
      fecha_hora: `${fechaHoy} 12:00:00`,
      observacion: 'Pedido creado.'
    }]);
    return resultado({ insertId: id, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, subtotal)')) {
    const lineas = estado.detallesPedido.get(Number(parametros[0])) || [];
    lineas.push({
      producto_id: Number(parametros[1]),
      cantidad: Number(parametros[2]),
      subtotal: Number(parametros[3]),
      nombre: producto.nombre
    });
    estado.detallesPedido.set(Number(parametros[0]), lineas);
    return resultado({ insertId: lineas.length, affectedRows: 1 });
  }
  if (consulta.startsWith('UPDATE productos SET stock = ?, estado = ? WHERE id = ?')) {
    producto.stock = Number(parametros[0]);
    producto.estado = parametros[1];
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO movimientos_inventario')) {
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO historial_pedidos') && consulta.includes('administrador_id')) {
    const historial = estado.historialPedido.get(Number(parametros[0])) || [];
    historial.push({
      estado_nuevo: parametros[2],
      fecha_hora: `${fechaHoy} 13:00:00`,
      observacion: parametros[4],
      visible_cliente: Boolean(parametros[5])
    });
    estado.historialPedido.set(Number(parametros[0]), historial);
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO historial_pedidos')) {
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT id, fecha, estado, total, costo_envio, zona_entrega, forma_pago FROM pedidos')) {
    const pedido = estado.pedidos.get(Number(parametros[0]));
    return rows(pedido ? [pedido] : []);
  }
  if (consulta.startsWith('SELECT id, total, costo_envio, zona_entrega, forma_pago, UNIX_TIMESTAMP(fecha) AS token_emitido_en FROM pedidos')) {
    const pedido = estado.pedidos.get(Number(parametros[0]));
    if (!pedido) return rows([]);
    return rows([{
      ...pedido,
      token_emitido_en: Math.floor(Date.parse(`${pedido.fecha.replace(' ', 'T')}Z`) / 1000)
    }]);
  }
  if (consulta.startsWith('SELECT d.producto_id, d.cantidad, d.subtotal')) {
    return rows(estado.detallesPedido.get(Number(parametros[0])) || []);
  }
  if (consulta.startsWith('SELECT h.estado_anterior, h.estado_nuevo, h.fecha_hora, h.observacion')) {
    const historial = estado.historialPedido.get(Number(parametros[0])) || [];
    return rows(consulta.includes('AND h.visible_cliente = 1')
      ? historial.filter((item) => item.visible_cliente)
      : historial);
  }
  if (consulta.startsWith('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE')) {
    const pedido = estado.pedidos.get(Number(parametros[0]));
    return rows(pedido ? [{ estado: pedido.estado }] : []);
  }
  if (consulta.startsWith('UPDATE pedidos SET estado = ?')) {
    const pedido = estado.pedidos.get(Number(parametros[3]));
    if (pedido) pedido.estado = parametros[0];
    return resultado({ affectedRows: pedido ? 1 : 0 });
  }
  if (consulta.startsWith('UPDATE pedidos SET pago_confirmado = 1')) {
    const pedido = estado.pedidos.get(Number(parametros[1]));
    if (!pedido || pedido.pago_confirmado) return resultado({ affectedRows: 0 });
    pedido.pago_confirmado = true;
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT id FROM pedidos WHERE id = ?')) {
    const pedido = estado.pedidos.get(Number(parametros[0]));
    return rows(pedido ? [{ id: pedido.id }] : []);
  }
  if (consulta.startsWith('SELECT p.id, p.nombre, SUM(d.cantidad) AS unidades')) {
    return rows([]);
  }
  if (consulta.startsWith('SELECT id FROM solicitudes_mayoristas WHERE clave_solicitud')) {
    const solicitud = [...estado.solicitudes.values()].find((item) => item.clave_solicitud === parametros[0]);
    return rows(solicitud ? [{ id: solicitud.id }] : []);
  }
  if (consulta.startsWith('SELECT p.id, p.nombre, p.presentaciones')) {
    return rows([producto]);
  }
  if (consulta.startsWith('INSERT INTO solicitudes_mayoristas')) {
    const id = estado.siguienteSolicitud++;
    estado.solicitudes.set(id, {
      id,
      clave_solicitud: parametros[0],
      negocio: parametros[1],
      contacto: parametros[2],
      telefono: parametros[3],
      whatsapp: parametros[4],
      correo: parametros[5],
      estado: 'nueva'
    });
    estado.detallesSolicitud.set(id, []);
    return resultado({ insertId: id, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO detalle_solicitud_mayorista')) {
    estado.detallesSolicitud.get(Number(parametros[0])).push({
      producto_id: Number(parametros[1]),
      nombre_producto: parametros[2],
      presentacion: parametros[3],
      unidad: parametros[4],
      gestiona_produccion: parametros[5],
      cantidad: Number(parametros[6])
    });
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO historial_mayoristas')) {
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT id, estado FROM solicitudes_mayoristas WHERE id = ? FOR UPDATE')) {
    const solicitud = estado.solicitudes.get(Number(parametros[0]));
    return rows(solicitud ? [{ id: solicitud.id, estado: solicitud.estado }] : []);
  }
  if (consulta.startsWith('INSERT INTO cotizaciones_mayoristas')) {
    const id = estado.siguienteCotizacion++;
    estado.cotizaciones.set(id, {
      id,
      solicitud_id: Number(parametros[0]),
      estado: parametros[1],
      subtotal: parametros[2],
      descuento: parametros[3],
      envio: parametros[4],
      total: parametros[5],
      condiciones_pago: parametros[6],
      vigencia: parametros[7],
      correo: estado.solicitudes.get(Number(parametros[0])).correo,
      negocio: estado.solicitudes.get(Number(parametros[0])).negocio,
      whatsapp: estado.solicitudes.get(Number(parametros[0])).whatsapp
    });
    estado.detallesCotizacion.set(id, []);
    return resultado({ insertId: id, affectedRows: 1 });
  }
  if (consulta.startsWith('INSERT INTO detalle_cotizacion_mayorista')) {
    estado.detallesCotizacion.get(Number(parametros[0])).push({
      producto_id: Number(parametros[1]),
      nombre_producto: parametros[2],
      presentacion: parametros[3],
      unidad: parametros[4],
      gestiona_produccion: parametros[5],
      cantidad: Number(parametros[6]),
      precio_unitario: parametros[7],
      subtotal: parametros[8]
    });
    return resultado({ insertId: 1, affectedRows: 1 });
  }
  if (consulta.startsWith('UPDATE solicitudes_mayoristas SET estado = ?')) {
    actualizarSolicitud(parametros[1], parametros[0]);
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith("UPDATE solicitudes_mayoristas SET estado = '")) {
    const estadoNuevo = consulta.match(/SET estado = '([^']+)'/)[1];
    actualizarSolicitud(parametros[0], estadoNuevo);
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT c.id, c.solicitud_id, c.estado, c.vigencia, s.whatsapp, s.negocio FROM cotizaciones_mayoristas')) {
    const quote = estado.cotizaciones.get(Number(parametros[0]));
    return rows(quote ? [{
      id: quote.id,
      solicitud_id: quote.solicitud_id,
      estado: quote.estado,
      vigencia: quote.vigencia,
      whatsapp: quote.whatsapp,
      negocio: quote.negocio
    }] : []);
  }
  if (consulta.startsWith('SELECT COUNT(*) AS total, SUM(precio_unitario = 0) AS sin_precio')) {
    const lineas = estado.detallesCotizacion.get(Number(parametros[0])) || [];
    return rows([{ total: lineas.length, sin_precio: lineas.filter((linea) => Number(linea.precio_unitario) === 0).length }]);
  }
  if (consulta.startsWith('UPDATE cotizaciones_mayoristas SET estado = ? WHERE id = ?')) {
    actualizarCotizacion(parametros[1], { estado: parametros[0] });
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('UPDATE cotizaciones_mayoristas SET estado = \'vencida\'')) {
    return resultado({ affectedRows: 0 });
  }
  if (consulta.startsWith('UPDATE cotizaciones_mayoristas SET estado = \'enviada\'')) {
    actualizarCotizacion(parametros[1], { estado: 'enviada', token_hash: parametros[0] });
    return resultado({ affectedRows: 1 });
  }
  if (consulta.startsWith('SELECT c.id, c.solicitud_id, c.estado, c.subtotal')) {
    const quote = [...estado.cotizaciones.values()].find((item) => item.token_hash === parametros[0]);
    if (!quote) return rows([]);
    return rows([{
      ...quote,
      vigencia: quote.vigencia,
      fecha: `${fechaHoy} 12:00:00`,
      provincia: 'Pichincha',
      ciudad: 'Quito',
      contacto: 'Cliente mayorista'
    }]);
  }
  if (consulta.startsWith('SELECT nombre_producto, presentacion, cantidad, precio_unitario, subtotal')) {
    return rows(estado.detallesCotizacion.get(Number(parametros[0])) || []);
  }
  if (consulta.startsWith('SELECT c.id, c.solicitud_id, c.estado, c.vigencia FROM cotizaciones_mayoristas')) {
    const quote = [...estado.cotizaciones.values()].find((item) => item.token_hash === parametros[0]);
    return rows(quote ? [{
      id: quote.id,
      solicitud_id: quote.solicitud_id,
      estado: quote.estado,
      vigencia: quote.vigencia
    }] : []);
  }
  if (consulta.startsWith('UPDATE solicitudes_mayoristas SET estado = ? WHERE id = ?')) {
    actualizarSolicitud(parametros[1], parametros[0]);
    return resultado({ affectedRows: 1 });
  }

  estado.ultimaConsultaNoSimulada = consulta;
  throw new Error(`Consulta no simulada en prueba aislada: ${consulta}`);
}

function reiniciarEstado() {
  estado.usuarios = new Map();
  estado.pedidos = new Map();
  estado.idempotencias = new Map();
  estado.detallesPedido = new Map();
  estado.historialPedido = new Map();
  estado.solicitudes = new Map();
  estado.detallesSolicitud = new Map();
  estado.cotizaciones = new Map();
  estado.detallesCotizacion = new Map();
  estado.siguienteUsuario = 800;
  estado.siguientePedido = 1000;
  estado.siguienteSolicitud = 2000;
  estado.siguienteCotizacion = 3000;
  estado.consultas = [];
  producto.stock = 50;
  producto.estado = 'disponible';
  estado.pedidos.set(900, {
    id: 900,
    fecha: `${fechaHoy} 09:00:00`,
    estado: 'cancelado',
    total: 3,
    pago_confirmado: true
  });
}

let servidorHttp;
let origen;
const executeOriginal = pool.execute;
const getConnectionOriginal = pool.getConnection;

test.before(async () => {
  estado.hashAdministrador = await bcrypt.hash('Test-password-1234!', 4);
  pool.execute = ejecutarConsulta;
  pool.getConnection = async () => ({
    execute: ejecutarConsulta,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {}
  });
  servidorHttp = servidor.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidorHttp.once('listening', resolve);
    servidorHttp.once('error', reject);
  });
  origen = `http://127.0.0.1:${servidorHttp.address().port}`;
});

test.after(async () => {
  pool.execute = executeOriginal;
  pool.getConnection = getConnectionOriginal;
  if (servidorHttp) await new Promise((resolve) => servidorHttp.close(resolve));
});

test('HTTP: login, catálogo, autorización de administración y CORS', async () => {
  reiniciarEstado();
  const productos = await fetch(`${origen}/api/productos`);
  assert.equal(productos.status, 200);
  assert.equal((await productos.json())[0].id, producto.id);

  const ficha = await fetch(`${origen}/api/productos/${producto.id}`);
  assert.equal(ficha.status, 200);
  assert.equal((await ficha.json()).nombre, producto.nombre);

  const mayoristas = await fetch(`${origen}/api/mayoristas/productos`);
  assert.equal(mayoristas.status, 200);
  assert.equal((await mayoristas.json())[0].id, producto.id);

  const bloqueado = await fetch(`${origen}/api/administracion/dashboard`);
  assert.equal(bloqueado.status, 403);
  const inicio = await fetch(`${origen}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuarioAdministrador.correo, contrasena: 'Test-password-1234!' })
  });
  assert.equal(inicio.status, 200);
  assert.equal(inicio.headers.get('cache-control'), 'no-store');
  const { token } = await inicio.json();
  assert.ok(token);

  const dashboard = await fetch(`${origen}/api/administracion/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(dashboard.status, 200);
  const tokenAlterado = `${token.slice(0, -1)}x`;
  const jwtAlterado = await fetch(`${origen}/api/administracion/dashboard`, {
    headers: { Authorization: `Bearer ${tokenAlterado}` }
  });
  assert.equal(jwtAlterado.status, 403);
  const origenPermitido = await fetch(`${origen}/api/productos`, { headers: { Origin: 'https://tienda.test' } });
  assert.equal(origenPermitido.headers.get('access-control-allow-origin'), 'https://tienda.test');
  const preflightPedido = await fetch(`${origen}/api/pedidos`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://tienda.test',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,idempotency-key'
    }
  });
  assert.equal(preflightPedido.status, 204);
  assert.match(preflightPedido.headers.get('access-control-allow-headers'), /idempotency-key/i);

  const mayoristasAdminNoAutorizado = await fetch(`${origen}/api/mayoristas/admin/solicitudes`);
  assert.equal(mayoristasAdminNoAutorizado.status, 403);
  const mayoristasAdmin = await fetch(`${origen}/api/mayoristas/admin/solicitudes`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(mayoristasAdmin.status, 200);

  const cors = await fetch(`${origen}/api/productos`, { headers: { Origin: 'https://origen-no-permitido.example' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), null);
});

test('HTTP: crea pedidos, aísla seguimiento por token y refleja confirmación de pago', async () => {
  reiniciarEstado();
  const inicio = await fetch(`${origen}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuarioAdministrador.correo, contrasena: 'Test-password-1234!' })
  });
  const { token: tokenAdministrador } = await inicio.json();

  async function crearPedido(correo, cantidad, claveIdempotencia = randomUUID()) {
    return fetch(`${origen}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': claveIdempotencia },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente prueba', telefono: '0991234567', correo, cedula: '' },
        direccion_entrega: 'Dirección de prueba',
        provincia: '',
        ciudad: '',
        sector: '',
        calle_principal: '',
        numero_domicilio: '',
        calle_secundaria: '',
        referencia: '',
        latitud: null,
        longitud: null,
        zona_entrega: 'Quito',
        forma_pago: 'Transferencia',
        consentimiento: true,
        productos: [{ id: producto.id, cantidad }]
      })
    });
  }

  const clavePedidoA = randomUUID();
  const respuestaA = await crearPedido('cliente-a@example.test', 2, clavePedidoA);
  assert.equal(respuestaA.status, 201);
  const pedidoA = await respuestaA.json();
  assert.equal(pedidoA.subtotal, 10);
  assert.equal(pedidoA.costo_envio, 2.5);
  assert.equal(pedidoA.total, 12.5);
  assert.ok(pedidoA.token_seguimiento);

  const respuestaDuplicadaA = await crearPedido('cliente-a@example.test', 2, clavePedidoA);
  assert.equal(respuestaDuplicadaA.status, 200);
  const pedidoDuplicadoA = await respuestaDuplicadaA.json();
  assert.equal(pedidoDuplicadoA.id, pedidoA.id);
  assert.equal(producto.stock, 48);
  const claveReutilizada = await crearPedido('cliente-a@example.test', 3, clavePedidoA);
  assert.equal(claveReutilizada.status, 409);

  const respuestaB = await crearPedido('cliente-b@example.test', 1);
  assert.equal(respuestaB.status, 201);
  const pedidoB = await respuestaB.json();
  assert.notEqual(pedidoA.id, pedidoB.id);
  assert.equal(producto.stock, 47);

  const transicionInvalida = await fetch(`${origen}/api/pedidos/${pedidoA.id}/estado`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenAdministrador}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'entregado' })
  });
  assert.equal(transicionInvalida.status, 409);

  const transicionValida = await fetch(`${origen}/api/pedidos/${pedidoA.id}/estado`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenAdministrador}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      estado: 'en_preparacion',
      observacion: 'Preparando el pedido.',
      visible_cliente: true
    })
  });
  assert.equal(transicionValida.status, 200);

  async function consultarPedido(token) {
    return fetch(`${origen}/api/pedidos/cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_seguimiento: token })
    });
  }

  const seguimientoA = await consultarPedido(pedidoA.token_seguimiento);
  assert.equal(seguimientoA.status, 200);
  assert.equal(seguimientoA.headers.get('cache-control'), 'no-store');
  const datosA = await seguimientoA.json();
  assert.equal(datosA.pedido.id, pedidoA.id);
  assert.equal(datosA.pedido.estado, 'en_preparacion');
  assert.equal(datosA.pedido.productos[0].cantidad, 2);
  assert.equal(datosA.pedido.historial.at(-1).observacion, 'Preparando el pedido.');
  assert.equal('correo' in datosA.pedido, false);
  assert.equal('direccion_entrega' in datosA.pedido, false);
  assert.equal('cedula' in datosA.pedido, false);

  const seguimientoB = await consultarPedido(pedidoB.token_seguimiento);
  assert.equal(seguimientoB.status, 200);
  assert.equal((await seguimientoB.json()).pedido.id, pedidoB.id);

  const tokenAlterado = `${pedidoA.token_seguimiento.slice(0, -1)}x`;
  const accesoAlterado = await consultarPedido(tokenAlterado);
  assert.equal(accesoAlterado.status, 404);
  const rutaAnterior = await fetch(`${origen}/api/pedidos/cliente?numero_pedido=${pedidoA.id}`);
  assert.equal(rutaAnterior.status, 404);

  const confirmacion = await fetch(`${origen}/api/pedidos/${pedidoA.id}/pago`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenAdministrador}` }
  });
  assert.equal(confirmacion.status, 200);
  const pagoDuplicado = await fetch(`${origen}/api/pedidos/${pedidoA.id}/pago`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenAdministrador}` }
  });
  assert.equal(pagoDuplicado.status, 409);

  const dashboard = await fetch(`${origen}/api/administracion/dashboard`, {
    headers: { Authorization: `Bearer ${tokenAdministrador}` }
  });
  assert.equal(dashboard.status, 200);
  const resumen = await dashboard.json();
  assert.equal(resumen.valor_pedidos_hoy, 20);
  assert.equal(resumen.pagos_pendientes_hoy, 7.5);
  assert.equal(resumen.pagos_confirmados_hoy, 15.5);

  const reporte = await fetch(`${origen}/api/administracion/reportes?desde=${fechaHoy}&hasta=${fechaHoy}`, {
    headers: { Authorization: `Bearer ${tokenAdministrador}` }
  });
  assert.equal(reporte.status, 200);
  const datosReporte = await reporte.json();
  assert.equal(Number(datosReporte.resumen.valor_pedidos), 20);
  assert.equal(Number(datosReporte.resumen.pagos_pendientes), 7.5);
  assert.equal(Number(datosReporte.resumen.pagos_confirmados), 15.5);
  assert.equal(Number(datosReporte.resumen.pedidos_cancelados), 1);
  assert.equal(Number(datosReporte.periodos.valor_pedidos_hoy), 20);
  assert.equal(Number(datosReporte.periodos.pagos_pendientes_hoy), 7.5);
  assert.equal(Number(datosReporte.periodos.pagos_confirmados_hoy), 15.5);

  const exportacion = await fetch(`${origen}/api/administracion/reportes.csv?desde=${fechaHoy}&hasta=${fechaHoy}`, {
    headers: { Authorization: `Bearer ${tokenAdministrador}` }
  });
  assert.equal(exportacion.status, 200);
  const csv = await exportacion.text();
  assert.match(csv, /Valor en pedidos \(excluye cancelados\)/);
  assert.match(csv, /Pagos pendientes \(excluye cancelados\)/);
  assert.match(csv, /Pagos marcados como confirmados/);

  const consultaDashboard = estado.consultas.find((consulta) => consulta.includes('AS valor_pedidos_hoy') &&
    consulta.includes('AS valor_pedidos_mes'));
  const consultaReporte = estado.consultas.find((consulta) => consulta.startsWith('SELECT COUNT(*) AS pedidos_registrados'));
  assert.match(consultaDashboard, /estado <> 'cancelado' AND pago_confirmado = 0/);
  assert.match(consultaReporte, /estado <> 'cancelado' AND pago_confirmado = 0/);
  assert.match(consultaReporte, /pago_confirmado = 1/);
});

test('HTTP: solicitud mayorista, cotización privada y respuesta del cliente', async () => {
  reiniciarEstado();
  const inicio = await fetch(`${origen}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuarioAdministrador.correo, contrasena: 'Test-password-1234!' })
  });
  const { token } = await inicio.json();
  const solicitud = await fetch(`${origen}/api/mayoristas/solicitudes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      negocio: 'Tienda de prueba',
      contacto: 'Contacto de prueba',
      telefono: '0991234567',
      whatsapp: '0991234567',
      correo: 'mayorista@example.test',
      provincia: 'Pichincha',
      ciudad: 'Quito',
      tipo_negocio: 'Tienda de mascotas',
      clave_solicitud: randomUUID(),
      consentimiento: true,
      productos: [{ producto_id: producto.id, cantidad: 5 }]
    })
  });
  assert.equal(solicitud.status, 201);
  const datosSolicitud = await solicitud.json();

  const cotizacion = await fetch(`${origen}/api/mayoristas/admin/solicitudes/${datosSolicitud.id}/cotizaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productos: [{ producto_id: producto.id, cantidad: 5, precio_unitario: '1.25' }],
      descuento: '0',
      envio: '2.00'
    })
  });
  assert.equal(cotizacion.status, 201);
  const datosCotizacion = await cotizacion.json();
  assert.equal(datosCotizacion.subtotal, '6.25');
  assert.equal(datosCotizacion.total, '8.25');

  const envio = await fetch(`${origen}/api/mayoristas/admin/cotizaciones/${datosCotizacion.id}/enviar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(envio.status, 200, `${await envio.clone().text()} ${estado.ultimaConsultaNoSimulada || ''}`);
  const datosEnvio = await envio.json();
  assert.match(datosEnvio.token, /^[a-f0-9]{64}$/);

  const consultaCotizacion = await fetch(`${origen}/api/mayoristas/cotizacion/${datosEnvio.token}`);
  assert.equal(consultaCotizacion.status, 200);
  assert.equal(consultaCotizacion.headers.get('cache-control'), 'no-store');
  const datosPublicos = await consultaCotizacion.json();
  assert.equal(datosPublicos.total, '8.25');
  assert.equal(datosPublicos.productos[0].cantidad, 5);
  assert.equal('correo' in datosPublicos, false);

  const respuesta = await fetch(`${origen}/api/mayoristas/cotizacion/${datosEnvio.token}/respuesta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'aceptada' })
  });
  assert.equal(respuesta.status, 200);
  assert.equal(estado.cotizaciones.get(datosCotizacion.id).estado, 'aceptada');
  assert.equal(estado.solicitudes.get(datosSolicitud.id).estado, 'aceptada');

  const respuestaRepetida = await fetch(`${origen}/api/mayoristas/cotizacion/${datosEnvio.token}/respuesta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'aceptada' })
  });
  assert.equal(respuestaRepetida.status, 409);
});

test('HTTP: el límite de inicio de sesión permite ocho intentos y bloquea el siguiente', async () => {
  for (let intento = 0; intento < 5; intento += 1) {
    const respuesta = await fetch(`${origen}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: usuarioAdministrador.correo, contrasena: 'incorrecta' })
    });
    assert.equal(respuesta.status, 401);
  }
  const bloqueado = await fetch(`${origen}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuarioAdministrador.correo, contrasena: 'incorrecta' })
  });
  assert.equal(bloqueado.status, 429);
  assert.ok(Number(bloqueado.headers.get('retry-after')) > 0);
});
