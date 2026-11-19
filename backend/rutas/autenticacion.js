const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const conexion = require('../base_datos');

const rutas = express.Router();

rutas.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Escribe el correo y la contraseña.' });
  }

  try {
    const [usuarios] = await conexion.execute(
      'SELECT id, nombre, correo, contrasena, rol FROM usuarios WHERE correo = ? AND rol = ?',
      [correo.trim().toLowerCase(), 'administrador']
    );
    const usuario = usuarios[0];
    if (!usuario || !usuario.contrasena || !(await bcrypt.compare(contrasena, usuario.contrasena))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
      process.env.JWT_SECRETO,
      { expiresIn: '8h' }
    );
    return res.status(200).json({ token, nombre: usuario.nombre });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

module.exports = rutas;
