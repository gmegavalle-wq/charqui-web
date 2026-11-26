const jwt = require('jsonwebtoken');

function verificarAdministrador(req, res, siguiente) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ')
    ? encabezado.slice(7)
    : '';

  if (!token) {
    return res.status(403).json({ error: 'Se requiere iniciar sesión como administrador.' });
  }

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRETO, {
      algorithms: ['HS256'],
      issuer: 'charqui',
      audience: 'administracion'
    });
    if (datos.rol !== 'administrador') {
      return res.status(403).json({ error: 'No tienes permiso de administrador.' });
    }
    req.administrador = datos;
    siguiente();
  } catch (error) {
    return res.status(403).json({ error: 'El token no es válido.' });
  }
}

module.exports = verificarAdministrador;
