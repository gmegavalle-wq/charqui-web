const express = require('express');
const conexion = require('../base_datos');
const verificarAdministrador = require('../middleware/administrador');

const rutas = express.Router();

rutas.get('/', verificarAdministrador, async (req, res) => {
  try {
    const [clientes] = await conexion.execute(
      "SELECT id, nombre, correo, telefono FROM usuarios WHERE rol = 'cliente' ORDER BY nombre"
    );
    res.status(200).json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los clientes.' });
  }
});

module.exports = rutas;
