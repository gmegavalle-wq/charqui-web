const express = require('express');

const rutas = express.Router();

const tarifas = {
  Quito: 2.5,
  'Sur de Quito': 2.5,
  Valles: 2.5
};
const envioGratisDesde = 20;
const zonasEnvioGratis = ['Sur de Quito'];
const formasPago = ['Transferencia bancaria'];

rutas.get('/', (req, res) => {
  res.status(200).json({
    tarifas,
    envio_gratis_desde: envioGratisDesde,
    zonas_envio_gratis: zonasEnvioGratis,
    formas_pago: formasPago
  });
});

module.exports = rutas;
module.exports.tarifas = tarifas;
module.exports.envioGratisDesde = envioGratisDesde;
module.exports.zonasEnvioGratis = zonasEnvioGratis;
module.exports.formasPago = formasPago;
