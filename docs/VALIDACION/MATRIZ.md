# Matriz de trazabilidad requisito → prueba

Generada por `npm run traceability:write` desde `docs/VALIDACION/matriz-trazabilidad.json`. Etapa actual: **E2**.

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
| RF-05 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-92 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-93 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-94 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-95 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-96 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-97 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-98 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-99 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-100 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-101 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-102 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| RF-103 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-19 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-20 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-23 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-25 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-26 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-28 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-29 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-30 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-31 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-32 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-33 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-34 | E2B | Ver PRD_GRUFARCOL.md | — | Etapa futura |
| AC-35 | E2B | Ver PRD_GRUFARCOL.md | pgtap: `supabase/tests/0006_corrections_numbering.test.sql` | Etapa futura |
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
