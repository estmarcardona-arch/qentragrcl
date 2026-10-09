# Matriz de trazabilidad requisito → prueba

Generada por `npm run traceability:write` desde `docs/VALIDACION/matriz-trazabilidad.json`. Etapa actual: **E2B**.

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
| RF-10 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-11 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-12 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-13 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-14 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-15 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-16 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-17 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-13 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-16 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-17 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-18 | E3 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-20 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-21 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-22 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-23 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-24 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-25 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-21 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-22 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-24 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-27 | E4 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-50 | E5 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
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
| AC-03 | E6 | Ver PRD_GRUFARCOL.md | — | Etapa futura |
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
