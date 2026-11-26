let configuracionEnvio = { tarifas: {}, envio_gratis_desde: 20, zonas_envio_gratis: [], formas_pago: [] };
let productosPedido = [];
const claveAlmacenamientoIdempotencia = 'charqui_clave_idempotencia_pedido';
const formatoClaveIdempotencia = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generarClaveIdempotencia() {
  if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
    throw new Error('Este navegador no permite proteger los reintentos del pedido. Actualiza el navegador para continuar.');
  }
  if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}

function obtenerClaveIdempotencia() {
  let clave = localStorage.getItem(claveAlmacenamientoIdempotencia);
  if (!formatoClaveIdempotencia.test(clave || '')) {
    clave = generarClaveIdempotencia();
    localStorage.setItem(claveAlmacenamientoIdempotencia, clave);
  }
  return clave;
}

function mostrarErrorCampo(campo) {
  const aviso = document.getElementById(`error-${campo.id}`);
  if (!aviso) return;
  if (campo.validity.valueMissing) aviso.textContent = 'Este campo es obligatorio.';
  else if (!campo.validity.valid) aviso.textContent = 'Revisa el formato de este dato.';
  else aviso.textContent = '';
}

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function leerRespuestaJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch (error) {
    const ruta = new URL(respuesta.url).pathname;
    throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${respuesta.status}) para ${ruta}.`);
  }
}

async function cargarResumen() {
  const botonEnviar = document.querySelector('#formulario-pedido button[type=submit]');
  botonEnviar.disabled = true;
  const carrito = JSON.parse(localStorage.getItem('charqui_carrito') || '[]');
  const resumen = document.getElementById('resumen-pedido');
  if (!carrito.length) {
    resumen.textContent = 'Tu carrito está vacío. Añade productos antes de confirmar.';
    document.querySelector('#formulario-pedido button[type="submit"]').disabled = true;
    return;
  }

  const respuestaEnvio = await fetch('/api/envios');
  configuracionEnvio = await leerRespuestaJson(respuestaEnvio);
  if (!respuestaEnvio.ok) throw new Error(configuracionEnvio.error || 'No se pudo cargar la configuración de entrega.');
  const zonas = document.getElementById('zona');
  zonas.innerHTML = '<option value="">Elige una zona</option>' +
    Object.keys(configuracionEnvio.tarifas || {}).map((zona) =>
      `<option value="${escaparHtml(zona)}">${escaparHtml(zona)}</option>`
    ).join('');
  const pagos = document.getElementById('forma-pago');
  pagos.innerHTML = '<option value="">Elige una forma de pago</option>' +
    (configuracionEnvio.formas_pago || []).map((forma) =>
      `<option value="${escaparHtml(forma)}">${escaparHtml(forma)}</option>`
    ).join('');

  productosPedido = await Promise.all(carrito.map(async (item) => {
    const respuesta = await fetch(`/api/productos/${item.id}`);
    const producto = await leerRespuestaJson(respuesta);
    if (!respuesta.ok) throw new Error(`${producto.error || 'Un producto ya no está disponible.'} Vuelve al carrito para revisarlo.`);
    const stock = Number(producto.stock);
    if (producto.estado !== 'disponible' || stock < 1) {
      throw new Error(`${producto.nombre} está agotado. Vuelve al carrito para quitarlo antes de continuar.`);
    }
    if (Number(item.cantidad) > stock) {
      throw new Error(`De ${producto.nombre} quedan ${stock} unidades y tienes ${item.cantidad} en el carrito. Vuelve al carrito y ajusta la cantidad.`);
    }
    return { id: producto.id, nombre: producto.nombre, cantidad: item.cantidad,
      precio: Number(producto.precio_oferta || producto.precio) };
  }));
  dibujarResumen();
  botonEnviar.disabled = false;
  zonas.addEventListener('change', dibujarResumen);
}

function dibujarResumen() {
  const subtotal = productosPedido.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  const zona = document.getElementById('zona').value;
  const gratisDesde = Number(configuracionEnvio.envio_gratis_desde);
  const envioGratis = configuracionEnvio.zonas_envio_gratis.includes(zona) && subtotal >= gratisDesde;
  const costoEnvio = zona ? (envioGratis ? 0 : Number(configuracionEnvio.tarifas[zona] || 0)) : null;
  const total = subtotal + (costoEnvio || 0);
  document.getElementById('resumen-pedido').innerHTML = `
    <h2>Resumen del pedido</h2>
    <ul>${productosPedido.map((item) => `<li>${escaparHtml(item.nombre)} × ${item.cantidad}: $${(item.precio * item.cantidad).toFixed(2)}</li>`).join('')}</ul>
    <p>Subtotal: $${subtotal.toFixed(2)}</p>
    <p>Envío: ${costoEnvio === null ? 'Elige una zona para calcularlo.' : `$${costoEnvio.toFixed(2)}`}</p>
    <p>Total: $${total.toFixed(2)}${costoEnvio === null ? ' + envío' : ''}</p>`;
}

document.getElementById('formulario-pedido').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const mensaje = document.getElementById('mensaje-pedido');
  const formulario = evento.currentTarget;
  if (!formulario.reportValidity()) return;
  const botonEnviar = formulario.querySelector('button[type="submit"]');

  const telefono = document.getElementById('telefono').value.trim();
  if (!/^[+0-9 ()-]{7,20}$/.test(telefono)) {
    mensaje.textContent = 'Escribe un teléfono válido.';
    document.getElementById('error-telefono').textContent = 'Escribe un teléfono válido.';
    return;
  }

  const datos = {
    cliente: {
      nombre: document.getElementById('nombre').value.trim(),
      telefono,
      correo: document.getElementById('correo').value.trim(),
      cedula: document.getElementById('cedula').value.trim()
    },
    direccion_entrega: document.getElementById('direccion').value.trim(),
    provincia: document.getElementById('provincia').value.trim(),
    ciudad: document.getElementById('ciudad').value.trim(),
    sector: document.getElementById('sector').value.trim(),
    calle_principal: document.getElementById('calle-principal').value.trim(),
    numero_domicilio: document.getElementById('numero-domicilio').value.trim(),
    calle_secundaria: document.getElementById('calle-secundaria').value.trim(),
    referencia: document.getElementById('referencia').value.trim(),
    latitud: document.getElementById('latitud').value || null,
    longitud: document.getElementById('longitud').value || null,
    zona_entrega: document.getElementById('zona').value,
    forma_pago: document.getElementById('forma-pago').value,
    consentimiento: document.getElementById('consentimiento').checked,
    productos: productosPedido.map((item) => ({ id: item.id, cantidad: item.cantidad }))
  };

  botonEnviar.disabled = true;
  try {
    const claveIdempotencia = obtenerClaveIdempotencia();
    const respuesta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': claveIdempotencia },
      body: JSON.stringify(datos)
    });
    const pedido = await leerRespuestaJson(respuesta);
    if (respuesta.status === 429) {
      const retryAfter = Number(respuesta.headers.get('Retry-After'));
      const espera = Number.isFinite(retryAfter) && retryAfter > 0
        ? ` Espera ${Math.ceil(retryAfter)} segundos antes de reintentar.`
        : '';
      throw new Error(`El servidor limitó temporalmente la solicitud.${espera} Conservamos tu carrito y la clave de esta compra para evitar duplicados.`);
    }
    if (!respuesta.ok) throw new Error(pedido.error || 'No se pudo registrar el pedido.');
    localStorage.removeItem(claveAlmacenamientoIdempotencia);
    localStorage.removeItem('charqui_carrito');
    window.dispatchEvent(new Event('charqui-carrito-actualizado'));
    const lista = pedido.productos.map((item) => `${item.nombre} x ${item.cantidad}: $${Number(item.subtotal).toFixed(2)}`).join('\n');
    const seguimiento = new URL('/mis-pedidos.html', window.location.origin);
    seguimiento.hash = new URLSearchParams({ token: pedido.token_seguimiento }).toString();
    const resumen = `Hola, quiero coordinar el pago del pedido #${pedido.id}.\n${lista}\nEnvío: $${Number(pedido.costo_envio).toFixed(2)}\nTotal: $${Number(pedido.total).toFixed(2)}\nForma de pago: ${pedido.forma_pago}\nSeguimiento privado: ${seguimiento.href}`;
    window.location.href = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(resumen)}`;
  } catch (error) {
    mensaje.textContent = error.message;
    botonEnviar.disabled = false;
  }
});

const formularioPedido = document.getElementById('formulario-pedido');
formularioPedido.addEventListener('invalid', (evento) => mostrarErrorCampo(evento.target), true);
formularioPedido.addEventListener('input', (evento) => {
  if (evento.target.id) mostrarErrorCampo(evento.target);
});
formularioPedido.addEventListener('change', (evento) => {
  if (evento.target.id) mostrarErrorCampo(evento.target);
});

cargarResumen().catch((error) => {
  document.getElementById('mensaje-pedido').textContent = error.message || 'No se pudo cargar el resumen del pedido.';
});
