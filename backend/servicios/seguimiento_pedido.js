const { createHmac } = require('crypto');
const jwt = require('jsonwebtoken');

const emisor = 'charqui';
const audiencia = 'seguimiento-pedido';
const alcance = 'consulta-pedido';

function claveSeguimiento(secretoJwt) {
  return createHmac('sha256', secretoJwt)
    .update('charqui:seguimiento-pedido:v1')
    .digest();
}

function crearTokenSeguimiento(idPedido, secretoJwt, emitidoEn) {
  const contenido = { alcance };
  if (emitidoEn !== undefined) {
    if (!Number.isSafeInteger(emitidoEn) || emitidoEn < 1) {
      throw new TypeError('La fecha de emisión del seguimiento no es válida.');
    }
    contenido.iat = emitidoEn;
  }
  return jwt.sign(
    contenido,
    claveSeguimiento(secretoJwt),
    {
      algorithm: 'HS256',
      subject: String(idPedido),
      issuer: emisor,
      audience: audiencia,
      expiresIn: '365d'
    }
  );
}

function verificarTokenSeguimiento(token, secretoJwt) {
  const contenido = jwt.verify(token, claveSeguimiento(secretoJwt), {
    algorithms: ['HS256'],
    issuer: emisor,
    audience: audiencia
  });
  if (typeof contenido !== 'object' || contenido.alcance !== alcance ||
      !/^[1-9]\d*$/.test(contenido.sub || '')) {
    throw new Error('El enlace de seguimiento no es válido.');
  }
  const idPedido = Number(contenido.sub);
  if (!Number.isSafeInteger(idPedido)) throw new Error('El enlace de seguimiento no es válido.');
  return idPedido;
}

module.exports = { crearTokenSeguimiento, verificarTokenSeguimiento };
