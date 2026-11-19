require('dotenv').config();
const bcrypt = require('bcrypt');
const conexion = require('./base_datos');

async function crearAdministrador() {
  const correo = 'admin@charqui.com';
  const contrasena = await bcrypt.hash('admin123', 10);

  try {
    const [usuarios] = await conexion.execute(
      'SELECT id FROM usuarios WHERE correo = ?',
      [correo]
    );
    if (usuarios.length) {
      await conexion.execute(
        "UPDATE usuarios SET nombre = ?, contrasena = ?, rol = 'administrador' WHERE correo = ?",
        ['Administrador Charqui', contrasena, correo]
      );
    } else {
      await conexion.execute(
        "INSERT INTO usuarios (nombre, correo, contrasena, telefono, rol) VALUES (?, ?, ?, ?, 'administrador')",
        ['Administrador Charqui', correo, contrasena, '']
      );
    }
    console.log('Administrador de prueba listo: admin@charqui.com / admin123');
  } catch (error) {
    console.error('No se pudo crear el administrador:', error.message);
    process.exitCode = 1;
  } finally {
    await conexion.end();
  }
}

crearAdministrador();
