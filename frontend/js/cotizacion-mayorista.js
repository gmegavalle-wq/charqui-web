const tokenCotizacion = new URLSearchParams(location.search).get('token') || '';

function escaparCotizacion(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function pedirCotizacionPrivada(url, opciones = {}) {
  const respuesta = await fetch(url, opciones);
  const texto = await respuesta.text();
  let datos;
  try { datos = texto ? JSON.parse(texto) : {}; }
  catch (error) { throw new Error(`El servidor respondió algo inesperado (HTTP ${respuesta.status}).`); }
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar la cotización.');
  return datos;
}

function fechaCotizacion(fecha) {
  if (!fecha) return 'No indicada';
  const valor = new Date(fecha);
  return Number.isNaN(valor.getTime()) ? String(fecha).slice(0, 10) : valor.toLocaleDateString('es-EC');
}

async function responderCotizacion(decision) {
  const mensaje = document.getElementById('respuesta-cotizacion-privada');
  try {
    const datos = await pedirCotizacionPrivada(`/api/mayoristas/cotizacion/${encodeURIComponent(tokenCotizacion)}/respuesta`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision })
    });
    mensaje.textContent = datos.mensaje;
    document.querySelectorAll('.accion-cotizacion-privada').forEach((boton) => { boton.disabled = true; });
  } catch (error) { mensaje.textContent = error.message; }
}

async function cargarCotizacionPrivada() {
  const estado = document.getElementById('estado-cotizacion-privada');
  const documento = document.getElementById('documento-cotizacion');
  if (!/^[a-f0-9]{64}$/i.test(tokenCotizacion)) { estado.textContent = 'El enlace privado no es válido.'; return; }
  try {
    const cotizacion = await pedirCotizacionPrivada(`/api/mayoristas/cotizacion/${encodeURIComponent(tokenCotizacion)}`);
    const filas = cotizacion.productos.map((producto) => `<tr>
      <td>${escaparCotizacion(producto.nombre_producto)}${producto.presentacion ? `<small>${escaparCotizacion(producto.presentacion)}</small>` : ''}</td>
      <td>${Number(producto.cantidad).toLocaleString('es-EC')} ${escaparCotizacion(producto.unidad)}</td>
      <td>$${Number(producto.precio_unitario).toFixed(3)}</td><td>$${Number(producto.subtotal).toFixed(2)}</td>
    </tr>`).join('');
    const puedeResponder = cotizacion.estado === 'enviada';
    documento.innerHTML = `<header class="documento-cotizacion-cabecera"><div><p class="sobrelinea">CHARQUI · Quito, Ecuador</p><h1>Cotización ${escaparCotizacion(cotizacion.codigo)}</h1></div><button type="button" class="boton boton-borde imprimir-cotizacion">Imprimir / Guardar PDF</button></header>
      <p>Fecha: ${fechaCotizacion(cotizacion.fecha)} · Vigencia: ${fechaCotizacion(cotizacion.vigencia)}</p>
      <section><h2>Propuesta para ${escaparCotizacion(cotizacion.negocio)}</h2><p>${escaparCotizacion(cotizacion.contacto)} · ${escaparCotizacion(cotizacion.ciudad)}, ${escaparCotizacion(cotizacion.provincia)}</p></section>
      <div class="tabla-contenedor"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>${filas}</tbody></table></div>
      <dl class="totales-cotizacion"><div><dt>Subtotal</dt><dd>$${Number(cotizacion.subtotal).toFixed(2)}</dd></div><div><dt>Descuento</dt><dd>$${Number(cotizacion.descuento).toFixed(2)}</dd></div><div><dt>Envío</dt><dd>$${Number(cotizacion.envio).toFixed(2)}</dd></div><div class="total-final"><dt>Total</dt><dd>$${Number(cotizacion.total).toFixed(2)}</dd></div></dl>
      <section><h2>Condiciones comerciales</h2><p>${escaparCotizacion(cotizacion.condiciones_pago || 'A coordinar con CHARQUI.')}</p></section>
      <p class="nota-privada">Esta cotización es privada. La aceptación confirma tu interés; CHARQUI coordinará contigo la fecha y entrega del pedido.</p>
      <div class="acciones-cotizacion-privada">${puedeResponder ? '<button class="boton accion-cotizacion-privada aceptar-cotizacion" type="button">Aceptar cotización</button><button class="boton boton-borde accion-cotizacion-privada rechazar-cotizacion" type="button">No aceptar</button>' : `<p>Estado de la cotización: ${escaparCotizacion(cotizacion.estado)}.</p>`}</div>`;
    documento.hidden = false;
    estado.hidden = true;
    documento.querySelector('.imprimir-cotizacion').addEventListener('click', () => window.print());
    const aceptar = documento.querySelector('.aceptar-cotizacion');
    const rechazar = documento.querySelector('.rechazar-cotizacion');
    if (aceptar) aceptar.addEventListener('click', () => responderCotizacion('aceptada'));
    if (rechazar) rechazar.addEventListener('click', () => responderCotizacion('rechazada'));
  } catch (error) {
    estado.textContent = error.message;
  }
}

document.addEventListener('DOMContentLoaded', cargarCotizacionPrivada);
