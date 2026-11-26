function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


async function cargarProductoPrioritario() {
  const contenedor = document.getElementById('producto-prioritario-inicio');
  try {
    const respuesta = await fetch('/api/productos');
    if (!respuesta.ok) return;
    const productos = await respuesta.json();
    const producto = productos.find(esProductoPrioritario);
    if (!producto) return;
    const disponible = producto.estado === 'disponible' && Number(producto.stock) > 0;
    const precio = Number(producto.precio_oferta || producto.precio);
    contenedor.innerHTML = `<article class="spotlight-patitas">
      <img src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}" loading="lazy">
      <div><p class="sobrelinea">Producto prioritario de CHARQUI</p><h3>${escaparHtml(producto.nombre)}</h3>
      <p>${escaparHtml(producto.descripcion)}</p><p class="precio-producto"><strong>$${precio.toFixed(2)}</strong></p>
      <a class="boton boton-principal" href="/producto.html?id=${producto.id}">${disponible ? 'Ver patitas de pollo' : 'Ver detalles'}</a>
      ${disponible ? '' : '<p class="disponibilidad agotado">Agotado por el momento</p>'}</div>
    </article>`;
    contenedor.querySelectorAll('img').forEach(prepararImagenAlternativa);
  } catch (error) {
    // La portada mantiene el catálogo y las ofertas aunque este bloque no cargue.
  }
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
    contenedor.querySelectorAll('.producto-imagen').forEach(prepararImagenAlternativa);
  } catch (error) {
    mensaje.textContent = 'No se pudieron cargar las ofertas.';
    mensaje.classList.add('error');
  }
}

cargarOfertas();
cargarProductoPrioritario();
