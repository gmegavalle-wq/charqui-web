const estadosPedido = [
  ['recibido_y_confirmado', 'Recibido y confirmado'],
  ['en_preparacion', 'En preparación'],
  ['listo_para_despacho', 'Listo para despacho'],
  ['en_reparto_local', 'En reparto local'],
  ['entregado', 'Entregado']
];
const nombresEstado = Object.fromEntries(estadosPedido);
nombresEstado.en_tu_puerta = 'En tu Puerta (estado anterior)';
nombresEstado.cancelado = 'Cancelado';

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarPedido(pedido) {
  const contenedor = document.getElementById('lista-pedidos');
  if (!pedido) {
    contenedor.innerHTML = '<p>No encontramos un pedido asociado a ese enlace.</p>';
    return;
  }
  const actual = estadosPedido.findIndex(([estado]) => estado === pedido.estado);
  const progreso = pedido.estado === 'cancelado'
    ? '<p class="estado-cancelado">Pedido cancelado</p>'
    : pedido.estado === 'en_tu_puerta'
      ? '<p>Este pedido conserva un estado anterior: En tu Puerta.</p>'
      : `<ol class="pasos progreso-pedido">${estadosPedido.map(([estado, nombre], indice) =>
        `<li class="${indice <= actual ? 'activo' : ''} ${indice < actual ? 'completado' : ''}"><span class="paso-marca">${indice < actual ? '✓' : indice + 1}</span><span>${nombre}</span></li>`
      ).join('')}</ol>`;
  const productos = (pedido.productos || []).map((item) =>
    `<li>${escaparHtml(item.nombre)} × ${item.cantidad} · $${Number(item.subtotal).toFixed(2)}</li>`
  ).join('');
  const historial = (pedido.historial || []).length
    ? `<h3>Historial de seguimiento</h3><ol class="historial-seguimiento">${pedido.historial.map((item) =>
      `<li><strong>${escaparHtml(nombresEstado[item.estado_nuevo] || item.estado_nuevo)}</strong><span>${escaparHtml(item.fecha_hora)}</span>${item.observacion ? `<p>${escaparHtml(item.observacion)}</p>` : ''}</li>`
    ).join('')}</ol>`
    : '<p>Este pedido todavía no tiene historial de cambios registrado.</p>';
  contenedor.innerHTML = `<article class="tarjeta-pedido">
      <h2>Pedido #${pedido.id}</h2>
      <p>Fecha: ${escaparHtml(pedido.fecha)}</p>
      <p>Estado: ${escaparHtml(nombresEstado[pedido.estado] || pedido.estado)}</p>
      ${progreso}
      <h3>Productos</h3><ul>${productos}</ul>
      <p>Total: <strong>$${Number(pedido.total).toFixed(2)}</strong></p>
      ${historial}
      <button class="repetir-pedido" data-id="${pedido.id}" type="button">Repetir este pedido</button>
    </article>`;

  document.querySelectorAll('.repetir-pedido').forEach((boton) => {
    boton.addEventListener('click', () => {
      const carrito = JSON.parse(localStorage.getItem('charqui_carrito') || '[]');
      for (const producto of pedido.productos) {
        const id = Number(producto.producto_id || producto.id);
        const existente = carrito.find((item) => item.id === id);
        if (existente) existente.cantidad += Number(producto.cantidad);
        else carrito.push({ id, cantidad: Number(producto.cantidad) });
      }
      localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
      window.dispatchEvent(new Event('charqui-carrito-actualizado'));
      window.location.href = '/carrito.html';
    });
  });
}

async function consultarPedido(token) {
  const mensaje = document.getElementById('mensaje-mis-pedidos');
  mensaje.textContent = '';
  try {
    const respuesta = await fetch('/api/pedidos/cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_seguimiento: token })
    });
    const texto = await respuesta.text();
    let datos;
    try { datos = JSON.parse(texto); }
    catch (error) { throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${respuesta.status}).`); }
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron buscar los pedidos.');
    mostrarPedido(datos.pedido);
  } catch (error) {
    mensaje.textContent = error.message || 'No se pudieron buscar los pedidos.';
  }
}

function extraerTokenSeguimiento(valor) {
  try {
    const url = new URL(valor, window.location.origin);
    return url.searchParams.get('token') ||
      new URLSearchParams(url.hash.slice(1)).get('token') ||
      valor;
  } catch (error) {
    return valor;
  }
}

document.getElementById('buscar-pedidos').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const entrada = document.getElementById('token-seguimiento').value.trim();
  consultarPedido(extraerTokenSeguimiento(entrada));
});

const tokenEnlace = new URLSearchParams(window.location.hash.slice(1)).get('token') ||
  new URLSearchParams(window.location.search).get('token');
if (tokenEnlace) {
  document.getElementById('token-seguimiento').value = tokenEnlace;
  consultarPedido(tokenEnlace);
}
