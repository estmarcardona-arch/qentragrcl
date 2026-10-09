# Reporte de etapa E3 — Sistema de gestión documental y plantillas

**Fase del PRD:** F2B (el responsable la nombró E3; en la matriz de trazabilidad conserva la clave E2B, ver D-44) · **Rama:** `etapa/E3` · **Fecha:** 09/10/2026
**Estado:** **cerrada**: aprobada por el responsable el 09/10/2026 e integrada a `main`. AC-19, 20, 23, 25, 26, 28, 29, 30, 31, 32, 33 y 34 aprobados; listado maestro de la semilla = pantalla (CI); migraciones 0014–0016 aplicadas en la nube; CI en verde ([ejecución 37991670244](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/37991670244)).

## Puerta de salida

| #   | Condición                                                             | Estado            | Evidencia                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AC-19, 20, 23, 25, 26, 28, 29, 30, 31, 32, 33 y 34 aprobados          | Cumplida          | pgTAP `0014_document_management` (32) y `0015_document_rpcs` (73); E2E `e2e/documentos.spec.ts`                                                                                                                           |
| 2   | El listado maestro de la semilla (Prompt 0B) coincide con la pantalla | Cumplida en la CI | E2E «RF-92 · el listado maestro de la pantalla coincide con la semilla»: compara código, versión, emisión, revisión, trámite y vigencia de los 12 documentos internos, el externo y el indicador por proceso (PRD 33,3 %) |
| 3   | Reporte ETAPA-E3.md                                                   | Cumplida          | Este documento                                                                                                                                                                                                            |

## Qué se construyó

### Migraciones (aplicadas al proyecto de desarrollo: 0014, 0015 y 0016)

| Migración                      | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0014_document_management.sql` | `document_types` (12 tipos con nivel, regla de vigencia, sello y capacitación), `approval_routes` y `approval_route_steps`, `controlled_documents`, `document_versions` (estados exactos del PRD 9), `document_requests`, `standardization_checks`, `document_distribution`, `document_change_requests`, `document_annulments`, `document_trainings`, `training_assignments`, `training_attempts`, `document_downloads`, `stage_definitions`, `process_templates`, `process_template_steps`; vistas `v_master_list` y `v_documents_overdue_by_process`; `compute_review_due_date` y `document_validity`. Todas con RLS, bitácora y sin borrado. Las respuestas de los cuestionarios viven en `app_private` (el navegador nunca las recibe). Firmas de versiones: columnas de ciclo de vida (emisión, revisión, vigencia, obsolescencia) fuera de la huella, para publicar sin romper la integridad (DI-7) |
| `0015_document_rpcs.sql`       | 22 RPC con rol, estado, SOD y bitácora (lista en el CHANGELOG). Códigos de error: `FORBIDDEN_ROLE`, `SOD_VIOLATION`, `RECORD_LOCKED`, `INVALID_TRANSITION`, `NOT_STANDARDIZED`, `STYLE_CHECK_FAILED`, `ROUTE_INCOMPLETE`, `RECALL_PENDING`, `PARENT_DOCUMENT_REVIEW_REQUIRED`, `TRAINING_REQUIRED`, `TRAINING_NOT_PASSED`, `DOCUMENT_NOT_EFFECTIVE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `0016_training_default.sql`    | D-19: la regla de capacitación queda en «avisar» por defecto (como está registrada); validación de los ajustes del SGD en `admin_update_setting`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Pantallas (Prompt 2B y 2C)

| Pantalla                   | Ruta                                              | Contenido                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-44 Listado maestro       | `/documentos`                                     | Tarjetas, indicador % vencidos por proceso, filtros (proceso, tipo, nivel, estado), búsqueda, formatos anidados, semáforo con ícono y texto, exportar a Excel (CSV); vista de planta con vigentes y «Pendiente de capacitación» |
| S-45 Solicitar / crear     | `/documentos/nuevo`, `/documentos/versiones/[id]` | Crear, modificar o anular; plantilla editable descargable; preliminar con revisor de redacción en vivo; código automático y no editable al codificar                                                                            |
| S-49 Estandarización       | `/documentos/estandarizacion`                     | Bandeja de la analista, lista de chequeo, revisor que resalta los términos subjetivos, devolución con observaciones, creación del código (ruta, regla de vigencia, vencimiento del registro)                                    |
| S-46 Detalle               | `/documentos/[id]`                                | Encabezado controlado; pestañas Documento, Versiones, Flujo, Firmas, Copias y distribución, Bitácora, Usado en lotes; acciones por rol con firma y contraseña; avisos de SOD, de cambio técnico y de versión en curso; PDF      |
| S-47 Capacitación          | `/documentos/capacitacion`                        | Mis capacitaciones, cuestionario con línea del 80 %, constancia en PDF; seguimiento (aprobados, pendientes, registro de capacitación) y asignación                                                                              |
| S-48 Cambios y anulaciones | `/documentos/cambios`                             | Solicitudes, detalle con origen, impacto y revisión del procedimiento padre; anulación con decisión de `aq_dir`, recolección por proceso y cierre                                                                               |
| S-43 Plantillas de proceso | `/master/plantillas`                              | Catálogo de etapas con sello documental; editor del master (banner de borrador, motivo obligatorio, pasos y parámetros); comparación con la vigente                                                                             |
| PDF                        | `/documentos/[id]/pdf`                            | Encabezado con página x de y, secciones, historial (3), cuadro de firmas, marca de copia o OBSOLETO, usuario y fecha de descarga                                                                                                |
| Panel                      | `/inicio`                                         | Indicador «% de documentos vencidos por proceso» para Aseguramiento de la calidad y Gerencia                                                                                                                                    |

## Resultados de pruebas

| Prueba                                | Requisito                                                                                                                                                                                 | Resultado                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| pgTAP `0014_document_management` (32) | RF-92, RF-94, RF-98, AC-33, AC-34, D-19, RLS                                                                                                                                              | Aprobado                                   |
| pgTAP `0015_document_rpcs` (73)       | RF-05, RF-93…RF-101, RF-103; AC-19, 20, 23, 25, 26, 28, 29, 30, 31, 32, 33                                                                                                                | Aprobado (con y sin semilla)               |
| pgTAP total (0000–0015)               |                                                                                                                                                                                           | Aprobado en la nube y en la CI             |
| Vitest (53)                           | RF-02, RF-92 (menú), RNF-01                                                                                                                                                               | Aprobado                                   |
| E2E ciclo completo (4 usuarios)       | Solicitud → estandarización (devolución y corrección) → código → revisión → aprobación → vigente → capacitación (no aprueba / aprueba y constancia) → anulación (RECALL_PENDING y cierre) | Aprobado (local contra la nube y en la CI) |
| E2E de la semilla                     | Listado maestro = Prompt 0B, vista de Diego, cuadro de firmas, seguimiento 12 de 14, AN-2026-0002, plantillas                                                                             | Aprobado en la CI                          |
| Matriz requisito→prueba               | 45 requisitos hasta E2B                                                                                                                                                                   | Aprobado                                   |

### Cada AC

| AC                                                                            | Resultado | Dónde                                                     |
| ----------------------------------------------------------------------------- | --------- | --------------------------------------------------------- |
| AC-19 Documento no vigente en una OP → `DOCUMENT_NOT_EFFECTIVE`               | Aprobado  | `assert_document_effective` (pgTAP); la usará la OP en E6 |
| AC-20 Master edita versión aprobada → `RECORD_LOCKED`                         | Aprobado  | pgTAP (RPC y trigger de pasos)                            |
| AC-23 El autor revisa o aprueba → `SOD_VIOLATION`                             | Aprobado  | pgTAP y E2E (aviso de SOD)                                |
| AC-25 Sin capacitación con la regla activa → `TRAINING_REQUIRED`              | Aprobado  | pgTAP (`assert_training`; la usará la ejecución en E6)    |
| AC-26 / AC-28 Otro rol crea o codifica → `FORBIDDEN_ROLE`                     | Aprobado  | pgTAP y E2E                                               |
| AC-29 Autor aprueba → `SOD_VIOLATION`; revisor aprueba → permitido            | Aprobado  | pgTAP                                                     |
| AC-30 Cambio técnico sin revisar el padre → `PARENT_DOCUMENT_REVIEW_REQUIRED` | Aprobado  | pgTAP                                                     |
| AC-31 70 % → `TRAINING_NOT_PASSED`; 85 % → constancia                         | Aprobado  | pgTAP y E2E                                               |
| AC-32 Anular sin recoger una copia → `RECALL_PENDING`                         | Aprobado  | pgTAP y E2E                                               |
| AC-33 «generalmente» y redacción no infinitiva → `STYLE_CHECK_FAILED`         | Aprobado  | pgTAP y E2E                                               |
| AC-34 Registro sanitario 30/09/2030 → revisión 30/09/2030                     | Aprobado  | pgTAP                                                     |

## Supuestos (decisiones por defecto, marcadas en PREGUNTAS_ABIERTAS.md)

- **D-15:** siglas `GCA, ADM, CC, PRD, MTO, TH, GLG, IDI`; `PC` = protocolo; vigencias del PRD 2.5.8; ruta técnica (revisa jefe inmediato o `aq_dir`, aprueba `dt`) y administrativa para ADM y TH. Documentos externos con código `EXT-NNN`.
- **D-19:** la capacitación avisa por defecto; con «bloquear» rige `TRAINING_REQUIRED`.
- **D-21:** módulo propio S-47.
- **D-22:** los formatos, registros y certificados no llevan sello; todo PDF lleva su marca de copia.
- **D-24:** administrativos los aprueba Gerencia o Dirección técnica.
- **D-26:** una revisión vencida solo alerta.
- **Numeración:** `SD-`, `SC-`, `AN-`, `CT-AAAA-NNNN` (formatos del Prompt 0B; D-11).
- **Nuevas:** D-42 (plantillas de dispensación y acondicionamiento sin formato en el 0B), D-43 (ADM-PR-002-FR-04 fuera del listado del 0B), D-44 (numeración de etapas).

## Datos en la nube

- **Decisión del responsable (09/10/2026): la nube se deja como está.** La semilla documental del Prompt 0B no se carga en la base de desarrollo; el listado maestro del 0B se verifica en la CI (base local con semilla).
- La base de desarrollo conserva los documentos ficticios que crearon las corridas locales de la E2E (GLG-PR-001…005, MTO-PR-001…006 y dos preliminares sin código, todos «Procedimiento de prueba E2E…»). Algunos códigos coinciden con los de la semilla (GLG-PR-004, SD-2026-0010/0011, AN-2026-0002), por lo que la semilla no puede cargarse sobre esa base sin limpiarla antes.
- La E2E del ciclo usa ahora el proceso MTO y la semilla ajusta los consecutivos sin retroceder (`greatest`).

## Deuda técnica y notas

- Devolver una versión desde la revisión o la aprobación: no implementado (las firmas no se repiten; requiere una versión nueva). Hoy solo se devuelve en la estandarización.
- Configuración de tipos de documento y rutas: solo por semilla; falta su pantalla de catálogo.
- «Agregar etapa» en S-43 y la edición maestra de fórmulas, especificaciones e instructivos (S-07…S-09) llegan con F3.
- «Usado en lotes» y la congelación en la OP se conectan en E6 (`assert_document_effective`, `assert_training` listos).
- «Enviar recordatorio» de capacitación depende de un SMTP (D-37).
- Exportar a Excel genera CSV (UTF-8 con BOM, «;»).
- Límite de inicios de sesión de Supabase local (CI) subido a 300 cada 5 minutos para la suite E2E; la nube conserva su valor.

## Comandos para reproducir

```bash
npm run ci                      # prettier, lint, tsc, Vitest, matriz, versiones y build
npm run test:db                 # pgTAP contra la nube
npm run test:db:pending         # migraciones nuevas en una transacción que se revierte
E2E_SEED_USERS=1 npx playwright test e2e/documentos.spec.ts --project=escritorio
```
