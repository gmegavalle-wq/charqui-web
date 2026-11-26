const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const conexion = require('../base_datos');
const crearLimitadorSolicitudes = require('../middleware/limitador_solicitudes');

const rutas = express.Router();
const limitarInicioSesion = crearLimitadorSolicitudes({ limite: 8, ventanaMs: 15 * 60 * 1000 });

rutas.post('/login', limitarInicioSesion, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const correo = req.body && req.body.correo;
  const contrasena = req.body && req.body.contrasena;
  if (typeof correo !== 'string' || typeof contrasena !== 'string' ||
      correo.length > 150 || !contrasena || contrasena.length > 256) {
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
      { expiresIn: '8h', algorithm: 'HS256', issuer: 'charqui', audience: 'administracion' }
    );
    return res.status(200).json({ token, nombre: usuario.nombre });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.code || error.name || 'Error');
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

module.exports = rutas;
