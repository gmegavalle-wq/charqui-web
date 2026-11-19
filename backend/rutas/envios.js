const express = require('express');
const conexion = require('../base_datos');

const rutas = express.Router();

async function cargarConfiguracion(base = conexion) {
  const [[configuracion]] = await base.execute(
    "SELECT valor FROM configuracion_tienda WHERE clave = 'envio_gratis_desde'"
  );
  const [zonas] = await base.execute('SELECT nombre, tarifa, envio_gratis FROM zonas_envio WHERE activa = 1 ORDER BY nombre');
  const [formas] = await base.execute('SELECT nombre FROM formas_pago WHERE activa = 1 ORDER BY nombre');
  return {
    tarifas: Object.fromEntries(zonas.map((zona) => [zona.nombre, Number(zona.tarifa)])),
    envio_gratis_desde: Number(configuracion?.valor || 20),
    zonas_envio_gratis: zonas.filter((zona) => Number(zona.envio_gratis)).map((zona) => zona.nombre),
    formas_pago: formas.map((forma) => forma.nombre)
  };
}

rutas.get('/', async (req, res) => {
  try {
    return res.status(200).json(await cargarConfiguracion());
  } catch (error) {
    console.error('Error al cargar envíos:', error.code || 'Error');
    return res.status(500).json({ error: 'No se pudo cargar la configuración de entrega.' });
  }
});

module.exports = rutas;
module.exports.cargarConfiguracion = cargarConfiguracion;
