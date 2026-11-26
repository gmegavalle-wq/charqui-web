# ANEXO B: CASOS DE PRUEBA Y RESULTADOS DE VALIDACIÓN DEL SISTEMA CHARQUI

**Proyecto:** CHARQUI
**Descripción:** plataforma web para la comercialización de snacks deshidratados naturales para mascotas.
**Tipo de documento:** Casos de prueba y resultados de validación.
**Anexo:** B.
**Versión del proyecto identificada:** 1.0.0
**Fecha de la ejecución automatizada documentada:** 26 de noviembre de 2026.

<!-- PAGEBREAK -->

> **Criterio de evidencia.** Este anexo diferencia las pruebas ejecutadas en esta revisión de las pruebas presentes en el código pero no ejecutadas, y de las verificaciones visuales o de exportación que no cuentan con evidencia suficiente. No describe como probado un flujo solo porque exista su implementación.

## Índice

- B.1. Introducción
- B.2. Objetivos de las pruebas
- B.3. Alcance de las pruebas
- B.4. Entorno de pruebas
- B.5. Metodología de pruebas
- B.6. Casos de prueba
- B.7. Organización de los casos por módulos
- B.8. Resumen de resultados
- B.9. Incidencias identificadas y correcciones
- B.10. Evidencias de las pruebas
- B.11. Limitaciones de las pruebas
- B.12. Conclusiones
- Referencias técnicas

<!-- PAGEBREAK -->

## B.1. Introducción

Las pruebas de software permiten contrastar el comportamiento de una aplicación con criterios observables y detectar errores antes de que afecten a sus usuarios. En CHARQUI, las verificaciones abarcan funciones de seguridad, respuestas HTTP, operaciones de comercio y componentes de administración.

El presente anexo registra las pruebas existentes en `backend/test/`, una ejecución de pruebas unitarias y HTTP simuladas realizada el 26 de noviembre de 2026, y las verificaciones que permanecen pendientes. Distingue la persistencia simulada de una integración con MariaDB real, y una respuesta HTTP de una interacción completa en navegador o con un servicio externo.

## B.2. Objetivos de las pruebas

### Objetivo general

Documentar las comprobaciones disponibles y ejecutadas para evaluar aspectos seleccionados de seguridad, respuestas HTTP, pedidos, pagos, seguimiento y gestión mayorista de CHARQUI, identificando con precisión su entorno y sus limitaciones.

### Objetivos específicos

1. Registrar las pruebas automatizadas que se ejecutaron y sus resultados.
2. Separar las pruebas unitarias y las pruebas HTTP con persistencia simulada de la integración con MariaDB.
3. Identificar las comprobaciones de interfaz, exportación de archivos y WhatsApp que no cuentan con evidencia de ejecución suficiente.
4. Documentar correcciones visibles en el estado del código sin atribuirles una validación de usuario que no se realizó.
5. Presentar resultados cuantificados sin confundir casos documentados, ejecuciones automatizadas y módulos funcionales.

## B.3. Alcance de las pruebas

Las pruebas automatizadas verificadas en esta revisión cubren:

- Longitud mínima del secreto JWT.
- Validación de coordenadas opcionales.
- Creación y validación de tokens de seguimiento.
- Limitación de solicitudes y respuesta HTTP 429.
- Inicio de sesión, catálogo API, autorización administrativa y CORS mediante un servidor HTTP local con persistencia simulada.
- Creación de pedidos, cálculo del subtotal, costo de envío y total, idempotencia, seguimiento, transición de estado, confirmación de pago y datos del dashboard/reporte mediante persistencia simulada.
- Solicitudes y cotizaciones mayoristas mediante persistencia simulada.

No forman parte de la ejecución automatizada de esta revisión: la interfaz completa en navegador, los flujos manuales del carrito y checkout, la descarga de un CSV en un navegador, la entrega de mensajes WhatsApp y la integración real con MariaDB.

El alcance no equivale a una certificación de calidad, seguridad o preparación para producción.

## B.4. Entorno de pruebas

**Tabla B.1**

*Entorno de pruebas documentado*

| Componente | Evidencia y alcance |
|---|---|
| Sistema operativo | Windows; las pruebas se invocaron desde PowerShell. No se verificó la edición o compilación de Windows. |
| Node.js de la ejecución | `v24.11.1`, comprobado mediante `node --version`. |
| Versión de Node declarada | `20.x` en `package.json`. Esta ejecución no demuestra compatibilidad ni aprobación bajo Node.js 20. |
| npm disponible | `11.6.2`. El comando de pruebas usado no depende de un script npm. |
| Runner | `node:test`, incluido en Node.js; aserciones con `node:assert/strict`. |
| Base simulada HTTP | Estado en memoria dentro de `integracion-http.test.js`; el archivo sustituye las funciones del pool para no conectarse a MariaDB. |
| Servidor HTTP de prueba | Express escucha en `127.0.0.1` con puerto asignado por el sistema durante la prueba. |
| MariaDB | No se usó en la ejecución documentada. MariaDB 10.4.32 aparece como versión reportada en una validación previa, no como servidor comprobado en esta ejecución. |
| Base aislada prevista | `charqui_web_test`, exigida por `integracion-mariadb.test.js`. La prueba requiere una configuración externa referenciada por `CHARQUI_TEST_DB_ENV`. |
| Navegador | No se usó para la ejecución automatizada de este anexo. |
| Datos | Valores de prueba y estructuras simuladas; no se usaron datos personales reales ni credenciales de producción. |

*Nota.* Node.js 20.x es la versión declarada; Node.js 24.11.1 es la versión observada durante la ejecución de este anexo.

`package.json` no define un script `test`. La ejecución realizada fue:

```powershell
node --test backend/test/seguridad-basica.test.js backend/test/integracion-http.test.js
```

La integración MariaDB se excluyó intencionalmente: el test inserta registros ficticios y modifica datos de la base aislada. En esta sesión no estaba configurada `CHARQUI_TEST_DB_ENV`. No se ejecutó ninguna prueba contra `charqui_web`.

## B.5. Metodología de pruebas

### B.5.1. Procedimiento

1. Se inspeccionaron los tres archivos `backend/test/*.test.js` para distinguir pruebas unitarias, HTTP simuladas e integración MariaDB.
2. Se ejecutaron solo `seguridad-basica.test.js` e `integracion-http.test.js`.
3. Se revisó el resumen emitido por `node:test`, que informó nueve pruebas aprobadas, cero fallidas y cero omitidas en esa selección.
4. Se dejó sin ejecutar `integracion-mariadb.test.js`, dado que escribe en la base de pruebas y requiere una configuración que apunte exclusivamente a `charqui_web_test`.
5. Se clasificaron por separado las interacciones de interfaz y los servicios externos sin evidencia de ejecución.

### B.5.2. Estados utilizados

**Tabla B.2**

*Criterios de clasificación de los resultados*

| Estado | Criterio |
|---|---|
| APROBADA | La prueba fue ejecutada y la evidencia disponible muestra que las aserciones del caso coincidieron con el resultado esperado. |
| FALLIDA | La prueba fue ejecutada y su resultado no coincidió con el esperado. |
| NO EJECUTADA | No se ejecutó el procedimiento de prueba en el entorno de esta revisión. |
| NO VERIFICADA | Hay evidencia parcial o indirecta, pero no alcanza para confirmar el resultado completo del caso definido. |

*Nota.* Los estados reflejan la evidencia disponible para cada ficha; el código de prueba por sí solo no justifica APROBADA.

La expresión **prueba automatizada** se reserva para una ejecución del runner. Un caso documentado puede desglosar una función no cubierta en pruebas automatizadas; por ello, el total de fichas no se presenta como el total de ejecuciones del runner.

<!-- PAGEBREAK -->

## B.6. Casos de prueba

### CP-001. Longitud mínima del secreto JWT

- **Módulo:** Seguridad.
- **Objetivo:** comprobar la aceptación del límite mínimo en bytes y el rechazo de valores más cortos o ausentes.
- **Tipo:** prueba unitaria automatizada.
- **Precondiciones:** ninguna conexión de red o base de datos.
- **Datos:** secreto de longitud mínima, uno de longitud inferior y valor nulo.
- **Procedimiento:** llamar a `secretoJwtValido` con los tres valores.
- **Resultado esperado:** aceptar el valor que alcanza el límite y rechazar el valor corto y el nulo.
- **Resultado obtenido:** las aserciones pasaron.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/seguridad-basica.test.js`, prueba “secreto JWT debe tener longitud mínima en bytes”; ejecución del 26-11-2026.

### CP-002. Validación de coordenadas opcionales

- **Módulo:** Registro de pedidos y validaciones.
- **Objetivo:** comprobar que las coordenadas se omiten en pareja y que valores incompletos o fuera de rango se rechazan.
- **Tipo:** prueba unitaria automatizada.
- **Precondiciones:** ninguna conexión de red o base de datos.
- **Datos:** ambas coordenadas nulas; par válido `-0.2`, `-78.5`; una sola coordenada; latitud `91`; y valor no numérico.
- **Procedimiento:** pasar cada par a `coordenadasValidas`.
- **Resultado esperado:** aceptar el par omitido y el válido; rechazar las demás combinaciones.
- **Resultado obtenido:** todas las aserciones pasaron.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/seguridad-basica.test.js`, prueba “coordenadas son opcionales en pareja y deben estar dentro de rango”.

### CP-003. Verificación del token privado de seguimiento

- **Módulo:** Seguimiento de pedidos y seguridad.
- **Objetivo:** confirmar que un token se valida con el secreto correspondiente y devuelve el identificador de pedido asociado.
- **Tipo:** prueba unitaria automatizada.
- **Precondiciones:** ninguna base de datos.
- **Datos:** identificador ficticio `42`, secreto de prueba y un secreto diferente.
- **Procedimiento:** generar el token, verificarlo con el secreto correcto y comprobar el rechazo con otro secreto.
- **Resultado esperado:** recuperar el identificador con el secreto correcto y lanzar error con el secreto distinto.
- **Resultado obtenido:** las aserciones pasaron.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/seguridad-basica.test.js`, prueba “token de seguimiento solo verifica con su secreto y pedido”.

### CP-004. Reproducción del token con fecha original

- **Módulo:** Seguimiento de pedidos.
- **Objetivo:** verificar que la creación del token es reproducible cuando se proporciona el mismo identificador, secreto y fecha de emisión.
- **Tipo:** prueba unitaria automatizada.
- **Precondiciones:** ninguna base de datos.
- **Datos:** identificador ficticio `42`, secreto de prueba y marca de tiempo fija.
- **Procedimiento:** crear dos tokens con los mismos valores y compararlos.
- **Resultado esperado:** ambos tokens coinciden.
- **Resultado obtenido:** la comparación pasó.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/seguridad-basica.test.js`, prueba “token de seguimiento puede reproducirse con la fecha original de emisión”.

### CP-005. Limitador unitario y respuesta 429

- **Módulo:** Seguridad.
- **Objetivo:** comprobar el bloqueo al superar el umbral y la cabecera `Retry-After`.
- **Tipo:** prueba unitaria automatizada con reloj controlado.
- **Precondiciones:** ninguna base de datos.
- **Datos:** umbral 1, ventana de 10 segundos y reloj simulado.
- **Procedimiento:** pasar dos solicitudes de la misma IP; avanzar el reloj hasta el final de la ventana y hacer una tercera.
- **Resultado esperado:** primera solicitud continúa; segunda devuelve 429 y `Retry-After: 10`; después de la ventana se permite continuar.
- **Resultado obtenido:** todas las aserciones pasaron.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/seguridad-basica.test.js`, prueba “limitador responde 429 y Retry-After al alcanzar el umbral”. Es una prueba unitaria, no una prueba de carga.

### CP-006. Inicio de sesión, catálogo API, autorización y CORS

- **Módulo:** Catálogo, autenticación y administración.
- **Objetivo:** comprobar respuestas API seleccionadas, acceso administrativo con JWT y política CORS.
- **Tipo:** integración HTTP con persistencia simulada.
- **Precondiciones:** servidor Express local del test; pool MySQL reemplazado por funciones que devuelven datos simulados.
- **Datos:** administrador, producto y orígenes web ficticios definidos dentro de la prueba.
- **Procedimiento:** consultar catálogo y ficha, probar endpoint administrativo sin token, iniciar sesión, acceder al dashboard con JWT, alterar el token, enviar preflight y usar orígenes permitidos y no permitidos.
- **Resultado esperado:** catálogo y ficha 200; administración sin credenciales y JWT alterado 403; login y dashboard autorizado 200; el origen permitido se refleja y el no permitido no se habilita.
- **Resultado obtenido:** aserciones del caso aprobadas en HTTP local con base simulada.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/integracion-http.test.js`, prueba “HTTP: login, catálogo, autorización de administración y CORS”.
- **Limitación:** no comprueba MariaDB, una sesión de navegador ni el catálogo visual, sus filtros o su ordenamiento.

### CP-007. Pedido, seguimiento, pagos e informes mediante HTTP simulado

- **Módulo:** Registro y seguimiento de pedidos, pagos y reportes administrativos.
- **Objetivo:** comprobar el flujo API cubierto por la prueba HTTP con persistencia en memoria.
- **Tipo:** integración HTTP simulada.
- **Precondiciones:** servidor Express local y pool simulado por mapas en memoria.
- **Datos:** producto de prueba de valor unitario 5, cantidades ficticias, costo de envío configurado en el mock y claves de idempotencia UUID.
- **Procedimiento:** crear pedidos; verificar subtotal, envío y total; repetir una clave; reutilizarla con datos distintos; actualizar un estado; consultar con tokens válidos y alterados; confirmar pago; consultar dashboard, reporte y respuesta CSV.
- **Resultado esperado:** pedido inicial 201 y duplicado idéntico reutilizado sin descontar stock por segunda vez; misma clave con contenido diferente 409; transición inválida 409 y válida 200; seguimiento devuelve solo datos previstos; confirmación de pago única; dashboard y reporte 200; el CSV contiene encabezados de importes definidos por el test.
- **Resultado obtenido:** las aserciones de esta prueba pasaron. El CSV fue una respuesta textual del endpoint en el entorno simulado; no se descargó ni abrió un archivo en navegador.
- **Estado:** **APROBADA**, con alcance limitado al test simulado.
- **Evidencia:** `backend/test/integracion-http.test.js`, prueba “HTTP: crea pedidos, aísla seguimiento por token y refleja confirmación de pago”.
- **Limitación:** no demuestra persistencia, transacciones reales, reversión en MariaDB ni una exportación descargada desde el navegador.

### CP-008. Solicitud y cotización mayorista

- **Módulo:** Ventas mayoristas.
- **Objetivo:** verificar la creación de una solicitud, cotización privada y respuesta del cliente a través de la API.
- **Tipo:** integración HTTP simulada.
- **Precondiciones:** servidor HTTP local y persistencia sustituida por datos en memoria.
- **Datos:** negocio, contacto, producto y cotización ficticios.
- **Procedimiento:** registrar una solicitud; crear y enviar una cotización administrativa; consultar el enlace privado; responder aceptación y repetir la decisión.
- **Resultado esperado:** creación de solicitud/cotización 201; token privado válido; respuesta pública sin correo; aceptación 200 y repetición 409.
- **Resultado obtenido:** todas las aserciones pasaron contra la persistencia simulada.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/integracion-http.test.js`, prueba “HTTP: solicitud mayorista, cotización privada y respuesta del cliente”.
- **Limitación:** no se validó la interfaz administrativa ni se envió un WhatsApp.

### CP-009. Límite de intentos de inicio de sesión por HTTP

- **Módulo:** Seguridad y autenticación.
- **Objetivo:** confirmar el bloqueo HTTP por exceso de intentos y la presencia de `Retry-After`.
- **Tipo:** integración HTTP con estado del limitador compartido durante la suite.
- **Precondiciones:** pruebas HTTP ejecutadas en el orden establecido por el archivo, que comparte el proceso y el limitador.
- **Datos:** credenciales ficticias incorrectas y dirección IP local del test.
- **Procedimiento:** ejecutar el escenario de intentos fallidos y comprobar respuestas 401 antes del umbral, seguida de 429.
- **Resultado esperado:** las solicitudes dentro del límite reciben la respuesta de autenticación; la solicitud que excede el límite devuelve 429 y `Retry-After`.
- **Resultado obtenido:** el caso pasó en la ejecución conjunta de las cuatro pruebas HTTP.
- **Estado:** **APROBADA**.
- **Evidencia:** `backend/test/integracion-http.test.js`, prueba “HTTP: el límite de inicio de sesión permite ocho intentos y bloquea el siguiente”.
- **Limitación:** el escenario comparte estado con accesos de pruebas anteriores; no es una medición independiente de ocho solicitudes desde un limitador recién reiniciado.

### CP-010. Integración real con MariaDB aislada

- **Módulo:** Catálogo, pedidos, inventario, seguimiento, pagos, reportes y mayoristas.
- **Objetivo:** ejecutar el escenario de extremo a extremo previsto contra MariaDB local de pruebas.
- **Tipo:** integración HTTP con base de datos real.
- **Precondiciones:** `CHARQUI_TEST_DB_ENV` configurada; `DB_NAME` exactamente `charqui_web_test`; host local; esquema y fixtures requeridos, incluida `idempotencia_pedidos`.
- **Datos:** fixtures y registros ficticios del test.
- **Procedimiento ejecutado en esta revisión:** ninguno. El test no se lanzó porque la variable `CHARQUI_TEST_DB_ENV` no estaba configurada.
- **Resultado esperado:** el script contiene aserciones para catálogo, envío, pedido, inventario, rollback, idempotencia secuencial y concurrente, seguimiento, pago, reporte y mayoristas.
- **Resultado obtenido:** no existe resultado de ejecución en MariaDB para esta revisión. La existencia de aserciones en el archivo no equivale a una prueba aprobada.
- **Estado:** **NO EJECUTADA**.
- **Evidencia:** `backend/test/integracion-mariadb.test.js`; inspección de la condición de aislamiento y ausencia de la variable en el entorno.
- **Precaución:** el test inserta registros ficticios en `charqui_web_test`. No se ejecutó contra `charqui_web` ni contra una base de producción.

### CP-011. Catálogo visual: búsqueda, filtros, ordenamiento y ficha

- **Módulo:** Catálogo de productos.
- **Objetivo:** verificar interacción visual y navegación de la página de catálogo, controles de búsqueda/filtro/orden y ficha de producto en navegador.
- **Tipo:** funcional de interfaz.
- **Precondiciones:** aplicación iniciada, datos de prueba y navegador.
- **Datos:** productos de prueba con atributos suficientes para cada filtro.
- **Procedimiento ejecutado en esta revisión:** ninguno. Las pruebas HTTP consultan una lista y una ficha simuladas, pero no prueban controles del DOM.
- **Resultado esperado:** controles visibles, resultados coherentes con cada criterio y ficha correcta al seleccionar un producto.
- **Resultado obtenido:** no se documentó un recorrido de navegador con evidencia reproducible para esta revisión.
- **Estado:** **NO EJECUTADA**.
- **Evidencia asociada:** ninguna captura de este recorrido. Las respuestas API cubiertas por CP-006 no sustituyen esta prueba.

### CP-012. Carrito y checkout en navegador

- **Módulo:** Carrito y registro de pedidos.
- **Objetivo:** comprobar agregar, modificar y retirar productos, totales y envío del formulario desde la interfaz.
- **Tipo:** funcional de interfaz de extremo a extremo.
- **Precondiciones:** navegador, servidor, productos de prueba y base aislada autorizada.
- **Datos:** productos ficticios disponibles y datos de cliente ficticios.
- **Procedimiento ejecutado en esta revisión:** ninguno.
- **Resultado esperado:** cantidades y totales coherentes, validaciones de formulario visibles y pedido de prueba creado una sola vez.
- **Resultado obtenido:** no verificado en navegador. CP-007 solo cubre peticiones API y persistencia simulada.
- **Estado:** **NO EJECUTADA**.
- **Evidencia asociada:** ninguna.

### CP-013. Revisión funcional del panel administrativo en navegador

- **Módulo:** Administración, pedidos e inventario.
- **Objetivo:** validar navegación y operación de los módulos del administrador desde el navegador.
- **Tipo:** interfaz funcional.
- **Precondiciones:** sesión administrativa de pruebas y datos aislados.
- **Datos:** usuario y registros ficticios.
- **Procedimiento ejecutado:** en una revisión visual anterior se observó el panel y el módulo Existencias; no se conserva una captura ni un registro de pasos que pruebe la operación del formulario, pedidos o reportes.
- **Resultado esperado:** panel accesible, controles operativos y cambios reflejados en la base aislada.
- **Resultado obtenido:** solo consta la observación parcial de la vista Existencias. No hay evidencia suficiente de un flujo funcional completo.
- **Estado:** **NO VERIFICADA**.
- **Evidencia asociada:** descripción de la revisión visual previa en `docs/manual_tecnico_charqui.md`; no existe captura local asociada a esta ficha.

### CP-014. Descarga y formato integral del CSV

- **Módulo:** Reportes administrativos.
- **Objetivo:** comprobar descarga en navegador, nombre de archivo, encabezados, codificación y contenido del CSV generado con datos de prueba.
- **Tipo:** integración de exportación y comprobación de archivo.
- **Precondiciones:** administrador de pruebas, dataset aislado y navegador o cliente HTTP que guarde el archivo.
- **Datos:** pedidos ficticios con pagos pendientes, confirmados y cancelados.
- **Procedimiento ejecutado en esta revisión:** no se descargó ningún archivo. CP-007 verificó contenido textual de la respuesta en un test simulado, pero no la codificación, el nombre del archivo ni una descarga.
- **Resultado esperado:** archivo descargable, encabezados y contenido íntegros, codificación legible.
- **Resultado obtenido:** formato integral del archivo no comprobado.
- **Estado:** **NO VERIFICADA**.
- **Evidencia asociada:** aserciones textuales limitadas en `backend/test/integracion-http.test.js`; no existe archivo exportado de esta revisión.

### CP-015. Apertura y envío de mensajes por WhatsApp

- **Módulo:** Integración externa y ventas.
- **Objetivo:** verificar que el enlace `wa.me` se abre correctamente y que el mensaje se presenta codificado; distinguirlo de la entrega efectiva del mensaje.
- **Tipo:** integración de interfaz con servicio externo.
- **Precondiciones:** navegador, número ficticio o de pruebas y acceso a WhatsApp.
- **Datos:** texto no sensible de prueba y número controlado.
- **Procedimiento ejecutado en esta revisión:** ninguno. La inspección del frontend encontró construcción de enlaces `wa.me`, pero no se abrió el enlace ni se envió mensaje.
- **Resultado esperado:** URL válida y texto presentado en el cliente de WhatsApp. La entrega/recepción requeriría una verificación externa adicional.
- **Resultado obtenido:** no hay evidencia de apertura, envío o recepción.
- **Estado:** **NO EJECUTADA**.
- **Evidencia asociada:** inspección de referencias `wa.me` en scripts frontend; no constituye prueba de servicio externo.

## B.7. Organización de los casos por módulos

### B.7.1. Catálogo de productos

- **CP-006:** lista y detalle mediante API con persistencia simulada, aprobados como parte de una prueba HTTP.
- **CP-011:** búsqueda, filtros, ordenamiento y navegación visual, no ejecutados en navegador.

La prueba CP-006 no acredita búsqueda, filtros ni ordenamiento de la interfaz.

### B.7.2. Carrito de compras

- **CP-012:** operaciones del carrito visual y cálculo mostrado en navegador, no ejecutados.

### B.7.3. Registro de pedidos

- **CP-007:** cálculo API del subtotal, envío y total, creación e idempotencia mediante estado simulado, aprobado.
- **CP-010:** persistencia MariaDB, inventario y transacciones reales, no ejecutado.
- **CP-012:** recorrido de checkout desde la interfaz, no ejecutado.

La prueba simulada no confirma rollback con motor SQL real. Esa aserción está prevista en el test MariaDB, que no se ejecutó.

### B.7.4. Seguimiento de pedidos

- **CP-003 y CP-004:** funciones unitarias de token, aprobadas.
- **CP-007:** consulta HTTP, ocultamiento de datos sensibles y rechazo de token alterado, cubiertos por la prueba simulada.
- **CP-010:** integración de seguimiento con MariaDB, no ejecutada.

### B.7.5. Pagos

- **CP-007:** confirmación API única, rechazo de repetición y cifras del reporte mediante mock, aprobados en el alcance simulado.
- No se verificó transferencia, pasarela de pago ni conciliación con una entidad financiera.

### B.7.6. Administración

- **CP-006:** autenticación, JWT y autorización de dashboard por API con persistencia simulada, aprobados.
- **CP-007:** dashboard e informe API con datos simulados, aprobados.
- **CP-013:** flujo visual de administración, no verificado de forma completa.

La ejecución no cubrió todas las acciones del panel, la gestión visual de productos ni una operación completa de inventario desde el navegador.

### B.7.7. Módulo mayorista

- **CP-008:** solicitud, cotización privada y respuesta API con mocks, aprobado.
- No se verificó la operación completa del panel mayorista en navegador ni el envío de WhatsApp.

### B.7.8. Seguridad

- **CP-001:** longitud de secreto JWT, aprobada.
- **CP-003 y CP-004:** validación y reproducción controlada del token de seguimiento, aprobadas.
- **CP-005 y CP-009:** limitación de solicitudes, aprobada en pruebas unitaria y HTTP simulada.
- **CP-006:** acceso administrativo, JWT y CORS, aprobado para las rutas ejercitadas.

Estos resultados no representan una auditoría de seguridad completa ni una prueba de penetración.

### B.7.9. Exportación de reportes

- **CP-007:** respuesta CSV simulada con comprobación textual de campos esperados, aprobada dentro de ese alcance.
- **CP-014:** archivo descargado, encabezados completos y codificación, no verificados.

### B.7.10. Integraciones externas

- **CP-015:** apertura de enlace y envío por WhatsApp, no ejecutados.
- La presencia de una URL `wa.me` en el código no demuestra entrega ni recepción del mensaje.

## B.8. Resumen de resultados

### B.8.1. Conteo por casos documentados

**Tabla B.3**

*Resumen cuantitativo de casos documentados*

| Indicador | Cantidad | Porcentaje del total |
|---|---:|---:|
| Total de casos documentados | 15 | 100,0 % |
| Pruebas aprobadas | 9 | 60,0 % |
| Pruebas fallidas | 0 | 0,0 % |
| Pruebas no ejecutadas | 4 | 26,7 % |
| Pruebas no verificadas | 2 | 13,3 % |

*Nota.* Porcentajes calculados sobre 15 casos documentados y redondeados a un decimal.

Los porcentajes se calcularon como `cantidad del estado ÷ 15 casos documentados × 100` y se redondearon a un decimal. La suma puede resultar en 100,0 % por redondeo.

### B.8.2. Conteo de ejecuciones automatizadas

La ejecución del 26 de noviembre de 2026 ejecutó **9 pruebas automatizadas de nivel superior**: cinco pruebas unitarias de `seguridad-basica.test.js` y cuatro pruebas HTTP de `integracion-http.test.js`. Resultado: **9 aprobadas, 0 fallidas, 0 omitidas**. Estas pruebas de HTTP usan persistencia simulada.

La ejecución actual no incluyó `integracion-mariadb.test.js`; por tanto, ese test no forma parte de las nueve ejecuciones ni de los resultados aprobados. Un informe técnico previo anotó una integración MariaDB omitida en una selección anterior por falta de `CHARQUI_TEST_DB_ENV`; ese registro histórico tampoco equivale a una integración aprobada.

**Figura B.1**

*Resultado de la ejecución automatizada*

[INSERTAR FIGURA B.1: Resultado de pruebas automatizadas]

*Nota.* Marcador para incorporar una captura real de la salida de `node --test`. No se adjunta una captura en esta versión.

## B.9. Incidencias identificadas y correcciones

La revisión del diff existente evidencia ajustes previos en archivos administrativos y en la página de inicio. No hay un registro que vincule estos cambios a un defecto reproducido durante la ejecución de nueve pruebas de esta revisión. En consecuencia, se documentan como correcciones observables en el código, no como defectos cuya corrección haya sido validada integralmente.

**Tabla B.4**

*Ajustes de código observables y alcance de validación*

| Módulo | Cambio observable en el código | Resultado de validación disponible |
|---|---|---|
| Administración de inventario | El controlador guarda la referencia del formulario antes de una operación asíncrona y la restablece después de guardar. | El cambio está en el diff de `frontend/js/admin.js`; no existe prueba automatizada de DOM ni recorrido de navegador que confirme el flujo. |
| Administración mayorista | La solicitud actual conserva sus productos al abrir el editor de cotización. | El cambio está en `frontend/js/admin.js`; la prueba HTTP cubre creación API de cotización, no la interacción del modal. |
| Administración mayorista | Varios datos dinámicos se renderizan mediante `escaparHtml` en lugar de `escapar`. | Cambio verificable en el diff. No se ejecutó una prueba de interfaz de valores hostiles ni una validación de renderizado. |
| Inicio | El mensaje vacío del bloque de ofertas se ajustó para referirse a ofertas, no a productos destacados. | Cambio textual verificable en `frontend/js/inicio.js`; no se realizó una comprobación visual en navegador en esta ejecución. |

*Nota.* La inspección del diff acredita la existencia de los cambios, pero no constituye evidencia de una prueba de aceptación en navegador.

No se registraron pruebas fallidas en la ejecución de esta revisión. Este hecho no demuestra que los cambios anteriores estén libres de regresiones ni que la aplicación carezca de otros defectos.

## B.10. Evidencias de las pruebas

No se generaron capturas ficticias. Los siguientes marcadores quedan pendientes para reemplazarse por capturas reales, con datos ficticios y sin secretos ni información personal:

**Figura B.2**

*Integración con la base aislada*

[INSERTAR FIGURA B.2: Validación de integración con MariaDB]

*Nota.* Pendiente. La integración MariaDB no se ejecutó en esta revisión.

**Figura B.3**

*Catálogo en navegador*

[INSERTAR FIGURA B.3: Catálogo de productos en navegador]

*Nota.* Pendiente. No se realizó el recorrido de navegador especificado.

**Figura B.4**

*Registro de pedido de prueba*

[INSERTAR FIGURA B.4: Registro de pedido]

*Nota.* Pendiente. La prueba HTTP ejecutada usó persistencia simulada; no se registró un pedido en MariaDB para esta evidencia.

**Figura B.5**

*Panel administrativo*

[INSERTAR FIGURA B.5: Panel administrativo]

*Nota.* Pendiente. La revisión visual previa del módulo Existencias no dispone de una captura asociada a esta ficha.

**Figura B.6**

*Exportación CSV*

[INSERTAR FIGURA B.6: Generación del reporte CSV]

*Nota.* Pendiente. El test automatizado verificó la respuesta textual del endpoint con datos simulados, pero no se guardó ni abrió un archivo CSV.

## B.11. Limitaciones de las pruebas

1. La versión de Node declarada es `20.x`, pero la ejecución documentada se hizo con Node.js `v24.11.1`. No se certifica aquí la ejecución bajo Node 20.
2. Las cuatro pruebas HTTP sustituyen el pool de base de datos con una estructura en memoria. Sus resultados no acreditan consultas SQL, restricciones, transacciones o persistencia real.
3. La prueba `integracion-mariadb.test.js` requiere configuración externa y escribe datos de prueba. No se ejecutó; no se modificó ninguna base de datos.
4. No se realizó un recorrido completo por catálogo, filtros, carrito, checkout, panel administrativo o vistas responsive en navegador durante esta revisión.
5. El test HTTP valida ciertos contenidos de la respuesta CSV simulada; no comprueba el archivo descargado, todas sus columnas, el nombre del archivo ni la codificación en un navegador.
6. No se abrió un enlace de WhatsApp ni se enviaron o recibieron mensajes. Un enlace construido en JavaScript no prueba la operación del servicio externo.
7. El panel Existencias fue observado parcialmente en una revisión anterior. No hay evidencia preservada de los pasos ni captura para evaluar su comportamiento funcional.
8. No se ejecutó `npm test` porque el paquete no define ese script. Se ejecutaron los dos archivos seleccionados directamente con `node --test`.
9. El caso HTTP de límite de login comparte el estado del limitador entre escenarios del mismo proceso; su aserción depende del orden de ejecución de la suite.
10. Los resultados no representan pruebas de carga, compatibilidad exhaustiva de navegadores, pruebas de producción ni certificación de seguridad.

## B.12. Conclusiones

En la ejecución automatizada realizada el 26 de noviembre de 2026, las nueve pruebas unitarias y HTTP seleccionadas finalizaron aprobadas y sin fallos. Las pruebas cubrieron funciones de seguridad y rutas API en un entorno local con persistencia simulada.

La evidencia no permite afirmar que la integración con MariaDB, la experiencia completa de usuario en navegador, la descarga del CSV o la comunicación con WhatsApp hayan sido validadas en esta revisión. Para completar el aseguramiento de calidad, se requiere una ejecución autorizada de la integración únicamente en `charqui_web_test`, así como recorridos manuales de interfaz con datos ficticios y registro de capturas reales.

Los resultados son parciales y circunscritos a las pruebas detalladas. No se afirma que el sistema esté libre de errores, certificado o listo para producción.

## Referencias técnicas

- `package.json`: versión del paquete, motor Node.js y scripts declarados.
- `backend/test/seguridad-basica.test.js`: pruebas unitarias de configuración JWT, coordenadas, tokens de seguimiento y limitador.
- `backend/test/integracion-http.test.js`: pruebas HTTP con persistencia simulada.
- `backend/test/integracion-mariadb.test.js`: prueba de integración que exige base aislada `charqui_web_test`.
- `backend/rutas/administracion.js`, `backend/rutas/pedidos.js` y `backend/rutas/mayoristas.js`: rutas funcionales asociadas a los casos.
- `frontend/js/admin.js` y `frontend/js/inicio.js`: cambios de frontend descritos en el apartado B.9.
- `docs/manual_tecnico_charqui.md`: registro previo de pruebas y revisión visual parcial.
