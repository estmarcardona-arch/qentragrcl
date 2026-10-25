# Reporte de etapa E5B — Maestro de materiales y productos

**Fase del PRD:** F4B (nueva en el PRD 1.9, por solicitud del responsable del 25/10/2026; clave E4B en la matriz) · **Rama:** `etapa/E5B` · **Fecha:** 25/10/2026
**Estado:** **lista para aprobación del responsable.** Migración 0026 aplicada en la nube; pgTAP 26 de 26 en la nube; CI en verde ([ejecución 40147987886](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/40147987886)).

## Por qué existe esta etapa

El responsable pidió que todo lo que se inventaría (materias primas, envases, empaques y productos terminados) se cree antes con su código y su forma de almacenamiento, que la recepción técnica deje todo en cuarentena con un rótulo **imprimible y descargable**, y que los materiales sean trazables de I+D a producto terminado. El PRD 1.8 tenía la tabla `materials` y la recepción (RF-20), pero **no** un maestro ni pantalla para crearlo, ni el rótulo en PDF. Se agregó al PRD 1.9: RF-26, S-50, fase F4B, fila nueva de la matriz 2.2, RF-20 ampliado, AC-42 y AC-43.

Decisiones del responsable: el maestro lo mantienen **I+D, el jefe de bodega y Aseguramiento de la calidad** (con motivo y bitácora; nada se borra, se inactiva); cada ítem registra **condiciones de almacenamiento** y **vida útil o reanálisis**; la recepción registra **orden de compra** y **unidades de empaque** (p. ej. 2 cajas × 100 plegadizas).

## Puerta de salida

| #   | Condición                                                          | Estado   | Evidencia                                                     |
| --- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| 1   | RF-26, AC-42 y AC-43 con prueba; RF-20 (v1.9) con prueba           | Cumplida | Matriz: 70 requisitos con prueba hasta F4B                    |
| 2   | Crear ítem → recibir con empaques y OC → cuarentena → rótulo y PDF | Cumplida | `e2e/maestros.spec.ts`: aprobado contra la nube               |
| 3   | El ciclo de E5 sigue funcionando con la recepción ampliada         | Cumplida | `e2e/bodega.spec.ts` (ciclo completo) aprobado contra la nube |
| 4   | Reporte ETAPA-E5B.md                                               | Cumplida | Este documento                                                |

## Qué se construyó

| Pieza                   | Contenido                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0026_item_master.sql`  | Fila «Maestro de materiales y productos» en la matriz (C: idi, bodega_jefe, aq_dir). Campos del maestro (almacenamiento, vida útil o reanálisis, empaque de compra) y de la recepción (orden de compra, empaques). RPC `save_material`, `save_product`, `save_presentation` (motivo, unidad del catálogo, código único e inmutable tras su uso). `receive_lot` con AC-42 y AC-43 |
| S-50 `/bodega/maestros` | Pestañas Materias primas, Envase, Empaque y Productos terminados; buscar; existencias por ítem; crear y editar con motivo; inactivar; presentaciones del producto; **dónde se usa** (prototipos, fórmulas, especificaciones e instructivos de I+D y lotes en bodega). Acceso desde Bodega y desde I+D                                                                            |
| S-11 recepción técnica  | Botón «Ingreso a bodega (recepción técnica)» en Inventario; solo ítems activos; orden de compra; empaques con cantidad calculada; vencimiento sugerido por la vida útil; condiciones de almacenamiento a la vista; plantilla CSV con las columnas nuevas                                                                                                                         |
| S-14 rótulo             | Condiciones de almacenamiento, empaques y orden de compra; **PDF descargable** de 10 × 7 cm con QR (`/bodega/rotulos/[id]/pdf`), que registra quién lo genera                                                                                                                                                                                                                    |

## Resultados de pruebas

| Prueba                           | Requisito                           | Resultado                                 |
| -------------------------------- | ----------------------------------- | ----------------------------------------- |
| pgTAP `0026_item_master` (19)    | RF-26, RF-20, AC-42, AC-43          | Aprobado en la nube                       |
| pgTAP total (0000–0026)          |                                     | 26 de 26 archivos aprobados en la nube    |
| Vitest (53)                      | RF-02, RF-04 (matriz de 21 módulos) | Aprobado                                  |
| E2E `e2e/maestros.spec.ts`       | RF-20, RF-26, AC-43                 | Aprobado contra la nube y en la CI        |
| E2E `e2e/bodega.spec.ts` (ciclo) | RF-20…RF-25                         | Aprobado contra la nube (sin regresiones) |

## Trazabilidad de I+D a producto terminado

- **Hoy:** el código del maestro une I+D (prototipos, fórmulas, especificaciones, instructivos) con bodega (lotes, kardex, traslados). «Dónde se usa» lo muestra en cada ítem y producto.
- **Siguiente:** la dispensación de lotes de insumo a una orden de producción y la transformación en granel y producto terminado llegan con Producción (F6, RF-30…39; `dispensing_line_lots`, lotes de producto). La consulta completa hacia atrás y hacia adelante es Trazabilidad (F10, RF-70). «Dónde se usa» quedó listo para mostrar esos eslabones.

## Supuestos (PREGUNTAS_ABIERTAS.md)

- **D-55:** S-50 no tiene diseño en `docs/diseno`; se construyó con el sistema de diseño del Prompt 0.
- **D-56:** la fecha de recepción es la hora del servidor (regla 6 de AGENTS.md) y se imprime en el rótulo; una fecha de llegada física distinta se agregaría como dato aparte.
- **D-57:** la vida útil del maestro solo sugiere la fecha; manda la del proveedor.

## Corregido en la etapa

- Error 500 en «Nuevo ítem»: una constante exportada desde un componente de cliente se usaba en el servidor.

## Comandos para reproducir

```bash
npm run ci
npm run test:db
E2E_SEED_USERS=1 E2E_SEED_DOCS=1 npx playwright test e2e/maestros.spec.ts --project=escritorio
```
