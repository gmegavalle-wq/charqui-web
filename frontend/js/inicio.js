function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function cargarOfertas() {
  const contenedor = document.getElementById('productos-oferta');
  const mensaje = document.getElementById('mensaje-inicio');

  try {
    const respuesta = await fetch('/api/ofertas');
    const ofertas = await respuesta.json();
    mensaje.textContent = '';
    contenedor.innerHTML = ofertas.length
      ? ofertas.map((producto) => `
        <article class="tarjeta-producto revelar">
          <a class="imagen-producto-enlace" href="/producto.html?id=${producto.id}"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}"></a>
          <span class="etiqueta-producto etiqueta-oferta">Oferta</span>
          <div class="datos-producto"><h3>${escaparHtml(producto.nombre)}</h3>
          <p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
          <p class="precio-producto"><s>$${Number(producto.precio).toFixed(2)}</s> <strong>$${Number(producto.precio_oferta).toFixed(2)}</strong></p>
          <a class="boton boton-principal boton-ancho" href="/producto.html?id=${producto.id}">Ver producto</a></div>
        </article>`).join('')
      : '<p class="sin-productos">Pronto encontrarás productos destacados en nuestro catálogo.</p>';
  } catch (error) {
    mensaje.textContent = 'No se pudieron cargar las ofertas.';
    mensaje.classList.add('error');
  }
}

cargarOfertas();
