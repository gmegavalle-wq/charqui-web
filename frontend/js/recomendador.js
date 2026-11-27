let productosRecomendador = [];
let pasoRecomendador = 0;

const ingredientesConocidos = [
  ['pollo', 'Pollo'], ['res', 'Res'], ['albacora', 'Pescado (albacora)'], ['pescado', 'Pescado (albacora)'],
  ['higado', 'Hígado'], ['corazon', 'Corazón'], ['pulmon', 'Pulmón'],
  ['manzana', 'Manzana'], ['canela', 'Canela'], ['perejil', 'Perejil'], ['traquea', 'Tráquea']
];

function escaparHtmlRecomendador(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarTextoRecomendador(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function aplicaMascota(producto, mascota) {
  return producto.tipo_mascota === mascota || producto.tipo_mascota === 'ambos';
}

function sonPatitasDePollo(producto) {
  const textos = `${producto.descripcion || ''}\n${producto.info_nutricional || ''}`;
  return /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?ingredientes(?: principales)?(?:\*\*)?\s*:[^\n]*\bpatitas de pollo\b/i.test(textos);
}

// Solo lee ingredientes escritos explícitamente en la ficha del producto.
function leerIngredientes(producto) {
  const textos = `${producto.descripcion || ''}\n${producto.info_nutricional || ''}`;
  const lineas = [...textos.matchAll(/^\s*(?:[-*]\s*)?(?:\*\*)?ingredientes(?: principales)?(?:\*\*)?\s*:\s*([^\n]+)/gim)];
  const encontrados = new Set();
  let otros = false;

  for (const coincidencia of lineas) {
    const lista = coincidencia[1]
      .replace(/,\s*(?:adem[aá]s de|junto con|junto a).*/i, '')
      .replace(/\b100\s*%\s*/gi, '')
      .replace(/[.;]+$/g, '');
    const partes = lista.split(/\s+y\s+|,\s*/i).map((parte) => parte.trim()).filter(Boolean);

    for (const parte of partes) {
      const parteNormalizada = normalizarTextoRecomendador(parte);
      const categorias = ingredientesConocidos
        .filter(([clave]) => parteNormalizada.includes(clave))
        .map(([, nombre]) => nombre);
      if (categorias.length) categorias.forEach((nombre) => encontrados.add(nombre));
      else otros = true;
    }
  }
  return { nombres: [...encontrados], otros };
}

function productosDeMascota(mascota) {
  return productosRecomendador.filter((producto) => aplicaMascota(producto, mascota));
}

function mostrarEspecies() {
  const especies = [
    ['perro', 'Perro'], ['gato', 'Gato']
  ].filter(([mascota]) => productosRecomendador.some((producto) => aplicaMascota(producto, mascota)));

  document.getElementById('opciones-mascota').innerHTML = especies.map(([valor, nombre]) => `
    <label class="opcion-recomendador"><input type="radio" name="mascota-recomendada" value="${valor}"> ${nombre}</label>`).join('');
}

function mostrarIngredientes() {
  const mascota = document.querySelector('input[name="mascota-recomendada"]:checked')?.value;
  const productos = mascota ? productosDeMascota(mascota) : productosRecomendador;
  const opciones = new Set();
  let existenOtros = false;

  productos.forEach((producto) => {
    const datos = leerIngredientes(producto);
    datos.nombres.forEach((nombre) => opciones.add(nombre));
    if (datos.otros) existenOtros = true;
  });

  const selector = document.getElementById('preferencia-ingrediente');
  const seleccionAnterior = selector.value;
  const lista = [...opciones].sort((a, b) => a.localeCompare(b, 'es'));
  if (existenOtros) lista.push('Otros ingredientes');
  selector.innerHTML = '<option value="sin_preferencia">Sin preferencia</option>' + lista.map((nombre) => {
    const valor = nombre === 'Otros ingredientes' ? 'otros_ingredientes' : normalizarTextoRecomendador(nombre);
    return `<option value="${escaparHtmlRecomendador(valor)}">${escaparHtmlRecomendador(nombre)}</option>`;
  }).join('');
  if ([...selector.options].some((opcion) => opcion.value === seleccionAnterior)) selector.value = seleccionAnterior;
}

function mostrarPaso() {
  const preguntas = [
    document.getElementById('pregunta-mascota'),
    document.getElementById('pregunta-textura'),
    document.getElementById('pregunta-ingrediente')
  ];
  preguntas.forEach((pregunta, indice) => { pregunta.hidden = indice !== pasoRecomendador; });
  document.querySelectorAll('#recomendador-progreso li').forEach((elemento, indice) => {
    elemento.classList.toggle('activo', indice <= pasoRecomendador);
    if (indice === pasoRecomendador) elemento.setAttribute('aria-current', 'step');
    else elemento.removeAttribute('aria-current');
  });
  document.getElementById('paso-anterior').disabled = pasoRecomendador === 0;
  document.getElementById('paso-siguiente').hidden = pasoRecomendador === 2;
  document.getElementById('buscar-recomendaciones').hidden = pasoRecomendador !== 2;
  document.getElementById('error-recomendador').textContent = '';
}

function mascotaElegida() {
  return document.querySelector('input[name="mascota-recomendada"]:checked')?.value || '';
}

function crearTarjeta(producto) {
  const nombre = escaparHtmlRecomendador(producto.nombre);
  const descripcion = String(producto.descripcion || '').split(/\n+/).map((parte) => parte.trim()).find(Boolean) || '';
  const precioActual = Number(producto.precio_oferta || producto.precio);
  const tieneOferta = producto.precio_oferta != null && Number(producto.precio_oferta) < Number(producto.precio);
  const foto = producto.imagen ? `/img/${encodeURIComponent(producto.imagen)}` : '';
  const carrito = leerCarrito();
  const agregado = carrito.find((item) => Number(item.id) === Number(producto.id));
  const limiteAlcanzado = Number(agregado?.cantidad || 0) >= Number(producto.stock);
  return `<article class="tarjeta-producto tarjeta-recomendacion">
    <a class="imagen-producto-enlace" href="/producto.html?id=${encodeURIComponent(producto.id)}">
      <img class="producto-imagen" src="${foto}" alt="${nombre}">
    </a>
    <div class="datos-producto">
      <h3>${nombre}</h3>
      <p class="descripcion-producto">${escaparHtmlRecomendador(descripcion.slice(0, 150))}${descripcion.length > 150 ? '…' : ''}</p>
      <p class="precio-producto">${tieneOferta ? `<s>$${Number(producto.precio).toFixed(2)}</s> ` : ''}<strong>$${precioActual.toFixed(2)}</strong></p>
      <p class="disponibilidad disponible">Disponible · ${Number(producto.stock)} unidades</p>
      <a class="boton boton-borde boton-ancho" href="/producto.html?id=${encodeURIComponent(producto.id)}">Ver producto</a>
      <button class="boton boton-principal boton-ancho agregar-recomendacion" data-id="${producto.id}" type="button" ${limiteAlcanzado ? 'disabled' : ''}>${limiteAlcanzado ? 'Límite de stock en el carrito' : 'Agregar al carrito'}</button>
    </div>
  </article>`;
}

function leerCarrito() {
  try { return JSON.parse(localStorage.getItem('charqui_carrito') || '[]'); }
  catch (error) { return []; }
}

function obtenerCoincidencias() {
  const mascota = mascotaElegida();
  const textura = document.querySelector('input[name="textura-recomendada"]:checked')?.value || 'sin_preferencia';
  const ingrediente = document.getElementById('preferencia-ingrediente').value;

  const compatibles = productosRecomendador.filter((producto) => {
    if (!aplicaMascota(producto, mascota)) return false;
    if (textura !== 'sin_preferencia' && producto.textura !== textura) return false;
    if (ingrediente === 'sin_preferencia') return true;
    const ingredientes = leerIngredientes(producto);
    if (ingrediente === 'otros_ingredientes') return ingredientes.otros;
    return ingredientes.nombres.some((nombre) => normalizarTextoRecomendador(nombre) === ingrediente);
  });

  // La prioridad se aplica solo a productos que ya cumplen todos los filtros.
  return compatibles.sort((productoA, productoB) =>
    Number(esProductoPrioritario(productoB) || sonPatitasDePollo(productoB)) -
    Number(esProductoPrioritario(productoA) || sonPatitasDePollo(productoA))
  );
}

function mostrarResultados() {
  const coincidencias = obtenerCoincidencias();
  const lista = document.getElementById('tarjetas-recomendador');
  const mensaje = document.getElementById('mensaje-resultados-recomendador');
  lista.innerHTML = coincidencias.map(crearTarjeta).join('');
  if (coincidencias.length) {
    mensaje.textContent = '¡Encontramos algunas opciones para tu mascota!';
    lista.querySelectorAll('.producto-imagen').forEach(prepararImagenAlternativa);
  } else {
    mensaje.textContent = 'No encontramos una coincidencia exacta. Prueba cambiando alguna de tus preferencias para descubrir otras opciones.';
  }
  document.getElementById('recomendador-cuestionario').hidden = true;
  document.getElementById('resultados-recomendador').hidden = false;
  document.getElementById('aviso-recomendador').textContent = '';
}

async function agregarRecomendacion(id, boton) {
  const aviso = document.getElementById('aviso-recomendador');
  boton.disabled = true;
  try {
    const respuesta = await fetch(`/api/productos/${encodeURIComponent(id)}`);
    const producto = await respuesta.json();
    if (!respuesta.ok || producto.estado !== 'disponible' || Number(producto.stock) < 1) {
      throw new Error('Este producto ya no tiene unidades disponibles. Actualiza las recomendaciones.');
    }

    const carrito = leerCarrito();
    const existente = carrito.find((item) => Number(item.id) === Number(producto.id));
    const cantidadActual = Number(existente?.cantidad || 0);
    if (cantidadActual >= Number(producto.stock)) {
      throw new Error(`Ya tienes en el carrito todas las unidades disponibles de ${producto.nombre}.`);
    }
    if (existente) existente.cantidad = cantidadActual + 1;
    else carrito.push({ id: Number(producto.id), cantidad: 1 });
    localStorage.setItem('charqui_carrito', JSON.stringify(carrito));
    window.dispatchEvent(new Event('charqui-carrito-actualizado'));
    aviso.textContent = `${producto.nombre} se agregó al carrito.`;
    const nuevaCantidad = cantidadActual + 1;
    boton.disabled = nuevaCantidad >= Number(producto.stock);
    boton.textContent = boton.disabled ? 'Límite de stock en el carrito' : 'Agregar otra unidad';
  } catch (error) {
    aviso.textContent = error.message || 'No se pudo agregar el producto al carrito.';
    boton.disabled = false;
  }
}

function iniciarRecomendador() {
  const form = document.getElementById('formulario-recomendador');
  document.getElementById('paso-siguiente').addEventListener('click', () => {
    if (pasoRecomendador === 0 && !mascotaElegida()) {
      document.getElementById('error-recomendador').textContent = 'Selecciona para quién buscas el snack.';
      return;
    }
    if (pasoRecomendador < 2) pasoRecomendador += 1;
    if (pasoRecomendador === 2) mostrarIngredientes();
    mostrarPaso();
  });
  document.getElementById('paso-anterior').addEventListener('click', () => {
    if (pasoRecomendador > 0) pasoRecomendador -= 1;
    mostrarPaso();
  });
  document.getElementById('opciones-mascota').addEventListener('change', mostrarIngredientes);
  form.addEventListener('submit', (evento) => { evento.preventDefault(); mostrarResultados(); });
  document.getElementById('editar-preferencias').addEventListener('click', () => {
    document.getElementById('resultados-recomendador').hidden = true;
    document.getElementById('recomendador-cuestionario').hidden = false;
    pasoRecomendador = 0;
    mostrarPaso();
  });
  document.getElementById('tarjetas-recomendador').addEventListener('click', (evento) => {
    const boton = evento.target.closest('.agregar-recomendacion');
    if (boton) agregarRecomendacion(boton.dataset.id, boton);
  });

  fetch('/api/productos')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error('No pudimos consultar el catálogo.');
      return respuesta.json();
    })
    .then((productos) => {
      productosRecomendador = productos.filter((producto) =>
        producto.estado === 'disponible' && Number(producto.stock) > 0
      );
      document.getElementById('recomendador-cargando').hidden = true;
      if (!productosRecomendador.length) {
        document.getElementById('recomendador-cargando').textContent = 'Por ahora no hay productos disponibles para recomendar.';
        document.getElementById('recomendador-cargando').hidden = false;
        return;
      }
      mostrarEspecies();
      mostrarIngredientes();
      mostrarPaso();
      document.getElementById('recomendador-cuestionario').hidden = false;
    })
    .catch(() => {
      const mensaje = document.getElementById('recomendador-cargando');
      mensaje.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo más tarde.';
      mensaje.classList.add('error');
    });
}

iniciarRecomendador();
