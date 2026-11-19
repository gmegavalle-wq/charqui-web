const express = require('express');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');

const rutas = express.Router();

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
    datos.tipo_mascota, datos.info_nutricional || null,
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
  try {
    const [productos] = await conexion.execute(
      'SELECT * FROM productos WHERE id = ? AND estado = ?',
      [req.params.id, 'disponible']
    );
    if (!productos.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json(productos[0]);
  } catch (error) {
    res.status(400).json({ error: 'El identificador del producto no es válido.' });
  }
});

rutas.post('/', verificarAdministrador, async (req, res) => {
  if (!validarProducto(req.body)) return res.status(400).json({ error: 'Revisa los datos del producto.' });
  try {
    const [resultado] = await conexion.execute(
      `INSERT INTO productos
       (nombre, descripcion, precio, stock, imagen, estado, tipo_mascota,
        info_nutricional, presentaciones, precio_oferta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valoresProducto(req.body)
    );
    res.status(201).json({ id: resultado.insertId, mensaje: 'Producto creado.' });
  } catch (error) {
    res.status(400).json({ error: 'No se pudo guardar el producto.' });
  }
});

rutas.put('/:id', verificarAdministrador, async (req, res) => {
  if (!validarProducto(req.body)) return res.status(400).json({ error: 'Revisa los datos del producto.' });
  if (!['disponible', 'agotado', 'inactivo'].includes(req.body.estado)) {
    return res.status(400).json({ error: 'El estado no es válido.' });
  }
  try {
    const [resultado] = await conexion.execute(
      `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?,
       imagen = ?, estado = ?, tipo_mascota = ?, info_nutricional = ?,
       presentaciones = ?, precio_oferta = ? WHERE id = ?`,
      [...valoresProducto(req.body), req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json({ mensaje: 'Producto actualizado.' });
  } catch (error) {
    res.status(400).json({ error: 'No se pudo actualizar el producto.' });
  }
});

rutas.delete('/:id', verificarAdministrador, async (req, res) => {
  try {
    const [resultado] = await conexion.execute(
      "UPDATE productos SET estado = 'inactivo' WHERE id = ?", [req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(200).json({ mensaje: 'Producto retirado del catálogo.' });
  } catch (error) {
    res.status(400).json({ error: 'No se pudo retirar el producto del catálogo.' });
  }
});

module.exports = rutas;
