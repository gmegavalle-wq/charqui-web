function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function leerCarritoProducto() {
  try { return JSON.parse(localStorage.getItem('charqui_carrito') || '[]'); }
  catch (error) { return []; }
}

function actualizarBotonCompra(producto) {
  const boton = document.getElementById('anadir-carrito');
  if (!boton) return;
  const agregado = leerCarritoProducto().find((item) => Number(item.id) === Number(producto.id));
  const cantidad = Number(agregado?.cantidad || 0);
  const stock = Math.max(0, Number(producto.stock) || 0);
  const disponible = producto.estado === 'disponible' && stock > 0;
  const limite = cantidad >= stock;
  boton.disabled = !disponible || limite;
  boton.textContent = !disponible ? 'Producto agotado' : limite ? 'Límite de stock en el carrito' : 'Añadir al carrito';
}

function guardarEnCarrito(producto) {
  const carrito = leerCarritoProducto();
  const existente = carrito.find((item) => Number(item.id) === Number(producto.id));
  const cantidadActual = Number(existente?.cantidad || 0);
  const stock = Math.max(0, Number(producto.stock) || 0);
  const aviso = document.getElementById('mensaje-producto');
  if (producto.estado !== 'disponible' || stock < 1) {
    aviso.textContent = 'Este producto ya no está disponible. Revisa el catálogo para ver otras opciones.';
    return;
  }
  if (cantidadActual >= stock) {
    aviso.textContent = `Ya tienes las ${stock} unidades disponibles de este producto en el carrito.`;
    actualizarBotonCompra(producto);
    return;
  }
  if (existente) existente.cantidad = cantidadActual + 1;
  else carrito.push({ id: Number(producto.id), cantidad: 1 });
  localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
  window.dispatchEvent(new Event('charqui-carrito-actualizado'));
  aviso.textContent = `${producto.nombre} se añadió al carrito.`;
  aviso.classList.add('visible');
  window.setTimeout(() => aviso.classList.remove('visible'), 3500);
  actualizarBotonCompra(producto);
}

function esCompatible(mascotaActual, producto) {
  const mascotaProducto = producto.tipo_mascota;
  if (mascotaActual === 'perro' || mascotaActual === 'gato') {
    return mascotaProducto === mascotaActual || mascotaProducto === 'ambos';
  }
  return mascotaProducto === 'ambos';
}

async function cargarRelacionados(productoActual) {
  try {
    const respuesta = await fetch('/api/productos');
    if (!respuesta.ok) return;
    const productos = await respuesta.json();
    const relacionados = productos.filter((producto) =>
      Number(producto.id) !== Number(productoActual.id) &&
      producto.estado === 'disponible' && Number(producto.stock) > 0 &&
      esCompatible(productoActual.tipo_mascota, producto)
    ).slice(0, 3);
    if (!relacionados.length) return;
    const seccion = document.getElementById('seccion-relacionados');
    seccion.hidden = false;
    document.getElementById('productos-relacionados').innerHTML = relacionados.map((producto) => {
      const precio = Number(producto.precio_oferta || producto.precio);
      return `<article class="tarjeta-producto">
        <a class="imagen-producto-enlace" href="/producto.html?id=${producto.id}"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}" loading="lazy"></a>
        <div class="datos-producto"><h3>${escaparHtml(producto.nombre)}</h3><p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
        <p class="precio-producto"><strong>$${precio.toFixed(2)}</strong></p><a class="boton boton-principal boton-ancho" href="/producto.html?id=${producto.id}">Ver producto</a></div>
      </article>`;
    }).join('');
    document.querySelectorAll('#productos-relacionados .producto-imagen').forEach(prepararImagenAlternativa);
  } catch (error) {
    // El detalle del producto sigue disponible aunque no carguen las sugerencias.
  }
}

async function cargarProducto() {
  const id = new URLSearchParams(window.location.search).get('id');
  const ficha = document.getElementById('ficha-producto');
  if (!id) {
    ficha.textContent = 'No se indicó un producto.';
    return;
  }

  try {
    const respuesta = await fetch(`/api/productos/${encodeURIComponent(id)}`);
    const producto = await respuesta.json();
    if (!respuesta.ok) throw new Error(producto.error || 'No se pudo cargar el producto.');
    const precio = Number(producto.precio_oferta || producto.precio);
    const stock = Math.max(0, Number(producto.stock) || 0);
    const disponible = producto.estado === 'disponible' && stock > 0;
    document.title = `${producto.nombre} | Charqui`;
    ficha.classList.remove('error');
    ficha.innerHTML = `
      <div class="ficha-columnas"><div class="ficha-imagen"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}"></div>
      <div class="ficha-detalle"><p class="sobrelinea">SNACK NATURAL</p><h1>${escaparHtml(producto.nombre)}</h1><p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
      <p class="precio-producto">${producto.precio_oferta ? `<s>$${Number(producto.precio).toFixed(2)}</s> ` : ''}<strong>$${precio.toFixed(2)}</strong></p>
      <p class="disponibilidad ${disponible ? 'disponible' : 'agotado'}">${disponible ? `Disponible · ${stock} unidades` : 'Agotado'}</p>
      <button class="boton boton-principal" id="anadir-carrito" type="button">Añadir al carrito</button></div></div>
      <section class="informacion-nutricional"><h2>Información nutricional</h2><p>${escaparHtml(producto.info_nutricional || 'No especificada.')}</p><h3>Presentaciones</h3><p>${escaparHtml(producto.presentaciones || 'Consultar disponibilidad.')}</p></section>`;
    ficha.querySelectorAll('.producto-imagen').forEach(prepararImagenAlternativa);
    document.getElementById('anadir-carrito').addEventListener('click', () => guardarEnCarrito(producto));
    actualizarBotonCompra(producto);
    cargarRelacionados(producto);
  } catch (error) {
    ficha.textContent = error.message || 'No se pudo cargar el producto.';
    ficha.classList.add('error');
  }
}

cargarProducto();
