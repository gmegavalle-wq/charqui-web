const estados = [
  ['recibido_y_confirmado', 'Recibido y Confirmado'],
  ['en_preparacion', 'En Preparación'],
  ['en_reparto_local', 'En Reparto Local'],
  ['en_tu_puerta', 'En tu Puerta'],
  ['cancelado', 'Cancelado']
];

let fotografiaSeleccionada = null;
let urlFotografiaTemporal = '';

function escaparHtml(texto) {
  return String(texto == null ? '' : texto).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function obtenerToken() {
  return sessionStorage.getItem('charqui_token') || '';
}

async function leerRespuestaJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch (error) {
    const ruta = new URL(respuesta.url).pathname;
    const esHtml = (respuesta.headers.get('content-type') || '').includes('text/html') || /^\s*<!doctype html/i.test(texto);
    const mensaje = esHtml
      ? `El servidor devolvió una página HTML (HTTP ${respuesta.status}) para ${ruta}. Reinicia el servidor y vuelve a intentarlo.`
      : `El servidor devolvió una respuesta no válida (HTTP ${respuesta.status}) para ${ruta}.`;
    throw new Error(mensaje);
  }
}

async function pedir(url, opciones = {}) {
  const encabezados = { ...(opciones.headers || {}), Authorization: `Bearer ${obtenerToken()}` };
  if (opciones.body && !(opciones.body instanceof FormData)) encabezados['Content-Type'] = 'application/json';
  const respuesta = await fetch(url, { ...opciones, headers: encabezados });
  const datos = await leerRespuestaJson(respuesta);
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la acción.');
  return datos;
}

function mostrarMensaje(texto) {
  document.getElementById('mensaje-admin').textContent = texto;
}

function mostrarMensajeProducto(texto, esError = false) {
  const mensaje = document.getElementById('mensaje-producto-admin');
  mensaje.textContent = texto;
  mensaje.classList.toggle('error', esError);
  mensaje.classList.toggle('mensaje-exito', Boolean(texto) && !esError);
}

function mostrarFotografia(nombreArchivo = '', archivo = null) {
  const imagen = document.getElementById('previsualizacion-producto');
  const aviso = document.getElementById('aviso-previsualizacion');
  const nombre = document.getElementById('nombre-fotografia');

  if (urlFotografiaTemporal) URL.revokeObjectURL(urlFotografiaTemporal);
  urlFotografiaTemporal = '';
  imagen.hidden = true;
  imagen.removeAttribute('src');
  aviso.hidden = false;

  if (archivo) {
    urlFotografiaTemporal = URL.createObjectURL(archivo);
    imagen.onload = () => {
      imagen.hidden = false;
      aviso.hidden = true;
    };
    imagen.onerror = () => {
      imagen.hidden = true;
      aviso.textContent = 'No se pudo mostrar la vista previa de este archivo.';
    };
    imagen.src = urlFotografiaTemporal;
    nombre.textContent = `Seleccionada: ${archivo.name}`;
    return;
  }

  if (nombreArchivo && !/[\\/]/.test(nombreArchivo)) {
    imagen.onload = () => {
      imagen.hidden = false;
      aviso.hidden = true;
    };
    imagen.onerror = () => {
      imagen.hidden = true;
      aviso.textContent = 'La fotografía actual no se encuentra en frontend/img.';
    };
    imagen.src = `/img/${encodeURIComponent(nombreArchivo)}`;
    nombre.textContent = `Actual: ${nombreArchivo}`;
    return;
  }

  imagen.onload = null;
  imagen.onerror = null;
  nombre.textContent = 'Sin fotografía seleccionada';
  aviso.textContent = 'La fotografía seleccionada aparecerá aquí.';
}

function validarFotografia(archivo) {
  const extensionesPermitidas = ['jpg', 'jpeg', 'png', 'webp'];
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const extension = archivo.name.split('.').pop().toLowerCase();

  if (!extensionesPermitidas.includes(extension) || (archivo.type && !tiposPermitidos.includes(archivo.type))) {
    return 'Elige una fotografía JPG, JPEG, PNG o WEBP.';
  }
  if (archivo.size > 5 * 1024 * 1024) return 'La fotografía no puede superar los 5 MB.';
  if (!archivo.size) return 'El archivo seleccionado está vacío.';
  return '';
}

async function subirFotografia(archivo) {
  const formulario = new FormData();
  formulario.append('fotografia', archivo);
  const respuesta = await fetch('/api/productos/imagen', {
    method: 'POST',
    headers: { Authorization: `Bearer ${obtenerToken()}` },
    body: formulario
  });
  const datos = await leerRespuestaJson(respuesta);
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar la fotografía.');
  return datos.archivo;
}

function dibujarPedidos(pedidos) {
  document.getElementById('tabla-pedidos').innerHTML = pedidos.map((pedido) => {
    const productos = pedido.productos.map((item) =>
      `${escaparHtml(item.nombre)} × ${item.cantidad}`
    ).join('<br>');
    const zona = escaparHtml(pedido.zona_entrega || 'No registrada');
    const costoEnvio = pedido.costo_envio == null
      ? 'No registrado'
      : `$${Number(pedido.costo_envio).toFixed(2)}`;
    const formaPago = escaparHtml(pedido.forma_pago || 'No registrada');
    const estadoPago = pedido.pago_confirmado == null
      ? 'No disponible en la base actual'
      : Number(pedido.pago_confirmado)
        ? 'Confirmado'
        : `<button class="confirmar-pago" data-id="${pedido.id}" type="button">Confirmar pago</button>`;
    return `
    <tr><td>${pedido.id}</td><td>${escaparHtml(pedido.nombre)}<br>${escaparHtml(pedido.telefono)}</td>
    <td>${escaparHtml(pedido.fecha)}</td><td>${productos}</td><td>${escaparHtml(pedido.direccion_entrega)}</td>
    <td>${zona}<br>${costoEnvio}</td>
    <td>${formaPago}</td><td>$${Number(pedido.total).toFixed(2)}</td>
    <td>${estadoPago}</td>
    <td><select class="estado-pedido" data-id="${pedido.id}">${estados.map(([valor, etiqueta]) =>
      `<option value="${valor}" ${pedido.estado === valor ? 'selected' : ''}>${etiqueta}</option>`
    ).join('')}</select></td><td><button class="guardar-estado" data-id="${pedido.id}" type="button">Guardar estado</button></td></tr>`
  }).join('');

  document.querySelectorAll('.confirmar-pago').forEach((boton) => {
    boton.addEventListener('click', async () => {
      try {
        await pedir(`/api/pedidos/${boton.dataset.id}/pago`, { method: 'PUT' });
        await cargarPanel();
      } catch (error) { mostrarMensaje(error.message); }
    });
  });
  document.querySelectorAll('.guardar-estado').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const selector = document.querySelector(`.estado-pedido[data-id="${boton.dataset.id}"]`);
      if (selector.value === 'cancelado' && !window.confirm('¿Cancelar este pedido?')) return;
      try {
        await pedir(`/api/pedidos/${boton.dataset.id}/estado`, {
          method: 'PUT', body: JSON.stringify({ estado: selector.value })
        });
        await cargarPanel();
      } catch (error) { mostrarMensaje(error.message); }
    });
  });
}

function dibujarProductos(productos) {
  document.getElementById('tabla-productos').innerHTML = productos.map((producto) => `
    <tr><td>${escaparHtml(producto.nombre)}</td><td>$${Number(producto.precio_oferta || producto.precio).toFixed(2)}</td>
    <td>${producto.stock}</td><td>${escaparHtml(producto.tipo_mascota)}</td><td>${escaparHtml(producto.estado)}</td>
    <td><button class="editar-producto" data-id="${producto.id}" type="button">Editar</button>
    <button class="eliminar-producto" data-id="${producto.id}" type="button">Eliminar</button></td></tr>`
  ).join('');
  document.querySelectorAll('.editar-producto').forEach((boton) => {
    boton.addEventListener('click', () => editarProducto(productos.find((item) => item.id === Number(boton.dataset.id))));
  });
  document.querySelectorAll('.eliminar-producto').forEach((boton) => {
    boton.addEventListener('click', async () => {
      if (!window.confirm('¿Eliminar este producto?')) return;
      try {
        await pedir(`/api/productos/${boton.dataset.id}`, { method: 'DELETE' });
        await cargarPanel();
      } catch (error) { document.getElementById('mensaje-producto-admin').textContent = error.message; }
    });
  });
}

function editarProducto(producto) {
  document.getElementById('producto-id').value = producto.id;
  document.getElementById('producto-nombre').value = producto.nombre;
  document.getElementById('producto-descripcion').value = producto.descripcion;
  document.getElementById('producto-precio').value = producto.precio;
  document.getElementById('producto-oferta').value = producto.precio_oferta || '';
  document.getElementById('producto-stock').value = producto.stock;
  document.getElementById('producto-mascota').value = producto.tipo_mascota;
  document.getElementById('producto-nutricion').value = producto.info_nutricional || '';
  document.getElementById('producto-presentaciones').value = producto.presentaciones || '';
  document.getElementById('producto-imagen').value = producto.imagen || '';
  document.getElementById('producto-estado').value = producto.estado;
  fotografiaSeleccionada = null;
  document.getElementById('archivo-fotografia').value = '';
  mostrarFotografia(producto.imagen || '');
  mostrarMensajeProducto('');
  document.getElementById('producto-nombre').focus();
}

async function cargarPanel() {
  try {
    const [pedidos, productos, clientes] = await Promise.all([
      pedir('/api/pedidos'), pedir('/api/productos?todos=1'), pedir('/api/clientes')
    ]);
    dibujarPedidos(pedidos);
    dibujarProductos(productos);
    document.getElementById('tabla-clientes').innerHTML = clientes.map((cliente) =>
      `<tr><td>${escaparHtml(cliente.nombre)}</td><td>${escaparHtml(cliente.correo)}</td><td>${escaparHtml(cliente.telefono)}</td></tr>`
    ).join('');
    document.getElementById('acceso-admin').hidden = true;
    document.getElementById('panel-admin').hidden = false;
  } catch (error) {
    sessionStorage.removeItem('charqui_token');
    document.getElementById('panel-admin').hidden = true;
    document.getElementById('acceso-admin').hidden = false;
    mostrarMensaje(error.message);
  }
}

document.getElementById('formulario-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: document.getElementById('correo-admin').value,
        contrasena: document.getElementById('contrasena-admin').value
      })
    });
    const datos = await leerRespuestaJson(respuesta);
    if (!respuesta.ok) throw new Error(datos.error);
    sessionStorage.setItem('charqui_token', datos.token);
    mostrarMensaje('');
    await cargarPanel();
  } catch (error) { mostrarMensaje(error.message || 'No se pudo iniciar sesión.'); }
});

document.getElementById('formulario-producto').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const id = document.getElementById('producto-id').value;
  const datos = {
    nombre: document.getElementById('producto-nombre').value.trim(),
    descripcion: document.getElementById('producto-descripcion').value.trim(),
    precio: document.getElementById('producto-precio').value,
    precio_oferta: document.getElementById('producto-oferta').value,
    stock: document.getElementById('producto-stock').value,
    tipo_mascota: document.getElementById('producto-mascota').value,
    info_nutricional: document.getElementById('producto-nutricion').value.trim(),
    presentaciones: document.getElementById('producto-presentaciones').value.trim(),
    imagen: document.getElementById('producto-imagen').value.trim(),
    estado: document.getElementById('producto-estado').value
  };
  const botonGuardar = document.querySelector('#formulario-producto [type="submit"]');
  botonGuardar.disabled = true;
  try {
    if (fotografiaSeleccionada) {
      datos.imagen = await subirFotografia(fotografiaSeleccionada);
      document.getElementById('producto-imagen').value = datos.imagen;
      fotografiaSeleccionada = null;
      mostrarFotografia(datos.imagen);
    }
    await pedir(id ? `/api/productos/${id}` : '/api/productos', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(datos)
    });
    document.getElementById('formulario-producto').reset();
    document.getElementById('producto-id').value = '';
    fotografiaSeleccionada = null;
    mostrarFotografia();
    mostrarMensajeProducto('Producto guardado correctamente.');
    await cargarPanel();
  } catch (error) {
    mostrarMensajeProducto(error.message, true);
  } finally {
    botonGuardar.disabled = false;
  }
});

document.getElementById('archivo-fotografia').addEventListener('change', (evento) => {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const error = validarFotografia(archivo);
  if (error) {
    evento.target.value = '';
    document.getElementById('error-fotografia').textContent = error;
    return;
  }

  document.getElementById('error-fotografia').textContent = '';
  fotografiaSeleccionada = archivo;
  mostrarFotografia('', archivo);
});

document.getElementById('limpiar-producto').addEventListener('click', () => {
  document.getElementById('formulario-producto').reset();
  document.getElementById('producto-id').value = '';
  document.getElementById('error-fotografia').textContent = '';
  fotografiaSeleccionada = null;
  mostrarFotografia();
  mostrarMensajeProducto('');
});

document.getElementById('cerrar-sesion').addEventListener('click', () => {
  sessionStorage.removeItem('charqui_token');
  document.getElementById('panel-admin').hidden = true;
  document.getElementById('acceso-admin').hidden = false;
});

if (obtenerToken()) cargarPanel();
