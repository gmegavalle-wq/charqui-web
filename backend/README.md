# Configuración y operación segura

## Variables de entorno

Configura estas variables en el entorno del servidor (no las publiques ni las incluyas en Git):

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: conexión MySQL. Si faltan, el código usa `localhost`, `3306`, `root`, contraseña vacía y `charqui_web`; en producción define credenciales propias y restringidas.
- `JWT_SECRETO`: secreto aleatorio de al menos 32 bytes. El servidor no inicia si falta o es demasiado corto. Cambiarlo invalida las sesiones de administración y los enlaces privados de seguimiento ya emitidos.
- `CORS_ORIGINS`: lista separada por comas de orígenes permitidos, incluyendo esquema y puerto cuando aplique, sin barras finales (por ejemplo, `https://tienda.ejemplo`). Déjalo vacío si frontend y API se sirven desde el mismo origen. No uses `*` ni incluyas hosts no confiables.
- `PUERTO`: puerto HTTP local; por defecto `3000`.
- `ADMIN_CORREO` y `ADMIN_CONTRASENA`: requeridas al ejecutar `npm run crear-admin`. La contraseña debe tener al menos 16 caracteres e incluir minúscula, mayúscula, número y símbolo. El comando no cambia una cuenta ya existente.

## Límites y enlaces de seguimiento

El inicio de sesión permite 8 solicitudes por IP cada 15 minutos; la creación de pedidos, 5 cada 10 minutos; y las consultas de seguimiento, 30 por minuto. Los contadores viven en memoria: se reinician al reiniciar el proceso, no se comparten entre instancias y no sustituyen controles perimetrales ante tráfico distribuido. La tabla de clientes se acota a 5.000 claves por limitador.

Actualmente Express no confía en proxies (`trust proxy` está desactivado). Si se despliega detrás de un proxy, configura una lista de proxies de confianza antes de depender de `req.ip`; no confíes indiscriminadamente en encabezados reenviados por el cliente.

El enlace privado de seguimiento es un secreto portador, válido durante un año. El token se transmite en el fragmento (`#token=...`) para que no se envíe al servidor como parte de la petición de la página. El cliente debe conservarlo y no compartirlo; cualquier persona que lo tenga podrá consultar el pedido. Usa HTTPS en producción. No se registra automáticamente una caducidad de esos datos en la base.

El botón de compra se desactiva mientras la solicitud está en curso para reducir envíos dobles desde la interfaz, pero no existe una clave de idempotencia persistente. Reintentos de red o solicitudes simultáneas desde otros clientes aún podrían crear pedidos duplicados; la protección debe implementarse con almacenamiento durable antes de depender de ella operativamente.

## Base de datos y despliegue

No ejecutar migraciones como parte de esta configuración. Confirma la versión de MySQL/MariaDB y respalda la base antes de cualquier cambio de esquema. El backend espera las columnas/tablas de pedidos, historial y `pago_confirmado` definidas por el esquema/migración existentes.

Los importes administrativos distinguen el valor de pedidos no cancelados, los pagos pendientes de esos pedidos y los importes marcados como confirmados. No existe registro de reembolsos, por lo que el total confirmado no es una conciliación neta.
