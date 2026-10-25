# Reporte de etapa E5 — Bodega y calidad de insumos

**Fase del PRD:** F4 (el responsable la nombra E5; en la matriz de trazabilidad conserva la clave E4, ver D-44) · **Rama:** `etapa/E5` · **Fecha:** 24/10/2026
**Estado:** **lista para aprobación del responsable.** Migraciones 0023–0025 aplicadas en la nube; pgTAP 25 de 25 en la nube; CI en verde ([ejecución 40144550302](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/40144550302)).

## Puerta de salida

| #   | Condición                                                                | Estado   | Evidencia                                                                                                                    |
| --- | ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | RF-20…RF-25, AC-21, AC-22, AC-24, AC-27 con prueba                       | Cumplida | Matriz: 67 requisitos con prueba hasta F4                                                                                    |
| 2   | El inventario del 0B se carga por semilla y cuadra con la pantalla       | Cumplida | 9 bodegas, 8 con estructura y 276 ubicaciones (D-50); E2E «las bodegas y ubicaciones del 0B cuadran» y «kardex de glicerina» |
| 3   | pgTAP de saldo, compatibilidad de ubicaciones y traslados (TR-2026-0007) | Cumplida | pgTAP 0023 (19), 0024 (37) y 0025 (21); 0025 verifica TR-2026-0007 cuando la semilla está cargada                            |
| 4   | Playwright recepción → liberación → traslado                             | Cumplida | `e2e/bodega.spec.ts`: aprobado localmente contra la nube y en la CI                                                          |
| 5   | Reporte ETAPA-E5.md                                                      | Cumplida | Este documento                                                                                                               |

## Qué se construyó

### Migraciones (aplicadas al proyecto de desarrollo: 0023, 0024 y 0025)

| Migración                          | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0023_warehouses.sql`              | `external_parties` (calificación con vencimiento, D-17), `warehouses` (función, interna o externa, prefijo, bajo llave, estado con aprobación D-20), `warehouse_allowed_types`, `racks` (pisos, posiciones, zona D-16), `storage_locations` (código PREFIJO-Eee-Pp-nn, bloqueo con motivo). RPC: `save_external_party`, `qualify_external_party`, `create_warehouse`, `generate_locations`, `decide_external_warehouse`, `set_rack_zone`, `set_location_blocked`, `party_is_qualified` |
| `0024_material_lots_inventory.sql` | `material_lots`, `lot_status_history`, `lot_tests`, `inventory_movements` (inmutable), `stock_by_location` (trigger; nunca negativo), `labels`; vistas `v_lot_stock` (saldo, en tránsito, vencido y agotado derivados) y `v_location_status`. RPC: `receive_material_lot`, `suggest_locations`, `import_material_receipts`, `relocate_lot`, `adjust_lot`, `record_lot_results`, `release_material_lot`, `log_label_print`, `assert_lot_available`                                      |
| `0025_stock_transfers.sql`         | `stock_transfers` (`TR-AAAA-NNNN`), `stock_transfer_lines` (bloqueadas tras el despacho). RPC: `save_transfer_draft`, `dispatch_transfer` (dos firmas, personas distintas), `receive_transfer` (acta y ubicación), `cancel_transfer`                                                                                                                                                                                                                                                   |

Todas las tablas nuevas: RLS por permiso de módulo (matriz 2.2), bitácora y sin borrado; escritura solo por RPC.

### Pantallas (Prompt 4 y 4B)

| Pantalla                   | Ruta                                                                                                         | Contenido                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-11 Recepción             | `/bodega/recepcion`                                                                                          | Formulario con ubicaciones sugeridas, lista de verificación, «Se recibirá en CUARENTENA», errores por campo e importación CSV con plantilla                                                                                                  |
| S-14 Rótulo                | `/bodega/rotulos/[id]`                                                                                       | Rótulo 10 × 7 cm: estado en grande con ícono, UBICACIÓN, código interno, QR; impresión del navegador y registro de quién imprime                                                                                                             |
| S-12 Inventario y kardex   | `/bodega/inventario`, `/bodega/inventario/[id]`                                                              | FEFO, filtros por estado, alertas 30/60/90 días y vencidos, localizador «¿Dónde está este lote?»; kardex con saldo acumulado, resultados, historia, traslado interno y ajuste                                                                |
| S-13 Liberación de insumos | `/calidad/insumos`                                                                                           | Bandeja de cuarentena, resultados por el laboratorio, bloqueo GMP con regla y acción, aprobar («Liberé») o rechazar con motivo, aviso SOD-5 y resueltos recientemente                                                                        |
| S-41 Bodegas y ubicaciones | `/bodega/estructura`, `/bodega/estructura/nueva`, `/bodega/estructura/[code]`, `/bodega/estructura/terceros` | Tarjetas con función, sitio, estructura y ocupación; nueva bodega con vista previa; mapa estantes × pisos con Libre/Ocupada/Bloqueada y zona de cuarentena; externa con calificación y en tránsito; aprobación D-20; terceros y calificación |
| S-42 Traslados             | `/bodega/traslados`, `/bodega/traslados/nuevo`, `/bodega/traslados/[id]`                                     | Lista con «Solo externos», formulario con bloqueos (cuarentena, destino sin calificación), línea de tiempo con sellos, remisión PDF, despacho, aprobación y recepción                                                                        |

## Resultados de pruebas

| Prueba                                    | Requisito                                           | Resultado                                     |
| ----------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| pgTAP `0023_warehouses` (19)              | RF-23, AC-27, D-17, D-20                            | Aprobado en la nube                           |
| pgTAP `0024_material_lots_inventory` (37) | RF-20…RF-22, RF-24; AC-03, AC-21, AC-22; D-03, D-16 | Aprobado en la nube                           |
| pgTAP `0025_stock_transfers` (21)         | RF-25, AC-24, TR-2026-0007                          | Aprobado en la nube                           |
| pgTAP total (0000–0025)                   |                                                     | 25 de 25 archivos aprobados en la nube        |
| Vitest (53)                               | RF-02 (menú), RNF-01                                | Aprobado                                      |
| E2E `e2e/bodega.spec.ts` · ciclo completo | RF-20…RF-25, AC-21, AC-24                           | Aprobado localmente contra la nube y en la CI |
| E2E `e2e/bodega.spec.ts` · semilla 0B     | RF-21, RF-23, RF-25, AC-27                          | Aprobado en la CI                             |
| Matriz requisito→prueba                   | 67 requisitos hasta F4                              | Aprobado                                      |

### Cada AC

| AC                                                                       | Resultado | Dónde                                                            |
| ------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------- |
| AC-21 Material de envase en una ubicación de producto terminado          | Aprobado  | pgTAP 0024; E2E (recepción)                                      |
| AC-22 Lote rechazado a una ubicación de materias primas aprobadas        | Aprobado  | pgTAP 0024                                                       |
| AC-24 Despacho a bodega externa con tercero vencido                      | Aprobado  | pgTAP 0025; E2E (bloqueo en el formulario)                       |
| AC-27 6 × 4 × 2 = 48 ubicaciones únicas                                  | Aprobado  | pgTAP 0023; E2E (BOD-MP)                                         |
| AC-03 (preparado) Lote en cuarentena no se dispensa (`LOT_NOT_APPROVED`) | Aprobado  | pgTAP 0024 (`assert_lot_available`); la dispensación llega en F6 |
| Saldo de inventario = suma de movimientos y nunca negativo               | Aprobado  | pgTAP 0024                                                       |

## Supuestos (decisiones por defecto, marcadas en PREGUNTAS_ABIERTAS.md)

- **D-03:** sin ERP; importación CSV de recepciones (todas o ninguna; cada lote en cuarentena).
- **D-10:** impresión del navegador, rótulo 10 × 7 cm con QR.
- **D-16:** rechazado solo a la bodega de rechazo; zonas de cuarentena y aprobados por estante; las sugerencias no proponen rechazo ni devolución.
- **D-17:** solo existencias, traslados y recepción; `aq_dir` califica al tercero con vencimiento y referencia.
- **D-20:** `aq_dir` aprueba las bodegas externas con firma.
- **Nuevas:** D-50 (9 bodegas en la semilla), D-51 (códigos ME- y EM-), D-52 (pruebas de liberación: especificación vigente o CoA), D-53 (vencido y agotado derivados), D-54 (ocupación de ejemplo del 0B).

## Datos en la nube

- Cargados con autorización del responsable (24/10/2026): terceros y estructura de las 9 bodegas (276 ubicaciones), sin lotes. Las pruebas locales dejaron un lote de envase y un traslado de prueba (`ENV-E2E-…`) recibidos en BOD-EXT-01.
- Los lotes del Prompt 0B (glicerina, fenoxietanol, perfume, ácido cítrico, ENV-2510-A) y TR-2026-0007 solo están en la base de la CI.

## Deuda técnica y notas

- El adjunto del CoA y del acta de recepción se registran como referencia: el archivo se habilita con el almacenamiento (D-38).
- Las devoluciones de material a la bodega de devolución llegan con la producción (F6, RF-36).
- No hay importación de saldos aprobados: todo lote importado pasa por la liberación de Control de calidad (GxP).
- La vista de mapa se consulta desde «Bodegas y ubicaciones»; el inventario enlaza a cada lote y su ubicación.

## Comandos para reproducir

```bash
npm run ci                      # prettier, lint, tsc, Vitest, matriz, versiones y build
npm run test:db                 # pgTAP contra la nube
E2E_SEED_USERS=1 E2E_SEED_DOCS=1 npx playwright test e2e/bodega.spec.ts --project=escritorio   # semilla completa (CI)
npm run seed:remote -- --catalogos --confirmar   # catálogos de la nube (idempotente)
```
