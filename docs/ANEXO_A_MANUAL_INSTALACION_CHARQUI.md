# Anexo A. Manual de instalación y configuración del sistema CHARQUI

**Proyecto:** CHARQUI
**Descripción:** plataforma web para la comercialización de snacks deshidratados naturales para mascotas.
**Tipo de documento:** Manual de instalación y configuración.
**Anexo:** A.
**Versión técnica revisada:** 1.0.0 (metadato de `package.json`).
**Fecha:** 26 de noviembre de 2026.

> **Alcance de este anexo.** Este documento describe un procedimiento para preparar un entorno local de desarrollo desde una copia limpia del repositorio. La elaboración del manual no instaló software, importó SQL, ejecutó migraciones, creó cuentas ni registró pedidos.

## Diagnóstico breve de instalación

La inspección encontró los siguientes elementos reales:

- El proyecto requiere Node.js `20.x` (`engines` de `package.json`). La máquina de esta sesión reportó Node.js `v24.11.1` y npm `11.6.2`; por tanto, el runtime observado no es la versión declarada para la instalación.
- El servidor se inicia mediante `npm run iniciar`, que ejecuta `node backend/servidor.js`. Escucha en `PUERTO` o, por defecto, en el puerto `3000`.
- El backend conecta a MariaDB/MySQL con `mysql2/promise`. `DB_NAME` tiene como valor predeterminado `charqui_web`; el esquema SQL inicial también crea y selecciona `charqui_web`.
- El lockfile es `package-lock.json`; para una instalación reproducible corresponde `npm ci`.
- Se encontraron el esquema inicial `database/charqui.sql` y cuatro migraciones: administración, mayoristas, recomendador e idempotencia de pedidos.
- Express sirve el frontend directamente desde `frontend/`; no se encontró un paso de compilación de frontend.
- No se identificó un archivo `.env.example`. `backend/README.md` enumera las variables del servidor.
- Las instrucciones de Windows se proporcionan en PowerShell. MariaDB, phpMyAdmin, Git y Visual Studio Code no se instalan ni configuran desde los scripts npm del proyecto.

## 1. Portada

**Nombre:** Anexo A. Manual de instalación y configuración del sistema CHARQUI
**Proyecto:** CHARQUI
**Descripción:** plataforma web para la comercialización de snacks deshidratados naturales para mascotas.
**Tipo de documento:** Manual de instalación y configuración.
**Anexo:** A.

## 2. Introducción

Este manual describe cómo obtener el código fuente, preparar un entorno local, instalar las dependencias, crear una base de datos de desarrollo, configurar las variables del backend e iniciar la aplicación CHARQUI.

Está dirigido a estudiantes, docentes y desarrolladores que necesiten instalar el sistema para revisión o mantenimiento. Los pasos deben ejecutarse sobre una instalación local nueva o una base de desarrollo autorizada. No se debe apuntar el entorno de pruebas a una base de producción ni a una base utilizada por otra instalación.

## 3. Requisitos previos

### 3.1 Software obligatorio

| Componente | Requisito documentado | Uso |
|---|---|---|
| Sistema operativo | El código no declara una matriz de sistemas operativos soportados. Los comandos de este anexo son para Windows y PowerShell. | Entorno de trabajo. |
| Node.js | Versión `20.x`, según `package.json`. | Ejecutar el backend y las herramientas npm. |
| npm | Se instala con Node.js. No se fija versión en `package.json`. | Instalar dependencias desde el lockfile. |
| Git | Necesario si se clona el repositorio. | Descargar y actualizar el código fuente. |
| MariaDB o MySQL | El proyecto utiliza el protocolo/conector MySQL. MariaDB 10.4.32 se utilizó en una validación previa del entorno de pruebas; el repositorio no fija una versión mínima formal. | Almacenar datos. |
| Navegador web | Navegador moderno con JavaScript habilitado. El proyecto no publica versiones mínimas. | Acceder a las páginas y probar la interfaz. |

### 3.2 Herramientas opcionales

| Herramienta | Uso |
|---|---|
| phpMyAdmin | Interfaz visual para crear una base, importar los scripts y revisar las tablas. No es una dependencia de CHARQUI. |
| Visual Studio Code | Editor recomendado para explorar los archivos. No es requisito para ejecutar el servidor. |

### 3.3 Hardware

El repositorio no especifica memoria, CPU o espacio mínimos. Como la instalación local ejecuta Node.js, MariaDB y un navegador, debe disponerse de recursos suficientes para mantenerlos simultáneamente. Esta recomendación no representa una certificación de hardware.

## 4. Preparación del entorno

### 4.1 Instalar Node.js 20.x

1. Descarga una versión Node.js 20.x desde el archivo oficial de Node.js: <https://nodejs.org/en/download/archive/>.
2. Selecciona el instalador adecuado para Windows y sigue el asistente.
3. Abre una nueva ventana de PowerShell para que se actualice el `PATH`.
4. Comprueba las versiones:

```powershell
node --version
npm --version
```

La versión de Node debe ser `v20.x`. Si aparece otra versión, revisa la instalación o el administrador de versiones utilizado antes de continuar. No es necesario cambiar la versión global en equipos compartidos; puede usarse un administrador de versiones aprobado por la institución.

**[INSERTAR CAPTURA A.1: Instalación o comprobación de Node.js]**

### 4.2 Instalar MariaDB

1. Instala MariaDB Server desde el sitio oficial: <https://mariadb.org/download/>.
2. Durante la instalación local, define una contraseña segura para la cuenta administrativa de la base.
3. Conserva el puerto configurado; el valor predeterminado usado por el backend es `3306`.
4. Inicia el servicio MariaDB desde el panel de servicios de Windows o desde el programa de administración instalado.
5. Si se utilizará phpMyAdmin, instálalo por separado con un método confiable compatible con la instalación local. phpMyAdmin no se instala con npm ni forma parte del repositorio.

No se comprobó en esta elaboración qué método de instalación de MariaDB o phpMyAdmin está disponible en el equipo destino.

**[INSERTAR CAPTURA A.2: Acceso a phpMyAdmin]**

### 4.3 Instalar Git y Visual Studio Code

Instala Git desde <https://git-scm.com/download/win> para clonar el repositorio. Visual Studio Code puede instalarse desde <https://code.visualstudio.com/> para editar archivos.

Comprueba Git desde PowerShell:

```powershell
git --version
```

No se requiere ninguna extensión de VS Code especificada por el proyecto.

## 5. Obtención del código fuente

El repositorio configurado en Git es `gmegavalle-wq/charqui-web`, con URL:

<https://github.com/gmegavalle-wq/charqui-web>

Clona el proyecto desde PowerShell:

```powershell
git clone https://github.com/gmegavalle-wq/charqui-web.git
Set-Location charqui-web
```

Comprueba la raíz del proyecto:

```powershell
Get-ChildItem -Name
```

Se deben encontrar, entre otros, `backend`, `database`, `frontend`, `package.json` y `package-lock.json`.

Para abrir la carpeta en Visual Studio Code:

```powershell
code .
```

Si el comando `code` no está disponible, abre VS Code desde el menú Inicio y selecciona **Archivo > Abrir carpeta**, indicando la carpeta clonada.

## 6. Instalación de dependencias

El repositorio incluye `package-lock.json`; utiliza `npm ci` para instalar las dependencias con las versiones resueltas en ese archivo:

```powershell
npm ci
```

El comando elimina/recrea `node_modules` en la copia de trabajo y no debe usarse si se necesita conservar instalaciones locales existentes. En una clonación limpia, instala lo fijado por el lockfile. No edites `package.json` ni `package-lock.json` para completar este paso.

Las dependencias directas declaradas son Express, CORS, dotenv, jsonwebtoken, bcrypt y mysql2. La versión concreta resuelta de cada paquete se consulta en `package-lock.json`; las versiones de rango de `package.json` no son necesariamente la versión instalada.

No hay un script de compilación del frontend: el servidor sirve directamente los archivos HTML, CSS, JavaScript e imágenes de `frontend/`.

## 7. Configuración de la base de datos

### 7.1 Crear la base local

Realiza estos pasos únicamente en una instalación local nueva o de desarrollo. No selecciones una base de producción ni una base habitual de otra persona.

Opción phpMyAdmin:

1. Inicia MariaDB y abre phpMyAdmin con una cuenta administrativa local.
2. Selecciona **Bases de datos** y crea una base llamada `charqui_web`.
3. Se recomienda `utf8mb4` con una intercalación disponible en la instalación, por ejemplo `utf8mb4_general_ci`.
4. Si el entorno se comparte, crea desde **Cuentas de usuario** una cuenta de aplicación limitada a `charqui_web`; evita otorgarle privilegios globales.

El archivo `database/charqui.sql` también incluye `CREATE DATABASE IF NOT EXISTS charqui_web` y `USE charqui_web`. En phpMyAdmin, puede importarse desde la página de la base creada o desde **Importar** después de seleccionar la base.

Opción de cliente SQL: conecta al servidor local y ejecuta el contenido de `database/charqui.sql` en la instancia de desarrollo. El archivo selecciona `charqui_web`.

**[INSERTAR CAPTURA A.3: Importación de la base de datos]**

### 7.2 Importar el esquema inicial

1. Revisa que la base elegida sea la de desarrollo local `charqui_web`.
2. En phpMyAdmin, abre esa base y selecciona **Importar**.
3. Elige `database/charqui.sql`.
4. Inicia la importación y espera el resultado.
5. Comprueba que se crearon las tablas iniciales: `usuarios`, `productos`, `pedidos` y `detalle_pedido`.

El SQL inicial contiene, además, algunas ampliaciones de columnas para productos y pedidos. Las migraciones posteriores completan el esquema.

### 7.3 Migraciones disponibles

| Archivo | Alcance |
|---|---|
| `database/migracion_admin_charqui.sql` | Datos de clientes adicionales, columnas de pedido y reparto, historial, movimientos de inventario, zonas, formas de pago y configuración. |
| `database/migracion_mayoristas.sql` | Configuración mayorista, solicitudes, detalles, cotizaciones, historial, pedidos mayoristas y producción. |
| `database/migracion_recomendador.sql` | Campo de textura y actualización de clasificación basada en las descripciones existentes. |
| `database/migracion_idempotencia_pedidos.sql` | Tabla persistente de claves para prevenir pedidos duplicados. Este archivo no selecciona la base por sí mismo. |

Para preparar una base vacía compatible con todo el código actual, revisa y aplica, en una instalación local de desarrollo, las migraciones que correspondan al esquema inicial, por ejemplo en este orden:

1. `database/migracion_admin_charqui.sql`
2. `database/migracion_mayoristas.sql`
3. `database/migracion_recomendador.sql`
4. Selecciona `charqui_web` y aplica `database/migracion_idempotencia_pedidos.sql`.

Este orden es una guía para una instalación nueva; no es un comando automatizado del proyecto ni sustituye la revisión de la versión exacta de cada esquema. El backend no ejecuta migraciones al iniciar. Algunas columnas del SQL inicial y de migraciones posteriores se solapan y usan `IF NOT EXISTS`, pero no se debe asumir que cualquier combinación de esquemas existentes es segura.

La migración del recomendador incluye `UPDATE productos`; en una base vacía no habrá registros que clasificar, pero en una base con datos esa instrucción actualiza filas que cumplen sus condiciones. Antes de usar cualquier migración sobre una base existente, realiza respaldo y confirma el estado del esquema. No ejecutes estas instrucciones contra producción como parte de una instalación de desarrollo.

### 7.4 Verificar la importación

En phpMyAdmin, selecciona `charqui_web` y revisa la lista de tablas. El esquema completo esperado por la implementación actual contiene 20 tablas:

`usuarios`, `productos`, `pedidos`, `detalle_pedido`, `historial_pedidos`, `movimientos_inventario`, `zonas_envio`, `formas_pago`, `configuracion_tienda`, `configuracion_producto_mayorista`, `solicitudes_mayoristas`, `detalle_solicitud_mayorista`, `cotizaciones_mayoristas`, `detalle_cotizacion_mayorista`, `historial_mayoristas`, `pedidos_mayoristas`, `detalle_pedido_mayorista`, `capacidad_produccion_patitas`, `produccion_patitas_mayorista` e `idempotencia_pedidos`.

La lista confirma presencia, no corrección de todas las relaciones. Para una inspección adicional, la pestaña **Estructura** de phpMyAdmin muestra campos e índices.

## 8. Configuración de variables de entorno

### 8.1 Crear `.env`

No existe una plantilla `.env.example` en el repositorio. En una clonación limpia, crea `.env` en la raíz y ábrelo con un editor:

```powershell
New-Item -Path .env -ItemType File
notepad .env
```

Si `.env` ya existe, no lo sobrescribas: revísalo con la persona responsable y conserva los valores existentes. El archivo está incluido en `.gitignore`; no lo agregues al repositorio.

Incluye las siguientes variables con valores de tu entorno local:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=<USUARIO_LOCAL_DE_APLICACION>
DB_PASSWORD=<CONTRASENA_LOCAL>
DB_NAME=charqui_web
JWT_SECRETO=<SECRETO_ALEATORIO_DE_32_BYTES_O_MAS>
CORS_ORIGINS=
PUERTO=3000
```

Los valores entre `< >` son marcadores ficticios y deben reemplazarse. No uses literalmente los corchetes. La cuenta y la contraseña de MariaDB deben corresponder al usuario local autorizado para `charqui_web`. El backend tiene valores de reserva inseguros para facilitar desarrollo antiguo (`root`, contraseña vacía y `charqui_web`); configura explícitamente DB_USER y DB_PASSWORD para la instalación local y no uses estos valores de reserva en producción.

### 8.2 Variables reconocidas

| Variable | Obligatoria/condicional | Función |
|---|---|---|
| `DB_HOST` | Requerida para conexión adecuada | Host MariaDB/MySQL. Valor de reserva en código: `localhost`. |
| `DB_PORT` | Opcional | Puerto SQL; reserva `3306`. |
| `DB_USER` | Requerida para conexión adecuada | Cuenta de base de datos. |
| `DB_PASSWORD` | Requerida según la cuenta | Contraseña SQL. |
| `DB_NAME` | Requerida para seleccionar el esquema esperado | Nombre de la base; reserva `charqui_web`. |
| `JWT_SECRETO` | Requerida | Clave aleatoria de al menos 32 bytes para JWT de administración y derivación del token de seguimiento. El servidor no inicia si es demasiado corta o no está configurada. |
| `CORS_ORIGINS` | Opcional | Lista de orígenes permitidos, separada por comas. Si frontend y API usan el mismo origen, puede dejarse vacía. |
| `PUERTO` | Opcional | Puerto HTTP; reserva `3000`. |
| `ADMIN_CORREO` | Solo al crear cuenta inicial | Correo para `npm run crear-admin`. |
| `ADMIN_CONTRASENA` | Solo al crear cuenta inicial | Contraseña para `npm run crear-admin`; mínimo 16 caracteres e incluye minúscula, mayúscula, número y símbolo. |

### 8.3 Generar un secreto local

Para generar un secreto aleatorio sin imprimirlo en la consola, ejecuta desde la raíz del proyecto. El comando agrega una línea al `.env`; ejecútalo solo una vez y verifica primero que `JWT_SECRETO` no esté ya configurado:

```powershell
node -e "require('fs').appendFileSync('.env', 'JWT_SECRETO=' + require('crypto').randomBytes(48).toString('hex') + '\n')"
```

El comando no muestra el valor generado. No compartas el archivo ni pegues su contenido en reportes, capturas, chats o repositorios públicos. En producción, el secreto debe ser provisto mediante el mecanismo seguro de gestión de secretos del entorno.

### 8.4 Servicios externos

No se encontraron credenciales de API para servicios externos. La aplicación construye enlaces `wa.me` para abrir WhatsApp; no existe una variable de entorno para un token de WhatsApp ni se envían mensajes automáticamente desde el backend. `CORS_ORIGINS` es una configuración de seguridad del servidor, no una integración externa.

## 9. Ejecución del sistema

### 9.1 Iniciar el servidor

Desde la raíz del repositorio, con la base y `.env` preparados:

```powershell
npm run iniciar
```

El script ejecuta `node backend/servidor.js`. Con `PUERTO` no definido, la aplicación informa que está disponible en el puerto `3000`.

Para usar otro puerto únicamente en la sesión actual de PowerShell:

```powershell
$env:PUERTO = "3001"
npm run iniciar
```

### 9.2 Dirección local

- Inicio: `http://localhost:3000/`
- Catálogo: `http://localhost:3000/catalogo.html`
- Administración: `http://localhost:3000/admin.html`
- Mayoristas: `http://localhost:3000/mayoristas.html`

Si configuraste otro puerto, reemplaza `3000`.

### 9.3 Comprobar el inicio

El mensaje de inicio esperado es similar a:

```text
Charqui está disponible en el puerto 3000
```

Abre la dirección de inicio en un navegador. El mensaje solo confirma que Express inició; no demuestra por sí solo que la conexión a la base funcione. Para comprobarla, carga el catálogo y verifica que devuelve productos o un estado vacío sin error. No registres una compra real para probar el arranque.

**[INSERTAR CAPTURA A.4: Configuración del proyecto en Visual Studio Code]**

**[INSERTAR CAPTURA A.5: Ejecución del servidor]**

**[INSERTAR CAPTURA A.6: Página de inicio de CHARQUI funcionando]**

Las capturas anteriores son marcadores editoriales; no se adjuntan imágenes simuladas ni se afirma que esos pasos se ejecutaron en una instalación limpia.

### 9.4 Crear la cuenta administrativa local

El repositorio incluye `npm run crear-admin`. Para usarlo, configura temporalmente las variables requeridas en la sesión de PowerShell:

```powershell
$correo = Read-Host "Correo administrativo local"
$contrasenaSegura = Read-Host "Contrasena administrativa local" -AsSecureString
$puntero = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($contrasenaSegura)
try {
    $env:ADMIN_CORREO = $correo
    $env:ADMIN_CONTRASENA = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($puntero)
    npm run crear-admin
}
finally {
    Remove-Item Env:ADMIN_CORREO -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_CONTRASENA -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($puntero)
}
```

Introduce valores de prueba locales y seguros cuando PowerShell lo solicite. La contraseña se solicita como entrada segura y no aparece en el historial del comando. No guardes una contraseña real en scripts, documentación ni capturas. El script no reemplaza una cuenta que ya tenga ese correo. Ejecuta este paso solo después de comprobar que `DB_NAME` apunta a tu base local de desarrollo.

## 10. Verificación de instalación

Realiza las comprobaciones sin enviar dinero, mensajes externos ni pedidos que involucren clientes reales. Para revisar transacciones completas se necesita un conjunto de productos y usuarios ficticios en una base aislada.

| Comprobación | Procedimiento seguro | Requiere datos de prueba |
|---|---|---|
| Inicio | Abre `http://localhost:3000/`. Confirma que carga la página. | No. |
| Catálogo | Abre `/catalogo.html`; verifica que aparecen productos, o el estado vacío, sin error de conexión. | Sí, para comprobar tarjetas reales. |
| Ficha de producto | Selecciona un producto y revisa descripción, precio y disponibilidad. | Sí. |
| Carrito | Añade un producto de prueba, abre `/carrito.html` y revisa cantidad y subtotal. | Sí. |
| Checkout | Abre `/pedido.html` y comprueba carga de zonas, forma de pago y resumen. No confirmes un pedido real. | Sí, con producto disponible. |
| Registro de pedidos | Solo en una base de pruebas aislada, con datos ficticios y autorización para que el test escriba en esa base. | Sí. |
| Seguimiento | Utiliza el token devuelto por un pedido de prueba. No compartas tokens reales. | Sí. |
| Administración | Abre `/admin.html` e inicia sesión con una cuenta local creada para desarrollo. | Sí. |
| Mayoristas | Abre `/mayoristas.html`; comprueba catálogo. El envío del formulario registra datos, por lo que hazlo solo con fixtures ficticios en base aislada. | Sí para envío. |

El repositorio no define un script `npm test`. Las pruebas disponibles usan `node:test` y pueden ejecutarse así:

```powershell
node --test backend/test/seguridad-basica.test.js backend/test/integracion-http.test.js
```

La integración real MariaDB se encuentra en `backend/test/integracion-mariadb.test.js`. Requiere que `CHARQUI_TEST_DB_ENV` apunte a un archivo de entorno externo que seleccione exactamente `charqui_web_test`, con host local. Esta prueba crea datos ficticios y realiza escrituras en esa base aislada; no la ejecutes si no confirmaste la configuración y tienes autorización para modificar los fixtures de prueba.

En esta elaboración no se ejecutaron compras, envíos de formularios, migraciones ni pruebas de navegador sobre una instalación limpia.

## 11. Solución de problemas frecuentes

| Problema | Comprobación | Acción segura |
|---|---|---|
| `node` no se reconoce | Ejecuta `node --version`. | Reinstala Node.js 20.x o corrige el PATH; abre una nueva consola. |
| Versión de Node distinta de 20.x | Comprueba `node --version` y `package.json`. | Usa una instalación/administrador local compatible con Node 20 sin cambiar la versión global compartida. |
| `npm ci` falla | Revisa que estás en la raíz y existe `package-lock.json`; comprueba conexión y Node. | Ejecuta de nuevo tras resolver el error de red o versión. No borres el lockfile ni cambies dependencias. |
| Puerto ocupado | Revisa `PUERTO` o el mensaje de `listen`. | Elige otro puerto disponible, por ejemplo `$env:PUERTO="3001"`, y abre la URL con ese puerto. |
| El servidor no inicia por JWT | Revisa que `.env` tenga `JWT_SECRETO` de 32 bytes o más. | Genera un valor aleatorio local mediante el procedimiento de la sección 8.3. No uses un valor publicado. |
| Error de conexión SQL | Comprueba servicio MariaDB, host, puerto, usuario, contraseña y base en `.env`. | Corrige solamente el entorno local y verifica que `DB_NAME` es la base pretendida antes de iniciar. |
| Acceso denegado en MariaDB | Verifica que la cuenta existe y tiene permisos sobre `charqui_web`. | Ajusta permisos localmente; evita usar una cuenta global privilegiada para la aplicación. |
| Error de tabla o columna inexistente | Comprueba en phpMyAdmin las tablas y columnas; confirma qué migraciones locales se aplicaron. | Haz respaldo y revisa el esquema antes de aplicar la migración faltante; no migres producción como solución rápida. |
| CORS bloqueado | Revisa el origen exacto del navegador y `CORS_ORIGINS`. | Si frontend y API están en el mismo servidor/origen, deja CORS vacío; de otro modo, configura solo orígenes confiables, sin comodín. |
| El checkout muestra producto agotado | Comprueba `productos.estado` y `productos.stock` en la base de desarrollo. | Usa fixtures aislados correctamente preparados; no aumentes stock en una base real para probar. |
| No aparecen productos | Comprueba que existan productos disponibles en la base correcta. | Añade datos únicamente en una base local o de pruebas autorizada. |

## 12. Consideraciones de seguridad

1. No publiques `.env`, contraseñas SQL, `JWT_SECRETO`, credenciales administrativas ni tokens privados.
2. Confirma la base seleccionada antes de ejecutar importaciones, migraciones o pruebas. No utilices una base de producción para desarrollo.
3. Crea un usuario SQL limitado a la base de aplicación cuando el entorno lo permita; no mantengas `root` ni permisos globales en la configuración de la aplicación.
4. Utiliza una contraseña administrativa que cumpla el mínimo implementado: 16 caracteres, mayúscula, minúscula, número y símbolo.
5. Usa datos ficticios en pruebas. No copies nombres, teléfonos, direcciones ni correos de clientes reales.
6. Protege los enlaces de seguimiento y cotización: funcionan como credenciales portadoras.
7. El entorno de producción debe usar HTTPS. El proyecto no debe considerarse desplegado de forma segura solo por iniciar correctamente.
8. Realiza respaldos antes de cambiar el esquema y almacénalos en una ubicación protegida.
9. No compartas capturas que muestren archivos `.env`, credenciales, tokens ni datos personales.
10. El repositorio excluye `.env` mediante `.gitignore`; verifica que el archivo no esté siendo añadido manualmente al control de versiones.

## 13. Conclusión

El procedimiento documentado permite preparar un entorno local reproducible, instalar las dependencias bloqueadas, importar el esquema apropiado y configurar el servidor sin cambiar el código del proyecto. La verificación explícita de Node.js, base seleccionada y variables de seguridad reduce el riesgo de incompatibilidad y de afectar datos de otra instalación.

La importación y las migraciones son operaciones sobre el esquema y pueden modificar la base seleccionada. Deben realizarse únicamente en un entorno de desarrollo preparado y después de confirmar la base y mantener un respaldo cuando corresponda.

## Referencias técnicas del proyecto

- Repositorio CHARQUI: <https://github.com/gmegavalle-wq/charqui-web>
- `package.json` y `package-lock.json`.
- `backend/servidor.js`, `backend/base_datos.js` y `backend/README.md`.
- `database/charqui.sql`.
- `database/migracion_admin_charqui.sql`.
- `database/migracion_mayoristas.sql`.
- `database/migracion_recomendador.sql`.
- `database/migracion_idempotencia_pedidos.sql`.
