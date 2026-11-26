const LONGITUD_MINIMA_SECRETO_JWT = 32;

function secretoJwtValido(secreto) {
  return typeof secreto === 'string' &&
    Buffer.byteLength(secreto, 'utf8') >= LONGITUD_MINIMA_SECRETO_JWT;
}

module.exports = { secretoJwtValido, LONGITUD_MINIMA_SECRETO_JWT };
