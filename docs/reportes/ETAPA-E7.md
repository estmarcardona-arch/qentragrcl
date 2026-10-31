# Reporte de etapa E7 — Producción

**Fase del PRD:** F6 (clave E6 en la matriz, D-44) · **Rama:** `etapa/E7` · **Fecha:** 31/10/2026
**Estado:** **lista para aprobación del responsable.** Migraciones 0029 y 0030 aplicadas en la nube el 31/10/2026; pgTAP 29 de 29 en la nube; CI en verde con el lote completo en pantalla ([ejecución 41242355267](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/41242355267)).

## Puerta de salida

| #   | Condición                                                                   | Estado   | Evidencia                                                                                 |
| --- | --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 1   | El lote de ejemplo se ejecuta de punta a punta en pantalla                  | Cumplida | `e2e/produccion.spec.ts`: aprobado en la CI de GitHub                                     |
| 2   | Los números coinciden con el 0B                                             | Cumplida | pgTAP 0029: 60,00 kg de glicerina, 100,2 %, 98,2 %, 97,5 %; la E2E repite 98,6 % y 98,0 % |
| 3   | AC-03, 04, 05, 07, 14, 19, 25, 35 e intentos de violación de SOD con prueba | Cumplida | pgTAP 0029 (todos); E2E: AC-03, 04, 05, 07, 14, SOD-4 y aviso de capacitación             |
| 4   | Reporte ETAPA-E7.md                                                         | Cumplida | Este documento                                                                            |

## Qué se construyó

| Pieza                       | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0029_production_orders`    | Numeración `OP-AAAA-NNNN` (D-11) y lote `L-AAMM-NNN` (D-65). `create_production_order` valida fórmula, especificación de producto terminado, instructivo de fabricación y formatos vigentes de las etapas y los congela (AC-07, AC-19; las revisiones vencidas avisan). `approve_production_order`: firma del Director técnico, nunca de quien creó la orden (D-12); genera 4 órdenes de etapa (SD, OF, OE, OA; D-69), solicitudes SD/SE/SA con sus rótulos y la orden de codificado (AC-14). `presentation_materials` (D-68), configuración del control en proceso (D-08, D-66, D-67) y del rendimiento de PT (≥ 97 %)                                    |
| `0030_production_execution` | Despeje (`CLEARANCE_MISSING`), limpieza enlazada con la hoja de vida del equipo, `start_stage`, dispensación multi-lote con descuento por ubicación (`LOT_NOT_APPROVED`, `LOT_EXPIRED`, `INSUFFICIENT_STOCK`, `EQUIPMENT_NOT_VALID`), verificaciones con SOD, `complete_step` (orden de los pasos, equipos válidos, rangos, uso en la hoja de vida, `TRAINING_REQUIRED`), control de peso, rendimientos, granel con rótulo, inspección de 9 puntos, devolución, codificado, `complete_stage` con lo que falta listado, borradores por campo y aviso de correcciones (AC-35). La contraseña se verifica antes de escribir: un intento fallido queda contado |
| Pantallas                   | S-16 tablero con lote activo y línea de proceso; S-15 crear orden con las versiones que se congelan y el bloqueo; S-38 documentos de la orden, aprobación y PDF; S-17 despeje; S-39 limpieza con bloqueo de equipo no apto; S-18 dispensación (FEFO, lotes y balanzas no disponibles visibles con su motivo, suma en vivo); S-19/S-20/S-21 registros con asistente por pasos, sello del formato y aviso de capacitación, control de peso con tabla, gráfica y próximo control, rendimiento, inspección y devolución. Botones grandes (tablet) y cola local de borradores con reintento                                                                     |
| Semilla 0B                  | OP-2026-0042 / L-2610-018 aprobada el 04/10/2026, dispensación completa (glicerina 40,00 + 20,00 kg; BAL-014; Diego y Paola) y fabricación en el paso 6 de 11; OP-2026-0043 / L-2610-019 en borrador; lotes ilustrativos (D-70)                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Resultados de pruebas

| Prueba                       | Requisito                                                             | Resultado                                   |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| pgTAP `0029_production` (55) | RF-30…39, AC-03, 04, 05, 07, 14, 19, 25, 35, SOD-1, SOD-4, D-12, DI-3 | Aprobado en la nube                         |
| pgTAP total (0000–0030)      |                                                                       | 29 de 29 archivos aprobados                 |
| Semilla completa             |                                                                       | Validada en transacción (E3…E7 sin errores) |
| Vitest (53)                  | RF-02 (menú con Producción)                                           | Aprobado                                    |
| `npm run ci` (local)         |                                                                       | Aprobado                                    |
| E2E `e2e/produccion.spec.ts` | Lote completo del 0B                                                  | Aprobado en la CI de GitHub                 |

## Supuestos (PREGUNTAS_ABIERTAS.md)

D-65 (código de lote), D-66 (rango del peso neto ± 1,5 %), D-67 (tolerancia de dispensación 0 %), D-68 (materiales por presentación), D-69 (dispensación como orden de etapa; dispensación y acondicionamiento sin formato en la semilla), D-70 (lotes ilustrativos), D-71 (fuera de rango y rendimientos hasta F8; quién verifica).

## Deuda técnica y notas

- Fuera de rango y rendimientos fuera de límites quedan marcados y bloquean el cierre de la etapa hasta que Desviaciones (F8) permita vincular la desviación.
- El material de envase y de acondicionamiento no se descuenta todavía del inventario (D-68).
- La regla de capacitación está en «avisar» (D-19): la pantalla muestra el aviso; con «bloquear» el paso se rechaza (AC-25, probado en pgTAP).
- La nube no tiene los documentos maestros de la semilla (solo catálogos): Producción solo se puede recorrer completo con la semilla de la CI o cargando los documentos reales de la empresa.

## Corregido en la etapa

- Los formularios con estado (agregar lote, paso actual, inspección, rendimiento, control de peso) se reinician al cambiar de pesada, paso o presentación; antes conservaban el lote agotado o los datos de otra presentación.
- Las acciones firmadas y «Iniciar etapa» marcan `data-ready` al ser interactivas; la E2E espera esa marca, la carga por partes de la página y el resultado de cada firma antes de seguir.
- La E2E de producción usa sus propios lotes de insumo: no altera los saldos de la semilla que verifica la E2E de bodega.

## Comandos para reproducir

```bash
npm run ci
npm run test:db:pending        # antes de aplicar 0029 y 0030
E2E_SEED_USERS=1 E2E_SEED_DOCS=1 E2E_DB_URL=... npx playwright test e2e/produccion.spec.ts --project=escritorio
```
