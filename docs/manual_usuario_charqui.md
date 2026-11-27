# CHARQUI — Manual de usuario oficial

**Sistema:** Tienda web CHARQUI  
**Versión de referencia:** 1.0.0, según los metadatos técnicos de `package.json`; no se identifica un número de versión editorial publicado en la interfaz.  
**Autor(es):** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. Revisar `package.json` y la documentación institucional del proyecto.  
**Fecha de elaboración:** 26 de noviembre de 2026  
**Dirigido a:** clientes, negocios que solicitan cotizaciones mayoristas y personal administrador.

CHARQUI permite consultar snacks deshidratados para mascotas, preparar pedidos minoristas, solicitar cotizaciones mayoristas y gestionar las operaciones comerciales desde un área administrativa. El pedido se registra en el sitio; el pago se coordina después por WhatsApp y no se procesa con tarjeta dentro de la página.

<!-- PAGEBREAK -->

## 1. Portada y bienvenida

Te damos la bienvenida a CHARQUI. Este manual explica cómo recorrer la tienda, elegir productos, registrar y seguir un pedido, solicitar una cotización mayorista y usar las herramientas administrativas disponibles.

Las instrucciones describen el comportamiento identificado en el código del proyecto. La disponibilidad de productos, tarifas, zonas de entrega y formas de pago puede cambiar según la configuración vigente de la tienda.

**Importante:** los snacks se presentan como premios complementarios; no sustituyen una alimentación completa. Consulta los ingredientes y la información nutricional de cada producto en su ficha.

## 2. Índices

### 2.1 Índice general

1. Portada y bienvenida  
2. Índices  
3. Primeros pasos y acceso al sistema  
4. Navegación general y conceptos clave  
5. Guías paso a paso por módulo o funcionalidad  
6. Mensajes del sistema, alertas y errores frecuentes  
7. Preguntas frecuentes y soporte  
8. Datos pendientes de confirmación editorial

### 2.2 Índice de tablas

- **Tabla 1.** Requisitos de uso y acceso
- **Tabla 2.** Roles y permisos
- **Tabla 3.** Menú y acciones de navegación
- **Tabla 4.** Glosario de términos
- **Tabla 5.** Campos del checkout
- **Tabla 6.** Estados del pedido
- **Tabla 7.** Datos de la solicitud mayorista
- **Tabla 8.** Módulos administrativos
- **Tabla 9.** Campos de la cotización mayorista
- **Tabla 10.** Mensajes y resolución rápida

### 2.3 Índice de figuras

- **Figura 1.** Mapa de navegación de la tienda
- **Figura 2.** Recorrido de compra minorista
- **Figura 3.** Ciclo de vida y seguimiento del pedido
- **Figura 4.** Solicitud y cotización mayorista
- **Figura 5.** Recorrido general de administración

## 3. Primeros pasos y acceso al sistema

### 3.1 Requisitos de uso

| Requisito | Qué necesitas |
|---|---|
| Navegador | Un navegador web con JavaScript habilitado. No se encontró una lista oficial de navegadores o versiones mínimas. |
| Conexión | Acceso a Internet para cargar el catálogo, enviar formularios y consultar pedidos o cotizaciones. |
| Almacenamiento del navegador | El carrito y algunos datos temporales de compra se guardan en el almacenamiento local o de sesión del navegador. Si se borra ese almacenamiento, el carrito puede perderse. |
| WhatsApp | Para coordinar pagos y contacto comercial, el sitio abre enlaces de WhatsApp. Se necesita acceso a WhatsApp Web o a la aplicación. |
| Administración | Para ingresar al panel se requiere una cuenta de administrador creada por la persona responsable del sistema. No existe una opción de registro ni recuperación de contraseña en la pantalla. |

**Tabla 1. Requisitos de uso y acceso.**

### 3.2 Acceso de clientes

No se encontró una pantalla de registro ni de inicio de sesión para clientes. Para comprar, el cliente navega como visitante y proporciona sus datos en el checkout. Al gestionar un pedido, el sistema registra los datos necesarios para la compra y el seguimiento.

El seguimiento no se busca por cédula, correo o número de pedido: requiere el enlace o token privado entregado después de registrar la compra. Conserva ese enlace y no lo compartas.

### 3.3 Inicio de sesión administrativo

1. Abre la página **Administración** desde el enlace del pie de página o visita `/admin.html`.
2. Escribe el correo y la contraseña de administrador.
3. Pulsa **Iniciar sesión**.
4. Si los datos son correctos, se muestra el panel de gestión. Si no, revisa el correo y la contraseña e inténtalo de nuevo.
5. Para salir, pulsa **Cerrar sesión**.

El proyecto no muestra un enlace para crear una cuenta, cambiar la contraseña o recuperar el acceso. Solicita credenciales a la persona responsable de administrar CHARQUI; no compartas tu contraseña.

### 3.4 Panel inicial

El panel comienza en **Resumen**. Presenta conteos de pedidos por atender, entregas pendientes, solicitudes y compromisos mayoristas, productos con stock bajo y valores de pedidos y pagos por día y mes. Algunos indicadores permiten abrir directamente el módulo relacionado.

El valor de pagos confirmados representa los pedidos marcados como pagados; el sistema no registra devoluciones. Los valores de pagos pendientes excluyen pedidos cancelados.

### 3.5 Roles y permisos

| Rol o tipo de acceso | Acciones disponibles |
|---|---|
| Visitante o cliente minorista | Consultar la página principal, catálogo, fichas, carrito, recomendaciones, formas de entrega y pago; registrar un pedido y consultarlo mediante su enlace privado. |
| Cliente mayorista | Consultar el catálogo mayorista, enviar una solicitud y, si recibe un enlace privado de cotización, consultarla y aceptarla o rechazarla. |
| Administrador | Iniciar sesión y gestionar pedidos, pagos, entregas, clientes, mayoristas, productos, existencias, configuración de envíos y pagos, reportes y exportaciones. |

**Tabla 2. Roles y permisos.** El acceso a una cotización o al seguimiento de un pedido depende de poseer el enlace privado correspondiente; no equivale a una cuenta con contraseña.

## 4. Navegación general y conceptos clave

### 4.1 Menú y acciones comunes

| Sección o acción | Cómo llegar o para qué sirve |
|---|---|
| Inicio | Vuelve a la portada, muestra productos destacados, ofertas, recomendador y preguntas frecuentes. |
| Catálogo | Consulta productos, filtra por mascota, busca texto y cambia el orden. |
| Ficha de producto | Abre al seleccionar un producto. Muestra descripción, precio, disponibilidad, información nutricional y presentaciones cuando están registradas. |
| Carrito | Revisa cantidades, elimina productos y continúa al checkout. |
| Mis Pedidos | Consulta el pedido usando un enlace o token privado. |
| Mayoristas | Selecciona productos y cantidades para enviar una solicitud de cotización. |
| Administración | Abre el acceso privado al panel de gestión. |
| Política de privacidad | Explica los datos que se solicitan y los usos descritos por el sitio. |

**Tabla 3. Menú y acciones de navegación.**

**Figura 1. Mapa de navegación de la tienda**

```text
Inicio ──┬── Catálogo ── Ficha de producto ── Carrito ── Checkout
         │                                          │
         │                                          └── WhatsApp: coordinar pago
         ├── Recomendador ── Ficha / añadir al carrito
         ├── Mis Pedidos ── Enlace privado ── Estado e historial
         └── Mayoristas ── Solicitud ── Cotización privada

Pie de página ── Administración ── Panel privado
             ├── Política de privacidad
             └── WhatsApp y redes sociales
```

### 4.2 Filtros, búsquedas y listas

- En el catálogo puedes buscar por texto, filtrar por **Todos**, **Perros** o **Gatos**, y ordenar por productos destacados, nombre o precio ascendente/descendente.
- En el administrador, los pedidos se filtran por número, cliente o teléfono, estado y fechas; también se ordenan del más reciente al más antiguo o al revés.
- Clientes pueden buscarse por nombre, correo o teléfono.
- Las solicitudes mayoristas pueden filtrarse por cliente o negocio, estado y rango de fechas.
- No se identificó paginación en las listas revisadas. Si una lista es larga, usa los filtros disponibles.

### 4.3 Glosario

| Término | Significado en el sistema |
|---|---|
| Carrito | Selección temporal de productos y cantidades antes de registrar un pedido. |
| Zona de entrega | Zona configurada por CHARQUI que determina la tarifa aplicable. |
| Envío gratis | Regla configurable para zonas elegibles cuando el subtotal alcanza el mínimo definido. |
| Pedido | Registro de compra con cliente, productos, dirección, total, forma de pago y estado. |
| Pago pendiente / confirmado | Indicador administrativo. Confirmar significa marcar el pago como recibido; el sitio no procesa pagos con tarjeta. |
| Enlace o token privado | Credencial secreta que permite consultar un pedido o cotización concretos. No debe compartirse públicamente. |
| Solicitud mayorista | Petición de propuesta comercial; por sí sola no crea una compra ni descuenta existencias. |
| Cotización | Propuesta de productos, cantidades, precios y condiciones preparada por CHARQUI. |
| Existencias / stock | Unidades disponibles registradas para un producto. |
| Movimiento de inventario | Registro de entrada, salida, ajuste u otros movimientos vinculados con existencias. |

**Tabla 4. Glosario de términos.**

## 5. Guías paso a paso por módulo o funcionalidad

### 5.1 Explorar la página principal y obtener recomendaciones

**Objetivo:** encontrar productos y acceder a las funciones de compra.

1. Abre **Inicio**.
2. Usa **Ver catálogo** o **Hacer mi pedido** para continuar.
3. En el recomendador, elige si buscas un snack para perro o gato.
4. Avanza por las preguntas de textura e ingrediente. La lista de ingredientes se obtiene de lo descrito en los productos.
5. Pulsa **Ver recomendaciones**. Puedes cambiar las respuestas o abrir la ficha de un producto.
6. Añade el producto al carrito desde una recomendación o desde su ficha.

Las recomendaciones son coincidencias con las preferencias escogidas, no una indicación veterinaria. La página recuerda que los snacks son complementarios.

### 5.2 Consultar el catálogo y una ficha

1. Abre **Catálogo**.
2. Escribe parte del nombre, descripción o tipo de mascota en el campo de búsqueda.
3. Elige un filtro de mascota y, si lo deseas, un criterio de orden.
4. Pulsa **Ver producto** para abrir la ficha.
5. Revisa precio, disponibilidad, descripción, información nutricional y presentaciones.
6. Si el producto tiene unidades disponibles, pulsa **Añadir al carrito**. Cada pulsación agrega una unidad, sin superar el stock indicado.

Los precios mostrados son los vigentes del catálogo. La aplicación vuelve a consultar disponibilidad y precios al preparar el pedido. Si una imagen no está disponible, se muestra un aviso alternativo.

### 5.3 Revisar y actualizar el carrito

1. Abre **Carrito** desde la cabecera.
2. Revisa productos, precio unitario, cantidad y subtotal.
3. Cambia la cantidad en el campo **Cantidad**. El valor debe ser entero, al menos 1 y no superar las unidades disponibles.
4. Pulsa **Eliminar** para quitar un producto.
5. Cuando no haya avisos de stock, pulsa **Continuar al pedido**.

El coste de entrega todavía no aparece como total definitivo en el carrito: se calcula después de elegir la zona en el checkout. Si un producto está agotado, ya no existe o la cantidad supera el stock, corrige o elimina esa línea antes de continuar.

### 5.4 Registrar y confirmar un pedido

**Figura 2. Recorrido de compra minorista**

```text
Elegir productos → Carrito → Datos de contacto y entrega
        → Revisar subtotal + envío + total
        → Confirmar pedido en el sitio
        → Pedido registrado → WhatsApp con mensaje preparado
        → El cliente envía el mensaje y coordina el pago
```

Completa los campos de la siguiente tabla. Los campos opcionales pueden dejarse vacíos.

| Campo | Obligatorio | Validación o uso |
|---|---:|---|
| Nombre completo | Sí | Nombre de la persona que realiza la compra. |
| Teléfono | Sí | Debe tener un formato válido; se utiliza para coordinar la entrega. |
| Correo electrónico | Sí | Debe tener formato de correo. |
| Cédula | No | Si se ingresa, debe tener entre 6 y 20 dígitos. No sirve para buscar pedidos. |
| Dirección exacta | Sí | Dirección principal de entrega. |
| Provincia, ciudad, sector/barrio, calles, número y referencia | No | Detalles complementarios de la dirección. |
| Latitud y longitud | No | Coordenadas; si se completa una, el sistema valida el par y su rango. |
| Zona de entrega | Sí | Selecciona una opción de la lista configurada. |
| Forma de pago | Sí | Selecciona una opción configurada por CHARQUI. El pago se coordina fuera del sitio. |
| Aceptación de la política de privacidad | Sí | Debes marcar la casilla para registrar el pedido. |

**Tabla 5. Campos del checkout.**

Pasos:

1. Desde el carrito, pulsa **Continuar al pedido**.
2. Completa los datos de contacto y dirección.
3. Selecciona la zona y la forma de pago.
4. Acepta la política de privacidad.
5. Revisa el resumen. El sitio muestra subtotal, costo de envío y total. El envío puede ser gratis en las zonas configuradas si se alcanza el mínimo vigente.
6. Pulsa **Confirmar pedido** una sola vez y espera la respuesta.
7. Si el registro tiene éxito, el navegador abre WhatsApp con un mensaje preparado que incluye el número de pedido, productos, envío, total, forma de pago y enlace privado de seguimiento.
8. Revisa el mensaje y envíalo desde WhatsApp para iniciar la coordinación. El sitio no envía ese mensaje ni cobra el pago automáticamente.

Si aparece un error o no sabes si el pedido se registró, no inicies una compra distinta de inmediato. Conserva la misma sesión y datos, espera el tiempo indicado si se muestra una limitación y consulta con CHARQUI antes de repetir la operación. El checkout conserva una clave técnica para que un reintento de la misma compra no cree otro pedido.

### 5.5 Consultar el seguimiento privado

**Figura 3. Ciclo de vida y seguimiento del pedido**

```text
Recibido y confirmado → En preparación → Listo para despacho
        → En reparto local → Entregado

El administrador puede cancelar un pedido antes de entregarlo,
sujeto a las reglas de producción mayorista.
El estado del pago se registra aparte del estado de entrega.
```

| Estado | Qué indica |
|---|---|
| Recibido y confirmado | El pedido se registró en el sistema. No significa que el pago ya esté confirmado. |
| En preparación | La preparación está en curso. |
| Listo para despacho | Está preparado para organizar su entrega. |
| En reparto local | El pedido está en reparto local. |
| Entregado | La entrega se marcó como completada. |
| Cancelado | El pedido fue cancelado. |
| En tu Puerta (estado anterior) | Estado heredado que puede aparecer en registros antiguos. |

**Tabla 6. Estados del pedido.**

1. Abre **Mis Pedidos**.
2. Pega el enlace privado recibido en el mensaje de WhatsApp, o copia el token incluido en ese enlace.
3. Pulsa **Buscar pedido**. Si abriste la página desde el enlace, la búsqueda se realiza automáticamente.
4. Revisa el número, fecha, estado, productos, total e historial visible.
5. **Repetir este pedido** agrega sus productos y cantidades al carrito actual; revisa disponibilidad y cantidades antes de comprar.

El enlace es privado y funciona como una llave: cualquier persona que lo tenga puede consultar ese pedido. El token tiene una vigencia técnica de un año. El sistema no permite buscar pedidos ajenos por datos personales.

### 5.6 Solicitar una cotización mayorista

**Figura 4. Solicitud y cotización mayorista**

```text
Elegir productos y cantidades
        → Completar datos del negocio y aceptar privacidad
        → Enviar solicitud → Registro confirmado
        → WhatsApp abre un mensaje preparado (el cliente lo envía)
        → CHARQUI revisa y prepara una cotización
        → Cliente abre el enlace privado y acepta o rechaza
        → Si acepta, administración puede convertirla en pedido
```

1. Abre **Mayoristas** y revisa los productos disponibles para cotizar.
2. Elige una cantidad entera positiva y pulsa **Agregar a la solicitud**.
3. Ajusta la cantidad en la lista, o pulsa **Quitar** para retirar un producto.
4. Completa el formulario y acepta el uso de datos.
5. Pulsa **Enviar solicitud**.
6. Solo después de que el sistema confirme el registro, se abre WhatsApp con el identificador de solicitud y los datos enviados. Revisa y envía el mensaje si deseas contactar a CHARQUI por ese medio.
7. La solicitud no equivale a una compra y no descuenta stock minorista.
8. Si CHARQUI prepara una cotización, recibirás un enlace privado para consultarla. Desde ese enlace puedes imprimirla/guardarla como PDF y aceptarla o indicar que no la aceptas.

| Campo | Obligatorio | Observación |
|---|---:|---|
| Productos y cantidades | Sí | Debe agregarse al menos un producto. Cantidades enteras entre 1 y 1.000.000. |
| Nombre del negocio | Sí | Hasta 150 caracteres. |
| Nombre del contacto | Sí | Hasta 120 caracteres. |
| Teléfono y WhatsApp | Sí | Deben tener formato válido. |
| Correo electrónico | Sí | Debe tener formato válido. |
| Tipo de negocio | Sí | Tienda de mascotas, distribuidor, veterinaria, emprendimiento u otro. |
| Tipo de negocio «Otro» | Condicional | Si eliges «Otro», completa el campo que describe el tipo. |
| Provincia y ciudad | Sí | Datos de ubicación del negocio. |
| Sector o dirección | No | Hasta 255 caracteres. |
| Observaciones | No | Hasta 2.000 caracteres. |
| Aceptación de privacidad | Sí | Debes marcar la casilla para enviar la solicitud. |

**Tabla 7. Datos de la solicitud mayorista.**

El catálogo puede mostrar cantidades sugeridas para un producto destacado y una opción de cantidad personalizada. Los precios mayoristas se definen en la propuesta, no en la solicitud pública.

### 5.7 Consultar o responder a una cotización

1. Abre el enlace privado enviado por CHARQUI.
2. Comprueba el código, productos, cantidades, precios, subtotal, descuento, envío, total, vigencia y condiciones de pago.
3. Si la cotización está enviada y vigente, pulsa **Aceptar cotización** o **No aceptar**.
4. Espera el mensaje de confirmación. Después de registrar una respuesta, los botones quedan desactivados.
5. Si el enlace no es válido o la cotización venció, comunícate con CHARQUI para solicitar ayuda o una actualización.

La aceptación confirma el interés en la propuesta; CHARQUI coordina la fecha y entrega. La creación del pedido mayorista se completa desde administración después de revisar disponibilidad y capacidad.

### 5.8 Usar los módulos administrativos

Después de iniciar sesión, el menú lateral organiza el trabajo por áreas. Las operaciones administrativas requieren sesión vigente.

| Módulo | Acciones y pasos disponibles |
|---|---|
| Resumen | Revisa pedidos, entregas, actividad mayorista, stock bajo y cifras financieras. Selecciona un indicador para abrir el módulo relacionado cuando esté habilitado. |
| Pedidos | Filtra por número/cliente/teléfono, estado y fechas. Abre **Ver ficha** para revisar cliente, dirección, productos, pago e historial. Registra el siguiente estado permitido, una observación opcional y si esa observación será visible al cliente. |
| Confirmación de pago | En la ficha del pedido, pulsa **Confirmar pago** solo cuando corresponda marcarlo como recibido. La acción registra el estado; no procesa una transferencia ni acepta datos de tarjeta. Un pago ya confirmado no puede confirmarse por segunda vez. |
| Entregas | Consulta pedidos listos para despacho o en reparto local. Selecciona una fila, registra repartidor, fecha/hora de salida y observaciones. Puedes abrir el mapa o un enlace de WhatsApp si los datos están disponibles. |
| Clientes | Busca por nombre, correo o teléfono y abre el historial de pedidos. La interfaz revisada permite consultar, no editar el perfil del cliente. |
| Productos | Crea o edita producto. Nombre, descripción, precio, stock y tipo de mascota son obligatorios. Oferta, presentaciones e información nutricional son opcionales; la oferta debe ser menor que el precio. Puedes elegir textura, estado y fotografía. |
| Existencias | Revisa stock y movimientos. Registra entrada, salida o ajuste con motivo obligatorio. Entrada/salida requiere unidades enteras positivas; el ajuste define el nuevo stock. No se permiten salidas que dejen stock negativo ni ajustes sin cambio. |
| Mayoristas | Filtra y revisa solicitudes, cambia su estado cuando corresponda, prepara cotizaciones, genera enlaces privados y convierte cotizaciones aceptadas en pedidos. Incluye capacidad y avance de producción para compromisos de patitas. |
| Envíos y pagos | Edita el mínimo de envío gratis, zonas y tarifas, zonas elegibles para envío gratis y formas de pago disponibles. Las formas de pago se ingresan una por línea. |
| Reportes | Consulta cifras por rango de fechas y resumen de productos. Pulsa **Descargar CSV** para exportar el reporte del mismo rango. |

**Tabla 8. Módulos administrativos.**

#### Productos y fotografías

1. Abre **Productos**.
2. Completa los campos requeridos y los opcionales que correspondan.
3. Para una fotografía, selecciona JPG, JPEG, PNG o WEBP de hasta 5 MB; revisa la vista previa.
4. Pulsa **Guardar producto**. Para editar, pulsa **Editar** en la fila antes de guardar.
5. **Retirar** cambia el producto a inactivo; no es una eliminación definitiva del registro.

#### Inventario

1. Abre **Existencias** y selecciona el producto.
2. Elige **Entrada**, **Salida** o **Ajuste a existencias**.
3. Escribe la cantidad o el stock objetivo, según el tipo, y completa el motivo.
4. Pulsa **Guardar movimiento**.
5. Consulta el historial para ver fecha, tipo, cantidad, stock anterior y posterior, motivo y responsable.

La alerta de stock bajo se activa en cinco unidades o menos. La venta minorista descuenta existencias al registrar el pedido. Una cancelación puede devolverlas; los compromisos de patitas mayoristas se gestionan por producción y no por el stock minorista de paquetes.

#### Pedidos, pagos y entregas

Los estados de entrega avanzan en orden. No se puede saltar directamente a un estado posterior. El administrador puede cancelar antes de la entrega; si la producción de patitas mayoristas ya comenzó, el sistema impide esa cancelación. Las observaciones del historial solo se muestran al cliente cuando se marca la casilla correspondiente.

#### Solicitudes y cotizaciones mayoristas

1. Abre **Mayoristas**, aplica filtros y pulsa **Revisar**.
2. Examina datos del negocio, productos, actividad y cotizaciones anteriores.
3. Usa **Crear cotización** para definir productos, cantidades y precios unitarios; completa descuento, envío, vigencia y condiciones de pago si aplican.
4. Las observaciones internas son solo para administración. Una cotización con precios incompletos queda como borrador; para prepararla, cada producto debe tener precio.
5. Usa **Preparar enlace privado y WhatsApp** para generar el enlace que se comparte con el negocio.
6. Tras la aceptación del cliente, usa **Revisar y convertir**. Indica una fecha de entrega igual o posterior a hoy.
7. Para patitas gestionadas por producción, registra capacidad en la fecha antes de convertir. El sistema comprueba que las unidades comprometidas no superen la capacidad.
8. Actualiza el progreso de producción sin retroceder cantidades y respetando: entregadas ≤ listas ≤ producidas ≤ solicitadas.

| Campo de cotización | Uso |
|---|---|
| Producto y cantidad | Líneas de la propuesta; cada producto debe aparecer una sola vez. |
| Precio unitario | Se define manualmente; admite hasta tres decimales. Si falta un precio, la cotización se guarda como borrador. |
| Descuento y envío | Valores monetarios no negativos; el descuento no puede superar el subtotal. |
| Vigencia | Opcional al guardar; si se informa, debe ser hoy o una fecha posterior. |
| Condiciones de pago | Texto opcional mostrado en la cotización. |
| Observaciones internas | Nota administrativa; no se muestra en el documento privado del cliente. |
| Fecha de entrega | Obligatoria al convertir una cotización aceptada; no puede ser anterior a hoy. |

**Tabla 9. Campos de la cotización mayorista.**

#### Reportes y archivo CSV

1. Abre **Reportes**.
2. Selecciona una fecha inicial y final, o deja ambas vacías para consultar el rango general que usa el sistema.
3. Pulsa **Consultar**.
4. Revisa pedidos registrados, entregados y cancelados, valor en pedidos, pagos pendientes y confirmados, y productos destacados por unidades/valor.
5. Pulsa **Descargar CSV** para obtener un archivo compatible con hojas de cálculo.

Los pedidos cancelados se cuentan en el indicador de registrados y se muestran por separado, pero se excluyen del valor de pedidos y de pagos pendientes. Los pagos confirmados reflejan los registros marcados como confirmados; no descuentan devoluciones.

**Figura 5. Recorrido general de administración**

```text
Iniciar sesión → Resumen → Elegir módulo
       ├── Pedidos → ficha → estado / pago / entrega
       ├── Productos → crear / editar / retirar
       ├── Existencias → movimiento → historial
       ├── Mayoristas → solicitud → cotización → aceptación → pedido
       ├── Envíos y pagos → configuración
       └── Reportes → consultar → descargar CSV
                         ↓
                    Cerrar sesión
```

### 5.9 Privacidad y cuidado de los enlaces

El checkout solicita datos de contacto y entrega; cédula, referencias, coordenadas y detalles complementarios son opcionales. La política indica que no se solicitan ni almacenan datos de tarjetas. Los datos se usan para gestionar pedidos, entrega, pago y seguimiento.

Los enlaces privados de pedido y cotización deben compartirse solo con la persona destinataria. Al abrir WhatsApp, el sistema deja preparado un mensaje; el usuario decide si lo envía. WhatsApp y las redes sociales son servicios externos sujetos a sus propias condiciones.

## 6. Mensajes del sistema, alertas y errores frecuentes

| Síntoma o mensaje | Qué significa | Qué hacer |
|---|---|---|
| “No encontramos productos con esos criterios” | Ningún producto coincide con la búsqueda y filtros. | Borra parte del texto, cambia el filtro o el orden. |
| Producto agotado o cantidad superior al stock | La disponibilidad cambió o el carrito supera las unidades existentes. | Vuelve al carrito, reduce la cantidad o elimina el producto. |
| “Revisa tus datos, dirección y consentimiento…” | Falta un dato obligatorio o algún valor no pasa la validación. | Revisa los campos marcados, el formato del teléfono/correo y la aceptación de privacidad. |
| “El servidor limitó temporalmente la solicitud” o “demasiadas solicitudes” | Se alcanzó el límite temporal de solicitudes. | Espera los segundos indicados, si aparecen, y vuelve a intentar con los mismos datos; no abras un pedido diferente mientras desconoces el resultado anterior. |
| “No encontramos un pedido asociado a ese enlace” o enlace no válido/vencido | El token no corresponde a un pedido disponible o no fue copiado completo. | Vuelve al mensaje original, copia el enlace completo y comprueba que no incluya espacios. |
| “Correo o contraseña incorrectos” | Las credenciales de administración no coinciden. | Comprueba los datos y contacta a la persona responsable; la pantalla no tiene recuperación de contraseña. |
| “Se requiere iniciar sesión como administrador” o “El token no es válido” | La sesión no existe o venció. | Inicia sesión nuevamente. |
| El pago ya estaba confirmado | El pedido ya aparece marcado como pagado. | Revisa la ficha y el historial antes de tomar otra acción. |
| “El cambio no sigue el orden permitido” | Se intentó saltar un estado del pedido. | Selecciona el siguiente estado permitido en la secuencia. |
| Cotización vencida | Terminó su vigencia. | Comunícate con CHARQUI para solicitar una actualización. |
| Error al cargar catálogo, carrito o reporte | El sitio no pudo completar una consulta. | Comprueba tu conexión, espera un momento y vuelve a consultar. Si persiste, contacta a CHARQUI. |
| La fotografía no cumple el formato o tamaño | El archivo no es JPG/JPEG/PNG/WEBP o supera 5 MB. | Selecciona una imagen compatible y menor o igual a 5 MB. |

**Tabla 10. Mensajes y resolución rápida.**

### Buenas prácticas

- Escribe un teléfono y correo que puedas revisar.
- Revisa zona, dirección, productos y cantidades antes de confirmar.
- No actualices ni vuelvas a enviar el checkout repetidamente si no sabes si se registró el pedido.
- Conserva los enlaces privados en un lugar seguro y no los publiques.
- Verifica la información del pago antes de marcarlo como confirmado en administración.
- Al enviar una solicitud o pedido, recuerda que el mensaje de WhatsApp queda preparado: debes revisarlo y enviarlo tú.
- No introduzcas números de tarjeta ni información de pago confidencial en los formularios del sitio.

## 7. Preguntas frecuentes y soporte

**¿Necesito crear una cuenta para comprar?**  
No se encontró una pantalla de registro o acceso de clientes. El checkout solicita los datos necesarios para tramitar el pedido.

**¿Cómo confirmo una compra?**  
Completa el checkout y pulsa **Confirmar pedido**. Si el registro funciona, el pedido queda guardado y se abre WhatsApp con un mensaje preparado. Envíalo desde WhatsApp para coordinar el pago. El registro del pedido no confirma que el pago haya sido recibido.

**¿Puedo pagar con tarjeta dentro de la página?**  
No. El sitio registra la forma de pago elegida, pero indica que el pago se coordina por WhatsApp y no solicita datos de tarjetas.

**¿Cómo consulto mi pedido?**  
Abre **Mis Pedidos** y pega el enlace privado recibido al confirmar la compra. No se consulta por cédula ni por el número de pedido solamente.

**¿Qué hago si perdí el enlace de seguimiento?**  
El repositorio no muestra una función de recuperación o búsqueda pública. Contacta a CHARQUI por el enlace de WhatsApp visible en el sitio y proporciona información suficiente para que el equipo te ayude sin compartir públicamente datos personales.

**¿La cotización mayorista es una compra?**  
No. Enviar una solicitud no crea un pedido ni descuenta el inventario minorista. El pedido mayorista se crea después de la aceptación y revisión administrativa de la cotización.

**¿La aceptación de una cotización crea automáticamente el pedido?**  
No por sí sola. La aceptación queda registrada; desde administración se revisa la propuesta y se convierte en pedido indicando fecha de entrega y disponibilidad.

**¿Puedo cambiar una cantidad del carrito?**  
Sí, desde **Carrito**, siempre que la cantidad sea un entero positivo y no supere el stock disponible.

**¿A dónde puedo escribir?**  
El sitio configura un enlace de WhatsApp de CHARQUI y muestra enlaces a Facebook, Instagram y TikTok. El código no publica un horario de atención ni un correo de soporte. WhatsApp abre una conversación externa; no se envía un mensaje automáticamente.

## 8. Datos pendientes de confirmación editorial

- **Autor(es) y responsable institucional:** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. No se encontró un campo de autor en los metadatos técnicos revisados.
- **Versión editorial y fecha oficial de publicación:** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. `package.json` indica 1.0.0, pero no confirma que sea la versión comercial publicada.
- **Navegadores y versiones mínimas compatibles:** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. Revisar el procedimiento de soporte y compatibilidad del equipo responsable.
- **Canales y horarios oficiales de soporte:** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. El sitio ofrece WhatsApp y redes sociales, pero no define horario ni correo de soporte.
- **Credenciales y procedimiento de recuperación administrativa:** [PENDIENTE DE VERIFICAR EN INTERFAZ/CÓDIGO]. La pantalla de administración no incluye recuperación; confirmar el procedimiento institucional fuera de la interfaz.
