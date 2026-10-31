# Reporte de etapa E6 — Equipos y hoja de vida

**Fase del PRD:** F5 (clave E5 en la matriz, D-44) · **Rama:** `etapa/E6` · **Fecha:** 31/10/2026
**Estado:** **lista para aprobación del responsable.** Migración 0027 aplicada en la nube el 31/10/2026; pgTAP 27 de 27 en la nube; tarea `pg_cron` creada; equipos de ejemplo cargados en la nube (D-63); CI en verde ([ejecución 41210241448](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/41210241448)).

## Puerta de salida

| #   | Condición                                                         | Estado    | Evidencia                                                                    |
| --- | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| 1   | RF-50 aprobado (y RF-51, AC-44…AC-47 con prueba)                  | Cumplida  | Matriz: 76 requisitos con prueba hasta F5; pgTAP 0027 33 de 33               |
| 2   | pgTAP de estados y de vigencia                                    | Cumplida  | `supabase/tests/0027_equipment.test.sql`                                     |
| 3   | Playwright de registro de calibración y bloqueo por vencimiento   | Pendiente | `e2e/equipos.spec.ts`: corre en la CI de GitHub (necesita la semilla del 0B) |
| 4   | Servicio de recordatorios con tarea programada (decisión escrita) | Cumplida  | `pg_cron` diario (D-59); correo en cola (D-60)                               |
| 5   | Reporte ETAPA-E6.md                                               | Cumplida  | Este documento                                                               |

## Qué se construyó

| Pieza                  | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD 1.10               | Fila «Equipos y hoja de vida» en la matriz 2.2 (C F: bodega_jefe, Producción, laboratorio, cc_jefe; C F A: aq_dir; L: bodega_aux, idi, dt, master, aq_doc, gerencia, auditor). Diccionario de las tablas nuevas, RF-50 ampliado, RF-51, rutas de S-25, AC-44…AC-47                                                                                                                                                                                                              |
| `0027_equipment.sql`   | `equipment` (código `AAA-999`, tipo del catálogo, área, crítico, documento que lo rige, controles que exige, estado y motivo). `equipment_events` firmados e inmutables (instalación, calibración, verificación, mantenimiento, calificación, limpieza, uso, cambio de estado). `equipment_attachments` con huella SHA-256 en el bucket privado `evidencias`. `notifications` y `email_outbox`. Configuración `equipment_alert_days` [30, 15, 7] y `cleaning_due_soon_hours` 48 |
| Reglas en SQL          | `save_equipment` (motivo al editar); `record_equipment_event` (contraseña antes de escribir, firma «Ejecuté»; la calificación «Aprobé» solo Aseguramiento de la calidad; la calibración exige certificado ya guardado, AC-44); `verify_cleaning` (otra persona, SOD, AC-47); `set_equipment_status` (sacar o devolver de servicio lo aprueba Aseguramiento de la calidad)                                                                                                       |
| Vigencia               | `equipment_validity(equipo, momento)`, `is_equipment_valid` y `assert_equipment_valid` (`EQUIPMENT_NOT_VALID: BAL-014: calibración vencida el 02/10/2026`). Producción la llamará en F6 (AC-05). `v_equipment_status`: «calibración vencida» derivada y estado general apto, apto con alerta o no apto                                                                                                                                                                          |
| Recordatorios          | `generate_equipment_reminders()`: por cada vencimiento, el umbral más urgente cruzado (30/15/7 o vencido), un aviso por persona con permiso de registrar o aprobar y su correo en cola; el mismo umbral no se repite. Tarea `pg_cron` diaria a las 06:00 de Bogotá                                                                                                                                                                                                              |
| S-25 `/equipos`        | Resumen (equipos, aptos, aptos con alerta, no apto), filtro «Con alertas», buscar, vencimientos de calibración, mantenimiento, calificación y limpieza por equipo; «Nuevo equipo»                                                                                                                                                                                                                                                                                               |
| S-25 `/equipos/[code]` | Por qué está o no apto, cuatro tarjetas de vencimiento, registrar calibración (con certificado), limpieza y otros eventos con firma, verificar limpieza, línea de tiempo con certificados (enlace temporal y huella), próximos vencimientos, lotes en que se usó, cambiar estado y editar la ficha con motivo; «Abrir desviación» deshabilitado hasta F8                                                                                                                        |
| Campana                | Avisos sin leer en la barra superior; marcar uno o todos como leídos. S-04 edita los días de alerta                                                                                                                                                                                                                                                                                                                                                                             |
| Semilla 0B             | TQ-101, HM-02, BAL-014 (calibración vencida desde el 02/10/2026), LL-03 y ET-02 (no crítico, mantenimiento al 20/10/2026) con 21 firmas; los avisos se generan al cargar                                                                                                                                                                                                                                                                                                        |
| CI                     | Supabase local arranca con Storage; bucket `evidencias` declarado en `supabase/config.toml`                                                                                                                                                                                                                                                                                                                                                                                     |

## Resultados de pruebas

| Prueba                      | Requisito                                | Resultado                                                 |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| pgTAP `0027_equipment` (33) | RF-50, RF-51, AC-44, AC-45, AC-46, AC-47 | Aprobado en la nube                                       |
| pgTAP total (0000–0027)     |                                          | 27 de 27 archivos aprobados en la nube                    |
| Bloque E6 de la semilla     |                                          | Cargado en transacción revertida: 5 equipos, 21 firmas    |
| Vitest (53)                 | RF-02 (menú con Equipos), matriz 22 × 15 | Aprobado                                                  |
| `npm run ci` (local)        |                                          | Aprobado: formato, lint, tipos, matriz, versiones y build |
| E2E `e2e/equipos.spec.ts`   | RF-50, RF-51, AC-44, AC-45               | Pendiente de la CI de GitHub                              |

## Supuestos (PREGUNTAS_ABIERTAS.md)

- **D-58:** roles del módulo según la fila nueva de la matriz.
- **D-59:** `pg_cron` (Supabase Cron) diario; sin Edge Functions en esta etapa.
- **D-60:** los correos quedan en cola; el envío depende del proveedor de correo (D-37).
- **D-61:** bucket privado `evidencias`, PDF/PNG/JPG hasta 10 MB, huella calculada por el servidor, inmutable.
- **D-62:** no se inventan periodicidades: el próximo vencimiento se digita; alerta de limpieza 48 h antes.

## Deuda técnica y notas

- Con la fecha real (31/10/2026) los cinco equipos del 0B salen **no aptos**: las limpiezas del 0B vencieron entre el 07 y el 12/10/2026 y ET-02 tiene el mantenimiento vencido. Es el comportamiento correcto; para verlos aptos se registra una limpieza nueva y otra persona la verifica.
- Los certificados de la semilla no se cargan (el almacenamiento empieza vacío); las calibraciones nuevas sí exigen el archivo.
- Los tipos de `database.types.ts` regenerados con `npm run db:types` tras aplicar 0027 coinciden con los escritos.
- **Equipos de ejemplo (D-63):** los cinco del 0B están en la nube solo para demostración (`npm run seed:remote -- --catalogos --confirmar`, con 12 avisos y 12 correos en cola). En la entrega se reemplazan por el inventario real de equipos de la empresa.
- El envío real de correos y el registro automático del «uso» desde la orden de producción llegan con D-37 y con F6.

## Corregido en la etapa

- Antes de aplicar 0027: concatenación de razones (`text[]`), bloqueo inicial del evento firmado, vigencia de la limpieza con la hora de referencia y límite exacto de 48 h.
- E2E del listado maestro (E3): la vigencia y el indicador de vencidos por proceso tenían valores fijos y fallaron el 31/10/2026 al vencer la revisión de IDI-EP-007 (30/10/2026); ahora se calculan con la fecha de ejecución.

## Comandos para reproducir

```bash
npm run ci
npm run test:db:pending        # antes de aplicar 0027
npm run test:db                # después de db:push
E2E_SEED_USERS=1 E2E_SEED_DOCS=1 npx playwright test e2e/equipos.spec.ts
```
