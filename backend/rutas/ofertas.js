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
    res.status(500).json({ error: 'No se pudieron cargar las ofertas.' });
  }
});

module.exports = rutas;
