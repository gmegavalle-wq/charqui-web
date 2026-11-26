const estados = [
  ['recibido_y_confirmado', 'Recibido y confirmado'], ['en_preparacion', 'En preparación'],
  ['listo_para_despacho', 'Listo para despacho'], ['en_reparto_local', 'En reparto local'],
  ['entregado', 'Entregado'], ['cancelado', 'Cancelado']
];
const nombresEstado = Object.fromEntries(estados);
let fotografiaSeleccionada = null;
let urlFotografiaTemporal = '';
let urlReporteTemporal = '';

function escaparHtml(texto) {
  return String(texto == null ? '' : texto).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function obtenerToken() { return sessionStorage.getItem('charqui_token') || ''; }
async function leerJson(respuesta) {
  const texto = await respuesta.text();
  try { return texto ? JSON.parse(texto) : {}; }
  catch (error) { throw new Error(`Respuesta no válida (HTTP ${respuesta.status}) en ${new URL(respuesta.url).pathname}.`); }
}
async function pedir(url, opciones = {}) {
  const headers = { ...(opciones.headers || {}), Authorization: `Bearer ${obtenerToken()}` };
  if (opciones.body && !(opciones.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const respuesta = await fetch(url, { ...opciones, headers });
  const datos = await leerJson(respuesta);
  if (!respuesta.ok) { const error = new Error(datos.error || 'No se pudo completar la acción.'); error.status = respuesta.status; throw error; }
  return datos;
}
function mostrarMensaje(texto, esError = false) {
  const aviso = document.getElementById('mensaje-panel');
  aviso.textContent = texto;
  aviso.classList.toggle('error', esError);
  aviso.classList.toggle('mensaje-exito', Boolean(texto) && !esError);
}

async function cargarDashboard() {
  const [resultadoDashboard, resultadoMayoristas] = await Promise.allSettled([
    pedir('/api/administracion/dashboard'),
    pedir('/api/mayoristas/admin/solicitudes')
  ]);
  if (resultadoDashboard.status === 'rejected') throw resultadoDashboard.reason;
  const datos = resultadoDashboard.value;
  const solicitudesMayoristas = resultadoMayoristas.status === 'fulfilled' ? resultadoMayoristas.value : [];
  const abiertasMayoristas = solicitudesMayoristas.filter((item) =>
    ['nueva', 'en_revision', 'cotizacion_preparada', 'cotizacion_enviada'].includes(item.estado)
  ).length;
  const compromisosMayoristas = solicitudesMayoristas.filter((item) =>
    ['aceptada', 'convertida_en_pedido'].includes(item.estado)
  ).length;
  const pedidosAtencion = [
    ['recibido_y_confirmado', 'Pedidos pendientes'],
    ['en_preparacion', 'En preparación'],
    ['listo_para_despacho', 'Listos para entrega']
  ];
  const tarjetasPedidos = pedidosAtencion.map(([estado, nombre]) => `
    <button class="indicador-admin" type="button" data-estado="${estado}"><span>${nombre}</span><strong>${datos.pedidos[estado] || 0}</strong></button>`).join('');
  const entregasPendientes = Number(datos.pedidos.listo_para_despacho || 0) + Number(datos.pedidos.en_reparto_local || 0);
  const tarjetasOperacion = `${tarjetasPedidos}
    <button class="indicador-admin indicador-entregas" data-modulo-destino="entregas" type="button"><span>Entregas pendientes</span><strong>${entregasPendientes}</strong></button>`;
  const tarjetasComercial = resultadoMayoristas.status === 'fulfilled'
    ? `<button class="indicador-admin" data-modulo-destino="mayoristas" type="button"><span>Solicitudes y cotizaciones abiertas</span><strong>${abiertasMayoristas}</strong></button>
      <button class="indicador-admin" data-modulo-destino="mayoristas" type="button"><span>Compromisos mayoristas</span><strong>${compromisosMayoristas}</strong></button>`
    : '<article class="indicador-admin"><span>Datos mayoristas</span><strong>No disponibles</strong></article>';
  const tarjetasInventario = `<button class="indicador-admin indicador-alerta" data-modulo-destino="inventario" type="button"><span>Stock bajo · ${Number(datos.limite_stock_bajo ?? 5)} o menos</span><strong>${datos.productos_stock_bajo}</strong></button>`;
  const tarjetasVentas = `<article class="indicador-admin indicador-venta"><span>Valor en pedidos · hoy</span><strong>$${Number(datos.valor_pedidos_hoy).toFixed(2)}</strong></article>
    <article class="indicador-admin indicador-venta"><span>Pagos pendientes · hoy</span><strong>$${Number(datos.pagos_pendientes_hoy).toFixed(2)}</strong></article>
    <article class="indicador-admin indicador-venta"><span>Pagos confirmados · hoy</span><strong>$${Number(datos.pagos_confirmados_hoy).toFixed(2)}</strong></article>
    <article class="indicador-admin indicador-venta"><span>Valor en pedidos · mes</span><strong>$${Number(datos.valor_pedidos_mes).toFixed(2)}</strong></article>
    <article class="indicador-admin indicador-venta"><span>Pagos pendientes · mes</span><strong>$${Number(datos.pagos_pendientes_mes).toFixed(2)}</strong></article>
    <article class="indicador-admin indicador-venta"><span>Pagos confirmados · mes</span><strong>$${Number(datos.pagos_confirmados_mes).toFixed(2)}</strong></article>`;
  const notaFinanciera = '<p class="texto-secundario">Los pagos confirmados reflejan el estado registrado en cada pedido; no se registran devoluciones en este sistema.</p>';
  const tarjetasHistoricas = `<button class="indicador-admin indicador-cancelado" data-estado="cancelado" type="button"><span>Pedidos cancelados</span><strong>${datos.pedidos.cancelado || 0}</strong></button>
    ${datos.pedidos_legacy ? `<article class="indicador-admin"><span>Estado anterior · En tu Puerta</span><strong>${datos.pedidos_legacy}</strong></article>` : ''}`;
  const contenedor = document.getElementById('indicadores-admin');
  contenedor.innerHTML = `<div class="grupo-indicadores-admin"><h3>Operaciones</h3><div>${tarjetasOperacion}</div></div>
    <div class="grupo-indicadores-admin"><h3>Comercial</h3><div>${tarjetasComercial}</div></div>
    <div class="grupo-indicadores-admin"><h3>Inventario</h3><div>${tarjetasInventario}</div></div>
    <div class="grupo-indicadores-admin"><h3>Resumen financiero</h3><div>${tarjetasVentas}</div>${notaFinanciera}</div>
    <div class="grupo-indicadores-admin"><h3>Histórico</h3><div>${tarjetasHistoricas}</div></div>`;
  contenedor.querySelectorAll('[data-estado]').forEach((boton) => boton.addEventListener('click', () => {
    document.getElementById('filtro-estado-pedido').value = boton.dataset.estado;
    mostrarModulo('pedidos');
  }));
  contenedor.querySelectorAll('[data-modulo-destino]').forEach((boton) => boton.addEventListener('click', () => mostrarModulo(boton.dataset.moduloDestino)));
}

function filtrosPedidos() {
  const params = new URLSearchParams();
  const datos = {
    buscar: document.getElementById('buscar-pedido-admin').value.trim(),
    estado: document.getElementById('filtro-estado-pedido').value,
    desde: document.getElementById('pedidos-desde').value,
    hasta: document.getElementById('pedidos-hasta').value,
    orden: document.getElementById('orden-pedidos').value
  };
  Object.entries(datos).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
  return params;
}
async function cargarPedidos() {
  const pedidos = await pedir(`/api/administracion/pedidos?${filtrosPedidos()}`);
  document.getElementById('tabla-pedidos').innerHTML = pedidos.length ? pedidos.map((pedido) => `
    <tr><td>#${pedido.id}${pedido.cotizacion_mayorista_id ? `<br><small>Mayorista · Cot. #${pedido.cotizacion_mayorista_id}</small>` : ''}</td><td>${escaparHtml(pedido.nombre)}<br>${escaparHtml(pedido.telefono)}</td>
    <td>${escaparHtml(pedido.fecha)}</td><td>$${Number(pedido.total).toFixed(2)}</td>
    <td>${Number(pedido.pago_confirmado) ? 'Confirmado' : 'Pendiente'}</td>
    <td><span class="estado-etiqueta">${escaparHtml(nombresEstado[pedido.estado] || 'En tu Puerta (anterior)')}</span></td>
    <td><button class="abrir-pedido" data-id="${pedido.id}" type="button">Ver ficha</button></td></tr>`).join('')
    : '<tr><td colspan="7">No hay pedidos para estos filtros.</td></tr>';
  document.querySelectorAll('.abrir-pedido').forEach((boton) => boton.addEventListener('click', () => abrirPedido(boton.dataset.id)));
}
function direccionCompleta(pedido) {
  const partes = [pedido.calle_principal, pedido.numero_domicilio, pedido.calle_secundaria,
    pedido.sector, pedido.ciudad, pedido.provincia, pedido.referencia, pedido.direccion_entrega]
    .filter((parte) => parte && String(parte).trim());
  return partes.length ? [...new Set(partes)].join(', ') : 'No registrada';
}
function siguientesEstados(estado) {
  const siguiente = { recibido_y_confirmado: ['en_preparacion'], en_preparacion: ['listo_para_despacho'],
    listo_para_despacho: ['en_reparto_local'], en_reparto_local: ['entregado'] };
  let lista = siguiente[estado] || [];
  if (!['entregado', 'cancelado'].includes(estado)) lista = [...lista, 'cancelado'];
  return lista;
}
async function abrirPedido(id) {
  try {
    const pedido = await pedir(`/api/administracion/pedidos/${id}`);
    const productos = pedido.productos.map((item) => `<tr><td>${escaparHtml(item.nombre)}</td><td>${item.cantidad}</td><td>$${Number(item.precio_unitario).toFixed(item.precio_mayorista ? 3 : 2)}</td><td>$${Number(item.subtotal).toFixed(2)}</td></tr>`).join('');
    const historial = pedido.historial.length ? pedido.historial.map((item) => `
      <li><strong>${escaparHtml(nombresEstado[item.estado_nuevo] || item.estado_nuevo)}</strong> · ${escaparHtml(item.fecha_hora)} · ${escaparHtml(item.administrador || 'Tienda')}
      ${item.observacion ? `<p>${escaparHtml(item.observacion)}${item.visible_cliente ? ' · Visible al cliente' : ''}</p>` : ''}</li>`).join('') : '<li>Sin historial anterior registrado.</li>';
    const pago = Number(pedido.pago_confirmado) ? `Confirmado · ${escaparHtml(pedido.pago_confirmado_en || '')}` : '<button id="confirmar-pago-detalle" type="button">Confirmar pago</button>';
    const gps = pedido.latitud != null && pedido.longitud != null ? `${pedido.latitud}, ${pedido.longitud}` : 'No registradas';
    const condicionesMayoristas = pedido.cotizacion_mayorista_id ? `<section class="detalle-cotizacion-pedido"><h3>Condiciones mayoristas</h3><p>Cotización #${pedido.cotizacion_mayorista_id} · Entrega prevista: ${escaparHtml(pedido.fecha_entrega_mayorista)}</p><p>Descuento: $${Number(pedido.descuento_mayorista).toFixed(2)} · Envío: $${Number(pedido.envio_mayorista).toFixed(2)}</p><p>${escaparHtml(pedido.condiciones_mayoristas || '')}</p><button id="abrir-solicitud-del-pedido" data-id="${pedido.solicitud_mayorista_id}" type="button">Ver historial comercial</button></section>` : '';
    document.getElementById('contenido-detalle-pedido').innerHTML = `
      <div class="detalle-pedido-grid">
        <section><h3>Cliente</h3><p>${escaparHtml(pedido.nombre)}</p><p>${escaparHtml(pedido.correo)}</p><p>${escaparHtml(pedido.telefono)}</p><p>Cédula: ${escaparHtml(pedido.cedula || 'No registrada')}</p></section>
        <section><h3>Entrega</h3><p>${escaparHtml(direccionCompleta(pedido))}</p><p>Zona: ${escaparHtml(pedido.zona_entrega || 'No registrada')}</p><p>Repartidor: ${escaparHtml(pedido.repartidor_nombre || 'No registrado')}</p><p>GPS: ${escaparHtml(gps)}</p></section>
        <section><h3>Pago</h3><p>Forma: ${escaparHtml(pedido.forma_pago || 'No registrada')}</p><p>Envío: ${pedido.costo_envio == null ? 'No registrado' : `$${Number(pedido.costo_envio).toFixed(2)}`}</p><p>${pago}</p></section>
        <section><h3>Pedido #${pedido.id}</h3><p>Fecha: ${escaparHtml(pedido.fecha)}</p><p>Estado: ${escaparHtml(nombresEstado[pedido.estado] || 'En tu Puerta (anterior)')}</p><p>Total: $${Number(pedido.total).toFixed(2)}</p></section>
      </div>${condicionesMayoristas}<div class="tabla-contenedor"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>${productos}</tbody></table></div>
      <h3>Historial de estados</h3><ol class="historial-admin">${historial}</ol>`;
    document.getElementById('modal-pedido-id').value = pedido.id;
    const destinos = siguientesEstados(pedido.estado);
    document.getElementById('nuevo-estado-pedido').innerHTML = destinos.length
      ? destinos.map((estado) => `<option value="${estado}">${escaparHtml(nombresEstado[estado])}</option>`).join('')
      : '<option value="">Sin cambios permitidos</option>';
    document.getElementById('nuevo-estado-pedido').disabled = !destinos.length;
    document.querySelector('#formulario-estado-pedido button[type="submit"]').disabled = !destinos.length;
    document.getElementById('observacion-estado-pedido').value = '';
    document.getElementById('observacion-visible').checked = false;
    const historialComercial = document.getElementById('abrir-solicitud-del-pedido');
    if (historialComercial) historialComercial.addEventListener('click', () => {
      const solicitudId = historialComercial.dataset.id;
      document.getElementById('modal-pedido').close();
      mostrarModulo('mayoristas');
      abrirSolicitudMayorista(solicitudId);
    });
    const confirmar = document.getElementById('confirmar-pago-detalle');
    if (confirmar) confirmar.addEventListener('click', async () => {
      try {
        await pedir(`/api/pedidos/${pedido.id}/pago`, { method: 'PUT' });
        mostrarMensaje('Pago confirmado.'); await cargarPedidos(); await abrirPedido(pedido.id);
      } catch (error) { mostrarMensaje(error.message, true); }
    });
    document.getElementById('modal-pedido').showModal();
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function cargarEntregas() {
  const pedidos = await pedir('/api/administracion/entregas');
  document.getElementById('tabla-entregas').innerHTML = pedidos.length ? pedidos.map((pedido) => {
    const direccion = direccionCompleta(pedido);
    const consulta = pedido.latitud != null && pedido.longitud != null ? `${pedido.latitud},${pedido.longitud}` : direccion;
    const mapa = consulta && consulta !== 'No registrada'
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}` : '';
    let telefono = String(pedido.telefono || '').replace(/\D/g, '');
    if (telefono.startsWith('0')) telefono = `593${telefono.slice(1)}`;
    else if (!telefono.startsWith('593') && telefono.length === 9) telefono = `593${telefono}`;
    const whatsapp = telefono ? `https://wa.me/${telefono}` : '';
    return `<tr><td>#${pedido.id}<br>${escaparHtml(nombresEstado[pedido.estado])}</td>
      <td>${escaparHtml(pedido.nombre)}<br>${escaparHtml(pedido.telefono)}</td><td>${escaparHtml(direccion)}</td>
      <td>${escaparHtml(pedido.salida_reparto || 'No registrada')}</td>
      <td>${mapa ? `<a href="${mapa}" target="_blank" rel="noopener">Abrir mapa</a>` : 'Sin dirección'}</td>
      <td>${whatsapp ? `<a href="${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : 'Sin teléfono'}</td>
      <td><button class="editar-entrega" data-id="${pedido.id}" data-nombre="${escaparHtml(pedido.repartidor_nombre || '')}" data-salida="${escaparHtml(pedido.salida_reparto || '')}" data-observacion="${escaparHtml(pedido.observaciones_entrega || '')}" type="button">Registrar</button></td></tr>`;
  }).join('') : '<tr><td colspan="7">No hay pedidos listos para entrega.</td></tr>';
  document.querySelectorAll('.editar-entrega').forEach((boton) => boton.addEventListener('click', () => {
    document.getElementById('id-pedido-entrega').value = boton.dataset.id;
    document.getElementById('pedido-entrega-seleccionado').textContent = `Pedido #${boton.dataset.id}`;
    document.getElementById('repartidor-nombre').value = boton.dataset.nombre;
    document.getElementById('salida-reparto').value = boton.dataset.salida.replace(' ', 'T').slice(0, 16);
    document.getElementById('observaciones-entrega').value = boton.dataset.observacion;
  }));
}

async function cargarInventario() {
  const [productos, catalogo] = await Promise.all([pedir('/api/administracion/inventario'), pedir('/api/productos?todos=1')]);
  document.getElementById('tabla-inventario').innerHTML = productos.map((producto) => `
    <tr class="${producto.stock_bajo ? 'fila-stock-bajo' : ''}"><td>${escaparHtml(producto.nombre)}</td>
    <td>${producto.stock}${producto.stock_bajo ? ' · Bajo' : ''}</td><td>${escaparHtml(producto.estado)}</td>
    <td>${escaparHtml(producto.ultimo_movimiento || 'Sin movimientos registrados')}</td>
    <td><button class="ver-movimientos" data-id="${producto.id}" type="button">Ver historial</button></td></tr>`).join('')
    || '<tr><td colspan="5">No hay productos.</td></tr>';
  document.getElementById('producto-movimiento').innerHTML = catalogo.map((producto) =>
    `<option value="${producto.id}">${escaparHtml(producto.nombre)} · ${producto.stock} unidades</option>`).join('');
  document.querySelectorAll('.ver-movimientos').forEach((boton) => boton.addEventListener('click', () => cargarMovimientos(boton.dataset.id)));
}
async function cargarMovimientos(id) {
  const movimientos = await pedir(`/api/administracion/inventario/${id}/movimientos`);
  document.getElementById('tabla-movimientos').innerHTML = movimientos.length ? movimientos.map((item) => `
    <tr><td>${escaparHtml(item.fecha_hora)}</td><td>${escaparHtml(item.tipo)}</td><td>${item.cantidad}</td>
    <td>${item.stock_anterior}</td><td>${item.stock_nuevo}</td><td>${escaparHtml(item.motivo || 'No registrado')}</td>
    <td>${escaparHtml(item.administrador || 'Tienda')}</td></tr>`).join('')
    : '<tr><td colspan="7">Sin movimientos registrados.</td></tr>';
}

async function cargarClientes() {
  const buscar = document.getElementById('filtro-cliente').value.trim();
  const clientes = await pedir(`/api/administracion/clientes?buscar=${encodeURIComponent(buscar)}`);
  document.getElementById('tabla-clientes').innerHTML = clientes.map((cliente) => `
    <tr><td>${escaparHtml(cliente.nombre)}</td><td>${escaparHtml(cliente.correo)}</td><td>${escaparHtml(cliente.telefono)}</td>
    <td>${escaparHtml(cliente.cedula || 'No registrada')}</td><td>${cliente.cantidad_pedidos}</td>
    <td>$${Number(cliente.total_compras).toFixed(2)}</td><td><button class="ver-cliente" data-id="${cliente.id}" type="button">Ver historial</button></td></tr>`).join('')
    || '<tr><td colspan="7">No hay clientes para esta búsqueda.</td></tr>';
  document.querySelectorAll('.ver-cliente').forEach((boton) => boton.addEventListener('click', () => cargarDetalleCliente(boton.dataset.id)));
}
async function cargarDetalleCliente(id) {
  const datos = await pedir(`/api/administracion/clientes/${id}`);
  const lista = datos.pedidos.length ? datos.pedidos.map((pedido) => `
    <article><h4>Pedido #${pedido.id} · ${escaparHtml(nombresEstado[pedido.estado] || pedido.estado)}</h4>
    <p>${escaparHtml(pedido.fecha)} · $${Number(pedido.total).toFixed(2)}</p>
    <button class="abrir-pedido" data-id="${pedido.id}" type="button">Abrir pedido</button></article>`).join('')
    : '<p>Este cliente todavía no tiene pedidos.</p>';
  const detalle = document.getElementById('detalle-cliente');
  detalle.hidden = false;
  detalle.innerHTML = `<h3>Historial de ${escaparHtml(datos.cliente.nombre)}</h3>${lista}`;
  detalle.querySelectorAll('.abrir-pedido').forEach((boton) => boton.addEventListener('click', () => abrirPedido(boton.dataset.id)));
}

async function cargarReporte() {
  const desde = document.getElementById('reporte-desde').value;
  const hasta = document.getElementById('reporte-hasta').value;
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  const reporte = await pedir(`/api/administracion/reportes?${params}`);
  const resumen = reporte.resumen;
  document.getElementById('resumen-reporte').innerHTML = `
    <article>Periodo<strong>${escaparHtml(reporte.desde)} – ${escaparHtml(reporte.hasta)}</strong></article>
    <article>Valor en pedidos · hoy<strong>$${Number(reporte.periodos.valor_pedidos_hoy).toFixed(2)} · ${Number(reporte.periodos.pedidos_hoy || 0)} pedidos</strong></article>
    <article>Valor en pedidos · semana<strong>$${Number(reporte.periodos.valor_pedidos_semana).toFixed(2)} · ${Number(reporte.periodos.pedidos_semana || 0)} pedidos</strong></article>
    <article>Valor en pedidos · mes<strong>$${Number(reporte.periodos.valor_pedidos_mes).toFixed(2)} · ${Number(reporte.periodos.pedidos_mes || 0)} pedidos</strong></article>
    <article>Pagos pendientes · periodo<strong>$${Number(resumen.pagos_pendientes).toFixed(2)}</strong></article>
    <article>Pagos confirmados · periodo<strong>$${Number(resumen.pagos_confirmados).toFixed(2)}</strong></article>
    <article>Valor en pedidos · periodo<strong>$${Number(resumen.valor_pedidos).toFixed(2)}</strong></article>
    <article>Pedidos<strong>${Number(resumen.pedidos_registrados)}</strong></article>
    <article>Entregados<strong>${Number(resumen.pedidos_entregados || 0)}</strong></article>
    <article>Cancelados<strong>${Number(resumen.pedidos_cancelados || 0)}</strong></article>`;
  document.getElementById('tabla-reporte-productos').innerHTML = reporte.productos.map((producto) => `
    <tr><td>${escaparHtml(producto.nombre)}</td><td>${producto.unidades}</td><td>$${Number(producto.valor_pedidos).toFixed(2)}</td></tr>`).join('')
    || '<tr><td colspan="3">No hay ventas en este periodo.</td></tr>';
  document.getElementById('exportar-reporte').dataset.desde = desde;
  document.getElementById('exportar-reporte').dataset.hasta = hasta;
}
async function exportarReporte(evento) {
  evento.preventDefault();
  const params = new URLSearchParams();
  if (evento.currentTarget.dataset.desde) params.set('desde', evento.currentTarget.dataset.desde);
  if (evento.currentTarget.dataset.hasta) params.set('hasta', evento.currentTarget.dataset.hasta);
  try {
    const respuesta = await fetch(`/api/administracion/reportes.csv?${params}`, { headers: { Authorization: `Bearer ${obtenerToken()}` } });
    if (!respuesta.ok) throw new Error('No se pudo descargar el reporte.');
    if (urlReporteTemporal) URL.revokeObjectURL(urlReporteTemporal);
    urlReporteTemporal = URL.createObjectURL(await respuesta.blob());
    const enlace = document.createElement('a'); enlace.href = urlReporteTemporal; enlace.download = 'reporte-charqui.csv'; enlace.click();
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function cargarConfiguracionEnvios() {
  const datos = await pedir('/api/administracion/configuracion/envios');
  document.getElementById('minimo-envio-gratis').value = datos.envio_gratis_desde;
  document.getElementById('zonas-configurables').innerHTML = datos.zonas.map((zona) => `
    <div class="fila-zona" data-id="${zona.id}">
      <label>Zona<input class="zona-nombre" maxlength="100" value="${escaparHtml(zona.nombre)}" required></label>
      <label>Tarifa ($)<input class="zona-tarifa" type="number" min="0" step="0.01" value="${zona.tarifa}" required></label>
      <label class="check-visible"><input class="zona-gratis" type="checkbox" ${Number(zona.envio_gratis) ? 'checked' : ''}> Envío gratis desde el mínimo</label>
      <button class="quitar-zona" type="button">Quitar</button>
    </div>`).join('');
  document.getElementById('formas-pago-configurables').value = datos.formas_pago_detalle.filter((forma) => forma.activa).map((forma) => forma.nombre).join('\n');
}

function agregarZonaEnvio(nombre = '', tarifa = 2.5, gratis = false) {
  const fila = document.createElement('div');
  fila.className = 'fila-zona';
  fila.innerHTML = `<label>Zona<input class="zona-nombre" maxlength="100" value="${escaparHtml(nombre)}" required></label>
    <label>Tarifa ($)<input class="zona-tarifa" type="number" min="0" step="0.01" value="${tarifa}" required></label>
    <label class="check-visible"><input class="zona-gratis" type="checkbox" ${gratis ? 'checked' : ''}> Envío gratis desde el mínimo</label>
    <button class="quitar-zona" type="button">Quitar</button>`;
  document.getElementById('zonas-configurables').append(fila);
  fila.querySelector('.quitar-zona').addEventListener('click', () => fila.remove());
}

async function guardarConfiguracionEnvios(evento) {
  evento.preventDefault();
  const zonas = [...document.querySelectorAll('.fila-zona')].map((fila) => ({
    nombre: fila.querySelector('.zona-nombre').value.trim(),
    tarifa: Number(fila.querySelector('.zona-tarifa').value),
    envio_gratis: fila.querySelector('.zona-gratis').checked
  }));
  const formas_pago = document.getElementById('formas-pago-configurables').value.split('\n').map((forma) => forma.trim()).filter(Boolean);
  try {
    await pedir('/api/administracion/configuracion/envios', { method: 'PUT', body: JSON.stringify({
      envio_gratis_desde: document.getElementById('minimo-envio-gratis').value, zonas, formas_pago
    }) });
    mostrarMensaje('Configuración de entrega guardada.');
    await cargarConfiguracionEnvios();
  } catch (error) { mostrarMensaje(error.message, true); }
}

function mostrarErrorFotografia(texto = '') {
  document.getElementById('error-fotografia').textContent = texto;
}
function mostrarPrevisualizacion(ruta) {
  const imagen = document.getElementById('previsualizacion-producto');
  const aviso = document.getElementById('aviso-previsualizacion');
  if (!ruta) {
    imagen.hidden = true;
    imagen.removeAttribute('src');
    aviso.hidden = false;
    return;
  }
  const rutaImagen = ruta.startsWith('/') || /^(blob:|data:|https?:\/\/)/i.test(ruta)
    ? ruta
    : `/img/${encodeURIComponent(ruta)}`;
  imagen.src = rutaImagen;
  imagen.hidden = false;
  aviso.hidden = true;
}
function seleccionarFotografia(evento) {
  const archivo = evento.target.files[0];
  fotografiaSeleccionada = archivo || null;
  mostrarErrorFotografia('');
  if (!archivo) return;
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size > 5 * 1024 * 1024) {
    fotografiaSeleccionada = null;
    evento.target.value = '';
    mostrarErrorFotografia('Usa una imagen JPG, PNG o WEBP de máximo 5 MB.');
    return;
  }
  if (urlFotografiaTemporal) URL.revokeObjectURL(urlFotografiaTemporal);
  urlFotografiaTemporal = URL.createObjectURL(archivo);
  mostrarPrevisualizacion(urlFotografiaTemporal);
  document.getElementById('nombre-fotografia').textContent = archivo.name;
}
async function subirFotografia() {
  if (!fotografiaSeleccionada) return document.getElementById('producto-imagen').value;
  const datos = new FormData();
  datos.append('fotografia', fotografiaSeleccionada);
  const respuesta = await pedir('/api/productos/imagen', { method: 'POST', body: datos });
  return respuesta.archivo;
}
function limpiarProducto() {
  document.getElementById('formulario-producto').reset();
  document.getElementById('producto-id').value = '';
  document.getElementById('producto-imagen').value = '';
  document.getElementById('nombre-fotografia').textContent = 'Sin fotografía seleccionada';
  document.getElementById('mensaje-producto-admin').textContent = '';
  fotografiaSeleccionada = null;
  if (urlFotografiaTemporal) URL.revokeObjectURL(urlFotografiaTemporal);
  urlFotografiaTemporal = '';
  mostrarPrevisualizacion('');
  mostrarErrorFotografia('');
}

async function cargarProductosAdmin() {
  const productos = await pedir('/api/productos?todos=1');
  document.getElementById('tabla-productos').innerHTML = productos.length ? productos.map((producto) => `
    <tr><td>${escaparHtml(producto.nombre)}</td><td>$${Number(producto.precio).toFixed(2)}${producto.precio_oferta ? ` · Oferta $${Number(producto.precio_oferta).toFixed(2)}` : ''}</td>
    <td>${producto.stock}</td><td>${escaparHtml(producto.tipo_mascota)}</td><td>${escaparHtml(producto.estado)}</td>
    <td><button class="editar-producto" data-id="${producto.id}" type="button">Editar</button>
    <button class="retirar-producto" data-id="${producto.id}" type="button">Retirar</button></td></tr>`).join('')
    : '<tr><td colspan="6">No hay productos registrados.</td></tr>';
  document.querySelectorAll('.editar-producto').forEach((boton) => boton.addEventListener('click', () => editarProducto(productos.find((item) => String(item.id) === boton.dataset.id))));
  document.querySelectorAll('.retirar-producto').forEach((boton) => boton.addEventListener('click', () => retirarProducto(boton.dataset.id)));
}
function editarProducto(producto) {
  if (!producto) return;
  document.getElementById('producto-id').value = producto.id;
  document.getElementById('producto-nombre').value = producto.nombre;
  document.getElementById('producto-descripcion').value = producto.descripcion;
  document.getElementById('producto-precio').value = producto.precio;
  document.getElementById('producto-oferta').value = producto.precio_oferta || '';
  document.getElementById('producto-stock').value = producto.stock;
  document.getElementById('producto-mascota').value = producto.tipo_mascota;
  document.getElementById('producto-textura').value = producto.textura || 'sin_clasificar';
  document.getElementById('producto-nutricion').value = producto.info_nutricional || '';
  document.getElementById('producto-presentaciones').value = producto.presentaciones || '';
  document.getElementById('producto-imagen').value = producto.imagen || '';
  document.getElementById('producto-estado').value = producto.estado;
  document.getElementById('nombre-fotografia').textContent = producto.imagen || 'Sin fotografía seleccionada';
  mostrarPrevisualizacion(producto.imagen);
  document.getElementById('formulario-producto').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function guardarProducto(evento) {
  evento.preventDefault();
  mostrarErrorFotografia('');
  const id = document.getElementById('producto-id').value;
  const datos = {
    nombre: document.getElementById('producto-nombre').value.trim(),
    descripcion: document.getElementById('producto-descripcion').value.trim(),
    precio: document.getElementById('producto-precio').value,
    precio_oferta: document.getElementById('producto-oferta').value || null,
    stock: document.getElementById('producto-stock').value,
    tipo_mascota: document.getElementById('producto-mascota').value,
    textura: document.getElementById('producto-textura').value,
    info_nutricional: document.getElementById('producto-nutricion').value.trim(),
    presentaciones: document.getElementById('producto-presentaciones').value.trim(),
    estado: document.getElementById('producto-estado').value
  };
  try {
    datos.imagen = await subirFotografia();
    await pedir(id ? `/api/productos/${id}` : '/api/productos', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(datos)
    });
    document.getElementById('mensaje-producto-admin').textContent = id ? 'Producto actualizado.' : 'Producto creado.';
    mostrarMensaje('Producto guardado.');
    limpiarProducto();
    await cargarProductosAdmin();
  } catch (error) {
    mostrarErrorFotografia(error.message);
    document.getElementById('mensaje-producto-admin').textContent = error.message;
  }
}
async function retirarProducto(id) {
  if (!confirm('¿Retirar este producto del catálogo?')) return;
  try {
    await pedir(`/api/productos/${id}`, { method: 'DELETE' });
    mostrarMensaje('Producto retirado del catálogo.');
    await cargarProductosAdmin();
  } catch (error) { mostrarMensaje(error.message, true); }
}

const estadosMayoristas = {
  nueva: 'Nueva', en_revision: 'En revisión', cotizacion_preparada: 'Cotización preparada',
  cotizacion_enviada: 'Cotización enviada', aceptada: 'Aceptada', rechazada: 'Rechazada',
  vencida: 'Vencida', convertida_en_pedido: 'Convertida en pedido'
};
function fechaLocalAdmin() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}
let productosMayoristasAdmin = [];
let solicitudMayoristaActual = null;

function parametrosMayoristas() {
  const params = new URLSearchParams();
  const filtros = {
    buscar: document.getElementById('buscar-mayorista').value.trim(),
    estado: document.getElementById('estado-mayorista').value,
    desde: document.getElementById('mayorista-desde').value,
    hasta: document.getElementById('mayorista-hasta').value
  };
  Object.entries(filtros).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
  return params;
}

async function cargarMayoristas() {
  const [solicitudes, productos] = await Promise.all([
    pedir(`/api/mayoristas/admin/solicitudes?${parametrosMayoristas()}`),
    pedir('/api/mayoristas/admin/productos')
  ]);
  productosMayoristasAdmin = productos;
  document.getElementById('tabla-mayoristas').innerHTML = solicitudes.length ? solicitudes.map((solicitud) => `
    <tr><td>#${solicitud.id}</td><td>${escaparHtml(solicitud.fecha)}</td>
    <td>${escaparHtml(solicitud.contacto)}<br><strong>${escaparHtml(solicitud.negocio)}</strong></td>
    <td>${escaparHtml(solicitud.ciudad)}, ${escaparHtml(solicitud.provincia)}</td><td>${escaparHtml(solicitud.productos || '')}</td>
    <td>${escaparHtml(estadosMayoristas[solicitud.estado] || solicitud.estado)}</td>
    <td><button class="abrir-mayorista" data-id="${solicitud.id}" type="button">Revisar</button></td></tr>`).join('')
    : '<tr><td colspan="7">No hay solicitudes para estos filtros.</td></tr>';
  document.querySelectorAll('.abrir-mayorista').forEach((boton) => boton.addEventListener('click', () => abrirSolicitudMayorista(boton.dataset.id)));
  await cargarProduccionPatitas();
}

function opcionesProductoMayorista(seleccionado) {
  return productosMayoristasAdmin.map((producto) => `<option value="${producto.id}" ${Number(producto.id) === Number(seleccionado) ? 'selected' : ''}>${escaparHtml(producto.nombre)} · ${producto.gestiona_produccion ? 'por patita' : escaparHtml(producto.presentaciones || 'por presentación')}</option>`).join('');
}

function crearFilaCotizacionMayorista(producto = {}) {
  return `<div class="fila-cotizacion-mayorista">
    <label>Producto<select class="producto-cotizar" required>${opcionesProductoMayorista(producto.producto_id)}</select></label>
    <label>Cantidad<input class="cantidad-cotizar" type="number" min="1" max="1000000" step="1" value="${Number(producto.cantidad || 1)}" required></label>
    <label>Precio unitario ($)<input class="precio-cotizar" type="number" min="0" max="9999999" step="0.001" value="${producto.precio_unitario == null ? '' : Number(producto.precio_unitario).toFixed(3)}" placeholder="Definir manualmente"><small class="subtotal-linea-cotizar">Subtotal: $0.00</small></label>
    <button class="quitar-fila-cotizacion" type="button">Quitar</button></div>`;
}

function convertirMilenimos(texto) {
  const valor = String(texto || '').trim().replace(',', '.');
  if (!valor) return 0n;
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(valor)) return null;
  const [entero, decimales = ''] = valor.split('.');
  return BigInt(entero) * 1000n + BigInt((decimales + '000').slice(0, 3));
}

function convertirCentavos(texto) {
  const valor = String(texto || '0').trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(valor)) return null;
  const [entero, decimales = ''] = valor.split('.');
  return BigInt(entero) * 100n + BigInt((decimales + '00').slice(0, 2));
}

function mostrarCentavos(centavos) {
  return `$${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;
}

function actualizarTotalesCotizacion() {
  const formulario = document.getElementById('form-mayorista-cotizacion');
  const salida = document.getElementById('preview-mayorista');
  if (!formulario || !salida) return;
  let subtotal = 0n;
  let valido = true;
  formulario.querySelectorAll('.fila-cotizacion-mayorista').forEach((fila) => {
    const cantidad = Number(fila.querySelector('.cantidad-cotizar').value);
    const precio = convertirMilenimos(fila.querySelector('.precio-cotizar').value);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 || precio === null) { valido = false; return; }
    const linea = (precio * BigInt(cantidad) + 5n) / 10n;
    subtotal += linea;
    fila.querySelector('.subtotal-linea-cotizar').textContent = `Subtotal: ${mostrarCentavos(linea)}`;
  });
  const descuento = convertirCentavos(formulario.elements.descuento.value);
  const envio = convertirCentavos(formulario.elements.envio.value);
  if (descuento === null || envio === null || descuento > subtotal) valido = false;
  if (!valido) { salida.textContent = 'Revisa cantidades, precios, descuento y envío.'; return; }
  salida.innerHTML = `<span>Subtotal: <strong>${mostrarCentavos(subtotal)}</strong></span>
    <span>Descuento: <strong>${mostrarCentavos(descuento)}</strong></span>
    <span>Envío: <strong>${mostrarCentavos(envio)}</strong></span>
    <span>Total: <strong>${mostrarCentavos(subtotal - descuento + envio)}</strong></span>`;
}

function renderEditorCotizacion(solicitud, cotizacion = null) {
  const contenedorDetalle = document.getElementById('detalle-mayorista');
  contenedorDetalle.querySelector('.editor-cotizacion-mayorista')?.remove();
  const iniciales = cotizacion && cotizacion.productos && cotizacion.productos.length ? cotizacion.productos : solicitud.productos;
  const lineas = iniciales.map((linea) => ({
    producto_id: linea.producto_id, cantidad: linea.cantidad,
    precio_unitario: cotizacion ? linea.precio_unitario : ''
  }));
  contenedorDetalle.innerHTML += `
    <section class="editor-cotizacion-mayorista"><h3>${cotizacion ? 'Nueva versión de cotización' : 'Preparar cotización'}</h3>
      <form id="form-mayorista-cotizacion" class="formulario-modulo">
        <div id="lineas-cotizacion-mayorista">${lineas.map(crearFilaCotizacionMayorista).join('')}</div>
        <button id="agregar-linea-cotizacion" type="button" class="boton boton-borde">Agregar producto</button>
        <div id="preview-mayorista" class="totales-preview-mayorista" aria-live="polite"></div>
        <div class="campos-mayorista-dos">
          <label>Descuento manual ($)<input name="descuento" type="number" min="0" max="9999999999" step="0.01" value="${cotizacion ? Number(cotizacion.descuento) : 0}"></label>
          <label>Envío ($)<input name="envio" type="number" min="0" max="9999999999" step="0.01" value="${cotizacion ? Number(cotizacion.envio) : 0}"></label>
          <label>Vigencia<input name="vigencia" type="date" value="${cotizacion && cotizacion.vigencia ? String(cotizacion.vigencia).slice(0, 10) : ''}"></label>
          <label>Condiciones de pago<input name="condiciones_pago" maxlength="500" value="${cotizacion ? escaparHtml(cotizacion.condiciones_pago || '') : ''}"></label>
        </div>
        <label>Observaciones internas (solo administración)<textarea name="observaciones_internas" maxlength="4000">${cotizacion ? escaparHtml(cotizacion.observaciones_internas || '') : ''}</textarea></label>
        <button type="submit">Guardar cotización</button>
      </form>
      ${cotizacion && ['aceptada'].includes(cotizacion.estado) ? `<form class="convertir-cotizacion-mayorista formulario-modulo" data-id="${cotizacion.id}"><h4>Convertir cotización aceptada en pedido</h4><label>Fecha prevista de entrega<input name="fecha_entrega" type="date" min="${fechaLocalAdmin()}" required></label><button type="submit">Revisar y crear pedido</button></form>` : ''}
    </section>`;
  const detalle = document.getElementById('detalle-mayorista');
  document.getElementById('lineas-cotizacion-mayorista').addEventListener('click', (evento) => {
    if (evento.target.matches('.quitar-fila-cotizacion')) {
      evento.target.closest('.fila-cotizacion-mayorista').remove();
      actualizarTotalesCotizacion();
    }
  });
  document.getElementById('agregar-linea-cotizacion').addEventListener('click', () => {
    document.getElementById('lineas-cotizacion-mayorista').insertAdjacentHTML('beforeend', crearFilaCotizacionMayorista({ producto_id: productosMayoristasAdmin[0]?.id }));
    actualizarTotalesCotizacion();
  });
  document.getElementById('form-mayorista-cotizacion').addEventListener('submit', guardarCotizacionMayorista);
  document.getElementById('form-mayorista-cotizacion').addEventListener('input', actualizarTotalesCotizacion);
  actualizarTotalesCotizacion();
  detalle.querySelectorAll('.convertir-cotizacion-mayorista').forEach((formulario) => formulario.addEventListener('submit', convertirCotizacionMayorista));
}

async function abrirSolicitudMayorista(id) {
  try {
    const datos = await pedir(`/api/mayoristas/admin/solicitudes/${id}`);
    solicitudMayoristaActual = { ...datos.solicitud, productos: datos.productos };
    const cotizaciones = datos.cotizaciones.map((cotizacion) => `<article class="cotizacion-historica">
      <h4>Cotización #${cotizacion.id} · ${escaparHtml(cotizacion.estado)}</h4>
      <p>${escaparHtml(cotizacion.fecha)} · Subtotal $${Number(cotizacion.subtotal).toFixed(2)} · Descuento $${Number(cotizacion.descuento).toFixed(2)} · Envío $${Number(cotizacion.envio).toFixed(2)} · Total $${Number(cotizacion.total).toFixed(2)}</p>
      ${cotizacion.productos.map((linea) => `<p>${escaparHtml(linea.nombre_producto)} · ${Number(linea.cantidad)} ${escaparHtml(linea.unidad)} × $${Number(linea.precio_unitario).toFixed(3)}</p>`).join('')}
      ${['preparada', 'enviada'].includes(cotizacion.estado) ? `<button class="enviar-cotizacion-mayorista" data-id="${cotizacion.id}" type="button">Preparar enlace privado y WhatsApp</button>` : ''}
      ${cotizacion.estado === 'aceptada' ? `<button class="editar-cotizacion-aceptada" data-id="${cotizacion.id}" type="button">Revisar y convertir</button>` : ''}
    </article>`).join('') || '<p>Aún no hay cotizaciones.</p>';
    const historial = datos.historial.map((item) => `<li>${escaparHtml(item.fecha)} · ${escaparHtml(item.evento)}${item.detalle ? ` · ${escaparHtml(item.detalle)}` : ''}${item.administrador ? ` · ${escaparHtml(item.administrador)}` : ''}</li>`).join('') || '<li>Sin movimientos anteriores.</li>';
    const historico = datos.historico_cliente.map((item) => `<li>Solicitud #${item.id} · ${escaparHtml(item.fecha)} · ${escaparHtml(estadosMayoristas[item.estado] || item.estado)} · ${escaparHtml(item.productos || '')}${item.cotizacion_id ? ` · Cotización #${item.cotizacion_id} ${escaparHtml(item.estado_cotizacion)} · $${Number(item.total || 0).toFixed(2)}` : ''}</li>`).join('');
    const detalle = document.getElementById('detalle-mayorista');
    detalle.innerHTML = `<div class="detalle-mayorista-cabecera"><div><p class="sobrelinea">Solicitud #${datos.solicitud.id} · ${escaparHtml(estadosMayoristas[datos.solicitud.estado])}</p><h3>${escaparHtml(datos.solicitud.negocio)}</h3></div><button id="cerrar-detalle-mayorista" class="boton boton-borde" type="button">Cerrar detalle</button></div>
      <div class="datos-cliente-mayorista"><p><strong>Contacto:</strong> ${escaparHtml(datos.solicitud.contacto)}</p><p><strong>Teléfono:</strong> ${escaparHtml(datos.solicitud.telefono)}</p><p><strong>WhatsApp:</strong> ${escaparHtml(datos.solicitud.whatsapp)}</p><p><strong>Correo:</strong> ${escaparHtml(datos.solicitud.correo)}</p><p><strong>Ubicación:</strong> ${escaparHtml(datos.solicitud.sector_direccion || '')} · ${escaparHtml(datos.solicitud.ciudad)}, ${escaparHtml(datos.solicitud.provincia)}</p><p><strong>Tipo de negocio:</strong> ${escaparHtml(datos.solicitud.tipo_negocio)}${datos.solicitud.otro_tipo_negocio ? ` · ${escaparHtml(datos.solicitud.otro_tipo_negocio)}` : ''}</p><p><strong>Observaciones:</strong> ${escaparHtml(datos.solicitud.observaciones || 'Ninguna')}</p></div>
      <div class="acciones-detalle-mayorista"><label>Estado de solicitud<select id="nuevo-estado-mayorista"><option value="nueva">Nueva</option><option value="en_revision">En revisión</option><option value="rechazada">Rechazada</option></select></label><button id="guardar-estado-mayorista" type="button">Guardar estado</button></div>
      <h3>Historial del cliente</h3><ul>${historico || '<li>Sin historial.</li>'}</ul><h3>Versiones de cotización</h3><div id="cotizaciones-mayorista">${cotizaciones}</div>
      <div id="acciones-compartir-cotizacion"></div><button id="nueva-cotizacion-mayorista" type="button">Crear cotización</button><h3>Actividad</h3><ol>${historial}</ol>`;
    detalle.hidden = false;
    detalle.querySelector('#nuevo-estado-mayorista').value = datos.solicitud.estado;
    detalle.querySelector('#cerrar-detalle-mayorista').addEventListener('click', () => { detalle.hidden = true; });
    detalle.querySelector('#guardar-estado-mayorista').addEventListener('click', guardarEstadoMayorista);
    detalle.querySelector('#nueva-cotizacion-mayorista').addEventListener('click', () => renderEditorCotizacion(solicitudMayoristaActual));
    detalle.querySelectorAll('.enviar-cotizacion-mayorista').forEach((boton) => boton.addEventListener('click', () => compartirCotizacionMayorista(boton.dataset.id)));
    detalle.querySelectorAll('.editar-cotizacion-aceptada').forEach((boton) => boton.addEventListener('click', () => {
      const cotizacion = datos.cotizaciones.find((item) => String(item.id) === boton.dataset.id);
      renderEditorCotizacion(datos.solicitud, cotizacion);
      document.getElementById('form-mayorista-cotizacion').hidden = true;
      document.querySelector('.convertir-cotizacion-mayorista')?.scrollIntoView({ behavior: 'smooth' });
    }));
    detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function guardarEstadoMayorista() {
  try {
    await pedir(`/api/mayoristas/admin/solicitudes/${solicitudMayoristaActual.id}/estado`, {
      method: 'PUT', body: JSON.stringify({ estado: document.getElementById('nuevo-estado-mayorista').value })
    });
    mostrarMensaje('Estado de solicitud actualizado.');
    await cargarMayoristas(); await abrirSolicitudMayorista(solicitudMayoristaActual.id);
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function guardarCotizacionMayorista(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const lineas = [...formulario.querySelectorAll('.fila-cotizacion-mayorista')].map((fila) => ({
    producto_id: fila.querySelector('.producto-cotizar').value,
    cantidad: fila.querySelector('.cantidad-cotizar').value,
    precio_unitario: fila.querySelector('.precio-cotizar').value
  }));
  try {
    const datos = Object.fromEntries(new FormData(formulario).entries());
    datos.productos = lineas;
    const resultado = await pedir(`/api/mayoristas/admin/solicitudes/${solicitudMayoristaActual.id}/cotizaciones`, {
      method: 'POST', body: JSON.stringify(datos)
    });
    mostrarMensaje(`Cotización ${resultado.estado === 'borrador' ? 'guardada como borrador' : 'preparada'} · Subtotal $${Number(resultado.subtotal).toFixed(2)} · Total $${Number(resultado.total).toFixed(2)}.`);
    await cargarMayoristas(); await abrirSolicitudMayorista(solicitudMayoristaActual.id);
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function compartirCotizacionMayorista(id) {
  try {
    const datos = await pedir(`/api/mayoristas/admin/cotizaciones/${id}/enviar`, { method: 'POST' });
    const enlace = `${location.origin}/cotizacion-mayorista.html?token=${encodeURIComponent(datos.token)}`;
    const numero = String(datos.whatsapp || '').replace(/\D/g, '');
    const mensaje = `Hola ${datos.negocio}, tu cotización privada de CHARQUI está lista: ${enlace}`;
    const whatsapp = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    document.getElementById('acciones-compartir-cotizacion').innerHTML = `<p>Enlace privado (compártelo solo con este cliente):</p><input readonly value="${escaparHtml(enlace)}" aria-label="Enlace privado de cotización"><div class="botones"><button id="copiar-enlace-cotizacion" type="button">Copiar enlace</button><a class="boton boton-borde" href="${escaparHtml(whatsapp)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a><a class="boton boton-borde" href="${escaparHtml(enlace)}" target="_blank" rel="noopener noreferrer">Vista imprimible</a></div>`;
    document.getElementById('copiar-enlace-cotizacion').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(enlace); mostrarMensaje('Enlace privado copiado.'); }
      catch (error) { mostrarMensaje('Selecciona y copia el enlace privado.', true); }
    });
    await cargarMayoristas();
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function convertirCotizacionMayorista(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  try {
    const resultado = await pedir(`/api/mayoristas/admin/cotizaciones/${formulario.dataset.id}/convertir`, {
      method: 'POST', body: JSON.stringify({ fecha_entrega: formulario.elements.fecha_entrega.value })
    });
    mostrarMensaje(`Pedido #${resultado.pedido_id} creado. ${resultado.mensaje}`);
    await cargarMayoristas(); await abrirSolicitudMayorista(solicitudMayoristaActual.id);
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function cargarProduccionPatitas() {
  const desde = document.getElementById('produccion-desde').value || fechaLocalAdmin();
  const hasta = document.getElementById('produccion-hasta').value || desde;
  try {
    const datos = await pedir(`/api/mayoristas/admin/produccion?desde=${desde}&hasta=${hasta}`);
    document.getElementById('tabla-capacidad-patitas').innerHTML = datos.dias.map((dia) => `
      <tr><td>${escaparHtml(dia.fecha_entrega)}</td><td>${Number(dia.capacidad_unidades).toLocaleString('es-EC')}</td><td>${Number(dia.comprometidas).toLocaleString('es-EC')}</td><td>${(Number(dia.capacidad_unidades) - Number(dia.comprometidas)).toLocaleString('es-EC')}</td></tr>`).join('') || '<tr><td colspan="4">Aún no hay capacidad registrada en estas fechas.</td></tr>';
    document.getElementById('tabla-produccion-patitas').innerHTML = datos.compromisos.map((item) => `
      <tr><td>Pedido #${item.pedido_id}<br>${escaparHtml(item.negocio)} · ${escaparHtml(item.contacto)}</td><td>${escaparHtml(item.fecha_entrega)}</td><td>${item.unidades_pedidas}</td>
      <td><input type="number" min="${item.unidades_producidas}" max="${item.unidades_pedidas}" value="${item.unidades_producidas}" data-producidas="${item.detalle_pedido_id}" aria-label="Patitas producidas"></td>
      <td><input type="number" min="${item.unidades_listas}" max="${item.unidades_pedidas}" value="${item.unidades_listas}" data-listas="${item.detalle_pedido_id}" aria-label="Patitas listas"></td>
      <td><input type="number" min="${item.unidades_entregadas}" max="${item.unidades_pedidas}" value="${item.unidades_entregadas}" data-entregadas="${item.detalle_pedido_id}" aria-label="Patitas entregadas"></td>
      <td><button class="guardar-progreso-patitas" data-id="${item.detalle_pedido_id}" type="button">Guardar avance</button></td></tr>`).join('') || '<tr><td colspan="7">No hay compromisos de producción en estas fechas.</td></tr>';
    document.querySelectorAll('.guardar-progreso-patitas').forEach((boton) => boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      try {
        await pedir(`/api/mayoristas/admin/produccion/${id}`, { method: 'PUT', body: JSON.stringify({
          unidades_producidas: document.querySelector(`[data-producidas="${id}"]`).value,
          unidades_listas: document.querySelector(`[data-listas="${id}"]`).value,
          unidades_entregadas: document.querySelector(`[data-entregadas="${id}"]`).value
        }) });
        mostrarMensaje('Progreso de producción actualizado.'); await cargarProduccionPatitas();
      } catch (error) { mostrarMensaje(error.message, true); }
    }));
  } catch (error) { mostrarMensaje(error.message, true); }
}

async function guardarCapacidadPatitas(evento) {
  evento.preventDefault();
  try {
    const resultado = await pedir('/api/mayoristas/admin/produccion/capacidad', { method: 'PUT', body: JSON.stringify({
      fecha_entrega: document.getElementById('capacidad-fecha').value,
      capacidad_unidades: document.getElementById('capacidad-unidades').value
    }) });
    mostrarMensaje(resultado.mensaje);
    document.getElementById('produccion-desde').value = document.getElementById('capacidad-fecha').value;
    document.getElementById('produccion-hasta').value = document.getElementById('capacidad-fecha').value;
    await cargarProduccionPatitas();
  } catch (error) { mostrarMensaje(error.message, true); }
}

function mostrarModulo(nombre) {
  document.querySelectorAll('.modulo-admin').forEach((modulo) => { modulo.hidden = modulo.id !== `modulo-${nombre}`; });
  document.querySelectorAll('.menu-admin [data-modulo]').forEach((boton) => {
    const activo = boton.dataset.modulo === nombre;
    boton.classList.toggle('activo', activo);
    if (activo) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  });
  const cargas = {
    dashboard: cargarDashboard, pedidos: cargarPedidos, entregas: cargarEntregas,
    inventario: cargarInventario, clientes: cargarClientes, reportes: cargarReporte,
    envios: cargarConfiguracionEnvios, productos: cargarProductosAdmin, mayoristas: cargarMayoristas
  };
  if (cargas[nombre]) cargas[nombre]().catch((error) => mostrarMensaje(error.message, true));
}

async function cargarPanel() {
  try {
    await cargarDashboard();
    document.getElementById('acceso-admin').hidden = true;
    document.getElementById('panel-admin').hidden = false;
  } catch (error) {
    sessionStorage.removeItem('charqui_token');
    document.getElementById('mensaje-admin').textContent = error.message;
    document.getElementById('acceso-admin').hidden = false;
    document.getElementById('panel-admin').hidden = true;
  }
}

function iniciarEventos() {
  document.getElementById('capacidad-fecha').min = fechaLocalAdmin();
  document.getElementById('capacidad-fecha').value = fechaLocalAdmin();
  document.getElementById('produccion-desde').value = fechaLocalAdmin();
  document.getElementById('produccion-hasta').value = fechaLocalAdmin();
  estados.forEach(([estado, nombre]) => {
    const opcion = document.createElement('option');
    opcion.value = estado;
    opcion.textContent = nombre;
    document.getElementById('filtro-estado-pedido').append(opcion);
  });
  document.querySelectorAll('.menu-admin [data-modulo]').forEach((boton) => boton.addEventListener('click', () => mostrarModulo(boton.dataset.modulo)));
  document.getElementById('formulario-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const mensaje = document.getElementById('mensaje-admin');
    mensaje.textContent = '';
    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: document.getElementById('correo-admin').value.trim(),
          contrasena: document.getElementById('contrasena-admin').value
        })
      });
      const datos = await leerJson(respuesta);
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo iniciar sesión.');
      sessionStorage.setItem('charqui_token', datos.token);
      await cargarPanel();
    } catch (error) { mensaje.textContent = error.message; }
  });
  document.getElementById('cerrar-sesion').addEventListener('click', () => {
    sessionStorage.removeItem('charqui_token');
    document.getElementById('panel-admin').hidden = true;
    document.getElementById('acceso-admin').hidden = false;
    document.getElementById('mensaje-admin').textContent = 'Sesión cerrada.';
  });
  document.getElementById('filtros-pedidos').addEventListener('submit', (evento) => {
    evento.preventDefault(); cargarPedidos().catch((error) => mostrarMensaje(error.message, true));
  });
  document.getElementById('buscar-cliente-admin').addEventListener('submit', (evento) => {
    evento.preventDefault(); cargarClientes().catch((error) => mostrarMensaje(error.message, true));
  });
  document.getElementById('filtros-reporte').addEventListener('submit', (evento) => {
    evento.preventDefault(); cargarReporte().catch((error) => mostrarMensaje(error.message, true));
  });
  document.getElementById('exportar-reporte').addEventListener('click', exportarReporte);
  document.getElementById('formulario-envios').addEventListener('submit', guardarConfiguracionEnvios);
  document.getElementById('filtros-mayoristas').addEventListener('submit', (evento) => {
    evento.preventDefault(); cargarMayoristas().catch((error) => mostrarMensaje(error.message, true));
  });
  document.getElementById('form-capacidad-patitas').addEventListener('submit', guardarCapacidadPatitas);
  document.getElementById('filtro-produccion-patitas').addEventListener('submit', (evento) => {
    evento.preventDefault(); cargarProduccionPatitas();
  });
  document.getElementById('agregar-zona-envio').addEventListener('click', () => agregarZonaEnvio());
  document.getElementById('zonas-configurables').addEventListener('click', (evento) => {
    if (evento.target.matches('.quitar-zona')) evento.target.closest('.fila-zona').remove();
  });
  document.getElementById('archivo-fotografia').addEventListener('change', seleccionarFotografia);
  document.getElementById('formulario-producto').addEventListener('submit', guardarProducto);
  document.getElementById('limpiar-producto').addEventListener('click', limpiarProducto);
  document.getElementById('formulario-inventario').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const id = document.getElementById('producto-movimiento').value;
    const tipo = document.getElementById('tipo-movimiento').value;
    const datos = { tipo, motivo: document.getElementById('motivo-movimiento').value.trim() };
    if (tipo === 'ajuste') datos.stock_objetivo = document.getElementById('stock-objetivo').value;
    else datos.cantidad = document.getElementById('cantidad-movimiento').value;
    try {
      await pedir(`/api/administracion/inventario/${id}/movimientos`, { method: 'POST', body: JSON.stringify(datos) });
      mostrarMensaje('Movimiento registrado.'); formulario.reset();
      await cargarInventario(); await cargarMovimientos(id);
    } catch (error) { mostrarMensaje(error.message, true); }
  });
  document.getElementById('tipo-movimiento').addEventListener('change', (evento) => {
    const ajuste = evento.target.value === 'ajuste';
    document.getElementById('cantidad-movimiento').disabled = ajuste;
    document.getElementById('stock-objetivo').disabled = !ajuste;
  });
  document.getElementById('formulario-entrega').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const id = document.getElementById('id-pedido-entrega').value;
    if (!id) return mostrarMensaje('Selecciona un pedido de la tabla de entregas.', true);
    try {
      await pedir(`/api/administracion/pedidos/${id}/entrega`, { method: 'PUT', body: JSON.stringify({
        repartidor_nombre: document.getElementById('repartidor-nombre').value,
        salida_reparto: document.getElementById('salida-reparto').value,
        observaciones_entrega: document.getElementById('observaciones-entrega').value
      }) });
      mostrarMensaje('Datos de reparto guardados.'); await cargarEntregas();
    } catch (error) { mostrarMensaje(error.message, true); }
  });
  document.getElementById('formulario-estado-pedido').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const id = document.getElementById('modal-pedido-id').value;
    try {
      await pedir(`/api/pedidos/${id}/estado`, { method: 'PUT', body: JSON.stringify({
        estado: document.getElementById('nuevo-estado-pedido').value,
        observacion: document.getElementById('observacion-estado-pedido').value,
        visible_cliente: document.getElementById('observacion-visible').checked
      }) });
      mostrarMensaje('Estado del pedido actualizado.');
      document.getElementById('modal-pedido').close(); await cargarPedidos(); await cargarDashboard();
    } catch (error) { mostrarMensaje(error.message, true); }
  });
  document.getElementById('cerrar-modal-pedido').addEventListener('click', () => document.getElementById('modal-pedido').close());
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarEventos();
  document.getElementById('stock-objetivo').disabled = true;
  if (obtenerToken()) cargarPanel();
});
