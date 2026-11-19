require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const servidor = express();
const carpetaFrontend = path.join(__dirname, '..', 'frontend');

servidor.use(cors());
servidor.use(express.json());
servidor.use((req, res, siguiente) => {
  if (req.path.startsWith('/api/') && !req.is('multipart/form-data') && !req.body) {
    req.body = {};
  }
  siguiente();
});
servidor.use(express.static(carpetaFrontend));

servidor.use('/api/auth', require('./rutas/autenticacion'));
servidor.use('/api/productos', require('./rutas/productos'));
servidor.use('/api/ofertas', require('./rutas/ofertas'));
servidor.use('/api/clientes', require('./rutas/clientes'));
servidor.use('/api/pedidos', require('./rutas/pedidos'));
servidor.use('/api/envios', require('./rutas/envios'));

servidor.get('/', (req, res) => {
  res.sendFile(path.join(carpetaFrontend, 'index.html'));
});

// Las rutas API inexistentes también responden JSON.
servidor.use('/api', (req, res) => {
  res.status(404).json({ error: 'La ruta solicitada no existe.' });
});

// Evita que Express envíe páginas HTML para errores de la API.
servidor.use((error, req, res, siguiente) => {
  if (req.originalUrl.startsWith('/api/')) {
    const estado = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    const mensaje = estado === 413
      ? 'La solicitud supera el tamaño permitido.'
      : estado === 400
        ? 'La solicitud enviada no es válida.'
        : 'Ocurrió un error interno en el servidor.';
    console.error('Error en una ruta API:', error.code || error.name || 'Error');
    return res.status(estado).json({ error: mensaje });
  }
  siguiente(error);
});

servidor.listen(Number(process.env.PUERTO || 3000), () => {
  console.log(`Charqui está disponible en http://localhost:${process.env.PUERTO || 3000}`);
});
