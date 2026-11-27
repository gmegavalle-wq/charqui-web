let productosMayoristas = [];
let solicitudMayorista = new Map();
let claveSolicitudMayorista = sessionStorage.getItem('charqui_clave_mayorista');

function escaparMayorista(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nuevaClaveSolicitud() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letra) => {
    const numero = Math.floor(Math.random() * 16);
    return (letra === 'x' ? numero : (numero & 3) | 8).toString(16);
  });
}

async function leerRespuestaMayorista(respuesta) {
  const texto = await respuesta.text();
  let datos;
  try { datos = texto ? JSON.parse(texto) : {}; }
  catch (error) { throw new Error(`El servidor respondió algo inesperado (HTTP ${respuesta.status}).`); }
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la solicitud.');
  return datos;
}

function mostrarProductosMayoristas() {
  const lista = document.getElementById('productos-mayoristas');
  const estado = document.getElementById('estado-catalogo-mayorista');
  lista.innerHTML = productosMayoristas.map((producto) => {
    const opciones = producto.destacado
      ? '<option value="500">500</option><option value="1000">1.000</option><option value="2000">2.000</option><option value="3000">3.000</option>'
      : '';
    return `<article class="tarjeta-mayorista ${producto.destacado ? 'producto-mayorista-destacado' : ''}">
      ${producto.destacado ? '<span class="etiqueta-mayorista">Producto destacado</span>' : ''}
      <a class="foto-mayorista" href="/producto.html?id=${encodeURIComponent(producto.id)}" aria-label="Ver ${escaparMayorista(producto.nombre)}">
        ${producto.imagen ? `<img src="/img/${encodeURIComponent(producto.imagen)}" alt="${escaparMayorista(producto.nombre)}" loading="lazy">` : '<span>Fotografía no disponible</span>'}
      </a>
      <div class="datos-mayorista"><h3>${escaparMayorista(producto.nombre)}</h3>
        <p>${escaparMayorista(producto.descripcion || '').slice(0, 190)}${String(producto.descripcion || '').length > 190 ? '…' : ''}</p>
        ${producto.presentaciones ? `<small>Presentación: ${escaparMayorista(producto.presentaciones)}</small>` : ''}
        <label for="cantidad-mayorista-${producto.id}">Cantidad ${producto.gestiona_produccion ? 'de patitas individuales' : 'de presentaciones'}</label>
        <div class="cantidad-mayorista">${producto.destacado ? `<select aria-label="Cantidad sugerida para ${escaparMayorista(producto.nombre)}">${opciones}<option value="personalizada">Otra cantidad</option></select>` : ''}
          <input id="cantidad-mayorista-${producto.id}" type="number" min="1" max="1000000" step="1" value="${producto.destacado ? '500' : '1'}" aria-label="Cantidad de ${escaparMayorista(producto.nombre)}"></div>
        <button class="boton boton-principal agregar-mayorista" data-id="${producto.id}" type="button">Agregar a la solicitud</button>
      </div>
    </article>`;
  }).join('');
  estado.hidden = productosMayoristas.length > 0;
  if (!productosMayoristas.length) estado.textContent = 'Por el momento no hay productos disponibles para cotizar.';
  const patitas = productosMayoristas.find((producto) => Number(producto.destacado) === 1);
  if (patitas && patitas.imagen) {
    const fotoHero = document.getElementById('foto-hero-mayorista');
    fotoHero.src = `/img/${encodeURIComponent(patitas.imagen)}`;
    fotoHero.alt = `${patitas.nombre}, producto CHARQUI para cotizar por unidad mayorista`;
  }

  lista.querySelectorAll('.agregar-mayorista').forEach((boton) => boton.addEventListener('click', () => {
    const producto = productosMayoristas.find((item) => Number(item.id) === Number(boton.dataset.id));
    const cantidadInput = document.getElementById(`cantidad-mayorista-${boton.dataset.id}`);
    const cantidad = Number(cantidadInput.value);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1000000) {
      cantidadInput.setCustomValidity('Escribe una cantidad entera mayor que cero.');
      cantidadInput.reportValidity();
      return;
    }
    cantidadInput.setCustomValidity('');
    solicitudMayorista.set(Number(producto.id), { producto, cantidad });
    mostrarSolicitudMayorista();
    document.getElementById('solicitar-cotizacion').scrollIntoView({ behavior: 'smooth' });
  }));

  lista.querySelectorAll('.cantidad-mayorista select').forEach((selector) => selector.addEventListener('change', () => {
    const entrada = selector.parentElement.querySelector('input');
    if (selector.value !== 'personalizada') entrada.value = selector.value;
    else { entrada.value = ''; entrada.focus(); }
  }));
}

function mostrarSolicitudMayorista() {
  const lista = document.getElementById('lista-solicitud-mayorista');
  if (!solicitudMayorista.size) {
    lista.innerHTML = '<p>Aún no agregas productos.</p>';
    return;
  }
  lista.innerHTML = `<h3>Productos por cotizar</h3>${[...solicitudMayorista.values()].map(({ producto, cantidad }) => `
    <div class="producto-solicitado"><span><strong>${escaparMayorista(producto.nombre)}</strong><small>${escaparMayorista(producto.presentaciones || '')}</small></span>
      <label>Cantidad<input type="number" min="1" max="1000000" step="1" value="${cantidad}" data-cantidad-id="${producto.id}"></label>
      <button class="quitar-solicitud-mayorista" data-id="${producto.id}" type="button" aria-label="Quitar ${escaparMayorista(producto.nombre)}">Quitar</button></div>`).join('')}`;
  lista.querySelectorAll('[data-cantidad-id]').forEach((entrada) => entrada.addEventListener('change', () => {
    const cantidad = Number(entrada.value);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1) { entrada.value = solicitudMayorista.get(Number(entrada.dataset.cantidadId)).cantidad; return; }
    solicitudMayorista.get(Number(entrada.dataset.cantidadId)).cantidad = cantidad;
  }));
  lista.querySelectorAll('.quitar-solicitud-mayorista').forEach((boton) => boton.addEventListener('click', () => {
    solicitudMayorista.delete(Number(boton.dataset.id));
    mostrarSolicitudMayorista();
  }));
}

async function cargarProductosMayoristas() {
  const estado = document.getElementById('estado-catalogo-mayorista');
  try {
    const respuesta = await fetch('/api/mayoristas/productos');
    productosMayoristas = await leerRespuestaMayorista(respuesta);
    mostrarProductosMayoristas();
  } catch (error) {
    estado.textContent = error.message;
  }
}

async function enviarSolicitudMayorista(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const error = document.getElementById('error-solicitud-mayorista');
  const boton = document.getElementById('enviar-solicitud-mayorista');
  const confirmar = document.getElementById('confirmacion-solicitud-mayorista');
  error.textContent = '';
  confirmar.hidden = true;
  if (!solicitudMayorista.size) { error.textContent = 'Agrega al menos un producto a tu solicitud.'; return; }
  if (!formulario.reportValidity()) return;
  if (!claveSolicitudMayorista) {
    claveSolicitudMayorista = nuevaClaveSolicitud();
    sessionStorage.setItem('charqui_clave_mayorista', claveSolicitudMayorista);
  }
  const datos = Object.fromEntries(new FormData(formulario).entries());
  datos.clave_solicitud = claveSolicitudMayorista;
  datos.consentimiento = formulario.elements.consentimiento.checked;
  datos.productos = [...solicitudMayorista.values()].map(({ producto, cantidad }) => ({ producto_id: producto.id, cantidad }));
  boton.disabled = true;
  try {
    const respuesta = await fetch('/api/mayoristas/solicitudes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
    });
    const resultado = await leerRespuestaMayorista(respuesta);
    const productosMensaje = [...solicitudMayorista.values()]
      .map(({ producto, cantidad }) => `- ${producto.nombre}: ${cantidad}`)
      .join('\n');
    const observaciones = String(datos.observaciones || '').trim();
    const mensajeWhatsApp = [
      'Hola, envié una solicitud de cotización mayorista a CHARQUI.',
      `Solicitud: #${resultado.id}`,
      `Nombre del cliente: ${datos.contacto}`,
      `Negocio: ${datos.negocio}`,
      `Teléfono de contacto: ${datos.telefono}`,
      `WhatsApp de contacto: ${datos.whatsapp}`,
      `Productos solicitados:\n${productosMensaje}`,
      ...(observaciones ? [`Observaciones: ${observaciones}`] : [])
    ].join('\n');
    const enlaceWhatsApp = `https://wa.me/${window.NUMERO_WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    confirmar.innerHTML = `<strong>Solicitud #${resultado.id} recibida.</strong><br>${escaparMayorista(resultado.mensaje)} CHARQUI se comunicará contigo por los datos que compartiste.`;
    confirmar.hidden = false;
    formulario.reset();
    solicitudMayorista.clear();
    mostrarSolicitudMayorista();
    claveSolicitudMayorista = '';
    sessionStorage.removeItem('charqui_clave_mayorista');
    window.location.href = enlaceWhatsApp;
  } catch (errorEnvio) {
    error.textContent = errorEnvio.message;
  } finally {
    boton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('formulario-solicitud-mayorista');
  if (!formulario) return;
  formulario.addEventListener('submit', enviarSolicitudMayorista);
  cargarProductosMayoristas();
});
