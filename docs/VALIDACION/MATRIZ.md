# Matriz de trazabilidad requisito → prueba

Generada por `npm run traceability:write` desde `docs/VALIDACION/matriz-trazabilidad.json`. Etapa actual: **E5**.

| Requisito | Etapa | Descripción | Pruebas | Estado |
|---|---|---|---|---|
| RNF-01 | E0 | Accesibilidad AA (contraste, foco visible, estado nunca solo por color) — parcial en E0: página base y componentes base sin violaciones axe; catálogo de estados con ícono y texto | e2e: `e2e/design.spec.ts`<br>unitaria: `src/components/gxp/status.test.ts` | Cubierto |
| RNF-03 | E0 | Idioma es-CO; formatos COP, dd/mm/aaaa, 24 h | unitaria: `src/lib/format.test.ts` | Cubierto |
| AG-05 | E0 | AGENTS.md regla 5: la clave service_role nunca se usa en el código del navegador | unitaria: `src/lib/db/secrets.test.ts` | Cubierto |
| RF-01 | E1 | Inicio de sesión con correo/contraseña y cierre automático por inactividad (15 min configurable) | e2e: `e2e/auth.spec.ts`<br>pgtap: `supabase/tests/0007_auth_session.test.sql`<br>unitaria: `src/lib/auth/constants.test.ts` | Cubierto |
| RF-02 | E1 | Dashboard por rol con tareas pendientes propias | e2e: `e2e/auth.spec.ts`<br>unitaria: `src/lib/auth/navigation.test.ts`<br>unitaria: `src/lib/dashboard/cards.test.ts` | Cubierto |
| AC-01 | E1 | Mismo usuario ejecuta y verifica → SOD_VIOLATION | pgtap: `supabase/tests/0005_signatures_sod.test.sql` | Cubierto |
| AC-02 | E1 | Editar registro firmado → RECORD_LOCKED | pgtap: `supabase/tests/0005_signatures_sod.test.sql` | Cubierto |
| AC-08 | E1 | Modificar audit_log → permiso denegado | pgtap: `supabase/tests/0003_audit_log.test.sql` | Cubierto |
| RF-03 | E2 | Administración de usuarios, roles y vencimiento de accesos de auditor | pgtap: `supabase/tests/0009_admin_users.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| RF-04 | E2 | Catálogos y perfiles regulatorios (líneas, marcas, áreas, unidades); cambiar un perfil no altera lotes existentes | pgtap: `supabase/tests/0008_areas_catalogs.test.sql`<br>pgtap: `supabase/tests/0010_permission_matrix.test.sql`<br>unitaria: `src/lib/admin/prd-matrix.test.ts`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| RF-06 | E2 | Catálogo de áreas con Aseguramiento de la calidad como dueña del SGD; solo aq_doc crea documentos controlados | pgtap: `supabase/tests/0008_areas_catalogs.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| AC-11 | E2 | Auditor vencido inicia sesión → rechazado | pgtap: `supabase/tests/0009_admin_users.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| RF-07 | E2 | Roles configurables (PRD 2.6): solicitar crear, configurar y retirar roles adicionales con aprobación de Calidad (D-39); permisos de roles del sistema con doble aprobación (D-40) | pgtap: `supabase/tests/0012_configurable_roles.test.sql`<br>pgtap: `supabase/tests/0013_role_change_approvals.test.sql`<br>e2e: `e2e/admin.spec.ts`<br>unitaria: `src/lib/auth/navigation.test.ts` | Cubierto |
| AC-36 | E2 | Rol adicional con lectura de trazabilidad: el usuario obtiene solo ese permiso | pgtap: `supabase/tests/0012_configurable_roles.test.sql` | Cubierto |
| AC-37 | E2 | Dar una función reservada a un rol adicional → RESERVED_PERMISSION | pgtap: `supabase/tests/0012_configurable_roles.test.sql` | Cubierto |
| AC-38 | E2 | Retirar un rol en uso / un rol del sistema → ROLE_IN_USE / SYSTEM_ROLE_LOCKED | pgtap: `supabase/tests/0012_configurable_roles.test.sql` | Cubierto |
| AC-39 | E2 | Rol adicional: no existe mientras está pendiente; autoaprobación → SOD_VIOLATION; aq_dir aprueba y se crea | pgtap: `supabase/tests/0013_role_change_approvals.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| AC-40 | E2 | Rol del sistema: una aprobación no aplica; misma persona dos veces → SOD_VIOLATION; aq_dir + dt aplican y S-04 marca la celda | pgtap: `supabase/tests/0013_role_change_approvals.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| AC-41 | E2 | Quitar al dt la liberación final → RESERVED_PERMISSION (candado) | pgtap: `supabase/tests/0013_role_change_approvals.test.sql`<br>e2e: `e2e/admin.spec.ts` | Cubierto |
| RF-05 | E2B | Usuario master: plantillas de proceso como versiones nuevas en borrador, con motivo; no edita versiones aprobadas | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-92 | E2B | Listado maestro (v_master_list) exportable, un documento una vez con su versión vigente, incluye externos | pgtap: `supabase/tests/0014_document_management.test.sql`<br>e2e: `e2e/documentos.spec.ts`<br>unitaria: `src/lib/auth/navigation.test.ts` | Cubierto |
| RF-93 | E2B | Solicitud de crear, modificar o anular con plantilla editable; solo aq_doc genera el código PPP-TT-NNN / PPP-TT-NNN-LL-## | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-94 | E2B | Estandarización con lista de chequeo y revisor de redacción; devolución con observaciones | pgtap: `supabase/tests/0014_document_management.test.sql`<br>pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-95 | E2B | Revisión y aprobación por ruta; cuadro Actualizado/Revisado/Aprobado; la anterior pasa a obsoleta | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-96 | E2B | Distribución, copias controladas y recolección (RECALL_PENDING) | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-97 | E2B | Capacitación con cuestionario (80 %), constancia y confirmación de lectura; TRAINING_REQUIRED configurable | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-98 | E2B | Vigencia por tipo (3 años, anual, registro sanitario, validación), semáforo e indicador de vencidos por proceso | pgtap: `supabase/tests/0014_document_management.test.sql`<br>pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-99 | E2B | Anulación: jefe de área solicita, aq_dir decide, recolección de copias, OBSOLETO y retención | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-100 | E2B | Control de cambios con origen e impacto; cambio técnico en un formato exige revisar el procedimiento padre | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| RF-101 | E2B | Congelación de versión: solo versiones vigentes en OP o lote (assert_document_effective) | pgtap: `supabase/tests/0015_document_rpcs.test.sql` | Cubierto |
| RF-102 | E2B | Firma corta y buenas prácticas: correcciones con asterisco y aviso a partir de 6 correcciones | pgtap: `supabase/tests/0006_corrections_numbering.test.sql` | Cubierto |
| RF-103 | E2B | Marca de copia controlada / no controlada / OBSOLETO con usuario y fecha de descarga | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-19 | E2B | Crear una OP con un documento no vigente → DOCUMENT_NOT_EFFECTIVE | pgtap: `supabase/tests/0015_document_rpcs.test.sql` | Cubierto |
| AC-20 | E2B | master edita una versión aprobada → RECORD_LOCKED | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-23 | E2B | El autor o master revisa o aprueba su versión → SOD_VIOLATION | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-25 | E2B | Ejecutar un paso sin la capacitación aprobada (regla activa) → TRAINING_REQUIRED | pgtap: `supabase/tests/0015_document_rpcs.test.sql` | Cubierto |
| AC-26 | E2B | Otro rol crea un documento controlado → FORBIDDEN_ROLE | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-28 | E2B | Solicitar un código sin ser aq_doc → FORBIDDEN_ROLE | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-29 | E2B | El autor aprueba su versión → SOD_VIOLATION; el revisor aprueba la que revisó → permitido | pgtap: `supabase/tests/0015_document_rpcs.test.sql` | Cubierto |
| AC-30 | E2B | Publicar un formato con cambio técnico sin revisar el padre → PARENT_DOCUMENT_REVIEW_REQUIRED | pgtap: `supabase/tests/0015_document_rpcs.test.sql` | Cubierto |
| AC-31 | E2B | Cuestionario con 70 % → TRAINING_NOT_PASSED; con 85 % → constancia | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-32 | E2B | Anular sin recoger una de las 4 copias → RECALL_PENDING | pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-33 | E2B | Preliminar con «generalmente» y redacción no infinitiva → STYLE_CHECK_FAILED con observaciones | pgtap: `supabase/tests/0014_document_management.test.sql`<br>pgtap: `supabase/tests/0015_document_rpcs.test.sql`<br>e2e: `e2e/documentos.spec.ts` | Cubierto |
| AC-34 | E2B | Documento con registro sanitario que vence el 30/09/2030 → revisión 30/09/2030 | pgtap: `supabase/tests/0014_document_management.test.sql` | Cubierto |
| AC-35 | E2B | Ver PRD_GRUFARCOL.md | pgtap: `supabase/tests/0006_corrections_numbering.test.sql` | Cubierto |
| RF-10 | E3 | Brief con los campos del Documento Maestro §6.5, competencia en varias filas y estado borrador → enviado → aprobado | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| RF-11 | E3 | Fórmula cualicuantitativa versionada sobre el SGD; no se envía si la suma ≠ 100 % (±0,001) | pgtap: `supabase/tests/0019_master_documents.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| RF-12 | E3 | Especificaciones por materia prima, granel y producto terminado; cada parámetro con método y límites | pgtap: `supabase/tests/0019_master_documents.test.sql` | Cubierto |
| RF-13 | E3 | Instructivos por etapa y presentación; cada paso define equipo, verificación y valores a capturar | pgtap: `supabase/tests/0019_master_documents.test.sql` | Cubierto |
| RF-14 | E3 | Aprobación de versiones con SOD-3: el creador no aprueba, la aprobada es inmutable y la anterior queda reemplazada; bandeja S-10 por ruta | pgtap: `supabase/tests/0019_master_documents.test.sql`<br>pgtap: `supabase/tests/0020_rd_readings_batch_inbox.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| RF-15 | E3 | Prototipos P-NNNN y mejoras P-NNNN-n; mínimo 2 por brief para elegir | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| RF-16 | E3 | Estabilidad preliminar: cinco pruebas, cronograma de 30 días, lecturas por tiempo (todas o ninguna) y cierre firmado | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>pgtap: `supabase/tests/0020_rd_readings_batch_inbox.test.sql`<br>e2e: `e2e/idi.spec.ts`<br>pgtap: `supabase/tests/0021_stability_signer_judgment.test.sql` | Cubierto |
| RF-17 | E3 | Hoja de costos con totales que coinciden con las líneas; solo la ven I+D, Dirección técnica y Gerencia (PRD 1.8) | pgtap: `supabase/tests/0019_master_documents.test.sql`<br>e2e: `e2e/idi.spec.ts`<br>pgtap: `supabase/tests/0022_cost_permissions.test.sql` | Cubierto |
| AC-13 | E3 | Aprobar fórmula sin estabilidad completa y conforme o con menos de 2 prototipos → STABILITY_INCOMPLETE / MIN_PROTOTYPES | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>pgtap: `supabase/tests/0019_master_documents.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| AC-16 | E3 | Cerrar como «cumple» con lecturas faltantes → STABILITY_INCOMPLETE | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>e2e: `e2e/idi.spec.ts`<br>pgtap: `supabase/tests/0021_stability_signer_judgment.test.sql` | Cubierto |
| AC-17 | E3 | Viscosidad con muestra de 200 mL → SAMPLE_TOO_SMALL | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>pgtap: `supabase/tests/0020_rd_readings_batch_inbox.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| AC-18 | E3 | El cronograma crea lecturas a 0 h, 12 h, 24 h, 3, 7, 15 y 30 d; microbiología solo a 0 h y 30 d | pgtap: `supabase/tests/0018_briefs_prototypes_stability.test.sql`<br>e2e: `e2e/idi.spec.ts` | Cubierto |
| RF-20 | E4 | Recepción en cuarentena con vencimiento obligatorio, CoA, ubicación sugerida compatible y rótulo con la ubicación; v1.9: orden de compra, unidades de empaque, vencimiento sugerido y rótulo PDF | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql`<br>e2e: `e2e/bodega.spec.ts`<br>pgtap: `supabase/tests/0026_item_master.test.sql`<br>e2e: `e2e/maestros.spec.ts` | Cubierto |
| RF-21 | E4 | Kardex por lote con movimientos inmutables, FEFO y alertas 30/60/90 días; saldo = suma de movimientos y nunca negativo | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| RF-22 | E4 | Liberación de insumos por Control de calidad con firma: cuarentena → aprobado | rechazado; SOD-5 | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| RF-23 | E4 | Bodegas por función, internas o externas (aprobación D-20), estantes × pisos × posiciones con ubicaciones codificadas | pgtap: `supabase/tests/0023_warehouses.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| RF-24 | E4 | Toda existencia con ubicación compatible; traslados internos con motivo; localizador; rechazado → bodega de rechazo (D-16) | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| RF-25 | E4 | Traslados y envíos a bodegas externas con tercero calificado, remisión PDF, firmas de despacho y recepción y estado en tránsito | pgtap: `supabase/tests/0025_stock_transfers.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| AC-21 | E4 | Material de envase en una ubicación de producto terminado → LOCATION_TYPE_MISMATCH | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| AC-22 | E4 | Trasladar un lote rechazado a una ubicación de materias primas aprobadas → LOCATION_RULE_VIOLATION | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql` | Cubierto |
| AC-24 | E4 | Despachar a una bodega externa con tercero no calificado o vencido → EXTERNAL_SITE_NOT_QUALIFIED | pgtap: `supabase/tests/0025_stock_transfers.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| AC-27 | E4 | 6 estantes × 4 pisos × 2 posiciones = 48 ubicaciones con códigos únicos | pgtap: `supabase/tests/0023_warehouses.test.sql`<br>e2e: `e2e/bodega.spec.ts` | Cubierto |
| RF-26 | E4B | Maestro de materiales y productos: código único, unidad del catálogo, almacenamiento, vida útil o reanálisis y empaque de compra; mantienen I+D, bodega y Calidad con motivo; dónde se usa | pgtap: `supabase/tests/0026_item_master.test.sql`<br>e2e: `e2e/maestros.spec.ts` | Cubierto |
| AC-42 | E4B | Recibir un ítem que no existe en el maestro o está inactivo → INVALID_FIELD | pgtap: `supabase/tests/0026_item_master.test.sql`<br>e2e: `e2e/maestros.spec.ts` | Cubierto |
| AC-43 | E4B | Recibir 2 cajas × 100 plegadizas → 200 und con orden de compra en el rótulo | pgtap: `supabase/tests/0026_item_master.test.sql`<br>e2e: `e2e/maestros.spec.ts` | Cubierto |
| RF-50 | E5 | Inventario de equipos con documento que los rige, hoja de vida firmada (instalación, calibración, verificación, mantenimiento, calificación, limpieza, uso), estados, certificados con huella y validez en un momento (is_equipment_valid) | pgtap: `supabase/tests/0027_equipment.test.sql`<br>e2e: `e2e/equipos.spec.ts`<br>pgtap: `supabase/tests/0028_equipment_links.test.sql` | Cubierto |
| RF-51 | E5 | Avisos de vencimiento de calibración, mantenimiento y calificación a 30/15/7 días (configurables) en la campana y por correo en cola, generados por tarea programada diaria | pgtap: `supabase/tests/0027_equipment.test.sql`<br>e2e: `e2e/equipos.spec.ts` | Cubierto |
| AC-44 | E5 | Registrar una calibración o una calificación sin certificado ni enlace del proveedor → INVALID_FIELD; el archivo queda con huella SHA-256 y el enlace se abre desde la hoja de vida | pgtap: `supabase/tests/0027_equipment.test.sql`<br>e2e: `e2e/equipos.spec.ts`<br>pgtap: `supabase/tests/0028_equipment_links.test.sql` | Cubierto |
| AC-45 | E5 | Equipo con calibración vencida → is_equipment_valid falso y EQUIPMENT_NOT_VALID con la regla y la fecha | pgtap: `supabase/tests/0027_equipment.test.sql`<br>e2e: `e2e/equipos.spec.ts` | Cubierto |
| AC-46 | E5 | Al cruzar un umbral se crea un aviso por persona y un correo en cola; el mismo umbral no se repite | pgtap: `supabase/tests/0027_equipment.test.sql` | Cubierto |
| AC-47 | E5 | Quien registró la limpieza no la verifica → SOD_VIOLATION | pgtap: `supabase/tests/0027_equipment.test.sql` | Cubierto |
| RF-30 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-31 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-32 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-33 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-34 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-35 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-36 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-37 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-38 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-39 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-03 | E6 | Dispensar un lote en cuarentena → LOT_NOT_APPROVED (assert_lot_available listo desde F4; la dispensación llega en F6) | pgtap: `supabase/tests/0024_material_lots_inventory.test.sql` | Etapa futura |
| AC-04 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-05 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-07 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-14 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-40 | E7 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-41 | E7 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-42 | E7 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-60 | E8 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-61 | E8 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-62 | E8 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-12 | E8 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-80 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-81 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-82 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-83 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-06 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-09 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-10 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-15 | E9 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-70 | E10 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-71 | E10 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-72 | E10 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-90 | E10 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-91 | E10 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
