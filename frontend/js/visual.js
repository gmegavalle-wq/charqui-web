
function mejorarAccesibilidadComun() {
  const principal = document.querySelector('main');
  if (principal) {
    if (!principal.id) principal.id = 'contenido-principal';
    principal.tabIndex = -1;
  }
  if (document.querySelector('.enlace-saltar')) return;
  const enlace = document.createElement('a');
  enlace.className = 'enlace-saltar';
  enlace.href = principal ? `#${principal.id}` : '#';
  enlace.textContent = 'Saltar al contenido principal';
  document.body.insertBefore(enlace, document.body.firstChild);
  document.querySelectorAll('.tabla-contenedor').forEach((tabla) => {
    tabla.tabIndex = 0;
    tabla.setAttribute('role', 'region');
    if (!tabla.hasAttribute('aria-label')) tabla.setAttribute('aria-label', 'Tabla desplazable; usa el desplazamiento horizontal para ver todas las columnas.');
  });
}

mejorarAccesibilidadComun();
const NUMERO_WHATSAPP = '593994324874';
window.NUMERO_WHATSAPP = NUMERO_WHATSAPP;

function actualizarContadorCarrito() {
  let cantidad = 0;
  try {
    const carrito = JSON.parse(localStorage.getItem('charqui_carrito') || '[]');
    cantidad = carrito.reduce((total, producto) => total + Math.max(0, Number(producto.cantidad) || 0), 0);
  } catch (error) {
    cantidad = 0;
  }

  const contador = document.getElementById('contador-carrito');
  const enlace = document.querySelector('.enlace-carrito');
  if (contador) contador.textContent = cantidad;
  if (enlace) enlace.setAttribute('aria-label', `Carrito, ${cantidad} productos`);
}

actualizarContadorCarrito();
window.addEventListener('storage', actualizarContadorCarrito);
window.addEventListener('charqui-carrito-actualizado', actualizarContadorCarrito);

document.querySelectorAll('[data-whatsapp]').forEach((enlace) => {
  enlace.href = `https://wa.me/${window.NUMERO_WHATSAPP}`;
});

document.querySelectorAll('.logo-imagen').forEach((imagen) => {
  imagen.addEventListener('error', () => {
    imagen.hidden = true;
  });
  if (imagen.complete && imagen.naturalWidth === 0) imagen.hidden = true;
});

function prepararImagenAlternativa(imagen) {
  imagen.addEventListener('error', () => {
    const alternativa = document.createElement('span');
    alternativa.className = 'imagen-alternativa';
    alternativa.setAttribute('role', 'img');
    alternativa.setAttribute('aria-label', `Fotografía no disponible para ${imagen.alt || 'este producto'}`);
    alternativa.textContent = 'Fotografía no disponible';
    imagen.replaceWith(alternativa);
  }, { once: true });
}

function esProductoPrioritario(producto) {
  const idConfigurado = Number(window.CHARQUI_PRODUCTO_PRIORITARIO_ID);
  if (Number.isSafeInteger(idConfigurado) && idConfigurado > 0 &&
      Number(producto.id) === idConfigurado) return true;

  const normalizar = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const nombre = normalizar(producto.nombre);
  const descripcion = normalizar(producto.descripcion);
  const archivoImagen = normalizar(String(producto.imagen || '').split(/[\\/]/).pop());
  const patronProducto = /\bpatitas?\b.{0,30}\bpollo\b|\bpollo\b.{0,30}\bpatitas?\b/;

  return patronProducto.test(nombre) || patronProducto.test(descripcion) ||
    /\bpatitas?\s+pollo\b/.test(nombre) || /patitas?\s+pollo/.test(archivoImagen);
}

if ('IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visible');
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.revelar').forEach((elemento) => {
    elemento.classList.add('revelar-listo');
    observador.observe(elemento);
  });
}
