const express = require('express');
const conexion = require('../base_datos');

const rutas = express.Router();

rutas.get('/', async (req, res) => {
  try {
    const [productos] = await conexion.execute(
      `SELECT * FROM productos
       WHERE estado = 'disponible' AND stock > 0 AND precio_oferta IS NOT NULL
       ORDER BY id DESC`
    );
    res.status(200).json(productos);
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('precio_oferta')) {
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'No se pudieron cargar las ofertas.' });
  }
});

module.exports = rutas;
