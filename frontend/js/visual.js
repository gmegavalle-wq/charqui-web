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
