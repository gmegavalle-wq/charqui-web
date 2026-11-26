const test = require('node:test');
const assert = require('node:assert/strict');
const crearLimitadorSolicitudes = require('../middleware/limitador_solicitudes');
const { crearTokenSeguimiento, verificarTokenSeguimiento } = require('../servicios/seguimiento_pedido');
const { secretoJwtValido, LONGITUD_MINIMA_SECRETO_JWT } = require('../utilidades/configuracion_seguridad');
const { coordenadasValidas } = require('../utilidades/validaciones_pedido');

test('secreto JWT debe tener longitud mínima en bytes', () => {
  assert.equal(secretoJwtValido('x'.repeat(LONGITUD_MINIMA_SECRETO_JWT)), true);
  assert.equal(secretoJwtValido('x'.repeat(LONGITUD_MINIMA_SECRETO_JWT - 1)), false);
  assert.equal(secretoJwtValido(null), false);
});

test('coordenadas son opcionales en pareja y deben estar dentro de rango', () => {
  assert.equal(coordenadasValidas(null, null), true);
  assert.equal(coordenadasValidas('-0.2', '-78.5'), true);
  assert.equal(coordenadasValidas('0', null), false);
  assert.equal(coordenadasValidas('91', '0'), false);
  assert.equal(coordenadasValidas('0', 'NaN'), false);
});

test('token de seguimiento solo verifica con su secreto y pedido', () => {
  const secreto = 's'.repeat(LONGITUD_MINIMA_SECRETO_JWT);
  const token = crearTokenSeguimiento(42, secreto);
  assert.equal(verificarTokenSeguimiento(token, secreto), 42);
  assert.throws(() => verificarTokenSeguimiento(token, `${secreto}x`));
});

test('limitador responde 429 y Retry-After al alcanzar el umbral', () => {
  let ahora = 1_000;
  let solicitudesSiguientes = 0;
  let estado;
  let retryAfter;
  const limitar = crearLimitadorSolicitudes({ limite: 1, ventanaMs: 10_000, reloj: () => ahora });
  const respuesta = {
    set(nombre, valor) {
      if (nombre === 'Retry-After') retryAfter = valor;
      return this;
    },
    status(valor) {
      estado = valor;
      return this;
    },
    json() {
      return this;
    }
  };
  const req = { ip: '192.0.2.10' };

  limitar(req, respuesta, () => { solicitudesSiguientes += 1; });
  limitar(req, respuesta, () => { solicitudesSiguientes += 1; });
  assert.equal(solicitudesSiguientes, 1);
  assert.equal(estado, 429);
  assert.equal(retryAfter, '10');

  ahora += 10_000;
  limitar(req, respuesta, () => { solicitudesSiguientes += 1; });
  assert.equal(solicitudesSiguientes, 2);
});
