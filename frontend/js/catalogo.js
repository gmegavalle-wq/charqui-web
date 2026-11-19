let productosCatalogo = [];

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarCatalogo() {
  const mascota = document.getElementById('filtro-mascota').value;
  const lista = document.getElementById('productos');
  const visibles = productosCatalogo.filter((producto) =>
    mascota === 'todos' || producto.tipo_mascota === mascota || producto.tipo_mascota === 'ambos'
  );

  lista.innerHTML = visibles.map((producto) => {
    const precio = producto.precio_oferta || producto.precio;
    const agotado = Number(producto.stock) < 1 || producto.estado !== 'disponible';
    return `<article class="tarjeta-producto">
      <a class="imagen-producto-enlace" href="/producto.html?id=${producto.id}"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}"></a>
      <span class="etiqueta-producto ${agotado ? 'etiqueta-agotado' : producto.precio_oferta ? 'etiqueta-oferta' : ''}">${agotado ? 'Agotado' : producto.precio_oferta ? 'Oferta' : ''}</span>
      <div class="datos-producto"><h2>${escaparHtml(producto.nombre)}</h2><p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
      <p class="precio-producto">${producto.precio_oferta ? `<s>$${Number(producto.precio).toFixed(2)}</s> ` : ''}<strong>$${Number(precio).toFixed(2)}</strong></p>
      <a class="boton boton-principal boton-ancho ${agotado ? 'boton-desactivado' : ''}" href="/producto.html?id=${producto.id}" ${agotado ? 'aria-label="Producto agotado: ' + escaparHtml(producto.nombre) + '"' : ''}>${agotado ? 'Ver detalles' : 'Ver producto'}</a></div>
    </article>`;
  }).join('') || '<p>No hay productos para este filtro.</p>';
}

async function cargarCatalogo() {
  const mensaje = document.getElementById('mensaje-catalogo');
  const filtro = document.getElementById('filtro-mascota');
  const mascotaUrl = new URLSearchParams(window.location.search).get('mascota');
  if (mascotaUrl === 'perro' || mascotaUrl === 'gato') filtro.value = mascotaUrl;
  document.querySelectorAll('.filtro-pastilla').forEach((boton) => {
    const seleccionado = boton.dataset.mascota === filtro.value;
    boton.classList.toggle('activo', seleccionado);
    boton.setAttribute('aria-pressed', seleccionado);
  });
  filtro.addEventListener('change', mostrarCatalogo);
  document.querySelectorAll('.filtro-pastilla').forEach((boton) => {
    boton.addEventListener('click', () => {
      filtro.value = boton.dataset.mascota;
      filtro.dispatchEvent(new Event('change'));
      document.querySelectorAll('.filtro-pastilla').forEach((opcion) => {
        opcion.classList.remove('activo');
        opcion.setAttribute('aria-pressed', 'false');
      });
      boton.classList.add('activo');
      boton.setAttribute('aria-pressed', 'true');
    });
  });

  try {
    const respuesta = await fetch('/api/productos');
    productosCatalogo = await respuesta.json();
    mensaje.textContent = '';
    mostrarCatalogo();
  } catch (error) {
    mensaje.textContent = 'No se pudo cargar el catálogo.';
    mensaje.classList.add('error');
  }
}

cargarCatalogo();
