require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const servidor = express();
const carpetaFrontend = path.join(__dirname, '..', 'frontend');

servidor.use(cors());
servidor.use(express.json());
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

servidor.listen(Number(process.env.PUERTO || 3000), () => {
  console.log(`Charqui está disponible en http://localhost:${process.env.PUERTO || 3000}`);
});
