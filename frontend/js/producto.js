function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function guardarEnCarrito(producto) {
  const carrito = JSON.parse(localStorage.getItem('charqui_carrito') || '[]');
  const existente = carrito.find((item) => item.id === producto.id);

  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ id: producto.id, cantidad: 1 });
  }
  localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
  window.dispatchEvent(new Event('charqui-carrito-actualizado'));
  const aviso = document.getElementById('mensaje-producto');
  aviso.textContent = 'Producto añadido al carrito.';
  aviso.classList.add('visible');
  window.setTimeout(() => aviso.classList.remove('visible'), 3000);
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
    if (!respuesta.ok) throw new Error(producto.error);
    ficha.classList.remove('error');
    const precio = producto.precio_oferta || producto.precio;
    ficha.innerHTML = `
      <div class="ficha-columnas"><div class="ficha-imagen"><img class="producto-imagen" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}"></div>
      <div class="ficha-detalle"><p class="sobrelinea">SNACK NATURAL</p><h1>${escaparHtml(producto.nombre)}</h1><p class="descripcion-producto">${escaparHtml(producto.descripcion)}</p>
      <p class="precio-producto">${producto.precio_oferta ? `<s>$${Number(producto.precio).toFixed(2)}</s> ` : ''}<strong>$${Number(precio).toFixed(2)}</strong></p>
      <p class="disponibilidad ${Number(producto.stock) > 0 ? 'disponible' : 'agotado'}">${Number(producto.stock) > 0 ? 'Disponible' : 'Agotado'}</p>
      <button class="boton boton-principal" id="anadir-carrito" type="button" ${Number(producto.stock) < 1 ? 'disabled' : ''}>Añadir al carrito</button></div></div>
      <section class="informacion-nutricional"><h2>Información nutricional</h2><p>${escaparHtml(producto.info_nutricional || 'No especificada.')}</p><h3>Presentaciones</h3><p>${escaparHtml(producto.presentaciones || 'Consultar disponibilidad.')}</p></section>`;
    document.getElementById('anadir-carrito').addEventListener('click', () => guardarEnCarrito(producto));
  } catch (error) {
    ficha.textContent = 'No se pudo cargar el producto.';
    ficha.classList.add('error');
  }
}

cargarProducto();
