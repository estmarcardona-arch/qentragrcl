# Documento Maestro del Producto — GRUFARCOL eBR
**Plataforma de registros de lote electrónicos (eBR), trazabilidad y liberación para fabricación de cosméticos y medicamentos**

| | |
|---|---|
| Versión | 1.4 (borrador vivo) |
| Fecha | 05/10/2026 |
| Empresa | GRUFARCOL |
| Nombre de trabajo | GRUFARCOL eBR (cambiable) |
| Documento hermano | `PRD_GRUFARCOL.md` (lo técnico) y `PROMPTS_CLAUDE_DESIGN_GRUFARCOL.md` (diseño visual) |

> **Qué contiene y qué no.** Este documento reúne lo **comercial y de producto**: idea, problema, visión, modelo de negocio, alcance, usuarios, clientes, flujo de valor, métricas y riesgos. La arquitectura, la base de datos, las herramientas y el flujo pantalla a pantalla viven en el PRD, escrito para que un agente de IA construya la plataforma.

---

## 0. Cómo se construyó este documento y qué falta confirmar

Este documento parte del diseño de una plataforma de referencia (una maquiladora cosmética que digitalizó su paquete técnico de producción) y lo reescribe para **GRUFARCOL**. De esa experiencia se conserva el **proceso** (qué debe registrarse, quién firma, cómo se traza un lote), no los formatos ni los nombres internos de esa empresa.

De GRUFARCOL solo se sabe lo que usted indicó: fabrica **cosméticos y medicamentos**. Todo lo demás son **supuestos**, marcados así en el texto para que se corrijan antes de construir:

| # | Supuesto sobre GRUFARCOL | Cómo se usa mientras no se confirme | Quién confirma |
|---|---|---|---|
| S1 | Opera en Colombia (moneda COP, zona horaria America/Bogota, regulador INVIMA) | Se diseña así | Dirección |
| S2 | Tiene una planta con áreas de bodega, dispensación, fabricación, envase, acondicionamiento y laboratorio | Una planta, varias áreas | Dirección técnica |
| S3 | Fabrica productos propios; **si también maquila** para terceros se activa la dimensión «Marca/cliente»; **si envía producto o material a un proveedor de maquila**, se activan las bodegas externas | La dimensión existe pero puede quedar apagada | Dirección |
| S4 | Tiene un ERP o sistema contable que lleva inventarios | Se deja un adaptador intercambiable | Administrativa / TI |
| S5 | Hoy los registros de lote están en papel | Se levanta la lista real de formatos (ver sección 13) | Garantía de calidad |
| S6 | Arranca con una línea piloto y luego amplía | Piloto de un producto de extremo a extremo | Dirección técnica |
| S7 | Los roles son los de la sección 7 | Se renombran según su organigrama | Recursos humanos |

---

## 1. Idea

Las plantas de cosméticos y medicamentos viven de **documentar lo que hicieron**: qué materias primas entraron, quién las pesó, en qué equipo se fabricó, qué controles se hicieron, cuánto salió y quién liberó el lote. Si esa documentación vive en papel, cada lote deja una carpeta que hay que armar, revisar y archivar; y responder «¿en qué lotes terminó esta materia prima?» exige abrir carpetas.

**La idea:** una plataforma web que lleva el ciclo completo del producto dentro de la planta, desde la idea comercial hasta el lote liberado:

1. **Comercial** presenta el *brief* del producto (caso de negocio).
2. **I+D** lo convierte en fórmula cualicuantitativa, especificaciones (granel y producto terminado) e instructivos (fabricación, envase, acondicionamiento).
3. **Producción** abre una orden y el sistema **genera automáticamente** los registros del lote a partir de esos instructivos aprobados.
4. **Bodega, Producción y Calidad** ejecutan y firman en pantalla, con trazabilidad de lote de materia prima, de equipo y de persona.
5. **Aseguramiento de calidad y Dirección técnica** revisan, liberan y obtienen **un solo PDF** con código QR verificable en línea.

## 2. El problema

| Dolor | Consecuencia |
|---|---|
| Formatos impresos y transcripción manual | Errores, tiempo perdido y registros ilegibles |
| La información de I+D y la ejecución en planta están desconectadas | Riesgo de ejecutar con una versión desactualizada de la fórmula |
| Trazabilidad por búsqueda manual en carpetas | Una consulta de lote o un retiro de producto toma horas o días |
| Estado de equipos, calibraciones y limpieza en hojas aparte | Se puede usar un equipo con calibración vencida sin advertirlo |
| Desviaciones y acciones correctivas dispersas | Se repiten los mismos eventos y es difícil demostrar que la acción funcionó |
| Armar el expediente para una auditoría o inspección | Semanas de preparación y riesgo de faltantes |

*(Validar con datos propios de GRUFARCOL: ver métricas base en la sección 11.)*

## 3. Visión del producto

> Que cada lote de GRUFARCOL tenga un expediente electrónico completo, íntegro y verificable, que se genera mientras se produce y no después; y que cualquier persona autorizada pueda responder en minutos qué se usó, quién lo hizo, con qué equipo y por qué se liberó.

Principios del producto (no se negocian):

- **Un solo hilo de datos.** Lo que I+D aprueba es lo que planta ejecuta. Nadie vuelve a digitar.
- **Quien ejecuta no verifica, quien verifica no aprueba.** La separación de funciones está en la plataforma, no en la buena voluntad.
- **Lo firmado no se borra.** Los cambios se corrigen con motivo, firma y rastro visible.
- **Hecha para gente ocupada.** Pantallas claras para el auxiliar en planta y para el director que decide.
- **Preparada para auditoría.** Todo registro se puede abrir, exportar y verificar.

## 4. Propuesta de valor

| Para… | Valor |
|---|---|
| Dirección técnica | Liberar lotes con un expediente completo y sin pendientes ocultos |
| Aseguramiento de calidad | Revisión por excepción: el sistema muestra lo incompleto, fuera de rango o sin firma |
| Producción | Instrucciones paso a paso, cálculo automático de cantidades y rendimientos, menos papel |
| Bodega | Inventario por lote con estado de calidad y vencimientos a la vista |
| Calidad / laboratorio | Resultados contra especificación automáticos y certificados generados |
| I+D y regulatorio | Versiones controladas de fórmulas e instructivos con historial de aprobaciones |
| Gerencia | Visibilidad de lotes en proceso, liberados, desviaciones abiertas y tiempos |

## 5. Modelo de negocio

El modelo depende de decisiones de GRUFARCOL que aún no se han tomado. Se presentan las opciones para decidir, sin asumir cifras.

| Opción | Descripción | Implica |
|---|---|---|
| **A. Herramienta propia de GRUFARCOL** | La plataforma se construye y se usa solo dentro de la empresa | Sin ingresos directos; el retorno es ahorro de tiempo, menos errores y mejor posición en auditorías |
| **B. Núcleo reutilizable** | La plataforma se construye de forma configurable y puede ofrecerse a otras plantas del sector | Hay que definir propiedad intelectual, licencia, soporte y quién responde por la validación en cada cliente |
| **C. Servicio a terceros con marca propia de GRUFARCOL** | Se ofrece como parte de un servicio de manufactura | Requiere acuerdos de confidencialidad y separación de datos por cliente |

**Recomendación de arranque:** construir para la opción A, pero con una arquitectura **configurable por empresa** (perfiles regulatorios, plantillas y roles editables) que no cierre la puerta a B. La decisión comercial se toma después del piloto, con datos reales.

> **Punto a resolver antes de reutilizar nada:** si el diseño de referencia proviene de otra empresa, definir por escrito qué es reutilizable (conocimiento general de GMP) y qué es confidencial de cada compañía (formatos, códigos, fórmulas, personas).

## 6. Alcance

### 6.1 El flujo completo (lo que cubre el producto)

| # | Etapa | Qué se logra | Rol que la origina |

|---|---|---|---|
| 0 | **Sistema de gestión documental** | Aseguramiento de la calidad crea los documentos controlados (procedimientos, formatos, instructivos, especificaciones, fórmulas), les asigna **código y versión**, los hace revisar y aprobar, los publica y confirma su lectura. Todo el registro de lote se apoya en ellos | Aseguramiento de la calidad |
| 1 | **Brief de producto** | Caso de negocio completo (ver 6.5): tipo de proyecto, medicamento o cosmético, justificación, competencia, consumidor, canales, margen y precio, costos, requisitos legales y recomendaciones | Comercial |
| 2 | **Prototipos de fórmula** | Mínimo 2 prototipos cualicuantitativos por brief aprobado, con código de prototipo, concepto y borrador del instructivo de manufactura; las mejoras llevan consecutivo del prototipo inicial | I+D |
| 2B | **Estabilidad preliminar y fórmula aprobada** | El prototipo elegido se somete a la estabilidad preliminar de Calidad (calentamiento, enfriamiento, microbiología, viscosidad y, si se requiere, densidad; 30 días); si no cumple se reformula; si cumple se aprueba por Gerencia, por el cliente (si es desarrollo externo) y por la Dirección técnica | I+D / Control de calidad / Dirección |
| 3 | **Especificaciones** | Criterios de aceptación de materias primas, granel, envase, etiqueta, plegadiza (si aplica) y producto terminado; se entregan junto con la fórmula aprobada | I+D / Control de calidad |
| 4 | **Instructivos** | Paso a paso de fabricación, envase y acondicionamiento, con los parámetros a registrar | I+D, validados por Producción |
| 4B | **Costos de la fórmula** | Costo por ingrediente, costo del granel por presentación, costo del producto terminado (con envase, etiqueta y caja) y costo del lote industrial según unidades definidas | I+D / Dirección |
| 5 | **Aprobación de versiones** | Revisión y aprobación antes de poder producir | Aseguramiento de calidad / Dirección técnica |
| 6 | **Recepción, bodegas e inventario** | Lotes de materias primas y materiales con ubicación (estante, piso, posición) según el tipo de material; cuarentena, aprobación o rechazo; bodegas de rechazo, devolución y granel; traslados a bodegas **externas** del proveedor de maquila | Bodega / Control de calidad |
| 7 | **Orden de producción** | Desde un tablero de órdenes se crea la orden (con número definido por Aseguramiento de calidad) y se genera el lote en ejecución. Al aprobarse, el sistema genera solicitudes (dispensación, material de envase, material de acondicionamiento), la orden de codificado, los rótulos y los registros de fabricación, envase y acondicionamiento, descargables en PDF | Coordinación de producción / Dirección técnica |
| 8 | **Prealistamiento, despeje de línea y limpieza** | Verificación previa de cada área (dispensación, fabricación, envase, acondicionamiento), con firma del coordinador o supervisor sobre los rótulos de limpieza de equipos y utensilios | Producción y verificador |
| 9 | **Dispensación** | Pesaje por lote de materia prima (varios lotes por insumo) | Producción |
| 10 | **Fabricación → Envase → Acondicionamiento** | Ejecución paso a paso con parámetros, equipos y firmas | Producción |
| 11 | **Controles de calidad** | Muestreo, análisis, inspección del producto terminado, certificado | Laboratorio / Control de calidad |
| 12 | **Desviaciones y CAPA** | Registro, investigación y acciones correctivas y preventivas | Cualquiera / Aseguramiento de calidad |
| 13 | **Liberación** | Conciliación de rendimientos, revisión de calidad, firma de la Dirección técnica | Aseguramiento / Dirección técnica |
| 14 | **Expediente final (paquete técnico)** | Lista de verificación de documentos del lote (Sí / No aplica) firmada por Producción, Garantía de calidad y Dirección técnica, y un solo PDF con QR de verificación pública | Sistema |
| 15 | **Trazabilidad** | Hacia adelante, hacia atrás y por equipo | Todos con permiso |

### 6.1.1 Cómo se encadena el trabajo (de la idea al lote)

```
Brief (Comercial) → aprobado → ≥ 2 prototipos (I+D) → estabilidad preliminar (30 días)
      → ¿cumple? no → reformular (nuevo consecutivo)   sí → fórmula aprobada
      → especificaciones + instructivos + costos
      → Orden de producción → lote → solicitudes, rótulos y registros
      → ejecución → calidad → liberación → paquete técnico
```

### 6.2 Perfil regulatorio por línea de producto

Un cosmético y un medicamento no exigen lo mismo. La plataforma maneja un **perfil por línea** que enciende o apaga controles:

| Control | Cosmético (supuesto) | Medicamento (supuesto) |
|---|---|---|
| Verificación independiente en dispensación y pesaje | Configurable | Obligatoria |
| Reautenticación en cada firma | Sí | Sí |
| Revisión del expediente por aseguramiento antes de liberar | Sí | Sí |
| Controles en proceso con límites | Los del instructivo | Los del instructivo, más estrictos |
| Calificación de equipos críticos | Según criticidad | Obligatoria en equipos críticos |
| Desviación crítica abierta bloquea la liberación | Sí | Sí |

*(La tabla es un punto de partida. Aseguramiento de calidad y regulatorio confirman cada fila con la norma vigente aplicable.)*

### 6.3 Fases

| Fase | Contenido | Resultado esperado |
|---|---|---|
| **0. Descubrimiento** | Levantar los formatos reales de GRUFARCOL y confirmar los supuestos S1–S7 | Lista de formatos y roles confirmada |
| **1. Piloto** | Un producto de extremo a extremo (idealmente un cosmético sencillo) | Un lote completo liberado en la plataforma, en paralelo con el papel |
| **2. Planta cosmética** | Todos los productos cosméticos | Papel retirado en cosméticos |
| **3. Medicamentos** | Perfil de medicamento activado; controles reforzados | Primer lote de medicamento liberado |
| **4. Mejora continua** | Integraciones, tableros, recall simulado, tendencias | Indicadores de gestión |

### 6.4 Fuera de alcance del MVP

Costeo y contabilidad, planeación de capacidad, programación de mantenimiento más allá del cronograma de equipos, integración directa con balanzas e instrumentos, logística de despachos y gestión de clientes finales. Pueden entrar en fases posteriores.

### 6.5 Contenido del brief de producto

El brief es el origen de todo proyecto y lo crea Comercial. Campos:

| Bloque | Contenido |
|---|---|
| Identificación | Fecha de ejecución; nombre del proyecto; **tipo de proyecto** (producto nuevo en el mercado «innovador», nuevo en el portafolio de la compañía, modificación o renovación, extensión de línea, maquila a tercero); **medicamento o cosmético** |
| Justificación | Por qué se hace el proyecto |
| Competencia (por producto comparado) | Fabricante, nombre del producto, envase (vidrio, PET, etc.), tipo de tapa, tipo de etiqueta, *claims*, activos declarados, precio |
| Características sensoriales | Aroma, color, apariencia; precio por mL |
| Fuentes | Descripción de las fuentes de información |
| Grupo objetivo | Estrato, edad, sexo, ingresos, otras características; explicación de «para quién está diseñado»; datos psicográficos; actitud de compra; frecuencia de consumo |
| Canal | Cadenas, subtiendas, mercado tradicional, otros |
| Rentabilidad | Margen de rentabilidad; precio de venta sugerido según presentación propuesta |
| Requisitos legales y costos | Requisitos legales; costos posibles de implementación |
| Cierre | Recomendaciones y sugerencias |

### 6.6 Prototipos, estabilidad y fórmula aprobada

- Con el brief aprobado, I+D crea **al menos 2 prototipos** de fórmula cualicuantitativa. Cada uno lleva **código de prototipo**; las mejoras se identifican con el **consecutivo del prototipo inicial** (por ejemplo P-0007, P-0007-1, P-0007-2).
- Cada prototipo declara el **tipo de producto** (crema, loción, fragancia, maquillaje…), el público y el beneficio buscado, y un **concepto** (descripción, esquema o boceto) con su **instructivo de manufactura**.
- El prototipo escogido pasa a **estabilidad preliminar**, con este protocolo de Calidad (30 días):

| Prueba | Condición | Lecturas |
|---|---|---|
| Calentamiento | 42 °C – 48 °C durante 30 días | Temperatura, pH y examen organoléptico a las 0 h, 12 h, 24 h, 3 d, 7 d, 15 d y 30 d, por triplicado |
| Enfriamiento | 0 °C – 8 °C durante 30 días | Las mismas lecturas, tiempos y triplicado |
| Microbiológica | Laboratorio **externo** | Recuento de mesófilos aerobios, *Pseudomonas aeruginosa*, *Staphylococcus aureus* y *Escherichia coli* a las 0 h y a los 30 días |
| Viscosidad | Muestra de **al menos 250 mL** | A los 0 y a los 30 días, por triplicado |
| Densidad | Solo si se requiere; con picnómetro | A criterio de Calidad |

  Si el producto no cumple, se reformula (nuevo consecutivo); si cumple, se convierte en **fórmula aprobada** por Gerencia, por el cliente (solo desarrollo externo) y por la Dirección técnica.
- La fórmula aprobada se entrega con sus **especificaciones** (granel, tipo de envase, tipo de etiqueta, plegadiza si aplica, producto terminado) y sus **instructivos** (fabricación, envase, acondicionamiento) y tiene un espacio de **costos**: costo de cada ingrediente, costo total del granel por presentación, costo total del producto terminado con envase, etiqueta y caja, y costo del lote industrial según unidades definidas.

### 6.7 El expediente de lote (paquete técnico)

Cada lote reúne su expediente con esta estructura. La lista de verificación marca cada documento como **Sí** o **No aplica** y se firma por tres personas.

| Sección | Documentos |
|---|---|
| Encabezado | Producto, titular, notificación o registro sanitario, presentación, cantidad, lote, fecha de expiración, números de orden de fabricación, envase y acondicionamiento, fechas de inicio y fin |
| General | Formación del paquete técnico |
| Manufactura | Orden de producción · prealistamiento y despeje de línea · solicitud de dispensación · rótulos de dispensación y alistamiento · limpieza de equipos y utensilios · registro de fabricación |
| Envase | Orden de envase · solicitud de material de envase · rótulos de alistamiento · prealistamiento y despeje · limpieza de equipos y utensilios · rótulo de granel · registro de envase · control de peso |
| Acondicionamiento | Orden de acondicionamiento · solicitud y **devolución** de material · prealistamiento y despeje · rótulo de granel · limpieza de equipos y utensilios · registro de acondicionamiento · inspección de producto terminado |
| Cierre | Certificado de calidad de producto terminado · consolidado y liberación |
| Firmas | **Verificado** por coordinación de producción · **Revisado** por garantía de calidad · **Aprobado** por dirección técnica |

*(En la plataforma estos documentos son registros digitales; el nombre y el código de cada formato se toman de la lista real de GRUFARCOL, decisión D-04.)*

### 6.8 Bodegas y ubicaciones

- Se pueden crear **bodegas** según su función: materias primas, material de envase, material de empaque, granel, producto terminado, **rechazo** y **devolución**. Cada bodega define qué tipos de material admite.
- En cada bodega se define el **número de estantes**, los **pisos por estante** y las **posiciones por piso**; la plataforma genera las ubicaciones con un código único (por ejemplo `MP-E03-P2-01` = estante 3, piso 2, posición 1). Todo lote queda asignado a una ubicación y se puede preguntar «¿dónde está este lote?».
- El sistema impide guardar un material en una ubicación que no admite su tipo, y por defecto lleva lo rechazado a la bodega de rechazo y las devoluciones a la de devolución (por confirmar).
- Si un producto se **maquila**, se pueden crear **bodegas externas**, vinculadas al proveedor de maquila, para registrar lo que se le envía (materiales, granel o producto) con su remisión, firma de despacho y firma de recepción. La trazabilidad sigue mostrando dónde está cada lote, también fuera de la planta. El proveedor debe estar calificado (por confirmar con Calidad).

### 6.9 Aseguramiento de la calidad y el sistema de gestión documental

**Aseguramiento de la calidad es un área de la empresa** y es la dueña del sistema de gestión documental (SGD). Esta sección aplica los procedimientos de **elaboración de documentos** y de **registro y control de documentos** aportados como referencia, con sus reglas (sin los nombres, personas ni códigos de la empresa de origen, que GRUFARCOL define).

**Quién hace qué**

| Rol | Papel en el SGD |
|---|---|
| Cualquier trabajador o líder de proceso | Solicita crear, modificar o anular un documento y redacta el preliminar con la plantilla editable |
| **Analista de gestión documental** (Aseguramiento de la calidad) | Revisa que el preliminar cumpla el estándar, **asigna el código**, mantiene el listado maestro, publica la versión vigente, emite las copias controladas y recoge las obsoletas |
| Jefe inmediato del autor o jefe/director de Aseguramiento de la calidad | Revisa; el director decide las anulaciones |
| Director técnico | Aprueba los documentos técnicos (y los administrativos, junto con Gerencia) |
| Gerente general | Aprueba los documentos administrativos |

Regla de oro: **quien elabora o modifica un documento no lo revisa ni lo aprueba; quien lo revisa sí puede aprobarlo.**

**Qué es un documento controlado**

- Cinco niveles: normatividad, manuales, procedimientos, instructivos/técnicas/matrices y formatos. Tipos: manual, plan, procedimiento, formato, política, programa, especificación, registro, certificado, instructivo, ficha técnica y protocolo (los estudios, como la estabilidad).
- **Código:** sigla del proceso (3 letras) + tipo (2) + consecutivo (001–999). Los formatos que cuelgan de un procedimiento llevan además su propio número (por ejemplo `PRD-PR-003-FR-01`). Procesos propuestos: calidad (GCA), administrativo (ADM), control de calidad (CC), producción (PRD), mantenimiento (MTO), talento humano (TH), logística y almacenamiento (GLG) e I+D (IDI).
- **Encabezado:** logotipo, título, fecha de emisión, fecha de revisión, versión, código y «página x de y». **Pie:** historial de actualizaciones y cuadro de firmas (*actualizado, revisado, aprobado*). **Cuerpo:** objetivo, alcance, responsables, desarrollo, documentos relacionados y anexos, y control de cambios.
- **Redacción:** clara, en infinitivo y sin términos subjetivos como «suficientemente» o «generalmente»; unidades del Sistema Internacional; «N.A.» cuando no aplica.

**Cómo vive un documento**

```
solicitud → preliminar → estandarización → código → revisión → aprobación
→ vigente (copias controladas) → divulgación y capacitación → revisión periódica
→ nueva versión (control de cambios) o anulación → obsoleto (5 años archivado)
```

**Vigencias**

- Manuales, procedimientos, instructivos y formatos: **3 años**.
- Fórmula maestra, artes, instructivos de manufactura, fichas técnicas y material de envase y empaque: **la del registro sanitario**.
- Especificaciones de materia prima y producto terminado: **anual**; las técnicas analíticas internas, la vigencia de su validación.
- Expedientes de notificación o registro sanitario: **5 años después** de vencido o cancelado; documentación de equipos: **hasta el fin de su vida útil**.
- Indicador anual: **% de documentos vencidos por proceso**.

**Cómo se conecta con el registro de lote**

| Qué hace el SGD | Cómo se conecta con el registro de lote |
|---|---|
| Documentos con código, versión y vigencia | Cada formato del lote (despeje, dispensación, fabricación, envase, acondicionamiento, inspección, certificado, paquete técnico) es la instancia de un formato controlado; el lote queda con la versión que usó y el PDF muestra el encabezado documental |
| Solo versiones vigentes | Una orden de producción no puede usar documentos que no estén vigentes |
| Control de cambios | Una desviación, una CAPA, una auditoría o la renovación del registro sanitario pueden originar un cambio; si un formato cambia en información técnica, también se revisa su procedimiento |
| Divulgación | Constancia al aprobar un cuestionario (80 % o más); quien ejecuta un paso debe estar capacitado en la versión vigente (regla configurable) |
| Copias y obsolescencia | PDF con «Copia controlada», «Copia no controlada» u «OBSOLETO» |

> Seguridad y salud en el trabajo queda fuera del MVP. Las vigencias, las siglas de proceso y los aprobadores son valores iniciales que GRUFARCOL confirma (decisión 15).

### 6.10 Usuario master

El **usuario master** puede crear y modificar **fórmulas, especificaciones y las plantillas de las etapas del proceso** (despeje de línea, dispensación, fabricación, envase, acondicionamiento y otras), siempre generando una **versión nueva** que pasa por revisión y aprobación como cualquier documento; no modifica versiones aprobadas, no aprueba lo que él mismo creó y no firma registros de ejecución. Así la empresa puede actualizar sus procesos sin tocar lotes en curso.

## 7. Usuarios

Roles de partida. Se renombran según el organigrama de GRUFARCOL (supuesto S7). Cada rol tiene permisos distintos; la regla de oro es la separación de funciones.

| Rol | Qué hace en la plataforma |
|---|---|
| **Comercial** | Crea el brief de producto |
| **Químico formulador (I+D)** | Crea fórmulas, especificaciones e instructivos |
| **Auxiliar de bodega** | Recibe insumos, imprime rótulos, deja los lotes en cuarentena |
| **Jefe de bodega** | Supervisa inventarios, ajustes y vencimientos |
| **Auxiliar de producción** | Dispensa, fabrica, envasa y acondiciona; registra parámetros |
| **Coordinador de producción** | Crea órdenes, verifica registros, planifica |
| **Auxiliar de laboratorio** | Toma muestras y captura resultados |
| **Jefe de control de calidad** | Libera materias primas y certifica producto terminado |
| **Director de aseguramiento de calidad** | Revisa expedientes, gestiona desviaciones y CAPA, vigila el sistema |
| **Director técnico** | Aprueba fórmulas e instructivos y libera el lote |
| **Administrador del sistema** | Usuarios, catálogos y configuración (no firma registros de calidad) |
| **Gerente general** | Aprueba documentos administrativos, fórmulas y prototipos |
| **Usuario master** | Crea y modifica fórmulas, especificaciones y plantillas de las etapas del proceso (siempre como versión nueva sujeta a aprobación) |
| **Analista de gestión documental** (área Aseguramiento de la calidad) | Estandariza los documentos, asigna código y versión, mantiene el listado maestro, publica, emite copias controladas, recoge obsoletas y hace seguimiento de la capacitación |
| **Auditor invitado** | Acceso de solo lectura, con fecha de vencimiento, para auditorías e inspecciones |

## 8. Clientes

Hay **tres significados** de «cliente» y conviene no mezclarlos:

| Término | Quién es | En GRUFARCOL |
|---|---|---|
| **Cliente de la plataforma** | La empresa que usa el software | GRUFARCOL |
| **Marca / cliente de maquila** | Dueño de un producto fabricado en la planta (solo si hay maquila, supuesto S3) | Por confirmar |
| **Proveedor de maquila** | Tercero al que GRUFARCOL envía material, granel o producto para que lo procese o almacene; se le asigna una bodega externa | Por confirmar |
| **Cliente final / distribuidor** | Quien compra el producto terminado | Fuera de alcance; solo se verifica el lote por QR |

## 9. Flujo de valor de extremo a extremo

```
COMERCIAL        I+D                         APROBACIÓN            BODEGA / CALIDAD
Brief  ───────▶  Fórmula + Especificaciones  ───▶ Versión aprobada   Recepción → Cuarentena → Liberación de insumo
                 + Instructivos                      │
                                                     ▼
PRODUCCIÓN (cada etapa con prealistamiento y firma)
Orden → Dispensación → Fabricación → Envase → Acondicionamiento
                                                     │
CALIDAD                                              ▼
Muestreo y análisis → Inspección PT → Certificado ──▶ Conciliación de rendimientos
                                                     │
                       Desviaciones / CAPA ◀────────┤ (en cualquier punto)
                                                     ▼
                           Revisión de aseguramiento → Firma de Dirección técnica
                                                     ▼
                                   PDF único con QR de verificación pública
```

## 10. Qué lo hace diferente de un registro en papel digitalizado

- Los registros **nacen de los instructivos aprobados**; no se diseñan a mano para cada lote.
- Los límites y rangos están en el paso: un valor fuera de rango **se ve y obliga a explicar**.
- El sistema **bloquea** usar una materia prima en cuarentena o vencida, o un equipo con calibración vencida.
- Una corrección **no borra** el dato original: queda tachado, con motivo, persona y hora.
- El expediente final trae **huella digital** (hash) y QR: cualquiera puede comprobar que su copia es la original.

## 11. Métricas de éxito

Medir la **línea base** en papel durante el descubrimiento; sin ella no se puede demostrar mejora.

| Métrica | Línea base | Meta del piloto |
|---|---|---|
| Tiempo de armado del expediente de un lote | *por medir* | Disponible al cierre del lote |
| Tiempo para responder una consulta de trazabilidad | *por medir* | Menos de 5 minutos |
| Registros con errores de diligenciamiento detectados en revisión | *por medir* | Reducción sostenida |
| Días entre fin de acondicionamiento y liberación | *por medir* | Reducción sostenida |
| Desviaciones con CAPA cerrada a tiempo | *por medir* | Meta definida por aseguramiento |
| Lotes liberados con registro 100 % en plataforma | 0 % | 100 % en la línea piloto |

## 12. Riesgos y supuestos

| Riesgo | Mitigación |
|---|---|
| El personal no adopta la herramienta | Piloto con usuarios reales desde el diseño; pantallas probadas con cada rol |
| El sistema no se considera «validado» ante una inspección | Plan de validación desde el inicio (el PRD define requisitos con identificador y pruebas trazables) |
| Alcance demasiado grande | Un producto de extremo a extremo antes de ampliar |
| Los formatos de GRUFARCOL difieren del proceso de referencia | Fase 0 de descubrimiento con los formatos reales |
| Integridad de datos (que se pueda cuestionar un registro) | Registros firmados inmodificables, rastro de auditoría de solo inserción |
| Dependencia de un solo desarrollador con herramientas de IA | Pruebas automáticas, documentación viva y migraciones versionadas |
| Reutilizar material de otra empresa sin permiso | Ver nota de la sección 5 |

## 13. Decisiones pendientes

1. ¿GRUFARCOL fabrica cosméticos y medicamentos desde el primer día, o se empieza por una línea?
2. ¿Hay maquila para terceros? (activa la dimensión «Marca/cliente»)
3. ¿Qué ERP o sistema de inventarios usa, y qué información debe intercambiar con la plataforma?
4. ¿Cuáles son los formatos reales de GRUFARCOL? (subir la carpeta de formatos, como se hizo en el caso de referencia)
5. ¿Qué formatos seguirán en papel con escaneo (por ejemplo pesaje o limpieza) y cuáles serán 100 % digitales?
6. ¿Normas aplicables confirmadas por regulatorio (GMP de cosméticos y de medicamentos, retención de registros)?
7. ¿Hay procedimiento de validación de sistemas computarizados en GRUFARCOL?
8. ¿Alojamiento en nube o servidor propio?
9. ¿Modelo de negocio (sección 5): A, B o C?
10. ¿Quién será el dueño del producto dentro de GRUFARCOL y quién aprueba el alcance de cada fase?
11. ¿Aseguramiento de calidad asigna cada número de orden o define el formato y el sistema lo numera?
12. ¿Quién aprueba la orden de producción (coordinación, dirección técnica o aseguramiento)?
13. ¿Cuáles son los criterios de cumplimiento de la estabilidad preliminar (variación aceptable de pH y viscosidad, límites microbiológicos, cambios organolépticos admisibles) y la tolerancia horaria de cada lectura?
14. ¿Qué documentos del expediente aplican a cosméticos y cuáles a medicamentos (para marcar «No aplica»)?
15. Los procedimientos de elaboración y de control de documentos se recibieron y se aplicaron como base. ¿Qué siglas de proceso, vigencias y aprobadores define GRUFARCOL?
16. ¿Qué reglas de ubicación aplican por defecto (rechazado, devolución, cuarentena por estante, primero que vence, primero que sale)?
17. Con el proveedor de maquila: ¿solo se controlan existencias y traslados, o también el registro de lote que él ejecute? ¿Cómo se califica?
18. ¿El usuario master y el administrador son la misma persona o dos roles?
19. ¿La capacitación (cuestionario con 80 % o más, o confirmación de lectura) bloquea la ejecución o solo avisa, y para qué tipos de documento?
20. ¿GRUFARCOL usa una plataforma de capacitación externa o el módulo de la plataforma?
21. ¿Los formatos llevan sello de copia controlada?
22. ¿Seguridad y salud en el trabajo entra al sistema documental?
23. ¿Quién aprueba los documentos administrativos: Gerencia, Dirección técnica o ambos?

## 14. Glosario

| Término | Significado |
|---|---|
| eBR | Registro de lote electrónico |
| Paquete técnico / expediente | Conjunto de todos los registros de un lote |
| OP | Orden de producción |
| Granel | Producto fabricado antes de envasar |
| PT | Producto terminado |
| Dispensación | Pesaje y entrega de materias primas para un lote |
| Despeje de línea | Verificación de que el área está limpia y libre de material de otro producto |
| Cuarentena | Estado de un lote que no puede usarse hasta ser liberado por calidad |
| OOS | Resultado fuera de especificación |
| Desviación | Evento no planeado que se aparta de lo aprobado |
| CAPA | Acción correctiva y preventiva |
| Prototipo | Versión de ensayo de una fórmula, con código propio, antes de ser aprobada |
| Estabilidad preliminar | Ensayo de 30 días de calentamiento, enfriamiento, microbiología, viscosidad y (si se requiere) densidad, para anticipar el comportamiento del producto antes de aprobar la fórmula |
| Fórmula cualicuantitativa | Lista de ingredientes con sus cantidades o porcentajes |
| Brief | Documento de caso de negocio que origina un proyecto de producto |
| Solicitud de material | Pedido generado por la orden para dispensación, envase o acondicionamiento |
| Orden de codificado | Instrucción de lo que se imprime en el producto (lote, vencimiento, otros) |
| SGD | Sistema de gestión documental |
| Listado maestro | Relación de todos los documentos internos con código, versión, fechas y documentos asociados |
| Copia controlada / no controlada | Copia sellada para personal autorizado / copia entregada a un tercero con fines informativos |
| Documento obsoleto | Documento que perdió su vigencia por cambio o eliminación; se identifica con sello y marca de agua |
| Protocolo | Documento obligatorio que describe cómo se hará un estudio (estabilidad, validación, mapeo de temperatura) |
| Formato / registro | El formato es el documento en blanco; el registro es el formato diligenciado |
| Firma corta | Inicial del primer nombre, punto y primer apellido («L. Torres»), registrada previamente |
| Documento controlado | Documento con código, versión, área propietaria, estado y fechas de vigencia, cuyo cambio se aprueba |
| Plantilla de proceso | Estructura de pasos y parámetros de una etapa (despeje, dispensación, fabricación, envase, acondicionamiento) de la que salen los registros |
| Bodega externa | Bodega fuera de las instalaciones, asociada a un proveedor de maquila |
| Ubicación | Posición exacta de un lote: bodega, estante, piso y posición |
| ALCOA+ | Atribuible, legible, contemporáneo, original, exacto, completo, consistente, duradero y disponible |

## 15. Historial

| Fecha | Versión | Cambio |
|---|---|---|
| 06/10/2026 | 1.4 | El SGD se ajusta a los procedimientos de elaboración y de registro y control de documentos: codificación por proceso, tipo y consecutivo, estructura del documento, roles y aprobadores, vigencias por tipo, retención, copias controladas, anulación y capacitación; rol de Gerente general; decisiones 20–23 |
| 06/10/2026 | 1.3 | Se agregan bodegas con estantes, pisos y posiciones por tipo de material (incluye rechazo, devolución, granel y bodegas externas para maquila), usuario master, área de Aseguramiento de la calidad y sistema de gestión documental integrado con el registro de lote; decisiones 15–19 |
| 06/10/2026 | 1.2 | Se incorpora el protocolo de estabilidad preliminar de Calidad (sección 6.6) |
| 05/10/2026 | 1.1 | Se incorpora el flujo detallado de negocio: brief ampliado, prototipos con estabilidad acelerada, costos, tablero de órdenes, solicitudes y documentos generados, limpieza de equipos y utensilios, y estructura del expediente con firmas de verificación, revisión y aprobación; decisiones 11–14 |
| 05/10/2026 | 1.0 | Reescritura para GRUFARCOL a partir del historial de diseño de la plataforma de referencia: flujo Brief → I+D → Producción → Calidad → Liberación; perfil regulatorio por línea; roles incluyendo administrador y auditor invitado; supuestos S1–S7 por confirmar |