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
  const datos = await pedir('/api/administracion/dashboard');
  const html = estados.filter(([estado]) => estado !== 'cancelado').map(([estado, nombre]) => `
    <button class="indicador-admin" type="button" data-estado="${estado}"><span>${nombre}</span><strong>${datos.pedidos[estado] || 0}</strong></button>`);
  html.push(`<article class="indicador-admin indicador-venta"><span>Ventas de hoy</span><strong>$${Number(datos.ventas_hoy).toFixed(2)}</strong></article>`);
  html.push(`<article class="indicador-admin indicador-venta"><span>Ventas del mes</span><strong>$${Number(datos.ventas_mes).toFixed(2)}</strong></article>`);
  html.push(`<button class="indicador-admin indicador-alerta" data-modulo-destino="inventario" type="button"><span>Stock bajo · 5 o menos</span><strong>${datos.productos_stock_bajo}</strong></button>`);
  html.push(`<button class="indicador-admin indicador-cancelado" data-estado="cancelado" type="button"><span>Cancelados</span><strong>${datos.pedidos.cancelado || 0}</strong></button>`);
  if (datos.pedidos_legacy) html.push(`<article class="indicador-admin"><span>Estado anterior · En tu Puerta</span><strong>${datos.pedidos_legacy}</strong></article>`);
  const contenedor = document.getElementById('indicadores-admin');
  contenedor.innerHTML = html.join('');
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
    <tr><td>#${pedido.id}</td><td>${escaparHtml(pedido.nombre)}<br>${escaparHtml(pedido.telefono)}</td>
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
    const productos = pedido.productos.map((item) => `<tr><td>${escaparHtml(item.nombre)}</td><td>${item.cantidad}</td><td>$${Number(item.precio_unitario).toFixed(2)}</td><td>$${Number(item.subtotal).toFixed(2)}</td></tr>`).join('');
    const historial = pedido.historial.length ? pedido.historial.map((item) => `
      <li><strong>${escaparHtml(nombresEstado[item.estado_nuevo] || item.estado_nuevo)}</strong> · ${escaparHtml(item.fecha_hora)} · ${escaparHtml(item.administrador || 'Tienda')}
      ${item.observacion ? `<p>${escaparHtml(item.observacion)}${item.visible_cliente ? ' · Visible al cliente' : ''}</p>` : ''}</li>`).join('') : '<li>Sin historial anterior registrado.</li>';
    const pago = Number(pedido.pago_confirmado) ? `Confirmado · ${escaparHtml(pedido.pago_confirmado_en || '')}` : '<button id="confirmar-pago-detalle" type="button">Confirmar pago</button>';
    const gps = pedido.latitud != null && pedido.longitud != null ? `${pedido.latitud}, ${pedido.longitud}` : 'No registradas';
    document.getElementById('contenido-detalle-pedido').innerHTML = `
      <div class="detalle-pedido-grid">
        <section><h3>Cliente</h3><p>${escaparHtml(pedido.nombre)}</p><p>${escaparHtml(pedido.correo)}</p><p>${escaparHtml(pedido.telefono)}</p><p>Cédula: ${escaparHtml(pedido.cedula || 'No registrada')}</p></section>
        <section><h3>Entrega</h3><p>${escaparHtml(direccionCompleta(pedido))}</p><p>Zona: ${escaparHtml(pedido.zona_entrega || 'No registrada')}</p><p>Repartidor: ${escaparHtml(pedido.repartidor_nombre || 'No registrado')}</p><p>GPS: ${escaparHtml(gps)}</p></section>
        <section><h3>Pago</h3><p>Forma: ${escaparHtml(pedido.forma_pago || 'No registrada')}</p><p>Envío: ${pedido.costo_envio == null ? 'No registrado' : `$${Number(pedido.costo_envio).toFixed(2)}`}</p><p>${pago}</p></section>
        <section><h3>Pedido #${pedido.id}</h3><p>Fecha: ${escaparHtml(pedido.fecha)}</p><p>Estado: ${escaparHtml(nombresEstado[pedido.estado] || 'En tu Puerta (anterior)')}</p><p>Total: $${Number(pedido.total).toFixed(2)}</p></section>
      </div><div class="tabla-contenedor"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>${productos}</tbody></table></div>
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
    <article>Hoy<strong>$${Number(reporte.periodos.ventas_hoy).toFixed(2)} · ${Number(reporte.periodos.pedidos_hoy || 0)} pedidos</strong></article>
    <article>Esta semana<strong>$${Number(reporte.periodos.ventas_semana).toFixed(2)} · ${Number(reporte.periodos.pedidos_semana || 0)} pedidos</strong></article>
    <article>Este mes<strong>$${Number(reporte.periodos.ventas_mes).toFixed(2)} · ${Number(reporte.periodos.pedidos_mes || 0)} pedidos</strong></article>
    <article>Ventas registradas<strong>$${Number(resumen.ventas_registradas).toFixed(2)}</strong></article>
    <article>Pedidos<strong>${Number(resumen.pedidos_registrados)}</strong></article>
    <article>Entregados<strong>${Number(resumen.pedidos_entregados || 0)}</strong></article>
    <article>Cancelados<strong>${Number(resumen.pedidos_cancelados || 0)}</strong></article>`;
  document.getElementById('tabla-reporte-productos').innerHTML = reporte.productos.map((producto) => `
    <tr><td>${escaparHtml(producto.nombre)}</td><td>${producto.unidades}</td><td>$${Number(producto.ingresos).toFixed(2)}</td></tr>`).join('')
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
  imagen.src = ruta.startsWith('/') ? ruta : `/img/${encodeURIComponent(ruta)}`;
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

function mostrarModulo(nombre) {
  document.querySelectorAll('.modulo-admin').forEach((modulo) => { modulo.hidden = modulo.id !== `modulo-${nombre}`; });
  document.querySelectorAll('.menu-admin [data-modulo]').forEach((boton) => boton.classList.toggle('activo', boton.dataset.modulo === nombre));
  const cargas = {
    dashboard: cargarDashboard, pedidos: cargarPedidos, entregas: cargarEntregas,
    inventario: cargarInventario, clientes: cargarClientes, reportes: cargarReporte,
    envios: cargarConfiguracionEnvios, productos: cargarProductosAdmin
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
  document.getElementById('agregar-zona-envio').addEventListener('click', () => agregarZonaEnvio());
  document.getElementById('zonas-configurables').addEventListener('click', (evento) => {
    if (evento.target.matches('.quitar-zona')) evento.target.closest('.fila-zona').remove();
  });
  document.getElementById('archivo-fotografia').addEventListener('change', seleccionarFotografia);
  document.getElementById('formulario-producto').addEventListener('submit', guardarProducto);
  document.getElementById('limpiar-producto').addEventListener('click', limpiarProducto);
  document.getElementById('formulario-inventario').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const id = document.getElementById('producto-movimiento').value;
    const tipo = document.getElementById('tipo-movimiento').value;
    const datos = { tipo, motivo: document.getElementById('motivo-movimiento').value.trim() };
    if (tipo === 'ajuste') datos.stock_objetivo = document.getElementById('stock-objetivo').value;
    else datos.cantidad = document.getElementById('cantidad-movimiento').value;
    try {
      await pedir(`/api/administracion/inventario/${id}/movimientos`, { method: 'POST', body: JSON.stringify(datos) });
      mostrarMensaje('Movimiento registrado.'); evento.currentTarget.reset();
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
