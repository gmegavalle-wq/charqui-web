let productosCatalogo = [];

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ordenarProductos(productos, orden) {
  const copia = [...productos];
  if (orden === 'nombre') return copia.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  if (orden === 'precio-menor') return copia.sort((a, b) => Number(a.precio_oferta || a.precio) - Number(b.precio_oferta || b.precio));
  if (orden === 'precio-mayor') return copia.sort((a, b) => Number(b.precio_oferta || b.precio) - Number(a.precio_oferta || a.precio));
  return copia.sort((a, b) => Number(esProductoPrioritario(b)) - Number(esProductoPrioritario(a)) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

function mostrarCatalogo() {
  const mascota = document.getElementById('filtro-mascota').value;
  const busqueda = document.getElementById('buscar-producto').value.trim().toLocaleLowerCase('es');
  const orden = document.getElementById('orden-producto').value;
  const lista = document.getElementById('productos');
  const contador = document.getElementById('resultado-catalogo');
  const visibles = ordenarProductos(productosCatalogo.filter((producto) => {
    const coincideMascota = mascota === 'todos' || producto.tipo_mascota === mascota || producto.tipo_mascota === 'ambos';
    const texto = `${producto.nombre || ''} ${producto.descripcion || ''} ${producto.tipo_mascota || ''}`.toLocaleLowerCase('es');
    return coincideMascota && (!busqueda || texto.includes(busqueda));
  }), orden);

  contador.textContent = `${visibles.length} ${visibles.length === 1 ? 'producto' : 'productos'}`;
  lista.innerHTML = visibles.map((producto) => {
    const precio = producto.precio_oferta || producto.precio;
    const agotado = Number(producto.stock) < 1 || producto.estado !== 'disponible';
    const prioritario = esProductoPrioritario(producto);
    const etiqueta = agotado ? 'Agotado' : prioritario ? 'Prioridad CHARQUI' : producto.precio_oferta ? 'Oferta' : '';
    return `<article class="tarjeta-producto ${prioritario ? 'producto-prioritario' : ''}">
      <a class="imagen-producto-enlace" href="/producto.html?id=${producto.id}"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}" loading="lazy"></a>
      <span class="etiqueta-producto ${agotado ? 'etiqueta-agotado' : producto.precio_oferta ? 'etiqueta-oferta' : ''}">${etiqueta}</span>
      <div class="datos-producto"><h2>${escaparHtml(producto.nombre)}</h2><p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
      <p class="precio-producto">${producto.precio_oferta ? `<s>$${Number(producto.precio).toFixed(2)}</s> ` : ''}<strong>$${Number(precio).toFixed(2)}</strong></p>
      <a class="boton boton-principal boton-ancho ${agotado ? 'boton-desactivado' : ''}" href="/producto.html?id=${producto.id}" ${agotado ? 'aria-label="Ver detalles de ${escaparHtml(producto.nombre)}, producto agotado"' : ''}>${agotado ? 'Ver detalles' : 'Ver producto'}</a></div>
    </article>`;
  }).join('') || '<p class="sin-productos">No encontramos productos con esos criterios. Prueba otra búsqueda o filtro.</p>';
  lista.querySelectorAll('.producto-imagen').forEach(prepararImagenAlternativa);
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
  document.getElementById('buscar-producto').addEventListener('input', mostrarCatalogo);
  document.getElementById('orden-producto').addEventListener('change', mostrarCatalogo);
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
    if (!respuesta.ok) throw new Error('No se pudo cargar el catálogo.');
    productosCatalogo = await respuesta.json();
    mensaje.textContent = '';
    mostrarCatalogo();
  } catch (error) {
    mensaje.textContent = error.message || 'No se pudo cargar el catálogo.';
    mensaje.classList.add('error');
  }
}

cargarCatalogo();
