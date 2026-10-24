# Reporte de etapa E4 — Documentos maestros

**Fase del PRD:** F3 (el responsable la nombra E4; en la matriz de trazabilidad conserva la clave E3, ver D-44) · **Rama:** `etapa/E4` · **Fecha:** 24/10/2026
**Estado:** **cerrada**: aprobada por el responsable el 24/10/2026 e integrada a `main` ([PR #2](https://github.com/estmarcardona-arch/qentragrcl/pull/2)). Migraciones 0017–0020 aplicadas en la nube; pgTAP en verde en la nube; CI en verde ([ejecución 40123794004](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/40123794004)).

## Puerta de salida

| #   | Condición                                                     | Estado   | Evidencia                                                          |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| 1   | RF-10…RF-17 con prueba                                        | Cumplida | Matriz: 57 requisitos con prueba hasta F3 (`npm run traceability`) |
| 2   | AC-13 aprobado (y AC-16, AC-17, AC-18 del protocolo, PRD §14) | Cumplida | pgTAP 0018, 0019 y 0020; E2E `e2e/idi.spec.ts`                     |
| 3   | AC-07 (parcial): `NO_APPROVED_VERSION` sin fórmula aprobada   | Cumplida | `assert_approved_formula` (pgTAP 0019); la OP la usará en E6       |
| 4   | Reporte ETAPA-E4.md                                           | Cumplida | Este documento                                                     |

## Qué se construyó

### Migraciones (aplicadas al proyecto de desarrollo: 0017, 0018, 0019 y 0020)

| Migración                              | Contenido                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0017_products_materials.sql`          | `materials`, `products`, `product_presentations` (catálogos con bitácora) y `stability_criteria` por producto (D-13): vacíos hasta que Calidad los defina; sin ellos no se cierra un estudio como «cumple»                                                                                                                            |
| `0018_briefs_prototypes_stability.sql` | `briefs` y `brief_competitors` (precio por mL), `formula_prototypes`, `prototype_items`, `prototype_approvals`, `stability_studies`, `stability_tests`, `stability_readings`. 13 RPC con rol, estado, SOD y bitácora (lista en el CHANGELOG). Quien registra lecturas no firma el resultado del estudio                               |
| `0019_master_documents.sql`            | Tipo documental `FM` (D-49); `formulas`, `formula_items`, `specifications`, `spec_parameters`, `instructions`, `instruction_steps`, `cost_sheets`, `cost_sheet_lines`, vista `v_cost_sheet_totals`. El contenido vive aquí; código, versión, estado y firmas en `document_versions` (D-27). Al aprobar: AC-13 y bloqueo del contenido |
| `0020_rd_readings_batch_inbox.sql`     | `record_stability_readings` (todas las repeticiones de un tiempo o ninguna) y `my_pending_versions` (bandeja S-10 según la ruta de aprobación)                                                                                                                                                                                        |

Todas las tablas nuevas: RLS por permiso de módulo (matriz 2.2), bitácora y sin borrado de registros firmables.

### Pantallas (Prompt 3 y 3B)

| Pantalla               | Ruta                                      | Contenido                                                                                                                                                               |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-05 Listado de briefs | `/idi/briefs`                             | Briefs por estado                                                                                                                                                       |
| S-06 Brief             | `/idi/briefs/nuevo`, `/idi/briefs/[id]`   | Índice lateral, competencia con precio por mL, grupo objetivo, canal, margen y precio sugerido; envío firmado por Comercial; aprobación o devolución por DT             |
| S-36 Prototipos        | `/idi/prototipos`, `/idi/prototipos/[id]` | Árbol de prototipos y mejoras, aviso de mínimo 2; estabilidad con cronograma, lecturas por tiempo, progreso y cierre firmado; criterios (D-13); aprobación como fórmula |
| S-07 Fórmula           | `/idi/formulas/[versionId]`               | Ingredientes con suma en vivo y kg por lote; prototipo de origen                                                                                                        |
| S-08 Especificaciones  | `/idi/especificaciones/[versionId]`       | Parámetros con método y límites por alcance                                                                                                                             |
| S-09 Instructivos      | `/idi/instructivos/[versionId]`           | Pasos por etapa y presentación con equipo, verificación y parámetros                                                                                                    |
| S-37 Costos            | `/idi/costos`, `/idi/costos/[formulaId]`  | Costo del granel, unidad terminada y lote industrial; confidencial                                                                                                      |
| S-10 Aprobaciones      | `/aprobaciones`                           | Versiones que le toca firmar al usuario, comparación con la versión reemplazada, prototipos por aprobar y briefs enviados                                               |

## Resultados de pruebas

| Prueba                                        | Requisito                                       | Resultado                              |
| --------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| pgTAP `0017_products_materials` (7)           | Catálogos, D-13                                 | Aprobado en la nube                    |
| pgTAP `0018_briefs_prototypes_stability` (46) | RF-10, RF-15, RF-16; AC-13, AC-16, AC-17, AC-18 | Aprobado en la nube                    |
| pgTAP `0019_master_documents` (28)            | RF-11…RF-14, RF-17; AC-07 (parcial), AC-13      | Aprobado en la nube                    |
| pgTAP `0020_rd_readings_batch_inbox` (17)     | RF-14, RF-16, AC-17                             | Aprobado en la nube                    |
| pgTAP total (0000–0020)                       |                                                 | 20 de 20 archivos aprobados en la nube |
| Vitest (53)                                   | RF-02, RF-92 (menú), RNF-01                     | Aprobado                               |
| E2E `e2e/idi.spec.ts`                         | RF-10, RF-11, RF-14…RF-17; AC-13, AC-16…AC-18   | Aprobado en la CI                      |
| Matriz requisito→prueba                       | 57 requisitos hasta F3                          | Aprobado                               |

### Cada AC

| AC                                                                               | Resultado | Dónde                                  |
| -------------------------------------------------------------------------------- | --------- | -------------------------------------- |
| AC-13 Aprobar fórmula sin estabilidad conforme o con menos de 2 prototipos       | Aprobado  | pgTAP 0018 y 0019; E2E                 |
| AC-16 Cerrar como «cumple» con lecturas faltantes → `STABILITY_INCOMPLETE`       | Aprobado  | pgTAP 0018; E2E                        |
| AC-17 Viscosidad con muestra de 200 mL → `SAMPLE_TOO_SMALL`                      | Aprobado  | pgTAP 0018 y 0020; E2E                 |
| AC-18 Cronograma 0 h, 12 h, 24 h, 3, 7, 15 y 30 d; microbiología solo 0 h y 30 d | Aprobado  | pgTAP 0018; E2E                        |
| AC-07 (parcial) Sin fórmula aprobada → `NO_APPROVED_VERSION`                     | Aprobado  | pgTAP 0019 (`assert_approved_formula`) |

## Supuestos (decisiones por defecto, marcadas en PREGUNTAS_ABIERTAS.md)

- **D-13:** el sistema no fija criterios de estabilidad; cerrar como «cumple» exige que Calidad o I+D los registren por producto (`STABILITY_CRITERIA_MISSING`, `STABILITY_OUT_OF_CRITERIA`, códigos que no están en el PRD).
- **D-27:** el estado de fórmulas, especificaciones e instructivos vive solo en `document_versions` (SGD).
- **Nueva D-49:** la fórmula maestra es el tipo documental `FM` (nivel 4, vigencia por registro sanitario, ruta técnica, con sello); código de la semilla `IDI-FM-001`.

## Datos en la nube

- Siguiendo la decisión de E3, la semilla del Prompt 0B no se carga en la nube: allí no hay productos, materias primas ni el protocolo `CC-PC-001`, por lo que el flujo de prototipos y estabilidad se verifica en la CI (base local con semilla).
- Para probar I+D en la vista previa de Vercel hace falta crear esos datos (o cargar la semilla en una base limpia): decisión del responsable.

## Deuda técnica y notas

- La edición maestra de fórmulas, especificaciones e instructivos por `master` (S-07…S-09 con banner de borrador) y «Agregar etapa» en S-43 siguen pendientes.
- El costo del prototipo (sin fórmula aprobada) no tiene pantalla; la hoja de costos parte de la fórmula.
- La matriz de permisos 2.2 agrupa costos con prototipos: `comercial`, `prod_coord`, `master` y `auditor` leen costos. Conviene confirmar con Dirección si RF-17 («solo roles autorizados») pide restringirlo más.
- La bandeja S-10 muestra las versiones propias bloqueadas por SOD para explicar por qué no se pueden firmar.
- La E2E de roles configurables de E2 (`e2e/admin.spec.ts`, proyecto tablet) falló una vez y aprobó al reintentarse en la CI: prueba inestable que conviene revisar.
- Al aprobar un estudio como «cumple» en la E2E haría falta registrar las 50 lecturas por pantalla; ese recorrido completo se cubre en pgTAP (0018) y la E2E verifica los bloqueos (AC-13, AC-16, AC-17).

## Comandos para reproducir

```bash
npm run ci                      # prettier, lint, tsc, Vitest, matriz, versiones y build
npm run test:db                 # pgTAP contra la nube
E2E_SEED_USERS=1 E2E_SEED_DOCS=1 npx playwright test e2e/idi.spec.ts --project=escritorio   # requiere la base con semilla
```
