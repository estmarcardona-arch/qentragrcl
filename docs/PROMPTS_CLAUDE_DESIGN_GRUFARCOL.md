# Prompts para diseñar «GRUFARCOL eBR» en Claude Design

**Versión 1.4 · 06/10/2026.** Documentos hermanos: `DOCUMENTO_MAESTRO_GRUFARCOL.md` (comercial) y `PRD_GRUFARCOL.md` (técnico). Los IDs de pantalla (S-01 … S-48) y de requisito (RF-xx) son **los mismos del PRD**, para que lo diseñado sea lo que luego se construye.

## Qué conserva y qué mejora frente a los prompts de «Compás»

Se conserva el método que funcionó: sistema de diseño primero; pantallas como láminas de alta fidelidad; personas y datos ficticios; variantes por rol como láminas separadas; semáforo con ícono + texto; contraste AA; formatos es-CO; trato de «usted»; revisión final de coherencia.

| Mejora | Por qué |
|---|---|
| **Un solo conjunto de datos ficticios (Prompt 0B)** que todos los prompts reutilizan | En Compás los datos se repetían y podían desalinearse; aquí el lote, los insumos, los equipos y las personas son los mismos en todas las pantallas |
| **IDs de pantalla y requisito del PRD en cada prompt** | Lo diseñado se traza directamente a lo que se construye y se valida |
| **Bloque «ACEPTACIÓN» por prompt** (lista verificable) | Se revisa lámina por lámina sin depender del gusto |
| **Estados obligatorios**: vacío, cargando, error, sin permiso y **bloqueado por regla GMP** | En un sistema regulado el bloqueo es una pantalla de primera clase, no una excepción |
| **Reglas GxP visibles en la interfaz**: firma electrónica, candado de registro firmado, corrección con valor tachado, segregación de funciones, mensaje de bloqueo con regla y acción | Es lo que distingue este producto de un formulario digital |
| **Tablet de 1024 px** en lugar de celular de 390 px | La app es web de escritorio, adaptable a tablet en planta; no hay app móvil |
| **Tres familias de color** (semáforo solo para calidad/vigencia; neutro para trámite; violeta para severidad) | Evita que «verde» signifique cosas distintas |
| **Azul acero como primario** y **fuente monoespaciada para códigos** | El primario no choca con el verde de «Aprobado»; los códigos de lote se leen sin error |
| **Datos mínimos en la página pública** definidos en el prompt | La verificación por QR no debe exponer fórmula ni costos |

## Cómo usarlos

1. Pegue los prompts **en orden y uno a la vez**: 0, 0B, 1, 2, **2B**, **2C**, 3, 3B, 4, **4B**, 5, 5B, 6, 7, 8, 9, 10, 11, 12, 12B, 13, **14 (revisión final)**. El 0 es la base; el 0B son los datos; los demás dependen de ambos. Los prompts 3B, 5B y 12B son las pantallas añadidas en la versión 1.1 (prototipos y costos, documentos de la orden y limpieza, paquete técnico). En la versión 1.4 el **prompt 2C se rehízo** con los procedimientos documentales aportados (codificación, estandarización, revisión y aprobación, copias controladas, capacitación con cuestionario, vigencias y anulación) y se agregó la pantalla S-49. Los prompts **2B, 2C y 4B** son los añadidos en la versión 1.3: usuario master y plantillas de proceso (2B), gestión documental de Aseguramiento de la calidad (2C) y estructura de bodegas, ubicaciones y bodegas externas (4B). Los prompts 0, 0B, 1, 2, 3, 4, 7, 12, 12B y 14 también se ajustaron para mostrar el código y la versión de los documentos y las ubicaciones.
2. Tras cada uno, revise con su bloque **ACEPTACIÓN** y corrija con frases concretas («el estado de calidad debe llevar ícono y texto», «tabla más compacta»). Evite «hazlo más bonito».
3. Si la herramienta permite guardar el sistema de diseño, guárdelo tras el Prompt 0.
4. Si se pierde la consistencia, repita al inicio: *«Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B.»*
5. Todo es **ficticio**: personas, lotes, proveedores, equipos y cifras. «GRUFARCOL eBR» es nombre de trabajo. Los supuestos S1–S7 y las decisiones abiertas están en los documentos hermanos; si GRUFARCOL cambia un nombre de rol o de área, solo se cambia en el 0B.
6. Cuando termine el diseño, anote en el PRD (sección 17) cualquier decisión que el diseño haya tomado sin estar escrita.

---

## PROMPT 0: Sistema de diseño

```
Diseña el sistema de diseño de "GRUFARCOL eBR" (nombre de trabajo), una plataforma web para el registro electrónico de lotes (eBR), la trazabilidad y la liberación de productos de una planta colombiana que fabrica cosméticos y medicamentos. Es un sistema regulado: lo que se registra es evidencia ante la autoridad sanitaria y los auditores. Los usuarios son auxiliares de producción y de bodega, analistas de laboratorio, jefes, coordinadores y directores: personas que trabajan con guantes y bata, con el tiempo medido, que necesitan claridad absoluta y cero ambigüedad. Se usa principalmente en computador de escritorio y se adapta a tablet en planta.

TONO VISUAL
Sobrio, técnico, muy claro y calmado; transmite rigor y confianza. No infantil, no "startup", no oscuro. Tema CLARO en todas las pantallas. Mucho espacio, jerarquía clara, tablas legibles y densas pero respirables.

ENTREGA
Un tablero de sistema de diseño con:

1. PALETA. Primario azul acero (#1E4E8C) con sus tonos; neutros grises fríos; fondo, superficies y bordes. Verifica contraste AA (4.5:1 texto normal, 3:1 texto grande y componentes) en todo par texto/fondo.

2. TRES FAMILIAS DE COLOR, CON REGLAS (lo más importante del producto):
   a) SEMÁFORO DE CALIDAD Y VIGENCIA — solo para el estado de calidad de un material, lote o registro, y para la vigencia de equipos y documentos. Siempre con color + ÍCONO + TEXTO (nunca solo color). Estados: verde "Aprobado" (check) · ámbar "Cuarentena" / "Por vencer" (reloj o triángulo) · rojo "Rechazado" / "Vencido" (círculo con X) · gris "Borrador" / "Sin dato" (guion). Muéstralo como insignia pequeña, como indicador grande en tarjeta y como celda de tabla. Debe distinguirse en escala de grises y con daltonismo.
   b) ESTADO DE TRÁMITE (en curso, pendiente, completada, bloqueada, en revisión, firmada) — usa NEUTRO y AZUL PRIMARIO, con ícono y texto. Nunca uses verde, ámbar ni rojo para trámite.
   c) SEVERIDAD DE DESVIACIÓN — familia VIOLETA en tres tonos: "Menor", "Mayor", "Crítica", con ícono y texto, distinta del semáforo.

3. TIPOGRAFÍA. Inter (o equivalente sobria) para interfaz; una fuente MONOESPACIADA (p. ej. JetBrains Mono) para códigos de lote, de orden, de equipo y de verificación. Escala: título de página, sección, tarjeta, cifra grande, texto, texto pequeño, etiqueta, código.

4. COMPONENTES (todos con estados: normal, foco visible, deshabilitado, error):
   - Botones: primario, secundario, peligro, fantasma. Un botón deshabilitado por una regla muestra al lado o debajo el MOTIVO.
   - Campos de formulario, selector, casilla, interruptor, selector de fecha, campo numérico con unidad (kg, g, mL, °C, %, rpm, min) y rango permitido visible; indicador "fuera de rango" con ícono + texto.
   - Tabla: encabezado, fila, fila con estado, fila vencida, ordenar, filtros, búsqueda, paginación, selección múltiple, vista compacta.
   - Pestañas, diálogos, avisos (información, advertencia, error, éxito), estado vacío, esqueleto de carga, estado de error, estado "sin permiso".
   - Menú lateral (escritorio), barra superior con migas de pan, buscador y menú de usuario; campana con contador de pendientes.
   - Asistente por pasos (stepper vertical con paso actual, completados y bloqueados).
   - Etiqueta de código de lote (monoespaciada, copiable).

5. COMPONENTES GxP (propios de este producto; diséñalos con mucho cuidado, se repiten en todo el sistema):
   a) MODAL DE FIRMA ELECTRÓNICA: título "Firmar registro"; qué se firma (nombre del registro y código); SIGNIFICADO de la firma como etiqueta clara ("Ejecuté", "Verifiqué", "Revisé", "Aprobé", "Liberé"); resumen del contenido que se firma; nombre y cargo del firmante; campo de contraseña ("Confirme su identidad"); fecha y hora del servidor (no editable); botones Cancelar / Firmar; estado de error "Contraseña incorrecta"; estado "No puede firmar: usted ejecutó este paso" (segregación de funciones).
   b) SELLO DE FIRMA: candado + "Ejecutó: Diego Cárdenas · 05/10/2026 14:32" y, cuando existan, "Verificó: …" y "Aprobó: …", en filas separadas; un registro firmado se ve BLOQUEADO (campos en solo lectura con candado).
   c) CORRECCIÓN: valor anterior TACHADO (visible), valor nuevo, motivo, autor y fecha. Nunca se borra nada.
   d) AVISO DE SEGREGACIÓN DE FUNCIONES: mensaje claro de por qué la persona no puede firmar o verificar.
   e) PANEL DE BITÁCORA (audit trail) lateral: lista cronológica de quién hizo qué, antes → después, motivo.
   f) AVISO DE BLOQUEO POR REGLA GMP: ícono de candado + "Qué regla" + "Qué hacer", con botón de acción (ejemplo: «Equipo BAL-014 con calibración vencida el 02/10/2026. Registre una desviación o use otra balanza.»).
   g) CHECKLIST DE LIBERACIÓN con ítems cumplidos, pendientes y bloqueantes.
   h) ENCABEZADO DE LOTE: código de lote, producto, presentación, estado, etapa actual, perfil regulatorio (Cosmético / Medicamento), responsable.

   i) SELLO DE DOCUMENTO CONTROLADO: insignia compacta con código monoespaciado, versión, estado y vigencia (por ejemplo «PRD-PR-003-FR-01 · v03 · Vigente»); variantes «Preliminar», «En estandarización», «En revisión», «En aprobación», «Vigente», «Obsoleto» (con marca «OBSOLETO») y «Revisión vencida» (semáforo de vigencia con ícono y texto).
   j) CUADRO DE FIRMAS DE DOCUMENTO: tres columnas «Actualizado por / Revisado por / Aprobado por» con nombre, cargo, firma corta (por ejemplo «V. Cruz»), fecha y sello de firma, más la tabla «Historial de actualizaciones» (versión, fecha, descripción del cambio; se muestran los últimos tres).
   k) MAPA DE UBICACIONES DE BODEGA: cuadrícula de estantes (columnas) por pisos (filas) con cada posición en estado Libre, Ocupada o Bloqueada (ícono + texto), zona de cuarentena marcada, y detalle al seleccionar; con variante de bodega EXTERNA que lleva una marca «Externa · nombre del proveedor».
   l) BANNER DE MODO EDICIÓN MAESTRA: aviso «Está creando la versión 04 en borrador. Los lotes en curso no cambian.» para el usuario master.
   m) ENCABEZADO DE DOCUMENTO CONTROLADO: bloque con logotipo, título, código, versión, fecha de emisión (dd-mm-aaaa), fecha de revisión y «Página x de y», que encabeza todo documento, formato y PDF; pie con el sello «Copia controlada», «Copia no controlada» u «OBSOLETO».
   n) CONSTANCIA DE CAPACITACIÓN y tarjeta de CUESTIONARIO: resultado en porcentaje con línea de aprobación del 80 %, intentos y botón de descarga de la constancia.

6. EJEMPLOS DE GRÁFICAS: línea de tendencia con límites mínimo y máximo (peso cada 30 min), barra de rendimiento contra límite, y mini gráfica de 6 puntos. Color solo para informar.

7. REGLAS DE INTERFAZ: moneda en pesos colombianos ("$135.131.500"), fechas dd/mm/aaaa, hora de 24 h (14:32), semana desde el lunes, decimales con coma ("98,2 %"), miles con punto, todo en español de Colombia, trato de "usted".

FORMATO
Diseña primero para escritorio (1440 px de ancho) y muestra cómo se adaptan los componentes principales a tablet (1024 px, con elementos táctiles de al menos 44 px). No diseñes versión celular. Navegación: menú lateral con las secciones Inicio, Aprobaciones, Documentos, I+D, Bodega, Producción, Calidad, Equipos, Desviaciones y CAPA, Trazabilidad, Liberación, Auditoría y Administración, que cambia según el rol; barra superior con migas de pan, buscador, campana y menú de usuario.

ACEPTACIÓN
- Los tres sistemas de color existen y no se mezclan.
- Ningún estado se comunica solo con color.
- El modal de firma, el sello de firma, la corrección y el aviso de bloqueo están diseñados como componentes reutilizables.
- Todo par texto/fondo cumple AA.
- Existen estados vacío, cargando, error y sin permiso.
- Existen el sello de documento controlado, el cuadro de firmas de documento, el mapa de ubicaciones y el banner de edición maestra.
```

---

## PROMPT 0B: Datos y personas ficticias (úsalos en todas las pantallas)

```
No diseñes pantallas todavía. Este es el CONJUNTO ÚNICO DE DATOS FICTICIOS que usarás en TODAS las pantallas siguientes. Guárdalo y respétalo exactamente (nombres, códigos, cifras y fechas). "Hoy" es el lunes 05/10/2026.

EMPRESA: GRUFARCOL (ficticia). Planta única con áreas: Bodega, Dispensación, Fabricación, Envase, Acondicionamiento, Laboratorio de control de calidad.

PERSONAS Y ROLES
- Camila Ortega · Comercial
- Sebastián Rojas · Químico formulador (I+D)
- Marta Quintero · Auxiliar de bodega
- Hernán Salgado · Jefe de bodega
- Diego Cárdenas · Auxiliar de producción
- Paola Mejía · Coordinadora de producción
- Natalia Ruiz · Auxiliar de laboratorio
- Ricardo Peña · Jefe de control de calidad
- Lucía Barrera · Directora de aseguramiento de calidad
- Dr. Esteban Gaviria · Director técnico
- Tomás Herrera · Administrador del sistema
- Inés Valencia · Auditora invitada (acceso de solo lectura, vence el 30/11/2026)

PRODUCTOS
- PRD-001 «Loción micelar ClariPlus» — línea Cosmética (perfil regulatorio: Cosmético). Presentaciones: 200 mL y 400 mL. Es el producto de casi todas las pantallas.
- PRD-014 «Suspensión oral Ibuprofeno 100 mg/5 mL» — línea Medicamentos (perfil: Medicamento). Solo se usa para mostrar controles más estrictos.

FÓRMULA CUALICUANTITATIVA de ClariPlus, versión 3 (aprobada), para un lote de 2.000,0 kg:
| Material | Código | % | kg por lote |
| Agua purificada | MP-001 | 94,20 | 1.884,00 |
| Glicerina | MP-014 | 3,00 | 60,00 |
| Poloxámero 184 | MP-022 | 1,50 | 30,00 |
| Fenoxietanol | MP-031 | 0,80 | 16,00 |
| Extracto de manzanilla | MP-040 | 0,30 | 6,00 |
| Etilhexilglicerina | MP-032 | 0,10 | 2,00 |
| Ácido cítrico | MP-055 | 0,05 | 1,00 |
| Perfume | MP-060 | 0,05 | 1,00 |
Total 100,00 % = 2.000,00 kg.

ESPECIFICACIÓN del producto terminado (versión 2, aprobada): pH 5,0–6,0 · densidad 0,990–1,020 g/mL · aspecto: líquido translúcido incoloro · olor: característico · recuento total de aerobios mesófilos < 100 UFC/g · ausencia de Pseudomonas aeruginosa.

LOTES DE INSUMO (ejemplos)
- Glicerina: MP-2026-0187 (lote proveedor GLI-2509-A, vence 30/09/2027, 40,00 kg, Aprobado) y MP-2026-0204 (lote proveedor GLI-2511-B, vence 31/12/2027, 120,00 kg, Aprobado).
- Fenoxietanol MP-2026-0198 (vence 15/03/2028, Cuarentena, recibido 05/10/2026).
- Perfume MP-2026-0171 (vence 30/09/2026 → VENCIDO).
- Poloxámero 184 MP-2026-0190 (Aprobado). Ácido cítrico MP-2026-0192 (Rechazado: pureza fuera de especificación).
- Proveedores ficticios: Química Andina S.A.S., Insumos del Valle Ltda.

LOTES DE PRODUCTO
- L-2609-041 · ClariPlus · OP-2026-0038 · en REVISIÓN FINAL, listo para liberar. Granel teórico 2.000,0 kg; granel real 2.004,0 kg (100,2 %).
  · Presentación 200 mL: granel asignado 1.000,0 kg → unidades teóricas 5.000; envasadas 4.910 → rendimiento de envase 98,2 %; rechazadas en inspección 25; muestras de retención 10; unidades aprobadas de producto terminado 4.875 → rendimiento PT 97,5 %.
  · Presentación 400 mL: granel asignado 1.000,0 kg → unidades teóricas 2.500; envasadas 2.465 → 98,6 %; rechazadas 10; retención 5; aprobadas 2.450 → rendimiento PT 98,0 %.
  · Granel remanente 4,0 kg (2,0 kg muestras de calidad + 2,0 kg contramuestra). Límite de rendimiento de PT: ≥ 97,0 %.
  · Resultados de laboratorio: pH 5,6 · densidad 1,004 g/mL · aerobios < 10 UFC/g · Pseudomonas aeruginosa ausente → todo conforme. Certificado analítico CA-2026-0041.
  · Código de verificación pública: K7Q2-M9XP-4TD8.
- L-2610-018 · ClariPlus · OP-2026-0042 · EN PROCESO: dispensación completada, fabricación en curso (paso 6 de 11), envase y acondicionamiento pendientes. Lote de 2.000,0 kg.
- L-2610-019 · ClariPlus · OP-2026-0043 · creado, sin iniciar.

DISPENSACIÓN de L-2610-018 (ejemplos): Glicerina requerida 60,00 kg = 40,00 kg del lote MP-2026-0187 + 20,00 kg del lote MP-2026-0204 (dos lotes en una misma línea). Agua purificada 1.884,00 kg (un lote). Dispensó Diego Cárdenas, verificó Paola Mejía. Balanza BAL-014.

EQUIPOS
- TQ-101 Tanque de fabricación 2.500 L · calibración vigente hasta 14/03/2027 · mantenimiento vigente · limpieza «Limpio» (vence 07/10/2026 → por vencer).
- HM-02 Homogeneizador · todo vigente.
- BAL-014 Balanza 300 kg · calibración VENCIDA desde 02/10/2026 (rojo).
- LL-03 Llenadora · todo vigente · limpieza vigente.
- ET-02 Etiquetadora · mantenimiento por vencer (20/10/2026).

DESVIACIONES
- DEV-2026-0012 · Crítica · «Balanza BAL-014 usada con calibración vencida» · lote L-2610-018 · estado: En CAPA · responsable Lucía Barrera.
- DEV-2026-0017 · Mayor · «Temperatura de fase oleosa 3 °C sobre el límite» · lote L-2609-041 · estado: En investigación · responsable Ricardo Peña.
- DEV-2026-0009 · Menor · «Etiqueta con lote desalineado» · lote L-2608-033 · estado: Cerrada.
- CAPA de DEV-2026-0012: Correctiva «Calibrar BAL-014 y verificar con pesas patrón» (fecha límite 09/10/2026) y Preventiva «Alerta automática de calibración 15 días antes del vencimiento» (31/10/2026); verificación de efectividad pendiente (30/11/2026).

CONTROLES EN PROCESO
- Envase 200 mL: peso neto objetivo 200,0 g; rango permitido 197,0–203,0 g; control cada 30 minutos. Valores del día: 08:00 → 199,8 · 08:30 → 200,3 · 09:00 → 198,9 · 09:30 → 203,6 (FUERA de rango) · 10:00 → 200,1.
- Inspección de producto terminado (9 puntos): 1 Integridad del envase · 2 Tapa y sello · 3 Etiqueta legible y centrada · 4 Lote y vencimiento impresos · 5 Notificación sanitaria visible · 6 Código de barras · 7 Plegadiza correcta · 8 Cantidad por caja · 9 Volumen neto.

BRIEF de ejemplo: «Loción micelar ClariPlus 400 mL», proyecto: nuevo producto; consumidora: mujeres 25–45 años con piel sensible; canales: farmacia y tienda en línea; precio objetivo $28.900; margen objetivo 45 %.

NUEVOS DATOS (v1.1)

BRIEF completo de ClariPlus 400 mL (BR-2026-0011): fecha de ejecución 15/06/2026; tipo de proyecto «Nuevo en el portafolio de la compañía»; categoría Cosmético; justificación «Ampliar la línea de higiene facial con un producto para piel sensible»; competencia (3 filas): (1) Marca Lumia · «Agua micelar sensible» · envase PET transparente · tapa flip-top · etiqueta autoadhesiva · claims «Sin perfume agresivo, dermatológicamente probado» · activos glicerina · precio $32.500 · 400 mL · $81,25/mL; (2) Marca Dermia · «Solución micelar» · PET · tapa rosca · etiqueta envolvente · claims «Hipoalergénica» · activos manzanilla · $26.900 · 400 mL · $67,25/mL; (3) Marca Pura · «Micelar facial» · vidrio · bomba dosificadora · etiqueta serigrafiada · $41.000 · 250 mL · $164,00/mL; sensorial: aroma suave, color incoloro, apariencia translúcida; fuentes: «Estudio de góndola en 12 farmacias y 2 tiendas en línea, junio 2026»; grupo objetivo: estratos 3–5, 25–45 años, mujeres, ingresos de 2 a 6 salarios mínimos; psicográficos «Busca rutinas simples y productos suaves»; actitud de compra «Compara precio y componentes»; frecuencia de consumo «Mensual»; canal: cadenas y subtiendas (farmacias); margen 45 %; precio sugerido $28.900 (400 mL) y $17.900 (200 mL); requisitos legales «Notificación sanitaria obligatoria; rotulado según norma vigente»; costos de implementación «Moldes y artes de etiqueta»; recomendaciones «Lanzar primero en farmacias».

PROTOTIPOS de ese brief: P-0007 «Loción micelar con extracto de manzanilla» (estado «Reformular»: estudio CERRADO ANTICIPADAMENTE como «No cumple» el 08/07/2026 por separación de fase observada en la prueba de calentamiento a los 7 días); P-0008 «Loción micelar sin extracto» (descartado); P-0007-1 «Mejora de P-0007 con poloxámero 1,5 %» (Aprobado como fórmula v3 el 25/08/2026; estudio CUMPLE). La fórmula v3 del 0B proviene de P-0007-1.

ESTABILIDAD PRELIMINAR de P-0007-1 (inicio 20/07/2026 08:00; fin 19/08/2026; muestra de laboratorio, analizó Natalia Ruiz). Cronograma de lecturas: 0 h 20/07 08:00 · 12 h 20/07 20:00 · 24 h 21/07 · 3 d 23/07 · 7 d 27/07 · 15 d 04/08 · 30 d 19/08.
- Calentamiento (rango 42–48 °C, 30 días): 7 tiempos × 3 repeticiones = 21 lecturas. Ejemplo 0 h: temperatura 45,1 / 44,8 / 45,3 °C · pH 5,6 / 5,6 / 5,5 · aspecto «líquido translúcido», color «incoloro», olor «característico». Ejemplo 30 d: 45,0 / 45,2 / 44,9 °C · pH 5,4 / 5,5 / 5,4 · sin cambios organolépticos.
- Enfriamiento (rango 0–8 °C, 30 días): 21 lecturas. Ejemplo 0 h: 4,2 / 4,0 / 4,3 °C · pH 5,6 / 5,6 / 5,6. Ejemplo 30 d: 4,1 / 4,3 / 4,0 °C · pH 5,6 / 5,5 / 5,6 · sin cambios.
- Microbiología (laboratorio externo «Laboratorio Externo Andino», ficticio; informe adjunto IM-2026-0188): a 0 h y 30 d — mesófilos aerobios < 10 UFC/g · Pseudomonas aeruginosa ausente · Staphylococcus aureus ausente · Escherichia coli ausente.
- Viscosidad (muestra de 300 mL, mínimo 250 mL): 0 d 11,8 / 12,0 / 11,9 mPa·s; 30 d 11,6 / 11,7 / 11,8 mPa·s.
- Densidad (requerida en este estudio; picnómetro): 0 d 1,004 g/mL; 30 d 1,003 g/mL.
Para P-0007 (cerrado anticipadamente): calentamiento con lecturas hasta los 7 días; en la lectura de 7 d aspecto «separación de fase» (marcado); no se inició el resto del cronograma.

COSTOS de la fórmula v3 (lote de 2.000 kg; $ por kg): agua 150 → $282.600 · glicerina 6.800 → $408.000 · poloxámero 38.000 → $1.140.000 · fenoxietanol 52.000 → $832.000 · manzanilla 95.000 → $570.000 · etilhexilglicerina 140.000 → $280.000 · ácido cítrico 9.500 → $9.500 · perfume 380.000 → $380.000. Costo del granel $3.902.100 ($1.951,05/kg). Producto terminado (con envase, tapa, etiqueta y caja; cifras redondeadas, densidad aproximada 1,00): 200 mL granel $390 + envase $650 + tapa $180 + etiqueta $120 + caja $150 = $1.490; 400 mL granel $780 + envase $980 + tapa $180 + etiqueta $150 + caja $200 = $2.290. Costo del lote industrial (5.000 unidades de 200 mL y 2.500 de 400 mL) = 5.000 × $1.490 + 2.500 × $2.290 = $13.175.000.

ORDEN DE PRODUCCIÓN: formato de numeración definido por Aseguramiento de calidad «OP-AAAA-NNNN». OP-2026-0042 (lote L-2610-018) está APROBADA y generó: Solicitud de dispensación SD-2026-0042 · Solicitud de material de envase SE-2026-0042 · Solicitud de material de acondicionamiento SA-2026-0042 · Orden de codificado CO-2026-0042 («Lote L-2610-018 · Vence 10/2028»). OP-2026-0043 está en BORRADOR. Rótulos de materias primas con cantidades de la fórmula (p. ej. «Glicerina 60,00 kg»).
DEVOLUCIÓN de material (lote L-2609-041, etiquetas 200 mL): solicitadas 5.200 · usadas 4.935 · dañadas 15 · devueltas 250 (4.935 + 15 + 250 = 5.200).

LIMPIEZA: TQ-101 limpiado el 05/10/2026 por Diego Cárdenas, verificado por Paola Mejía (rótulo de limpieza verificado, vigente hasta 07/10/2026). Utensilios: palas y recipientes de acero, 3 ítems.

PAQUETE TÉCNICO del lote L-2609-041: titular «GRUFARCOL S.A.S.» (ficticio); notificación sanitaria «NSO-FICT-2025-01234»; presentaciones 200 mL y 400 mL; cantidad 2.000,0 kg; fecha de expiración 09/2028; órdenes: fabricación OF-2026-0038, envase OE-2026-0038, acondicionamiento OA-2026-0038; inicio 22/09/2026, fin 02/10/2026. Documentos con «Sí»: orden de producción, prealistamiento y despeje (×3 etapas), solicitud de dispensación, rótulos de dispensación, limpieza de equipos y utensilios (×3), registro de fabricación, orden de envase, solicitud de material de envase, rótulo de granel, registro de envase, control de peso, orden de acondicionamiento, solicitud y devolución de material de acondicionamiento, registro de acondicionamiento, inspección de producto terminado, certificado de calidad CA-2026-0041, consolidado y liberación. «No aplica»: plegadiza (el producto va en caja corrugada) con motivo «Producto sin plegadiza». Firmas: Verificó Paola Mejía (03/10/2026) · Revisó Lucía Barrera (04/10/2026) · Aprobación del Dr. Gaviria PENDIENTE.

NUEVOS DATOS (v1.3)

PERSONAS NUEVAS: Gabriela Torres · Usuario master. Valentina Cruz · Analista de gestión documental (área Aseguramiento de la calidad, que dirige Lucía Barrera; firma corta «V. Cruz»). Marcela Duarte · Gerente general. Firma corta de Diego Cárdenas: «D. Cárdenas».
ÁREAS Y PROCESOS (sigla de 3 caracteres para los códigos de documento): Aseguramiento de la calidad (GCA) · Administrativo (ADM) · Control de calidad (CC) · Producción (PRD) · Mantenimiento (MTO) · Talento humano (TH) · Gestión logística y almacenamiento (GLG) · I+D (IDI, propuesta). Aseguramiento de la calidad es la dueña del sistema de gestión documental.

BODEGAS (estantes × pisos × posiciones = ubicaciones; ocupación de ejemplo):
- BOD-MP «Bodega de materias primas» (interna): 6 × 4 × 2 = 48 ubicaciones; ocupadas 31. El estante E01 es zona de CUARENTENA.
- BOD-ME «Bodega de material de envase» (interna): 4 × 3 × 4 = 48; ocupadas 22.
- BOD-EM «Bodega de material de empaque» (interna): 3 × 3 × 4 = 36; ocupadas 15.
- BOD-GR «Bodega de granel» (interna): 2 × 2 × 2 = 8; ocupadas 3.
- BOD-PT «Bodega de producto terminado» (interna): 8 × 4 × 3 = 96; ocupadas 54.
- BOD-RE «Bodega de rechazo» (interna, bajo llave): 1 × 2 × 4 = 8; ocupadas 3.
- BOD-DV «Bodega de devolución» (interna): 1 × 2 × 4 = 8; ocupadas 1.
- BOD-EXT-01 «Bodega externa — Maquilas del Norte S.A.S.» (ficticia): 2 × 3 × 4 = 24; ocupadas 6; tipos permitidos: material de envase, granel y producto terminado; proveedor de maquila CALIFICADO hasta 31/03/2027.
- BOD-EXT-02 «Bodega externa — Almacenes del Sur» (ficticia): calificación VENCIDA el 30/09/2026 (no admite envíos).
Códigos de ubicación: «MP-E03-P2-01» = estante 3, piso 2, posición 1. Ejemplos: glicerina MP-2026-0187 en MP-E03-P2-01 · poloxámero MP-2026-0190 en MP-E02-P1-01 · fenoxietanol MP-2026-0198 (cuarentena) en MP-E01-P1-02 · ácido cítrico MP-2026-0192 (rechazado) en RE-E01-P1-01 · perfume MP-2026-0171 (vencido) en RE-E01-P1-02 · envases PET 400 mL lote ENV-2510-A en ME-E02-P3-04 · producto terminado L-2609-041 de 200 mL en PT-E05-P1-01.
TRASLADO TR-2026-0007: de BOD-ME a BOD-EXT-01, 1.500 envases PET 400 mL (lote ENV-2510-A), motivo «Envío a maquila para llenado», despachado el 05/10/2026 por Marta Quintero y aprobado por Hernán Salgado; estado «En tránsito» a la espera de la recepción del maquilador; remisión PDF.

DOCUMENTOS CONTROLADOS. Código = proceso (3 letras) + tipo (2 letras) + consecutivo de 3 dígitos; los formatos que cuelgan de un procedimiento agregan su tipo y número (PRD-PR-003-FR-01 = formato 01 del procedimiento PRD-PR-003). Tipos: MN manual · PL plan · PR procedimiento · FR formato · PO política · PG programa · EP especificación · RG registro · CE certificado · IN instructivo · FT ficha técnica · PC protocolo. Niveles: 1 Normatividad · 2 Manuales · 3 Procedimientos · 4 Instructivos, técnicas y matrices · 5 Formatos.
LISTADO MAESTRO (código · título · versión · fecha de emisión · fecha de revisión · estado):
- GCA-PR-001 · Procedimiento para la elaboración de documentos · 02 · 17-04-2025 · 17-04-2028 · Vigente.
- GCA-PR-002 · Procedimiento para el registro y control de documentos · 01 · 17-04-2025 · 17-04-2028 · Vigente.
- GCA-PR-001-FR-01 · Formato listado maestro de documentos · 01 · 17-04-2025 · 17-04-2028 · Vigente. GCA-PR-001-FR-02 · Formato registro de firmas · 01 · mismas fechas.
- PRD-PR-003-FR-01 · Formato registro de fabricación · 03 · 15-05-2023 · 15-05-2026 · REVISIÓN VENCIDA (3 años).
- PRD-PR-001-FR-01 · Formato prealistamiento y despeje de línea · 04 · 20-01-2024 · 20-01-2027 · Vigente.
- PRD-PR-004-FR-01 · Formato registro de envase · 02 · 15-02-2024 · 15-02-2027 · Vigente.
- CC-PR-002-FR-01 · Formato certificado analítico de producto terminado · 02 · 15-02-2024 · 15-02-2027 · Vigente.
- CC-PC-001 · Protocolo de estabilidad preliminar · 01 · 15-02-2026 · 15-02-2029 · Vigente (es el protocolo del estudio del Prompt 3B).
- IDI-IN-012 · Instructivo de manufactura ClariPlus · 03 · vigencia = la de la notificación sanitaria (vence el 30-09-2030) · Vigente.
- IDI-EP-007 · Especificación de producto terminado ClariPlus · 02 · 30-10-2025 · revisión ANUAL 30-10-2026 · POR VENCER (ámbar).
- GLG-PR-004 · Procedimiento de almacenamiento y ubicación de materiales · 01 · EN REVISIÓN (autor Hernán Salgado; Valentina Cruz estandarizó y asignó el código).
- PRD-PR-003-FR-01 · versión 04 · PRELIMINAR (autor Gabriela Torres, usuario master), nacida de la solicitud de cambio SC-2026-0005; cambio técnico, por lo que exige revisar el procedimiento padre PRD-PR-003.
- Documento EXTERNO: «Norma de buenas prácticas de manufactura aplicable» (nivel Normatividad; emisor y versión del emisor; sin firmas internas; con control de distribución). Marcado «por confirmar».
INDICADOR «% de documentos vencidos por proceso» (de los documentos del listado): GCA 0 de 4 = 0 % · PRD 1 de 3 = 33,3 % · CC 0 de 2 = 0 % · IDI 0 de 2 = 0 % · GLG 0 de 1 = 0 %.
SOLICITUDES: SC-2026-0005 (modificación del PRD-PR-003-FR-01): origen la desviación DEV-2026-0017; motivo «Agregar control de temperatura de la fase oleosa cada 10 minutos»; impacto «No afecta lotes en curso; aplica a lotes creados después de quedar vigente»; estado «En elaboración». Solicitud de creación SD-2026-0011 de un procedimiento por Valentina… (estado «Pendiente de estandarización», solicitante Hernán Salgado: el borrador de GLG-PR-004). Solicitud de ANULACIÓN AN-2026-0002 del formato ADM-PR-002-FR-04 «Formato control de visitas»: pedida por el jefe de área, aprobada por Lucía Barrera, copias entregadas a 4 procesos y recogidas 3 (falta Administrativo) → estado «Recolección pendiente».
Cuadro de firmas de PRD-PR-003-FR-01 v03: Actualizado por Valentina Cruz (V. Cruz), Revisado por Lucía Barrera (L. Barrera), Aprobado por el Dr. Esteban Gaviria (E. Gaviria). Historial: 01 · 10-01-2023 · Creación del documento · 02 · 02-03-2023 · Ajuste de campos · 03 · 15-05-2023 · Inclusión de codificación. Usado en los lotes L-2609-041 y L-2610-018.
CAPACITACIÓN de PRD-PR-003-FR-01 v03: divulgada por Valentina Cruz; cuestionario con aprobación del 80 %; asignada a 14 personas con fecha límite 12-10-2026; 12 aprobaron y tienen constancia; pendientes Diego Cárdenas (intento 1: 70 %, no aprobó) y una persona más de producción (sin intento).

PLANTILLAS DE PROCESO (versión vigente): Despeje de línea v04 · Dispensación v02 · Fabricación v03 · Envase v02 · Acondicionamiento v02. Borrador en edición: Fabricación v04 (autor Gabriela Torres), con un paso nuevo «5B Medir temperatura de fase oleosa cada 10 minutos» (rango 70–75 °C), motivo «DEV-2026-0017 / SC-2026-0005».

Confirma con una sola línea que tienes los datos y espera el siguiente prompt.
```

---

## PROMPT 1: Acceso, firma y dashboard por rol (S-01, S-02 · RF-01, RF-02)

```
Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B. Diseña en escritorio (1440 px); del dashboard de Diego agrega también tablet (1024 px).

PANTALLA S-01: Inicio de sesión. Correo, contraseña, botón «Ingresar», enlace «¿Olvidó su contraseña?», aviso de sesión que expira por inactividad (15 min), pie con versión del sistema y la frase «Los registros de esta plataforma tienen validez de evidencia». Estados: error de credenciales, cuenta bloqueada, cuenta de auditor vencida («Su acceso venció el 30/11/2026. Solicite una ampliación a Administración.»).
Agrega una lámina del MODAL DE FIRMA ELECTRÓNICA en tres estados: normal (firmando «Verificó» la dispensación de glicerina), contraseña incorrecta, y bloqueado por segregación de funciones.

PANTALLA S-02: Dashboard por rol («Inicio»), una lámina por rol, con saludo, fecha y SOLO lo que ese rol necesita hacer hoy:
- Diego Cárdenas (Auxiliar de producción): «Mis lotes de hoy» (L-2610-018 fabricación, paso 6 de 11), recordatorio de control de peso a las 10:30, «Pendiente de mi firma» (2), aviso de equipo con alerta (BAL-014 vencida).
- Paola Mejía (Coordinadora): lotes activos del día con etapa y estado, órdenes por crear, verificaciones pendientes de su firma (3), despejes de línea pendientes.
- Marta Quintero (Auxiliar de bodega): recepciones pendientes (1: fenoxietanol), rótulos por imprimir, lotes en cuarentena esperando calidad.
- Ricardo Peña (Jefe de CC): lotes de insumo en cuarentena por liberar, resultados por revisar, certificados por aprobar.
- Lucía Barrera (Directora de AQ): expedientes por revisar (L-2609-041), desviaciones abiertas por severidad, CAPA por vencer, aprobaciones de versiones pendientes.
- Dr. Esteban Gaviria (Director técnico): lotes pendientes de liberación, versiones por aprobar, desviaciones críticas abiertas.
- Hernán Salgado (Jefe de bodega): ocupación por bodega (barra por bodega), traslados pendientes (TR-2026-0007 en tránsito), lotes por vencer.
- Valentina Cruz (Analista de gestión documental): documentos por estandarizar (2), documentos en revisión (1), revisiones periódicas vencidas (1: PRD-PR-003-FR-01), capacitaciones pendientes (2 personas), solicitudes de cambio abiertas (1), anulaciones con recolección pendiente (1), indicador «% de documentos vencidos por proceso», botón «Nuevo documento».
- Gabriela Torres (Usuario master): borradores propios (PRD-PR-003-FR-01 v04, Fabricación v04), versiones devueltas, accesos directos a fórmulas, especificaciones, instructivos y plantillas de proceso.
- Marcela Duarte (Gerente general): documentos administrativos por aprobar (1), fórmulas y prototipos por aprobar, resumen de lotes liberados del mes.
Cada tarjeta de pendiente es un enlace con conteo; las cifras deben coincidir con las listas de las demás pantallas. Incluye, para Diego, estado vacío («No tiene tareas pendientes») y estado cargando.

ACEPTACIÓN
- El menú lateral de cada rol muestra solo sus secciones.
- Los conteos coinciden con los del 0B (3 verificaciones de Paola, etc.).
- El modal de firma muestra significado, resumen y hora del servidor.
- El bloqueo por segregación explica la regla en una frase.
```

---

## PROMPT 2: Administración (S-03, S-04 · RF-03, RF-04)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) la sección «Administración», visible solo para Tomás Herrera (Administrador del sistema).

S-03 Usuarios y roles:
1. Lista de usuarios (tabla): nombre, correo, roles, estado (Activo / Inactivo con ícono y texto), último ingreso, vencimiento de acceso (solo auditor). Filtros por rol y estado.
2. Detalle/edición de usuario: datos, asignación de uno o varios roles con casillas (incluye «Usuario master» y «Analista de gestión documental»), área a la que pertenece, fecha de vencimiento del acceso, restablecer contraseña, desactivar. Aviso fijo: «La administración de usuarios no incluye firmar registros de calidad.» Muestra el bloqueo cuando se intenta asignar a un mismo usuario una combinación que viola la segregación de funciones para un lote (p. ej. «Ejecutar y liberar el mismo lote no está permitido»).
3. Invitar auditor: formulario con correo, alcance de lectura, fecha de vencimiento obligatoria; ejemplo con Inés Valencia hasta 30/11/2026.
4. Panel de bitácora de cambios de roles (quién asignó qué y cuándo).

S-04 Catálogos y perfiles regulatorios:
1. Pestañas: Líneas de producto, Áreas (con Aseguramiento de la calidad como dueña del sistema de gestión documental y sigla de proceso GCA), Proveedores de maquila (nombre, calificación y vencimiento), Unidades, Marcas/clientes de maquila (con interruptor «Activar maquila», apagado por defecto y nota «Por confirmar con Dirección»).
2. Perfiles regulatorios: tabla de reglas (verificación independiente en dispensación, reautenticación en cada firma, revisión de AQ antes de liberar, calificación de equipos críticos, desviación crítica bloquea liberación) con una columna por perfil, «Cosmético» y «Medicamento», y interruptores. Aviso: «Un cambio de perfil no altera los lotes ya creados.»
3. Estados vacío, cargando, error y sin permiso para quien no es administrador.

ACEPTACIÓN
- Un rol no administrador ve «Sin permiso» y no el contenido.
- Los dos perfiles se comparan lado a lado.
- Todo cambio muestra a quién y cuándo en la bitácora.
```

---

## PROMPT 2B: Usuario master y plantillas de proceso (S-43 · RF-05, RF-06)

```
Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B. Diseña en escritorio (1440 px).

CONCEPTO: el usuario master (Gabriela Torres) puede crear y modificar fórmulas, especificaciones, instructivos y las plantillas de cada etapa del proceso (despeje de línea, dispensación, fabricación, envase, acondicionamiento y otras). Siempre lo hace creando una VERSIÓN NUEVA EN BORRADOR que pasa por revisión y aprobación; no puede aprobar lo que él mismo creó ni modificar versiones aprobadas ni lotes ya ejecutados.

S-43 Plantillas de proceso:
1. Catálogo de etapas: tarjetas o tabla con Despeje de línea, Dispensación, Fabricación, Envase, Acondicionamiento y el botón «Agregar etapa»; cada una con su sello de documento controlado (código · versión · vigencia), versión vigente, última edición y si tiene un borrador abierto.
2. Editor de la plantilla de Fabricación v04 (borrador): lista de pasos arrastrables; panel de propiedades del paso (texto, parámetros con unidad, mínimo, máximo y frecuencia, equipo exigido, verificación de segunda persona); el paso nuevo «5B Medir temperatura de fase oleosa cada 10 minutos (70–75 °C)» resaltado; campo OBLIGATORIO «Motivo del cambio» (DEV-2026-0017 / SC-2026-0005); banner de modo edición maestra («Está creando la versión 04 en borrador. Los lotes en curso no cambian.»); botones «Guardar borrador» y «Enviar a revisión».
3. Comparación v03 contra v04 con diferencias resaltadas.
4. Variante de la plantilla de Despeje de línea: lista de ítems de verificación editables (por ejemplo «Área libre de materiales de lote anterior», «Rótulos de limpieza de equipos y utensilios verificados»).
5. Variante de acceso del master a S-07 (fórmula): mismo editor de fórmula con el banner de edición maestra y botón «Crear nueva versión (v04)».
6. Láminas de bloqueo: (a) el master intenta editar una versión aprobada — «Esta versión está aprobada. Cree una versión nueva en borrador.»; (b) el master intenta aprobar la versión que creó — aviso de segregación de funciones; (c) un rol sin permiso ve «Sin permiso»; (d) el master intenta firmar un registro de ejecución — «El usuario master no firma registros de ejecución».

ACEPTACIÓN
- Todo cambio exige motivo y crea una versión nueva en borrador.
- Se ve que la versión nueva solo aplica a lotes creados después de quedar vigente.
- Los tres bloqueos explican regla y acción.
- Cada plantilla muestra su sello de documento controlado.
```

---

## PROMPT 2C: Gestión documental de Aseguramiento de la calidad (S-44 a S-49 · RF-92 a RF-103)

```
Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B. Diseña en escritorio (1440 px). S-47 también en tablet (1024 px).

CONCEPTO: Aseguramiento de la calidad es el área dueña del sistema de gestión documental (SGD). La analista Valentina Cruz estandariza los documentos, asigna el código, mantiene el listado maestro, publica y emite copias controladas; Lucía Barrera revisa y aprueba (y decide las anulaciones); el Dr. Gaviria aprueba los documentos técnicos y Marcela Duarte los administrativos. Regla de oro visible en las pantallas: quien elabora o modifica un documento no lo revisa ni lo aprueba; quien lo revisa sí puede aprobarlo. Los documentos del SGD son los mismos formatos, instructivos, especificaciones y protocolos que usa el registro de lote: cada lote queda ligado a la versión que usó.

S-44 Listado maestro de documentos: tarjetas de conteo (vigentes, en revisión, revisiones vencidas, por estandarizar, solicitudes abiertas) y el indicador «% de documentos vencidos por proceso» (tabla pequeña con los valores del 0B); tabla con código monoespaciado, título, tipo, nivel, proceso, versión, fecha de emisión, fecha de revisión, estado de trámite (preliminar, en estandarización, en revisión, en aprobación, vigente, obsoleto: neutro/azul), vigencia (semáforo: Vigente, Por vencer, Revisión vencida, con ícono y texto) y documentos asociados (los formatos de un procedimiento se muestran anidados bajo él); filtros por proceso, tipo, nivel y estado; búsqueda; botón «Exportar a Excel»; incluye el documento externo. Variantes: vista de Valentina (completa, con «Nuevo documento» y exportar) y vista de Diego Cárdenas (solo vigentes con «Pendiente de capacitación»); estado vacío; sin permiso.
S-45 Solicitar o crear documento: (a) lámina del SOLICITANTE (Hernán Salgado): tipo de solicitud (crear, modificar, anular), proceso, tipo de documento, motivo, áreas a las que se distribuirá, y la descarga de la «plantilla editable» con la estructura obligatoria; (b) lámina de VALENTINA (solo ella): a partir de la solicitud ya estandarizada, el CÓDIGO generado automáticamente y no editable (GLG-PR-004), la versión 01, el título que debe iniciar con el nombre del tipo, el autor, la ruta de aprobación (revisa: jefe inmediato o Aseguramiento de la calidad; aprueba: Dirección técnica para documentos técnicos o Gerencia/Dirección técnica para administrativos) y, para un formato, el procedimiento padre (código PRD-PR-003-FR-01 = formato 01 de PRD-PR-003). Lámina de bloqueo para otro rol: «Solo Aseguramiento de la calidad asigna códigos.»
S-49 Estandarización (bandeja de Valentina): lista de preliminares recibidos; detalle con la LISTA DE CHEQUEO (encabezado completo; títulos mínimos: objetivo, alcance —los formatos e instructivos no llevan alcance—, responsables, desarrollo, documentos relacionados y anexos, control de cambios; redacción en infinitivo; unidades del Sistema Internacional; «N.A.» cuando no aplica) y el REVISOR DE REDACCIÓN que marca términos subjetivos («suficientemente», «generalmente», «adecuadamente», «apropiadamente») con el resultado «Cumple» o «No cumple»; botones «Devolver al solicitante con observaciones» y «Asignar código y enviar a revisión».
S-46 Detalle del documento (PRD-PR-003-FR-01): ENCABEZADO DE DOCUMENTO CONTROLADO (logotipo, título, código, versión, fecha de emisión, fecha de revisión, página x de y) y sello; pestañas: Documento (vista del contenido con las secciones mínimas), Versiones (v03 vigente, v04 preliminar, con la descripción del cambio), Flujo (línea de tiempo solicitud → preliminar → estandarización → código → revisión → aprobación → vigente → capacitación), Firmas (cuadro Actualizado/Revisado/Aprobado con firma corta e historial de actualizaciones, últimos tres), Copias y distribución (tabla de procesos con copia controlada entregada y obsoleta recogida: el «control de documentos»), Bitácora, y «Usado en lotes» (L-2609-041 y L-2610-018). Acciones según rol: Enviar a revisión, Aprobar (modal de firma «Aprobé»), «Publicar como vigente y emitir copias» (solo Valentina), «Crear nueva versión», «Descargar PDF» con marca. Láminas: documento OBSOLETO con marca de agua y sello «OBSOLETO»; «Copia no controlada» entregada a un tercero; bloqueo de segregación («Usted elaboró esta versión y no puede revisarla ni aprobarla»); el REVISOR que sí puede aprobar (caso permitido); bloqueo por cambio técnico de un formato: «Este cambio técnico exige revisar el procedimiento PRD-PR-003 antes de publicar.»
S-47 Divulgación y capacitación: para el usuario, lista de documentos asignados con fecha límite, el CUESTIONARIO (preguntas de opción múltiple) con porcentaje y línea de aprobación del 80 %, intentos y la CONSTANCIA descargable; lámina con Diego Cárdenas en 70 %: «No aprobó. Puede intentarlo de nuevo.»; para Valentina, seguimiento por documento (12 de 14 aprobaron; pendientes Diego Cárdenas y una persona más; botón «Enviar recordatorio») y registro de capacitación y entrenamiento; quién divulga (quien elaboró, revisó o aprobó, o la analista). Lámina del bloqueo en producción: «Debe aprobar la capacitación de PRD-PR-003-FR-01 v03 antes de ejecutar este paso.»
S-48 Control de cambios y anulaciones: (a) cambios: tabla de solicitudes y detalle de SC-2026-0005 (origen DEV-2026-0017 con enlace, motivo, impacto, documento afectado, versión nueva v04 preliminar, bloque «Revisión del procedimiento padre: pendiente / sin cambio / nueva versión», cierre automático al quedar vigente); lámina de creación desde el detalle de una desviación (botón «Solicitar cambio documental» en S-28) y desde «Renovación del registro sanitario» (todos los documentos con la vigencia del registro quedan marcados para revisión); (b) anulaciones: flujo jefe de área solicita → Lucía Barrera decide la viabilidad → recolección de copias por proceso (3 de 4 recogidas, falta Administrativo) → sello obsoleto → archivo (conservado 5 años) → listado maestro actualizado; AN-2026-0002 en «Recolección pendiente» con el bloqueo «No se puede cerrar la anulación: falta recoger la copia de Administrativo.»

ACEPTACIÓN
- Se ve en todo momento qué versión de cada documento está vigente y cuál se usó en cada lote.
- Solo Aseguramiento de la calidad asigna códigos; el autor nunca revisa ni aprueba lo suyo, pero el revisor sí puede aprobar.
- La estructura del código (proceso-tipo-consecutivo y subdocumento) se entiende con un ejemplo en pantalla.
- Una revisión vencida o por vencer se ve con ícono y texto, no solo con color.
- Toda descarga muestra «Copia controlada», «Copia no controlada» u «OBSOLETO».
- La capacitación con 80 % o más genera constancia; con menos no.
- El cambio técnico de un formato obliga a revisar su procedimiento y lo dice.
```

---

## PROMPT 3: I+D y documentos maestros (S-05 a S-10 · RF-10 a RF-14)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) el módulo de I+D y aprobaciones. De S-07 agrega también tablet (1024 px).

CONCEPTO: los documentos maestros (fórmula, especificación, instructivo) son VERSIONADOS: Borrador → En revisión → Aprobado → Reemplazado. Una versión aprobada no se edita: se crea una nueva. Quien crea una versión no la puede aprobar. El lote congela las versiones al crearse.

S-05 Listado de briefs: tabla (código, producto, tipo de proyecto, solicitante, fecha, estado), filtros, botón «Nuevo brief» (solo Camila Ortega).
S-06 Formulario de brief (Camila): secciones con índice lateral — 1 Identificación (fecha de ejecución, nombre del proyecto, barra de selección del TIPO DE PROYECTO: innovador / nuevo en el portafolio / modificación o renovación / extensión de línea / maquila a tercero; selector Medicamento o Cosmético) · 2 Justificación · 3 Competencia (tabla editable de productos comparados con fabricante, nombre, envase, tipo de tapa, tipo de etiqueta, claims, activos, precio, aroma, color, apariencia y precio por mL calculado; botón «Agregar competidor»; campo de fuentes de información) · 4 Grupo objetivo (estrato, edad, sexo, ingresos, otras características, explicación de «para quién está diseñado», datos psicográficos, actitud de compra, frecuencia de consumo) · 5 Canal de distribución (casillas: cadenas, subtiendas, mercado tradicional, otros) · 6 Margen y precio sugerido por presentación (con cálculo de margen) · 7 Requisitos legales y costos asociados · 8 Recomendaciones y sugerencias. Guardar borrador, Enviar a I+D. Usa el brief BR-2026-0011 del 0B (con sus tres competidores). Estados: guardado automático, error de campos obligatorios.
S-07 Fórmula cualicuantitativa (Sebastián Rojas): tabla de ingredientes con código, nombre, fase, porcentaje y kg por lote; total en vivo con indicador «Suma 100,00 %» (verde con ícono) o «Suma 99,95 % — no se puede enviar» (bloqueo con regla y acción); selector de tamaño de lote que recalcula kg; encabezado con versión (v3), estado y botón «Enviar a revisión». Una lámina con la fórmula bloqueada y sello de firma.
S-08 Especificaciones: pestañas Materia prima / Granel / Producto terminado; tabla de parámetros con método, mínimo, máximo y unidad; ejemplo con la especificación de ClariPlus del 0B.
S-09 Constructor de instructivos: lista ordenada de pasos arrastrables (11 pasos de fabricación de ClariPlus, p. ej. «Calentar fase acuosa a 70–75 °C», «Homogeneizar a 3.000 rpm por 15 min», «Enfriar a 35 °C y agregar perfume»); cada paso define: texto, si exige equipo, si exige verificación, y los parámetros a registrar (nombre, unidad, mínimo, máximo, frecuencia). Panel lateral de propiedades del paso. Pestañas Fabricación / Envase / Acondicionamiento con selector de presentación (200 mL / 400 mL).
S-10 Bandeja de aprobación de versiones (Dr. Gaviria y Lucía Barrera): tabla de versiones en revisión (documento, versión, creada por, fecha, cambios), comparación lado a lado entre v2 y v3 con diferencias resaltadas, botones Aprobar (abre el modal de firma, significado «Aprobé») y Devolver con motivo. Muestra el bloqueo cuando quien creó la versión intenta aprobarla.

ACEPTACIÓN
- La suma de la fórmula se ve en vivo y bloquea el envío si no es 100 %.
- Una versión aprobada se ve como solo lectura con candado.
- La comparación de versiones resalta lo cambiado.
- Los briefs usan los datos del 0B.
- La fórmula, la especificación y el instructivo muestran el sello de documento controlado (código · versión · vigencia) y su cuadro de firmas; la bandeja S-10 también recibe documentos del SGD.
```

---

## PROMPT 3B: Prototipos, estabilidad preliminar y costos (S-36, S-37 · RF-15, RF-16, RF-17)

```
Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B. Diseña en escritorio (1440 px).

S-36 Prototipos de fórmula y estabilidad (Sebastián Rojas; el Dr. Gaviria aprueba):
1. Encabezado con el brief de origen (BR-2026-0011, ClariPlus 400 mL) y el aviso «Se requieren al menos 2 prototipos para elegir».
2. Árbol o tabla de prototipos con código monoespaciado y consecutivo de mejora: P-0007 (estado «Reformular»), P-0008 («Descartado»), P-0007-1 («Aprobado como fórmula v3»). Cada fila: tipo de producto, público y beneficio, concepto, estado de trámite (neutro/azul, no semáforo).
3. Detalle de un prototipo (P-0007-1): tipo de producto, público, beneficio buscado, concepto propuesto (texto y espacio para boceto o esquema), tabla de ingredientes con porcentajes y suma, y el instructivo de manufactura borrador.
4. Bloque «ESTABILIDAD PRELIMINAR» del prototipo, en una vista con cinco pruebas como pestañas o tarjetas, con el avance global («Lecturas completas: 58 de 58 obligatorias») y las fechas del cronograma (inicio 20/07/2026, fin 19/08/2026):
   a) CALENTAMIENTO (42 °C – 48 °C, 30 días): tabla de lecturas con filas por tiempo (0 h, 12 h, 24 h, 3 d, 7 d, 15 d, 30 d) y columnas por repetición (R1, R2, R3), cada celda con temperatura, pH y examen organoléptico (aspecto, color, olor); lecturas pendientes con la fecha programada y estado «Pendiente» / «Vence hoy» / «Atrasada» (trámite, no semáforo); lectura con temperatura fuera de rango marcada con ícono y texto («Fuera de 42–48 °C»); gráfica de tendencia de pH por tiempo con las tres repeticiones.
   b) ENFRIAMIENTO (0 °C – 8 °C, 30 días): misma estructura con su rango.
   c) MICROBIOLÓGICA (laboratorio externo): dos tiempos (0 h y 30 d) y cuatro microorganismos (mesófilos aerobios, Pseudomonas aeruginosa, Staphylococcus aureus, Escherichia coli) con resultado y unidad; adjunto del informe del laboratorio externo (IM-2026-0188) y nombre del laboratorio; sin informe adjunto no se puede registrar («Adjunte el informe del laboratorio externo»).
   d) VISCOSIDAD: campo «Volumen de muestra (mL)» con validación «Mínimo 250 mL» (lámina con 200 mL y el error «La muestra debe ser de al menos 250 mL»), mediciones a 0 d y 30 d por triplicado, en mPa·s.
   e) DENSIDAD: interruptor «Se requiere densidad» (apagado la oculta); método fijo «Picnómetro»; valores a 0 d y 30 d.
   El estudio muestra el sello del PROTOCOLO que lo rige (CC-PC-001 · v01 · Vigente). Cada lectura muestra su sello (quién registró y cuándo, con firma corta). Conclusión «Cumple» / «No cumple» con firma; botón «Cerrar estudio» deshabilitado con motivo si faltan lecturas obligatorias («Faltan 3 lecturas de calentamiento a los 30 días»). Lámina de P-0007 con el CIERRE ANTICIPADO «No cumple» (motivo «Separación de fase a los 7 días, calentamiento»), las lecturas hasta los 7 días y el botón «Crear mejora (P-0007-1)» que genera el consecutivo. Nota «Criterios de cumplimiento por confirmar con Calidad».
5. Bloque de aprobación: Gerencia, Dirección técnica y (solo si es desarrollo externo) Cliente, cada uno con su sello de firma; el botón «Aprobar como fórmula» deshabilitado con motivo si falta estabilidad conforme o hay menos de 2 prototipos («Falta un estudio de estabilidad que cumpla»).

S-37 Hoja de costos de la fórmula v3 (Sebastián Rojas, Dr. Gaviria): tabla de ingredientes con cantidad por lote, costo por kg y costo por línea (valores del 0B); total del granel $3.902.100; sección por presentación (200 mL y 400 mL) con granel + envase + tapa + etiqueta + caja = costo del producto terminado ($1.490 y $2.290); costo del lote industrial según unidades definidas (5.000 y 2.500) = $13.175.000; los totales se recalculan en vivo. Aviso «Esta información es confidencial y no aparece en la verificación pública.» Una lámina con la vista de un rol sin permiso de costos («Sin permiso»).

ACEPTACIÓN
- La numeración de prototipos y mejoras se entiende sin explicación.
- La fórmula no se puede aprobar sin un estudio de estabilidad completo y conforme; el motivo está escrito.
- Las cinco pruebas, sus rangos (42–48 °C y 0–8 °C), sus tiempos de lectura y el triplicado se ven con claridad; la viscosidad exige al menos 250 mL.
- Cada lectura pendiente muestra su fecha programada.
- Los totales de costos coinciden con el 0B.
- Los costos nunca se muestran a roles sin permiso.
```

---

## PROMPT 4: Bodega e inventarios (S-11 a S-14 · RF-20 a RF-22)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) el módulo de Bodega y la liberación de insumos. Agrega tablet (1024 px) en S-11.

S-11 Recepción de materia prima (Marta Quintero): formulario con material (selector), proveedor, lote del proveedor, fecha de vencimiento (obligatoria), cantidad y unidad, adjunto del certificado de análisis del proveedor, observaciones; resumen «Se recibirá en CUARENTENA» con insignia ámbar. Ejemplo: Fenoxietanol, Química Andina S.A.S., lote FEN-2510-C. Campo «Ubicación» con ubicaciones libres sugeridas y compatibles con el tipo de material (para fenoxietanol: MP-E01-P1-02, zona de cuarentena). Botón «Recibir y generar rótulo». Errores: «Falta fecha de vencimiento» y, en una lámina aparte, «Esta ubicación no admite material de envase» al intentar colocar un material en una ubicación de otro tipo.
S-14 Rótulo (vista de impresión): rótulo con código interno MP-2026-0198, UBICACIÓN asignada en grande (MP-E01-P1-02), material, lote proveedor, vencimiento, estado «CUARENTENA» en grande con ícono, QR y fecha de recepción.
S-12 Inventario / kardex (Hernán Salgado): tabla por lote con material, lote, vencimiento, saldo, estado de calidad (semáforo con ícono y texto), filtros por estado, material y vencimiento; alertas de vencimiento a 30/60/90 días; ordenar por FEFO (primero que vence, primero que sale); columna «Ubicación» (bodega · código) y alternar entre vista de tabla y vista de MAPA de la bodega (estantes × pisos); buscador «¿Dónde está este lote?»; acción «Trasladar» con motivo. Detalle de un lote: movimientos (recepción, dispensaciones con código de lote de producto, ajustes con motivo) y saldo calculado. Incluye el lote vencido de perfume (rojo, «Vencido») y el rechazado de ácido cítrico.
S-13 Liberación de insumos (Ricardo Peña): bandeja de lotes en cuarentena con material, proveedor, fecha de recepción, resultados capturados (Pendiente / Conforme / No conforme), botones Aprobar o Rechazar (con motivo) mediante el modal de firma. Bloqueo: «No se puede aprobar: faltan resultados de análisis. Solicite a Laboratorio.»

ACEPTACIÓN
- Cuarentena, aprobado, rechazado y vencido son inconfundibles y siempre con ícono y texto.
- El kardex coincide con el 0B (glicerina: 40,00 y 120,00 kg).
- El rótulo muestra el estado con claridad a un metro de distancia.
- Todo lote muestra su ubicación; el sistema no permite ubicarlo donde su tipo no está admitido.
```

---

## PROMPT 4B: Estructura de bodegas, ubicaciones y bodegas externas (S-41, S-42 · RF-23, RF-24, RF-25)

```
Usa exactamente el sistema de diseño de GRUFARCOL eBR definido antes y los datos del Prompt 0B. Diseña en escritorio (1440 px). S-41 (mapa) también en tablet (1024 px).

S-41 Estructura de bodegas y ubicaciones (Hernán Salgado crea; Tomás Herrera también puede; Lucía Barrera aprueba las externas):
1. Lista de bodegas: tarjetas con código, nombre, función (materias primas, material de envase, material de empaque, granel, producto terminado, rechazo, devolución), marca «Interna» o «Externa · proveedor», ocupación (barra con «31 de 48 ubicaciones») y botón «Nueva bodega». Usa las ocho bodegas del 0B.
2. Formulario «Nueva bodega»: código, nombre, FUNCIÓN (selector con las siete funciones), tipos de material permitidos (casillas), sitio Interno o Externo (si es externo: selector de proveedor de maquila con su calificación y vencimiento, dirección y aviso «Requiere aprobación de Aseguramiento de la calidad»). Sección «Estructura»: número de estantes, pisos por estante, posiciones por piso y prefijo; vista previa en vivo «6 × 4 × 2 = 48 ubicaciones» con tres códigos de ejemplo (MP-E01-P1-01, MP-E03-P2-01, MP-E06-P4-02); botón «Generar ubicaciones».
3. Mapa de la bodega BOD-MP: cuadrícula de estantes (columnas E01–E06) por pisos (filas 1–4) con las dos posiciones de cada celda en estado Libre, Ocupada o Bloqueada (ícono + texto), estante E01 marcado como ZONA DE CUARENTENA; al seleccionar una ubicación, panel con su código, lotes almacenados y botón «Bloquear» (con motivo).
4. Lámina de BOD-EXT-01 (externa): marca «Externa · Maquilas del Norte S.A.S. · calificación vigente hasta 31/03/2027», existencias por lote y estado «En tránsito» de lo despachado.
5. Láminas de bloqueo: (a) «Almacenes del Sur: calificación vencida el 30/09/2026. No se pueden enviar materiales a esta bodega.»; (b) no se puede eliminar una ubicación con existencias; (c) crear una bodega externa queda «Pendiente de aprobación de Aseguramiento de la calidad».

S-42 Traslados y envíos a bodegas externas (Marta Quintero prepara; Hernán Salgado firma y aprueba):
1. Lista de traslados con código, origen, destino (interno o externo), estado (Borrador, Despachado «En tránsito», Recibido, Anulado; trámite, no semáforo) y fecha; filtro «Solo externos».
2. Formulario de traslado: origen y destino, líneas con lote, cantidad y ubicación de origen y destino, motivo; resumen de la calificación del tercero; botón «Generar remisión (PDF)».
3. Detalle de TR-2026-0007 en tránsito: línea de tiempo Borrador → Despachado → Recibido con sellos de firma de despacho (Marta Quintero, Hernán Salgado) y espacio para la firma de recepción y el adjunto del acta de recepción del maquilador; aviso «Mientras esté en tránsito, el saldo aparece en la bodega externa como pendiente de recepción».
4. Láminas de bloqueo: lote en cuarentena o rechazado no se puede enviar («El lote MP-2026-0198 está en cuarentena…»); destino sin calificación vigente.

ACEPTACIÓN
- Se ve cuántos estantes, pisos y posiciones tiene cada bodega y la cuenta cuadra (6 × 4 × 2 = 48; 2 × 3 × 4 = 24).
- La función de la bodega y los tipos de material permitidos se entienden sin leer.
- Una bodega externa se distingue a simple vista de una interna.
- Los bloqueos dicen regla y acción.
```

---

## PROMPT 5: Orden de producción, lotes y despeje de línea (S-15, S-16, S-17 · RF-30 a RF-32)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px). De S-16 y S-17 agrega también tablet (1024 px).

S-15 Crear orden de producción (Paola Mejía): producto (ClariPlus), número de orden asignado según el formato definido por Aseguramiento de calidad (OP-AAAA-NNNN, no editable), cantidad (2.000,0 kg), fecha planeada, versiones que se congelarán (fórmula v3, especificación v2, instructivos de fabricación, de envase 200 mL y 400 mL, y de acondicionamiento) mostradas como «Se usarán estas versiones aprobadas», presentaciones a envasar con cantidades, perfil regulatorio heredado (Cosmético), resumen de etapas que se generarán. Botón «Crear orden y lote» (queda en borrador hasta su aprobación; al aprobarse se generan las solicitudes y documentos, ver S-38). Estados: éxito («Se creó OP-2026-0043 y el lote L-2610-019»), y BLOQUEO si no hay versión aprobada («La fórmula de este producto no tiene versión aprobada. Solicite aprobación al Director técnico.»).
S-16 Tablero de órdenes y lotes / lote activo: es el panel que abre Producción, con botón «Crear orden de producción»; tabla con producto, lote, cantidad, presentación, OP, etapa actual, estado (En curso / En cuarentena / Aprobada, con semáforo solo para el estado de calidad), responsable, fecha; filtros por etapa y estado; tarjeta destacada del lote activo L-2610-018 con una línea de proceso horizontal (Despeje → Dispensación → Fabricación → Envase → Acondicionamiento) que muestra la etapa completada, la actual y las bloqueadas; incluye L-2610-018 (en proceso) y L-2610-019 (creado).
S-17 Prealistamiento y despeje de línea para cada área (Dispensación, Fabricación, Envase, Acondicionamiento): checklist por etapa (ej. Envase) — «Área libre de materiales de lote anterior», «Equipos limpios y con estado vigente» (con vigencia por equipo), «Documentación del lote anterior retirada», «Materiales de envase conciliados»; campos de ejecutor y verificador (coordinador o supervisor) con sellos de firma; bloqueo si falta verificador o si un equipo está vencido. Una lámina con SEGREGACIÓN: Diego ejecutó, solo Paola puede verificar.

ACEPTACIÓN
- La línea de proceso es entendible sin leer.
- El bloqueo por falta de versión aprobada dice regla y acción.
- Ninguna etapa aparece como iniciable sin despeje verificado.
```

---

## PROMPT 5B: Documentos de la orden y limpieza (S-38, S-39 · RF-38, RF-39)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px). S-39 también en tablet (1024 px).

S-38 Solicitudes y documentos de la orden OP-2026-0042 (Paola Mejía, Dr. Gaviria; Marta Quintero solo lectura):
1. Encabezado de la orden con su estado y la línea «Aprobada el 04/10/2026». Lámina previa con la orden en BORRADOR y el botón «Aprobar orden y generar documentos» (modal de firma); lámina con el aviso de segregación «Quien creó la orden no puede aprobarla».
2. Lista de DOCUMENTOS GENERADOS con ícono, nombre, código, estado y botón «Descargar PDF»: Solicitud de dispensación SD-2026-0042 · Solicitud de material de envase SE-2026-0042 · Solicitud de material de acondicionamiento SA-2026-0042 (etiquetas y corrugados) · Orden de codificado CO-2026-0042 · Rótulos de materias primas y materiales · Registro de fabricación · Registro de envase · Registro de acondicionamiento (con codificación).
3. Detalle de la solicitud de dispensación: tabla con cada materia prima y su cantidad calculada = porcentaje de fórmula × tamaño de lote (valores del 0B, glicerina 60,00 kg) y el rótulo de ejemplo «Glicerina · 60,00 kg · OP-2026-0042».
4. Detalle de la solicitud de material de acondicionamiento con su DEVOLUCIÓN (datos del lote L-2609-041: solicitadas 5.200, usadas 4.935, dañadas 15, devueltas 250) y el indicador «Cuadra: 4.935 + 15 + 250 = 5.200».
5. Detalle de la orden de codificado: textos que se imprimen (lote, vencimiento 10/2028) con vista previa.

S-39 Limpieza de equipos y utensilios (Diego Cárdenas ejecuta, Paola Mejía verifica): por etapa (Fabricación), lista de equipos y utensilios con casilla «Rótulo de limpieza colocado y verificado», fecha y hora de limpieza, vigencia («Vigente hasta 07/10/2026», ámbar por vencer), sellos de ejecutor y verificador. Lámina de bloqueo: «TQ-101 sin limpieza vigente: no puede usarse en el registro de fabricación. Registre la limpieza o use otro equipo.»

ACEPTACIÓN
- Se ve que al aprobar la orden aparecen automáticamente todos los documentos.
- Las cantidades coinciden con el 0B.
- La devolución de material cuadra.
- Limpieza vencida bloquea el uso con regla y acción.
```

---

## PROMPT 6: Dispensación multi-lote (S-18 · RF-33)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) y tablet (1024 px) la pantalla S-18 Dispensación del lote L-2610-018 (Diego Cárdenas ejecuta, Paola Mejía verifica).

Estructura: encabezado de lote; tabla de líneas por materia prima (Agua, Glicerina, Poloxámero, Fenoxietanol, Extracto de manzanilla, Etilhexilglicerina, Ácido cítrico, Perfume) con cantidad requerida, cantidad dispensada y estado (trámite).
La línea «Glicerina — requerida 60,00 kg» se muestra EXPANDIDA con DOS sublíneas de lote: MP-2026-0187 → 40,00 kg y MP-2026-0204 → 20,00 kg; cada sublínea con selector de lote (solo lotes Aprobados y no vencidos, ordenados por FEFO con la sugerencia «Usar primero: vence 30/09/2027»), balanza usada, peso registrado, tara, hora, y botón «Agregar otro lote». Indicador «Suma dispensada 60,00 / 60,00 kg» que cambia de estado si falta o sobra.
Variantes en láminas separadas:
a) Intento de usar el lote de fenoxietanol en cuarentena: bloqueo «El lote MP-2026-0198 está en cuarentena y no puede dispensarse. Espere la liberación de Control de calidad.»
b) Intento de usar el perfume vencido: bloqueo «Lote vencido el 30/09/2026».
c) Balanza BAL-014 con calibración vencida: bloqueo con botón «Abrir desviación» (prellena lote y equipo) y alternativa «Usar otra balanza».
d) Verificación independiente: la vista de Paola con cada línea y su botón «Verificar» (modal de firma, significado «Verifiqué»); una lámina en la que Diego intenta verificar su propia dispensación y el sistema lo impide.
e) Línea corregida: valor anterior tachado, nuevo valor, motivo y autor.
Panel lateral de bitácora desplegable.

ACEPTACIÓN
- Se ve que una materia prima admite VARIOS lotes.
- Los tres bloqueos explican regla y acción.
- Ningún lote en cuarentena, rechazado o vencido es seleccionable.
- La suma de lotes se compara con lo requerido en vivo.
```

---

## PROMPT 7: Fabricación, envase y acondicionamiento (S-19, S-20, S-21 · RF-34 a RF-37)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) y tablet (1024 px) los tres registros de producción del lote L-2610-018 (Diego Cárdenas ejecuta; Paola Mejía verifica). En el encabezado de cada registro muestra el SELLO DE DOCUMENTO CONTROLADO del formato (por ejemplo «PRD-PR-003-FR-01 · v03 · Vigente») y, si el usuario no ha confirmado la lectura de esa versión, la lámina de bloqueo «Debe confirmar la lectura de PRD-PR-003-FR-01 v03 antes de ejecutar este paso» con botón «Ir a confirmar».

S-19 Registro de fabricación: asistente por pasos (stepper vertical a la izquierda: 11 pasos, completados con sello de firma, el paso 6 actual, los demás pendientes) y a la derecha el detalle del paso actual: texto del instructivo, parámetros a registrar con rango y unidad (temperatura 70–75 °C, velocidad 3.000 rpm, tiempo 15 min), equipo usado (TQ-101, HM-02) con su vigencia en semáforo, hora de inicio/fin, observaciones, botón «Completar paso» (firma «Ejecuté»). Láminas adicionales: (a) valor fuera de rango — «78 °C está fuera del rango 70–75 °C. Debe abrir una desviación para continuar» con botón «Abrir desviación»; (b) equipo vencido (BAL-014) bloqueando el paso; (c) paso que requiere verificación de segunda persona; (d) transferencia de granel con rótulo y conciliación («Granel obtenido 2.004,0 kg · 100,2 % del teórico, dentro de límites»).
S-20 Registro de envase: selector de presentación (200 mL / 400 mL) como pestañas; para 200 mL: línea de la llenadora LL-03, control de peso cada 30 minutos con la tabla y la gráfica de tendencia con límites 197,0–203,0 g y los valores del 0B (el de 09:30 FUERA de rango, marcado con ícono y texto), contador regresivo «Próximo control 10:30», unidades envasadas, rechazadas, conciliación de rendimiento (98,2 % contra límite). Lámina con el control fuera de rango que exige desviación.
S-21 Registro de acondicionamiento con inspección de producto terminado de 9 puntos: lista de los 9 puntos con Conforme/No conforme y observación; no se puede completar hasta marcar los 9; unidades aprobadas, rechazadas y de retención con la cuenta que cuadra (4.910 − 25 − 10 = 4.875) y rendimiento PT 97,5 % contra límite ≥ 97,0 %; rótulo de producto terminado con QR de lote. Estado de etapa completada con sellos de firma.

ACEPTACIÓN
- El paso actual, los completados y los bloqueados se distinguen de inmediato.
- Fuera de rango siempre con ícono y texto y exige desviación.
- Los controles de peso se ven en tabla y en gráfica con límites.
- Las cuentas de rendimiento cuadran con el 0B.
```

---

## PROMPT 8: Laboratorio y calidad (S-22, S-23, S-24 · RF-40 a RF-42)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px).

S-22 Captura de resultados (Natalia Ruiz): selector de muestra (producto terminado del lote L-2609-041); tabla de parámetros de la especificación con método, límite, campo de resultado y CONFORMIDAD calculada automáticamente (ícono + texto) con los valores del 0B (pH 5,6 · densidad 1,004 · aerobios <10 UFC/g · Pseudomonas ausente). Lámina con un resultado fuera de especificación (pH 6,4): aparece «No conforme — fuera de especificación» y el botón «Abrir investigación (OOS)» que lleva a una desviación. Firma de «Ejecuté» del análisis.
S-23 Certificado analítico CA-2026-0041: vista del documento con encabezado, producto, lote, especificación, resultados, conclusión «Conforme», quién analizó, quién revisó y quién aprobó (sellos de firma en filas separadas), y botones «Aprobar certificado» (Ricardo Peña; modal de firma) y «Descargar PDF». Bloqueo cuando quien analizó intenta aprobar su propio certificado.
S-24 Supervisión de calidad (Lucía Barrera): tarjetas de conteo (lotes de insumo en cuarentena, resultados pendientes, certificados por aprobar, desviaciones abiertas, CAPA por vencer), tabla de pendientes por antigüedad, y una gráfica simple de «Lotes de insumo rechazados por mes» (últimos 6 meses). Las cifras deben coincidir con las listas.

ACEPTACIÓN
- La conformidad nunca depende solo del color.
- Fuera de especificación conduce a una acción clara.
- Los sellos distinguen analizó / revisó / aprobó.
```

---

## PROMPT 9: Equipos — hoja de vida (S-25 · RF-50)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) la pantalla S-25 Equipos.

1. Lista de equipos (tabla): código (monoespaciado), nombre, área, crítico (sí/no), calibración, mantenimiento, calificación, limpieza, cada celda con semáforo de VIGENCIA (ícono + texto + fecha). Filtro «Con alertas». Datos del 0B: TQ-101 (limpieza por vencer), HM-02, BAL-014 (calibración vencida desde 02/10/2026), LL-03, ET-02 (mantenimiento por vencer).
2. Hoja de vida del equipo BAL-014: encabezado con estado general «No apto para uso» (rojo, con ícono y texto); línea de tiempo de eventos (calibraciones, mantenimientos, calificaciones, limpiezas) con evidencia adjunta; próximos vencimientos; «Lotes en que se usó en los últimos 30 días»; botón «Registrar calibración» (con firma y adjunto del certificado) y «Abrir desviación».
3. Lámina de TQ-101 con todo vigente y limpieza por vencer (ámbar).
4. Aviso: «Un equipo con calibración vencida no puede usarse en registros de producción.»

ACEPTACIÓN
- Se ve de un vistazo qué equipos no se pueden usar y por qué.
- La hoja de vida enlaza a las desviaciones y a los lotes.
```

---

## PROMPT 10: Desviaciones y CAPA (S-26, S-27, S-28 · RF-60 a RF-62)

```
Con el mismo sistema de diseño (usa la FAMILIA VIOLETA para severidad, nunca el semáforo) y los datos del 0B, diseña en escritorio (1440 px). De S-27 agrega también tablet (1024 px).

S-26 Listado de desviaciones y CAPA: tabla con código, título, lote/equipo, severidad (menor / mayor / crítica, ícono + texto, violeta), estado de trámite (abierta, en investigación, en CAPA, cerrada), responsable, antigüedad y vencimiento de CAPA; filtros y búsqueda; incluye DEV-2026-0012, 0017 y 0009.
S-27 Apertura de desviación (desde cualquier pantalla de registro; viene PRELLENADA con el contexto): lote, etapa, equipo, quién detecta, fecha y hora, descripción, severidad, acción inmediata de contención, adjuntos. Aviso de que una severidad «Crítica» bloquea el lote y su liberación, con la regla escrita.
S-28 Detalle e investigación de DEV-2026-0012: encabezado (lote, equipo, severidad, estado); línea de tiempo del flujo (Abierta → En investigación → En CAPA → Cerrada); sección de investigación (causa raíz con método «5 porqués» o espina de pescado, impacto en otros lotes); tabla de acciones CAPA (correctiva y preventiva con responsable, fecha límite, estado); bloque de VERIFICACIÓN DE EFECTIVIDAD con fecha y resultado; botón «Cerrar desviación» deshabilitado con motivo («Falta la verificación de efectividad de la CAPA»); panel de bitácora. Lámina de la misma desviación ya cerrada con sellos de firma.

ACEPTACIÓN
- Severidad y estado de calidad no se confunden visualmente.
- La desviación crítica explica qué bloquea.
- El cierre exige efectividad y lo dice con regla y acción.
```

---

## PROMPT 11: Trazabilidad (S-29, S-30 · RF-70 a RF-72)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px).

S-29 Trazabilidad por lote, con interruptor «Hacia atrás / Hacia adelante»:
- HACIA ATRÁS (de producto terminado a insumos), lote L-2609-041: árbol o diagrama de flujo que parte del producto terminado y llega a cada insumo con su lote, proveedor, certificado y lote de producto donde se usó; muestra la glicerina con SUS DOS lotes (MP-2026-0187 y MP-2026-0204), los equipos usados, las desviaciones asociadas (DEV-2026-0017) y las personas que firmaron.
- HACIA ADELANTE (de insumo a producto): buscar glicerina MP-2026-0187 → lotes de producto en que se usó, con unidades producidas y destino. Incluye un buscador con autocompletado y un estado vacío «Sin resultados para ese código».
S-30 Trazabilidad por equipo y simulacro de retiro: buscar BAL-014 → lista de lotes en que se usó, con fechas y la marca «Usada con calibración vencida» en los afectados (L-2610-018); botón «Simular retiro de lote»: se elige un lote de insumo o de producto y se genera un informe con lotes afectados, cantidades y estado (en bodega / en proceso / liberado), con botón «Exportar informe». 

ACEPTACIÓN
- El resultado se entiende sin explicación en menos de 10 segundos.
- La trazabilidad se puede recorrer en ambos sentidos.
- Los afectados por un equipo vencido destacan con ícono y texto.
```

---

## PROMPT 12: Liberación final y verificación pública (S-31, S-32, S-33 · RF-80 a RF-82)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px). S-33 también en tablet (1024 px) y en una versión angosta de 390 px, ya que la abre cualquier persona al escanear un QR.

S-31 Liberación final del lote L-2609-041 (Dr. Esteban Gaviria libera; Lucía Barrera y Ricardo Peña firman revisiones previas):
- Encabezado de lote con perfil regulatorio.
- CONSOLIDADO en pestañas: Documentos maestros usados (versiones congeladas), Dispensación, Fabricación, Envase, Acondicionamiento, Resultados y certificado (CA-2026-0041), Desviaciones (DEV-2026-0017 en investigación), Equipos usados.
- CONCILIACIÓN DE RENDIMIENTO con las cifras exactas del 0B por presentación (granel 100,2 %; envase 98,2 % y 98,6 %; PT 97,5 % y 98,0 % contra límite ≥ 97,0 %) con barras y límite.
- CHECKLIST DE LIBERACIÓN: etapas completas ✓, rendimiento dentro de límites ✓, certificado aprobado ✓, revisión de calidad firmada por Ricardo Peña ✓, revisión del expediente por Lucía Barrera ✓, sin desviaciones críticas abiertas ✓ y «Desviación mayor DEV-2026-0017 sin cerrar» como PENDIENTE BLOQUEANTE.
- Botones «Liberar lote» y «Rechazar lote». Dos láminas: (A) liberación BLOQUEADA, botón deshabilitado con la lista de causas y acción para cada una; (B) liberación habilitada con todo cumplido, que abre el modal de firma con significado «Liberé».
S-32 Confirmación y vista previa del PDF con QR: mensaje de éxito, vista previa del expediente PDF (portada con producto, lote, fechas, resultado de liberación, QR, código K7Q2-M9XP-4TD8, huella SHA-256 abreviada, relación de los documentos controlados usados con su código y versión (PRD-PR-003-FR-01 v03, PRD-PR-001-FR-01 v04, etc.) y sellos de firma, con la marca «Copia controlada»), botones «Descargar PDF», «Copiar enlace de verificación» e «Imprimir».
S-33 Página pública de verificación (SIN inicio de sesión; sin menú de la plataforma): logo de GRUFARCOL, ícono grande de «Lote auténtico y liberado», producto (Loción micelar ClariPlus 200 mL), código de lote, fecha de liberación, estado «Liberado», huella abreviada; sección «Verificar mi copia» para subir el PDF y comparar la huella (resultados: «El documento coincide» / «El documento NO coincide»); y un estado de código inválido («No encontramos este código»). IMPORTANTE: esta página NO muestra fórmula, costos, proveedores ni datos de personas.

ACEPTACIÓN
- El botón de liberar está deshabilitado con motivos claros mientras falte algo.
- Las cifras de rendimiento son exactamente las del 0B.
- La página pública no contiene ningún dato comercial ni técnico sensible.
- El estado «auténtico» no depende solo del color.
```

---

## PROMPT 12B: Paquete técnico del lote (S-40 · RF-83)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px) la pantalla S-40 Paquete técnico del lote L-2609-041 (verifica Paola Mejía; revisa Lucía Barrera; aprueba el Dr. Esteban Gaviria).

Estructura, siguiendo el formato clásico de expediente:
1. ENCABEZADO: producto, titular, notificación sanitaria, presentación, cantidad, lote, fecha de expiración, números de orden de fabricación, envase y acondicionamiento, fecha de inicio y de fin (datos del 0B).
2. LISTA DE VERIFICACIÓN por secciones (General, Manufactura, Envase, Acondicionamiento, Cierre): cada documento en una fila con nombre, código y versión usada, estado (completo y firmado / pendiente), enlace al registro y selector «Sí / No aplica»; «No aplica» exige motivo (ejemplo: plegadiza, «Producto sin plegadiza»). Indicador de avance de documentos aplicables completos.
3. OBSERVACIONES.
4. TRES FIRMAS EN ORDEN con sellos: «Verificado por coordinación de producción», «Revisado por garantía de calidad», «Aprobado por dirección técnica», cada una con fecha; cada botón se habilita solo si la firma anterior existe.
Láminas: (A) Paola y Lucía firmaron, la aprobación del Dr. Gaviria deshabilitada con el motivo «Desviación mayor DEV-2026-0017 sin cerrar»; (B) las tres firmas completas; (C) un documento «Sí» faltante que bloquea todas las firmas («Falta el registro de limpieza de acondicionamiento. Complete el documento o márquelo No aplica con motivo.»); (D) intento de revisión antes de la verificación.

ACEPTACIÓN
- Se ve qué documentos faltan sin abrir cada uno.
- Las firmas tienen orden y el sistema lo explica.
- «No aplica» siempre muestra su motivo.
```

---

## PROMPT 13: Auditoría y auditor invitado (S-34, S-35 · RF-90, RF-91)

```
Con el mismo sistema de diseño y datos, diseña en escritorio (1440 px).

S-34 Vista del auditor invitado (Inés Valencia): misma navegación pero TODO en solo lectura; banner permanente «Acceso de auditoría · solo lectura · vence 30/11/2026»; sin botones de acción (no hay Firmar, Crear, Editar); buscador de lote que lleva al expediente consolidado; indicador «Esta consulta queda registrada».
S-35 Visor de bitácora (audit trail) (Lucía Barrera, Inés Valencia, Tomás Herrera): tabla con fecha y hora, usuario, acción, registro afectado (código monoespaciado), valor anterior → valor nuevo y motivo; filtros por usuario, tipo de registro, rango de fechas y lote; vista detalle de un evento (con el valor anterior tachado); botón «Exportar» (CSV/PDF). Datos de ejemplo coherentes con el 0B (la verificación de Paola Mejía, la corrección de un peso con motivo, la asignación de rol por Tomás Herrera, la apertura de DEV-2026-0012). Aviso fijo: «La bitácora no se puede modificar ni eliminar.»

ACEPTACIÓN
- Un auditor no ve ninguna acción de escritura.
- Cada evento muestra quién, qué, cuándo, antes, después y por qué.
```

---

## PROMPT 14: Revisión final de coherencia

```
Revisa todas las pantallas diseñadas con el sistema de diseño de GRUFARCOL eBR y los datos del Prompt 0B, y corrige lo que no cumpla. No agregues pantallas nuevas.

1. COLOR: el semáforo verde/ámbar/rojo/gris se usa SOLO para estado de calidad y vigencia; el trámite usa neutro/azul; la severidad de desviación usa violeta. Ningún estado depende solo del color.
2. COMPONENTES GxP: el modal de firma, el sello de firma, la corrección con valor tachado, el aviso de segregación y el aviso de bloqueo son idénticos en todas las pantallas donde aparecen.
3. DATOS: los códigos, nombres, cifras y fechas coinciden con el 0B (lotes, equipos, personas, rendimientos 98,2 / 98,6 / 97,5 / 98,0 %, suma de glicerina 40,00 + 20,00 = 60,00 kg, 4.910 − 25 − 10 = 4.875, 2.465 − 10 − 5 = 2.450). Los conteos de los dashboards coinciden con las listas.
4. NAVEGACIÓN: cada rol ve solo su menú; todas las pantallas tienen migas de pan; no hay callejones sin salida; desde cualquier registro se puede abrir una desviación con contexto.
5. REGLAS VISIBLES: botones deshabilitados con motivo; bloqueos con regla + acción; registros firmados con candado; fórmulas con suma 100 %; lotes en cuarentena, rechazados y vencidos no seleccionables.
6. FORMATOS: pesos colombianos, dd/mm/aaaa, hora de 24 h, coma decimal, español de Colombia, trato de «usted», códigos en fuente monoespaciada.
7. ESTADOS: cada pantalla tiene vacío, cargando, error y sin permiso (donde aplica) y los bloqueos por regla GMP.
8. EXPEDIENTE: las pantallas S-31 (liberación) y S-40 (paquete técnico) muestran los mismos estados de firma y la misma desviación pendiente; los costos aparecen solo en S-37 y nunca en las pantallas públicas ni en el PDF del expediente.
9. RESPONSIVO: escritorio 1440 px y tablet 1024 px con elementos táctiles ≥ 44 px; la página pública también a 390 px.
10. PÁGINA PÚBLICA: no expone fórmula, costos, proveedores ni datos de personas.

11. SGD: todo registro, plantilla, fórmula, especificación, instructivo y protocolo muestra el mismo sello de documento controlado y el mismo encabezado (código, versión, fecha de emisión, fecha de revisión, página x de y); los códigos siguen la estructura proceso-tipo-consecutivo (y subdocumento) de los ejemplos; ningún documento obsoleto aparece como vigente; el autor nunca revisa ni aprueba su versión; los PDF llevan «Copia controlada», «Copia no controlada» u «OBSOLETO»; las firmas cortas y las correcciones (valor tachado, asterisco, motivo, fecha) se ven igual en todas las pantallas.
12. BODEGAS: toda existencia muestra su ubicación con el mismo código (por ejemplo «MP-E03-P2-01»); las cuentas de estantes × pisos × posiciones cuadran con el 0B; las bodegas externas se distinguen y su calificación vigente o vencida se ve con ícono y texto.
13. MASTER Y AQ: solo Aseguramiento de la calidad crea documentos; el master solo crea versiones nuevas en borrador y su banner de edición maestra es el mismo en todas las pantallas.

Entrega una lista de las inconsistencias encontradas y corregidas, agrupadas por los puntos anteriores.
```

---

## Después del diseño

1. Compare cada pantalla con la tabla de la sección 12 del PRD (S-01 … S-48); cualquier pantalla extra o faltante se anota en el PRD sección 17.
2. Exporte o guarde el sistema de diseño (Prompt 0) y utilícelo como referencia para el agente de desarrollo: los tokens de color, tipografía y los componentes GxP son la base de `/src/components/gxp`.
3. Muestre las láminas a al menos una persona real de cada rol crítico (auxiliar de producción, jefe de control de calidad, director técnico) antes de construir.
4. Siguiente paso sugerido: preparar el prompt de arranque para el agente de desarrollo (Antigravity) a partir de las fases F0–F11 del PRD.
