require('dotenv').config();
const bcrypt = require('bcrypt');
const conexion = require('./base_datos');

async function crearAdministrador() {
  const correoConfigurado = process.env.ADMIN_CORREO;
  const contrasena = process.env.ADMIN_CONTRASENA;
  if (typeof correoConfigurado !== 'string' || typeof contrasena !== 'string') {
    throw new Error('Configura ADMIN_CORREO y ADMIN_CONTRASENA para crear el administrador.');
  }
  const correo = correoConfigurado.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
      contrasena.length < 16 ||
      !/[a-z]/.test(contrasena) || !/[A-Z]/.test(contrasena) ||
      !/\d/.test(contrasena) || !/[^A-Za-z0-9]/.test(contrasena)) {
    throw new Error('El correo o la contraseña no cumple los requisitos de seguridad.');
  }

  try {
    const [usuarios] = await conexion.execute(
      'SELECT id FROM usuarios WHERE correo = ?',
      [correo]
    );
    if (usuarios.length) {
      throw new Error('Ya existe una cuenta con ese correo. Utiliza el procedimiento seguro de recuperación.');
    }

    const contrasenaCifrada = await bcrypt.hash(contrasena, 12);
    await conexion.execute(
      "INSERT INTO usuarios (nombre, correo, contrasena, telefono, rol) VALUES (?, ?, ?, ?, 'administrador')",
      ['Administrador Charqui', correo, contrasenaCifrada, '']
    );
    console.log('Cuenta de administrador creada.');
  } catch (error) {
    console.error('No se pudo crear el administrador:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    await conexion.end();
  }
}

crearAdministrador().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
