function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function obtenerCarrito() {
  return JSON.parse(localStorage.getItem('charqui_carrito') || '[]');
}

function guardarCarrito(carrito) {
  localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
  window.dispatchEvent(new Event('charqui-carrito-actualizado'));
}

async function mostrarCarrito() {
  const contenedor = document.getElementById('carrito');
  const mensaje = document.getElementById('mensaje-carrito');
  const carrito = obtenerCarrito();
  if (!carrito.length) {
    contenedor.innerHTML = '<div class="carrito-vacio"><span aria-hidden="true">♡</span><h2>Tu carrito está vacío</h2><p>Encuentra un snack natural para tu compañero.</p><a class="boton boton-principal" href="/catalogo.html">Ir al catálogo</a></div>';
    mensaje.textContent = '';
    document.getElementById('resumen-carrito').hidden = true;
    return;
  }

  try {
    document.getElementById('resumen-carrito').hidden = false;
    const lineas = await Promise.all(carrito.map(async (item) => {
      const respuesta = await fetch(`/api/productos/${item.id}`);
      const producto = await respuesta.json();
      if (!respuesta.ok) return null;
      return { ...item, producto };
    }));
    const validas = lineas.filter(Boolean);
    const subtotal = validas.reduce((suma, item) =>
      suma + Number(item.producto.precio_oferta || item.producto.precio) * item.cantidad, 0
    );
    contenedor.innerHTML = `<div class="lista-carrito">${validas.map((item) => {
        const precio = Number(item.producto.precio_oferta || item.producto.precio);
        return `<article class="linea-carrito"><img class="imagen-carrito" src="/img/${encodeURIComponent(item.producto.imagen || '')}" alt="${escaparHtml(item.producto.nombre)}">
          <div class="datos-linea-carrito"><h2>${escaparHtml(item.producto.nombre)}</h2><p>$${precio.toFixed(2)} por unidad</p>
          <label class="etiqueta-cantidad" for="cantidad-${item.id}">Cantidad</label><input id="cantidad-${item.id}" class="cantidad-carrito" data-id="${item.id}" type="number" min="1" max="${item.producto.stock}" value="${item.cantidad}" aria-label="Cantidad de ${escaparHtml(item.producto.nombre)}"></div>
          <div class="total-linea-carrito"><strong>$${(precio * item.cantidad).toFixed(2)}</strong><button class="boton-texto quitar-carrito" data-id="${item.id}" type="button">Eliminar</button></div></article>`;
      }).join('')}</div>`;
    document.getElementById('total-carrito').textContent = `$${subtotal.toFixed(2)}`;
    const respuestaEnvio = await fetch('/api/envios');
    const configuracion = await respuestaEnvio.json();
    if (subtotal >= Number(configuracion.envio_gratis_desde)) {
      mensaje.textContent = 'Tu pedido puede tener envío gratis en el Sur de Quito.';
    } else {
      const falta = Math.max(0, Number(configuracion.envio_gratis_desde) - subtotal);
      mensaje.textContent = `Agrega $${falta.toFixed(2)} para alcanzar el envío gratis en el Sur de Quito.`;
    }
    document.getElementById('opciones-pago').textContent = (configuracion.formas_pago || []).join(', ');
    mensaje.classList.remove('error');
    enlazarCambios();
  } catch (error) {
    mensaje.textContent = 'No se pudo cargar el carrito.';
    mensaje.classList.add('error');
  }
}

function enlazarCambios() {
  document.querySelectorAll('.cantidad-carrito').forEach((campo) => {
    campo.addEventListener('change', () => {
      const carrito = obtenerCarrito();
      const item = carrito.find((producto) => producto.id === Number(campo.dataset.id));
      if (item) item.cantidad = Math.max(1, Number(campo.value) || 1);
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

mostrarCarrito();
