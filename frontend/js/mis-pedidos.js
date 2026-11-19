const estadosPedido = [
  ['recibido_y_confirmado', 'Recibido y Confirmado'],
  ['en_preparacion', 'En Preparación'],
  ['en_reparto_local', 'En Reparto Local'],
  ['en_tu_puerta', 'En tu Puerta']
];

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarPedidos(pedidos) {
  const contenedor = document.getElementById('lista-pedidos');
  if (!pedidos.length) {
    contenedor.innerHTML = '<p>No encontramos pedidos con esos datos.</p>';
    return;
  }

  contenedor.innerHTML = pedidos.map((pedido) => {
    const actual = estadosPedido.findIndex((estado) => estado[0] === pedido.estado);
    const barra = pedido.estado === 'cancelado'
      ? '<p>Pedido cancelado</p>'
      : `<ol class="pasos progreso-pedido">${estadosPedido.map((estado, indice) =>
        `<li class="${indice <= actual ? 'activo' : ''} ${indice < actual ? 'completado' : ''}"><span class="paso-marca">${indice < actual ? '✓' : indice + 1}</span><span>${estado[1]}</span></li>`
      ).join('')}</ol>`;
    const lineas = pedido.productos.map((item) =>
      `<li>${escaparHtml(item.nombre)} × ${item.cantidad}</li>`
    ).join('');
    return `<article class="tarjeta-pedido"><h2>Pedido #${pedido.id}</h2>
      <p>Fecha: ${escaparHtml(pedido.fecha)}</p><p>Estado: ${escaparHtml(pedido.estado)}</p>
      ${barra}<ul>${lineas}</ul><p>Total: $${Number(pedido.total).toFixed(2)}</p>
      <button class="repetir-pedido" data-id="${pedido.id}" type="button">Repetir este pedido</button></article>`;
  }).join('');

  document.querySelectorAll('.repetir-pedido').forEach((boton) => {
    boton.addEventListener('click', () => {
      const pedido = pedidos.find((item) => item.id === Number(boton.dataset.id));
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

document.getElementById('buscar-pedidos').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dato = document.getElementById('dato-cliente').value.trim();
  const esCorreo = dato.includes('@');
  const parametro = esCorreo ? 'correo' : 'telefono';
  const mensaje = document.getElementById('mensaje-mis-pedidos');
  mensaje.textContent = '';

  try {
    const respuesta = await fetch(`/api/pedidos/cliente?${parametro}=${encodeURIComponent(dato)}`);
    const pedidos = await respuesta.json();
    if (!respuesta.ok) throw new Error(pedidos.error);
    mostrarPedidos(pedidos);
  } catch (error) {
    mensaje.textContent = error.message || 'No se pudieron buscar los pedidos.';
  }
});
