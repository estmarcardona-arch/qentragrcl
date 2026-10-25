# Registro de cambios

Formato: una entrada por etapa y por tarea terminada (AGENTS.md, DoD). Fechas en DD/MM/AAAA.

## [E5] Bodega y calidad de insumos (PRD F4) — 24/10/2026

### Agregado

- Migración 0023: terceros (proveedores, maquiladores y almacenamiento externo) con calificación y vencimiento registrados por Aseguramiento de la calidad (D-17); bodegas por función, internas o externas, con tipos de material permitidos, bajo llave y prefijo de ubicaciones (RF-23); una externa nace pendiente y la aprueba `aq_dir` con firma (D-20); estantes con zona (cuarentena, aprobados o general; D-16) y ubicaciones generadas estante × piso × posición (`create_warehouse`, `generate_locations`, AC-27); bloqueo de ubicaciones con motivo.
- Migración 0024: lotes de insumo con código `MP-`/`ME-`/`EM-AAAA-NNNN` (D-51), recepción en cuarentena con vencimiento y CoA obligatorios y ubicación compatible sugerida (`receive_material_lot`, `suggest_locations`, RF-20); importación CSV de recepciones, todo o nada (`import_material_receipts`, D-03); kardex inmutable con existencias por ubicación que nunca quedan negativas (`inventory_movements`, `stock_by_location`, `v_lot_stock`, RF-21); traslado interno y ajuste con motivo; reglas de ubicación (`LOCATION_TYPE_MISMATCH`, AC-21; `LOCATION_RULE_VIOLATION`, AC-22); pruebas de liberación desde la especificación vigente o revisión del CoA (D-52), resultados del laboratorio y liberación o rechazo con firma y SOD-5 (`record_lot_results`, `release_material_lot`, `RESULTS_PENDING`, RF-22); rótulos (`log_label_print`); `assert_lot_available` para la dispensación (AC-03: `LOT_NOT_APPROVED`, `LOT_EXPIRED`, `INSUFFICIENT_STOCK`). Vencido y agotado se derivan (D-53).
- Migración 0025: traslados `TR-AAAA-NNNN` entre bodegas y a bodegas externas: borrador → despachado (en tránsito) → recibido | anulado; despacho con firma de quien prepara («Ejecuté») y aprobación del jefe de bodega, otra persona («Aprobé»); recepción con acta y ubicación («Verifiqué»); solo salen lotes aprobados y vigentes; tercero calificado y vigente (`EXTERNAL_SITE_NOT_QUALIFIED`, AC-24).
- Pantallas S-11 (recepción e importación CSV), S-12 (inventario FEFO con alertas a 30/60/90 días, localizador y kardex por lote), S-13 (liberación de insumos), S-14 (rótulo con QR e impresión del navegador, D-10), S-41 (bodegas, mapa de ubicaciones, nueva bodega, terceros y calificación) y S-42 (traslados con remisión PDF). Menú: «Bodega» y «Calidad»; el administrador y Aseguramiento de la calidad ven Bodega.
- Semilla del Prompt 0B: terceros, 9 bodegas (8 con estructura, 276 ubicaciones; D-50), lotes de insumo con su kardex y liberación (glicerina 40,00 y 120,00 kg, fenoxietanol en cuarentena, perfume vencido, ácido cítrico rechazado) y TR-2026-0007 en tránsito. En la nube se cargaron solo terceros y bodegas, sin lotes.
- Dependencia `qrcode` 1.5.4.
- Pruebas: pgTAP 0023 (19), 0024 (37) y 0025 (21); E2E `e2e/bodega.spec.ts` (ciclo recepción → liberación → traslado externo con cuatro personas y semilla). Matriz: 67 requisitos con prueba hasta F4.

### Corregido

- Las pestañas de I+D y Bodega se anunciaban como «Secciones de Documentos».

## [E4] Decisiones del responsable y pendientes — 24/10/2026

### Cambiado

- PRD 1.8: la fórmula maestra es el tipo documental `FM` (D-49 resuelta); D-13 resuelta; fila nueva «Costos de fórmula» en la matriz 2.2 (RF-17).
- Migración 0021 (D-13): cerrar un estudio como «cumple» ya no exige criterios por producto; sin criterios, quien firma justifica el resultado en las conclusiones. Con criterios completos se siguen evaluando y la temperatura fuera de rango siempre lo impide. Diálogo de cierre y panel de criterios actualizados.
- Migración 0022 (RF-17): solo I+D (elabora), Dirección técnica y Gerencia ven los costos; Comercial, Producción, Calidad, master y el auditor ya no. `can_read_costs` y `save_cost_sheet` usan el módulo nuevo.
- CI: `actions/upload-artifact` v7 (Node 24); el diagnóstico de autenticación ya no imprime la respuesta con el token.

### Corregido

- E2E de roles configurables: la bandeja «Cambios de roles» se recarga hasta ver la solicitud (fallaba de forma intermitente con la CI cargada).
- E2E de bloqueo tras 5 intentos: usa un usuario desechable creado en la base de la CI; antes bloqueaba 15 minutos a Camila y Marcela, que también usan las pruebas de I+D.
- E2E del brief: espera a que el formulario esté hidratado antes de llenarlo (la fecha se perdía de forma intermitente).
- Nube: catálogos ficticios cargados (`supabase/seed_catalogos.sql`); migraciones 0021 y 0022 aplicadas.

## [E4] Documentos maestros (PRD F3) — 24/10/2026

### Agregado

- Migración 0017: materias primas, materiales de envase y empaque, productos con registro sanitario y presentaciones (catálogos con bitácora) y criterios de cumplimiento de la estabilidad por producto, vacíos hasta que Calidad los defina (D-13).
- Migración 0018: brief con competencia y precio por mL (`save_brief`, `submit_brief`, `decide_brief`); prototipos `P-NNNN` y mejoras `P-NNNN-n` (`save_prototype`, `create_prototype_improvement`, `discard_prototype`), mínimo 2 por brief (AC-13); estabilidad preliminar con cinco pruebas y cronograma de 30 días (`start_stability_study`, AC-18), lecturas con rango, ventana y muestra mínima de viscosidad (`record_stability_reading`, AC-17), cierre firmado con cierre anticipado «No cumple» (`close_stability_study`, AC-16), criterios (`set_stability_criteria`) y aprobación como fórmula por Gerencia y Dirección técnica (`approve_prototype`).
- Migración 0019: tipo documental `FM` (D-49); fórmula (suma 100 % ± 0,001), especificaciones por alcance, instructivos por etapa y presentación y hoja de costos (`save_formula_draft`, `save_specification_draft`, `save_instruction_draft`, `save_cost_sheet`, `v_cost_sheet_totals`, `formula_quantities`) sobre el SGD; la aprobación de la fórmula exige un prototipo con estabilidad conforme (AC-13) y bloquea el contenido; `assert_approved_formula` (`NO_APPROVED_VERSION`, AC-07 parcial, se usa en E6). Costos legibles solo con permiso.
- Migración 0020: `record_stability_readings` (las repeticiones de un tiempo se registran todas o ninguna) y `my_pending_versions` (la bandeja S-10 muestra solo lo que le toca firmar a cada persona según la ruta y excluye las versiones aprobadas sin publicar).
- Pantallas S-05, S-06 (brief), S-36 (prototipos, estabilidad, criterios y aprobación como fórmula), S-07, S-08, S-09 (fórmula, especificaciones, instructivos), S-37 (costos) y S-10 (aprobaciones con comparación de versiones). Menú: «Aprobaciones» e «I+D».
- Semilla del Prompt 0B: PRD-001 y PRD-014, materias primas, BR-2026-0011, P-0007, P-0008, P-0007-1 con sus estudios, IDI-FM-001 v3, IDI-EP-007 v02, IDI-IN-012 v03 y costos.
- Pruebas: pgTAP 0017 (7), 0018 (46), 0019 (28) y 0020 (17); E2E `e2e/idi.spec.ts` (flujo brief → prototipos → estabilidad y vistas de la semilla). Matriz: 57 requisitos con prueba hasta F3.

### Corregido

- Los códigos de error de prototipos y estabilidad (`MIN_PROTOTYPES`, `STABILITY_*`, `SAMPLE_TOO_SMALL`, `READING_DUPLICATE`, `REPORT_MISSING`) se mostraban como «error inesperado».
- El formulario de lecturas volvía a enviar el tiempo recién registrado; ahora pasa al siguiente pendiente.
- La comparación de versiones en S-10 rotulaba la versión anterior como «número − 1»; ahora usa la versión reemplazada.

## [Seguridad] Dependencias — 24/10/2026

- `next` y `eslint-config-next` 16.4.0 → 16.4.3: corrige una ejecución remota de código sin autenticación en la optimización de imágenes (`/_next/image`) y una denegación de servicio con acciones de servidor (aviso crítico; `next build` se detenía).
- `zod` 4.6.5 → 4.6.7 (agotamiento de memoria con colecciones grandes) y `shadcn` 4.21.4 → 4.22.1 (dependencias vulnerables del CLI).
- Lockfile: `undici`, `body-parser`, `fast-uri` e `ip-address` actualizadas dentro de sus rangos (`npm audit fix`, sin `--force`). `npm audit`: 0 vulnerabilidades.

## [Documentación] PRD 1.7 — 09/10/2026

- Sección Producción del PRD reorganizada por etapa (Manufactura → Envase → Acondicionamiento → Cierre) con la secuencia de 23 documentos del paquete técnico; RF-30…39 agrupados en bloques A–F (mismos números); RF-38 precisa 3 órdenes de etapa, 3 solicitudes, orden de codificado, rótulos y 3 registros; AC-14 ajustado. Preguntas nuevas D-45…D-48.

## [E3] Sistema de gestión documental y plantillas (PRD F2B) — 09/10/2026

### Agregado

- Migración 0014: tipos y niveles de documento (12 tipos, incluido PC), rutas de aprobación (técnica y administrativa), documentos controlados y versiones, solicitudes, estandarización, distribución y control de copias, control de cambios, anulaciones, capacitación (cuestionario con respuestas fuera del alcance del navegador, asignaciones, intentos y constancias), descargas, etapas y plantillas de proceso, listado maestro `v_master_list` e indicador de vencidos por proceso. Columnas de ciclo de vida en firmas: la publicación fija fechas sin romper la huella firmada.
- Migración 0015: RPC con SOD y bitácora: `request_document`, `save_document_draft`, `submit_for_standardization`, `run_style_check` y `style_observations` (revisor de redacción), `request_document_code` (solo aq_doc, código sin saltos), `submit_for_review`, `review_document`, `approve_document` (el autor no revisa ni aprueba; el revisor sí aprueba), `publish_document`, `issue_copy`, `recall_copy`, `log_document_download`, `register_change_request`, `set_parent_review`, `decide_annulment`, `close_annulment`, `assign_training`, `register_training_attempt`, `acknowledge_read`, `assert_training`, `assert_document_effective` y `save_template_draft`.
- Migración 0016: la regla de capacitación queda en «avisar» por defecto (D-19) y la configuración del SGD se valida.
- Pantallas S-43 a S-49: listado maestro con filtros, anidación, semáforo de vigencia, indicador y exportación a Excel; solicitud con plantilla editable; estandarización con lista de chequeo y revisor de redacción; creación del código; detalle del documento con encabezado controlado, versiones, flujo, cuadro de firmas, copias, bitácora y lotes; capacitación y constancia; control de cambios y anulaciones; plantillas de proceso con edición maestra y comparación. PDF del documento controlado y de la constancia (`@react-pdf/renderer` 4.9.0). Indicador en los paneles de Aseguramiento de la calidad y Gerencia.
- Semilla del Prompt 0B: listado maestro, solicitudes SD-2026-0011, SC-2026-0005 y AN-2026-0002, capacitación y plantillas.
- Pruebas: pgTAP 0014 (32) y 0015 (73); E2E del ciclo completo y de la semilla.

## [E2] Administración — 07/10/2026

### Agregado

- Migración 0008: áreas con sigla de proceso, árbol sin ciclos y área dueña del SGD (GCA); catálogos versionados con bitácora (unidades, tipos de material y de equipo, clasificación de desviaciones, motivos de corrección), líneas de producto, perfiles regulatorios (PRD §10) con foto por lote, reglas de retención (RNF-05) y marcas detrás del interruptor de maquila (D-01); `admin_save_catalog` con lista blanca y motivo.
- Migración 0009: gestión de usuarios (listado, datos, activación sin borrado, roles con vigencia, ampliación y revocación, firma corta), auditor con vencimiento obligatorio y AC-11, combinaciones de roles prohibidas (D-18, SOD-7, SOD-9), configuración del sistema validada y política de contraseñas (mínimo 12, historial, caducidad).
- Migración 0010: matriz de permisos del PRD 2.2 generada desde el Markdown y `has_module_permission`.
- Pantallas S-03 (usuarios y roles, alta por invitación con enlace de un solo uso, detalle con bitácora) y S-04 (áreas, líneas, perfiles lado a lado, catálogos, retención, marcas, matriz de solo lectura, configuración); crear y cambiar contraseña; restablecimiento por enlace.
- Pruebas: pgTAP de RLS por catálogo, usuarios, AC-11 y matriz; E2E de administración, alta y baja, AC-11 y comparación de la matriz de S-04 con el PRD.

### Agregado (solicitud del responsable, 08/10/2026)

- PRD 1.5: sección 2.6 «Roles configurables», RF-07, AC-36…38, D-39 y D-40.
- Migración 0012: los roles pasan de un tipo enumerado a la tabla `roles` (15 roles del sistema protegidos y roles adicionales); funciones reservadas (`reserved_permissions`); matriz editable solo para roles adicionales; `admin_create_role`, `admin_update_role`, `admin_set_role_permissions`, `admin_set_role_incompatibilities`, `admin_set_role_active` (retirar o reactivar); vencimiento obligatorio por rol; la lectura de la bitácora se deriva del permiso de «Trazabilidad / Auditoría».
- S-04: pestaña «Roles y permisos» con el panel de permisos y restricciones, creación de roles y configuración por rol (permisos por módulo, incompatibilidades, opciones, retiro); la matriz muestra también los roles adicionales; el menú de un rol adicional se arma con sus permisos.

### Agregado (decisiones D-39 y D-40, 08/10/2026)

- PRD 1.6: aprobación de cambios de rol (sección 2.6), bandeja S-04B, AC-39…41, D-41.
- Migración 0013: solicitudes de cambio de rol (`role_change_requests`, `role_change_approvals`, numeración `CR-AAAA-NNNN`); `admin_request_role_change` (valida el cambio completo sin aplicarlo), `decide_role_change` (aprobar o rechazar con contraseña; quien solicita no aprueba; dos personas distintas), `admin_cancel_role_change`, `get_role_change_requests`. Rol adicional: aprueba `aq_dir`; permisos de un rol del sistema: `aq_dir` y `dt`; funciones reservadas con candado (su dueño no las pierde). Línea base del PRD guardada por celda (`prd_cell_text`). Las RPC de cambio directo de 0012 se eliminan.
- Bandeja «Cambios de roles» (`/cambios-roles`) para administración, Calidad, Dirección técnica y auditor, con antes y después; solicitudes pendientes en «Roles y permisos» y en cada rol; S-04 marca con «*» las celdas ajustadas.

### Corregido

- Migración 0011: `sign_record` valida registro, rol, orden y SOD antes de la contraseña; un rechazo por regla ya no consume intentos ni revierte el reinicio del contador. `practice_reauth` para la prueba en vivo.
- Lectura de sesión y cliente de servidor marcados como de tiempo de solicitud (`connection()`), sin errores de prerender con Cache Components.

## [E1] Núcleo GxP — 07/10/2026

### Agregado

- Migraciones 0003–0007: bitácora de solo-agregar con triggers genéricos (DI-1), registro de tablas con metadatos, bloqueo tras firma (DI-3) y sin borrado (DI-10); roles del PRD 2.1, perfiles, roles con vigencia, firma corta (DI-11) y configuración; firmas con `sign_record` (reautenticación configurable, huella SHA-256, orden de firmas, estado y bloqueo en una transacción), `check_sod` con SOD-1…SOD-10, `can_sign` y `verify_signature_integrity`; correcciones sin borrado con contador y aviso (DI-12); numeración sin saltos; bloqueo de cuenta por hook de Supabase Auth; eventos de sesión y `get_audit_trail`; reloj de referencia congelable en pruebas.
- pgTAP: línea base de seguridad (ninguna tabla sin RLS ni sin bitácora), AC-01, AC-02, AC-08, cada regla SOD con caso prohibido y permitido, RLS por rol, correcciones (AC-35) y sesión. Ayudas pgTAP y modo `test:db:pending` (prueba migraciones nuevas en una transacción revertida).
- Interfaz: S-01 inicio de sesión (mensaje único que no revela si el usuario existe), S-02 panel por rol con tarjetas «Sin datos», menú por rol, proxy de rutas protegidas, guardas por rol en servidor, cierre por inactividad con aviso, cierre de sesión.
- Componentes GxP: `SignatureModal`, `AuditTrailPanel`, `CorrectionDialog`, `LockedBanner`, `SignatureStamp`, `CorrectedValue`; utilidad de huella idéntica a `record_hash()`.
- Semilla local con los 15 usuarios ficticios del Prompt 0B; E2E de inicio de sesión, inactividad, bloqueo y firma con contraseña errónea.

## [E0] Cimientos — 07/10/2026

### Cambiado

- El servidor de desarrollo usa el puerto 3020 (`npm run dev` → http://localhost:3020); `supabase/config.toml` (auth local) actualizado al mismo puerto.

### Agregado (alcance ampliado de E0)

- Componentes base: `StatusBadge` (tres familias de color, catálogo con ícono + texto), `PageHeader`, `DataTable` (TanStack Table 9: búsqueda, orden, paginación, estados), `EmptyState`, `ErrorState`, `NoPermissionState`, `LoadingSkeleton`, `FormField`, `SodNotice`, `ControlledDocumentHeader` y `CopyStamp`, `DisabledReason`; variantes de botón del Prompt 0.
- Página `/_design` (solo desarrollo o con `ENABLE_DESIGN_PAGE=true`).
- Migración `0002_utilities.sql`: `set_updated_at()` y `health_check()`, con prueba pgTAP.
- Tipos generados (`src/lib/db/database.types.ts`) y envoltorio tipado de RPC (`src/lib/rpc`).
- Observabilidad: errores centralizados (`src/lib/errors.ts`), registro estructurado en servidor (`src/lib/log.ts`), páginas 404/500 en español, `GET /api/health`.
- CI: Supabase local en el runner, migraciones, pgTAP, build y E2E (sin credenciales).
- Scripts de Supabase local (`db:start`, `db:reset`, `test:db:local`, `db:stop`), commitlint, licencia propietaria, `docs/ENTORNOS.md`, `docs/CONVENCIONES_BD.md`.

### Agregado

- Repositorio git con `main` y rama `etapa/E0`; documentos fuente renombrados según PRD §5 (`docs/PRD_GRUFARCOL.md`, `docs/DOCUMENTO_MAESTRO_GRUFARCOL.md`) y exportaciones de diseño movidas a `docs/diseno/`.
- `AGENTS.md` (PRD §15 + reglas del proyecto) y `CLAUDE.md` que lo importa.
- Next.js 16.4 (App Router, TypeScript estricto, Turbopack), Tailwind CSS 4, shadcn/ui (Radix) y lucide-react.
- Tokens del sistema de diseño (Prompt 0) en `src/app/globals.css`: azul acero #1E4E8C, superficies, semáforo de calidad y vigencia, trámite, severidad violeta, escala tipográfica; Inter y JetBrains Mono; foco visible; solo tema claro.
- `src/lib/format.ts`: formatos es-CO (COP, números, porcentajes, fecha DD/MM/AAAA, fecha de documento DD-MM-AAAA, hora de 24 h en America/Bogota) con pruebas (RNF-03).
- Clientes de Supabase para navegador y servidor con clave pública (`src/lib/db`); `.env.example` sin valores reales; prueba AG-05 que impide `service_role` en `src/`.
- Supabase CLI, `supabase/config.toml`, migración `0001_extensions.sql` (pgcrypto, pgtap) y prueba pgTAP `0001_extensions.test.sql`; ejecutor pgTAP sin Docker (`npm run test:db`).
- Pruebas: Vitest, Playwright (escritorio 1440 px y tablet 1024 px) con axe (RNF-01, parcial).
- Calidad: ESLint, Prettier, husky + lint-staged (pre-commit: lint, formato, tsc, Vitest).
- Matriz requisito→prueba (`docs/VALIDACION/`) con los RF/AC del PRD por etapa y verificación en CI.
- Verificación de versiones exactas (`docs/VERSIONES.md`, `npm run versions`).
- CI en GitHub Actions: calidad, E2E + accesibilidad, base de datos (migraciones + pgTAP).
- `docs/PREGUNTAS_ABIERTAS.md` con D-01…D-26 y nuevas D-27…D-30.
