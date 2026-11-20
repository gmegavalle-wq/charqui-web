const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');

const rutas = express.Router();
const tamanioMaximoFotografia = 5 * 1024 * 1024;
const carpetaImagenes = path.resolve(__dirname, '..', '..', 'frontend', 'img');

function leerCuerpoFotografia(req, res, siguiente) {
  const leerCuerpo = express.raw({
    type: 'multipart/form-data',
    limit: tamanioMaximoFotografia + 64 * 1024
  });

  leerCuerpo(req, res, (error) => {
    if (error) {
      const estado = error.status === 413 ? 413 : 400;
      const mensaje = estado === 413
        ? 'La fotografía supera el tamaño máximo permitido de 5 MB.'
        : 'No se pudo leer la fotografía enviada.';
      return res.status(estado).json({ error: mensaje });
    }
    siguiente();
  });
}

function extraerFotografia(cuerpo, tipoContenido) {
  const coincidencia = String(tipoContenido || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const limite = coincidencia && (coincidencia[1] || coincidencia[2]).trim();
  if (!Buffer.isBuffer(cuerpo) || !limite || !/^[0-9A-Za-z'()+_,.\/:=?-]{1,70}$/.test(limite)) {
    return null;
  }

  const separador = Buffer.from(`--${limite}`);
  const salto = Buffer.from('\r\n');
  if (!cuerpo.subarray(0, separador.length).equals(separador) ||
      !cuerpo.subarray(separador.length, separador.length + 2).equals(salto)) {
    return null;
  }

  const inicioEncabezados = separador.length + 2;
  const finEncabezados = cuerpo.indexOf(Buffer.from('\r\n\r\n'), inicioEncabezados);
  if (finEncabezados < 0) return null;

  const encabezados = cuerpo.subarray(inicioEncabezados, finEncabezados).toString('latin1');
  const disposicion = encabezados.match(/content-disposition:\s*form-data;[^\r\n]*/i);
  if (!disposicion || !/name="fotografia"/i.test(disposicion[0]) || !/filename="[^"]+"/i.test(disposicion[0])) {
    return null;
  }

  const inicioFotografia = finEncabezados + 4;
  const marcadorFinal = Buffer.from(`\r\n--${limite}`);
  const finFotografia = cuerpo.indexOf(marcadorFinal, inicioFotografia);
  if (finFotografia < 0) return null;

  const resto = cuerpo.subarray(finFotografia + marcadorFinal.length);
  if (resto.toString('latin1') !== '--\r\n' && resto.toString('latin1') !== '--') return null;

  const datos = cuerpo.subarray(inicioFotografia, finFotografia);
  if (!datos.length || datos.length > tamanioMaximoFotografia) return null;

  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) {
    return { datos, extension: '.jpg' };
  }
  if (datos.length >= 8 && datos.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { datos, extension: '.png' };
  }
  if (datos.length >= 12 && datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP') {
    return { datos, extension: '.webp' };
  }
  return null;
}

rutas.post('/imagen', verificarAdministrador, leerCuerpoFotografia, async (req, res) => {
  const fotografia = extraerFotografia(req.body, req.headers['content-type']);
  if (!fotografia) {
    return res.status(400).json({ error: 'Selecciona una fotografía JPG, JPEG, PNG o WEBP válida de hasta 5 MB.' });
  }

  const nombreArchivo = `${randomUUID()}${fotografia.extension}`;
  const rutaArchivo = path.join(carpetaImagenes, nombreArchivo);
  try {
    await fs.writeFile(rutaArchivo, fotografia.datos, { flag: 'wx' });
    res.status(201).json({ archivo: nombreArchivo, mensaje: 'Fotografía cargada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar la fotografía.' });
  }
});

function validarProducto(datos) {
  const { nombre, descripcion, precio, stock, tipo_mascota } = datos;
  const precioNumero = Number(precio);
  const stockNumero = Number(stock);
  const ofertaNumero = datos.precio_oferta == null || datos.precio_oferta === ''
    ? null
    : Number(datos.precio_oferta);
  return Boolean(
    String(nombre || '').trim() && String(descripcion || '').trim() &&
    Number.isFinite(precioNumero) && precioNumero > 0 &&
    Number.isInteger(stockNumero) && stockNumero >= 0 &&
    ['perro', 'gato', 'ambos'].includes(tipo_mascota) &&
    (!datos.textura || ['crujiente', 'suave', 'sin_clasificar'].includes(datos.textura)) &&
    (ofertaNumero === null || (Number.isFinite(ofertaNumero) && ofertaNumero > 0 && ofertaNumero < precioNumero)) &&
    (!datos.estado || ['disponible', 'agotado', 'inactivo'].includes(datos.estado))
  );
}

function valoresProducto(datos) {
  const oferta = datos.precio_oferta === '' || datos.precio_oferta == null
    ? null
    : Number(datos.precio_oferta);
  return [
    datos.nombre.trim(), datos.descripcion.trim(), Number(datos.precio),
    Number(datos.stock), datos.imagen || null, datos.estado || 'disponible',
    datos.tipo_mascota, datos.textura || 'sin_clasificar', datos.info_nutricional || null,
    datos.presentaciones || null, oferta
  ];
}

rutas.get('/', async (req, res, siguiente) => {
  if (req.query.todos === '1') {
    return verificarAdministrador(req, res, siguiente);
  }
  siguiente();
}, async (req, res) => {
  try {
    const consulta = req.query.todos === '1'
      ? 'SELECT * FROM productos ORDER BY id DESC'
      : 'SELECT * FROM productos WHERE estado = ? ORDER BY id DESC';
    const parametros = req.query.todos === '1' ? [] : ['disponible'];
    const [productos] = await conexion.execute(consulta, parametros);
    res.status(200).json(productos);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los productos.' });
  }
});

rutas.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'El identificador del producto no es válido.' });
  }
  try {
    const [productos] = await conexion.execute(
      'SELECT * FROM productos WHERE id = ? AND estado = ?',
      [req.params.id, 'disponible']
    );
    if (!productos.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json(productos[0]);
  } catch (error) {
    console.error('Error al consultar el producto:', error.code || 'Error');
    res.status(500).json({ error: 'No se pudo consultar el producto.' });
  }
});

rutas.post('/', verificarAdministrador, async (req, res) => {
  if (!validarProducto(req.body)) return res.status(400).json({ error: 'Revisa los datos del producto.' });
  try {
    const [resultado] = await conexion.execute(
      `INSERT INTO productos
       (nombre, descripcion, precio, stock, imagen, estado, tipo_mascota,
        textura, info_nutricional, presentaciones, precio_oferta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valoresProducto(req.body)
    );
    res.status(201).json({ id: resultado.insertId, mensaje: 'Producto creado.' });
  } catch (error) {
    console.error('Error al crear el producto:', error.code || 'Error');
    res.status(500).json({ error: 'No se pudo guardar el producto.' });
  }
});

rutas.put('/:id', verificarAdministrador, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'El identificador del producto no es válido.' });
  }
  if (!validarProducto(req.body)) return res.status(400).json({ error: 'Revisa los datos del producto.' });
  if (!['disponible', 'agotado', 'inactivo'].includes(req.body.estado)) {
    return res.status(400).json({ error: 'El estado no es válido.' });
  }
  try {
    const [resultado] = await conexion.execute(
      `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?,
       imagen = ?, estado = ?, tipo_mascota = ?, textura = ?, info_nutricional = ?,
       presentaciones = ?, precio_oferta = ? WHERE id = ?`,
      [...valoresProducto(req.body), req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json({ mensaje: 'Producto actualizado.' });
  } catch (error) {
    console.error('Error al actualizar el producto:', error.code || 'Error');
    res.status(500).json({ error: 'No se pudo actualizar el producto.' });
  }
});

rutas.delete('/:id', verificarAdministrador, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'El identificador del producto no es válido.' });
  }
  try {
    const [resultado] = await conexion.execute(
      "UPDATE productos SET estado = 'inactivo' WHERE id = ?", [req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json({ mensaje: 'Producto retirado del catálogo.' });
  } catch (error) {
    console.error('Error al retirar el producto:', error.code || 'Error');
    res.status(500).json({ error: 'No se pudo retirar el producto del catálogo.' });
  }
});

module.exports = rutas;
