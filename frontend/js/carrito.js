function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function obtenerCarrito() {
  try { return JSON.parse(localStorage.getItem('charqui_carrito') || '[]'); }
  catch (error) { return []; }
}

function guardarCarrito(carrito) {
  localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
  window.dispatchEvent(new Event('charqui-carrito-actualizado'));
}

async function leerJson(respuesta) {
  try { return await respuesta.json(); }
  catch (error) { return {}; }
}

async function mostrarCarrito() {
  const contenedor = document.getElementById('carrito');
  const mensaje = document.getElementById('mensaje-carrito');
  const continuar = document.getElementById('continuar-pedido');
  const carrito = obtenerCarrito();
  continuar.setAttribute('aria-disabled', 'true');
  continuar.classList.add('boton-desactivado');
  mensaje.textContent = '';
  mensaje.classList.remove('error');
  if (!carrito.length) {
    contenedor.innerHTML = '<div class="carrito-vacio"><span aria-hidden="true">♡</span><h2>Tu carrito está vacío</h2><p>Encuentra un snack natural para tu compañero.</p><a class="boton boton-principal" href="/catalogo.html">Ir al catálogo</a></div>';
    document.getElementById('resumen-carrito').hidden = true;
    return;
  }

  try {
    document.getElementById('resumen-carrito').hidden = false;
    const lineas = await Promise.all(carrito.map(async (item) => {
      try {
        const respuesta = await fetch(`/api/productos/${item.id}`);
        const producto = await leerJson(respuesta);
        if (!respuesta.ok) return { ...item, producto: null, error: producto.error };
        return { ...item, producto };
      } catch (error) {
        return { ...item, producto: null, error: 'No se pudo consultar este producto.' };
      }
    }));
    const validas = lineas.filter((item) => item.producto);
    const problemas = lineas.filter((item) => {
      if (!item.producto) return true;
      return item.producto.estado !== 'disponible' || Number(item.producto.stock) < 1 || Number(item.cantidad) > Number(item.producto.stock);
    });
    const subtotal = validas.reduce((suma, item) =>
      suma + Number(item.producto.precio_oferta || item.producto.precio) * Number(item.cantidad || 0), 0
    );
    contenedor.innerHTML = `<div class="lista-carrito">${lineas.map((item) => {
      if (!item.producto) return `<article class="linea-carrito linea-carrito-problema"><div class="datos-linea-carrito"><h2>Producto no disponible</h2><p>${escaparHtml(item.error || 'No se encontró en el catálogo actual.')} Puedes quitarlo del carrito para continuar.</p></div><div class="total-linea-carrito"><button class="boton-texto quitar-carrito" data-id="${Number(item.id)}" type="button">Quitar producto</button></div></article>`;
      const producto = item.producto;
      const precio = Number(producto.precio_oferta || producto.precio);
      const stock = Math.max(0, Number(producto.stock) || 0);
      const agotado = producto.estado !== 'disponible' || stock < 1;
      const superaStock = !agotado && Number(item.cantidad) > stock;
      const avisoStock = agotado ? 'Este producto está agotado. Quítalo del carrito para continuar.' : superaStock ? `Solo hay ${stock} unidades disponibles. Ajusta la cantidad para continuar.` : '';
      return `<article class="linea-carrito ${avisoStock ? 'linea-carrito-problema' : ''}"><div class="imagen-carrito-marco"><img class="imagen-carrito" src="/img/${encodeURIComponent(producto.imagen || '')}" alt="${escaparHtml(producto.nombre)}"></div>
        <div class="datos-linea-carrito"><h2>${escaparHtml(producto.nombre)}</h2><p>$${precio.toFixed(2)} por unidad</p>
        <label class="etiqueta-cantidad" for="cantidad-${Number(item.id)}">Cantidad</label><input id="cantidad-${Number(item.id)}" class="cantidad-carrito" data-id="${Number(item.id)}" type="number" min="1" max="${stock}" value="${Number(item.cantidad) || 1}" ${agotado ? 'disabled' : ''} aria-label="Cantidad de ${escaparHtml(producto.nombre)}" aria-describedby="stock-${Number(item.id)}">
        <p id="stock-${Number(item.id)}" class="aviso-stock" ${avisoStock ? 'role="status"' : ''}>${avisoStock || `Disponible: ${stock} unidades.`}</p></div>
        <div class="total-linea-carrito"><strong>$${(precio * Number(item.cantidad || 0)).toFixed(2)}</strong><button class="boton-texto quitar-carrito" data-id="${Number(item.id)}" type="button">Eliminar</button></div></article>`;
    }).join('')}</div>`;
    contenedor.querySelectorAll('.imagen-carrito').forEach(prepararImagenAlternativa);
    document.getElementById('total-carrito').textContent = `$${subtotal.toFixed(2)}`;

    const respuestaEnvio = await fetch('/api/envios');
    const configuracion = await leerJson(respuestaEnvio);
    if (!respuestaEnvio.ok) throw new Error(configuracion.error || 'No se pudo cargar la configuración de entrega.');
    const umbral = Number(configuracion.envio_gratis_desde);
    const zonasGratis = Array.isArray(configuracion.zonas_envio_gratis) ? configuracion.zonas_envio_gratis : [];
    const mensajeEnvio = zonasGratis.length && Number.isFinite(umbral)
      ? `El envío se calcula según tu zona. En ${zonasGratis.join(', ')} puede ser gratis desde $${umbral.toFixed(2)}; verás el costo exacto al elegir la zona.`
      : 'El envío se calcula según tu zona; verás el costo exacto antes de confirmar el pedido.';
    mensaje.textContent = problemas.length
      ? `${problemas.length} producto${problemas.length === 1 ? ' requiere' : 's requieren'} atención antes de continuar. ${mensajeEnvio}`
      : mensajeEnvio;
    document.getElementById('opciones-pago').textContent = (configuracion.formas_pago || []).join(', ');
    continuar.setAttribute('aria-disabled', String(problemas.length > 0));
    continuar.classList.toggle('boton-desactivado', problemas.length > 0);
    enlazarCambios();
  } catch (error) {
    mensaje.textContent = error.message || 'No se pudo cargar el carrito. Inténtalo de nuevo.';
    mensaje.classList.add('error');
    continuar.setAttribute('aria-disabled', 'true');
    continuar.classList.add('boton-desactivado');
  }
}

function enlazarCambios() {
  document.querySelectorAll('.cantidad-carrito').forEach((campo) => {
    campo.addEventListener('change', () => {
      const carrito = obtenerCarrito();
      const item = carrito.find((producto) => producto.id === Number(campo.dataset.id));
      const maximo = Number(campo.max);
      let cantidad = Number(campo.value);
      if (!Number.isInteger(cantidad) || cantidad < 1) cantidad = 1;
      if (Number.isFinite(maximo) && cantidad > maximo) cantidad = maximo;
      campo.value = cantidad;
      if (item) item.cantidad = cantidad;
      guardarCarrito(carrito);
      mostrarCarrito();
    });
  });
  document.querySelectorAll('.quitar-carrito').forEach((boton) => {
    boton.addEventListener('click', () => {
      guardarCarrito(obtenerCarrito().filter((item) => item.id !== Number(boton.dataset.id)));
      mostrarCarrito();
    });
  });
}
document.getElementById('continuar-pedido').addEventListener('click', (evento) => {
  if (evento.currentTarget.getAttribute('aria-disabled') === 'true') {
    evento.preventDefault();
    document.getElementById('mensaje-carrito').focus();
  }
});

mostrarCarrito();
