# Reporte de etapa E2 — Administración

**Fase del PRD:** F2 · **Rama:** `etapa/E2` · **Fecha:** 07/10/2026
**Estado:** construida; RF-03, RF-04, RF-06, RF-07, AC-11 y AC-36…41 aprobados en pgTAP; la matriz de la interfaz coincide con el PRD (prueba automática). **Pendiente:** aplicar la migración 0013 en la nube (con su confirmación), CI de las E2E de aprobación, revisión del responsable y aprobación para integrar a `main`.

## Puerta de salida

| #   | Condición                                                                        | Estado   | Evidencia                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RF-03, RF-04, RF-06 y AC-11 aprobados                                            | Cumplida | pgTAP 0008–0010 y E2E `e2e/admin.spec.ts` (local y CI)                                                                                                                    |
| 2   | La matriz de permisos de la interfaz coincide con la del PRD (prueba automática) | Cumplida | E2E «la matriz de permisos de S-04 coincide celda a celda con el PRD 2.2»: lee la tabla renderizada y la compara con la tabla Markdown del PRD (16 columnas × 19 módulos) |
| 3   | Reporte ETAPA-E2.md                                                              | Cumplida | Este documento                                                                                                                                                            |

CI: [ejecución 37726544747](https://github.com/estmarcardona-arch/qentragrcl/actions/runs/37726544747), commit `2f304fa`: Calidad ✅ · Integración (Supabase local, migraciones, semilla, pgTAP, build, E2E con clave administrativa) ✅.

## Qué se construyó

### Migraciones (aplicadas al proyecto de desarrollo y pruebas)

| Migración                    | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0008_areas_catalogs.sql`    | `organizational_areas`: sigla de proceso, árbol sin ciclos, jefe de área y una sola área dueña del SGD (GCA). Catálogos versionados (`version` sube en cada cambio) con bitácora y sin borrado: `catalog_items` (unidades, tipos de material, tipos de equipo, clasificación de desviaciones, motivos de corrección), `product_lines`, `regulatory_profiles` (PRD §10) con `regulatory_profile_snapshot`, `retention_rules` (RNF-05) y `brands` (bloqueadas si `maquila_enabled` = falso). Escritura solo con `admin_save_catalog` (lista blanca de tablas y columnas, motivo obligatorio) |
| `0009_admin_users.sql`       | `admin_list_users`, `admin_update_profile`, `admin_set_user_active` (nunca borrado), `admin_grant_role`, `admin_set_role_expiry`, `admin_revoke_role`, `admin_set_short_signature`, `admin_update_setting` (validación por clave). Auditor con vencimiento obligatorio. `role_incompatibilities` (D-18, SOD-7, SOD-9). Política de contraseñas: `check_password_policy`, `record_password_change` y historial en `app_private`. `get_my_context` con vencimiento de acceso y estado de la contraseña                                                                                       |
| `0010_permission_matrix.sql` | `permission_modules` y `module_permissions`, generadas desde el PRD con `scripts/gen-permission-matrix.ts`; de solo lectura. `has_module_permission(módulo, permiso)` para las políticas de las etapas siguientes                                                                                                                                                                                                                                                                                                                                                                          |
| `0011_sign_order.sql`        | Corrección de E1: `sign_record` valida registro, rol, orden y SOD antes de la contraseña. `practice_reauth` para la prueba en vivo                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Pantallas

| Pantalla                     | Contenido                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-03 `/admin/usuarios`       | Lista con roles (los vencidos tachados), área, estado (activo, invitación pendiente, inactivo), último ingreso y vencimiento del acceso; filtros por rol y estado; búsqueda                                                 |
| S-03 `/admin/usuarios/nuevo` | Alta por invitación: correo, nombre, cargo, área y roles con vigencia (la del auditor es obligatoria). Se valida la combinación de roles. Resultado: enlace de un solo uso (24 h) con «Enviar por correo» y «Copiar enlace» |
| S-03 `/admin/usuarios/[id]`  | Datos, roles (asignar, vigencia, revocar), firma corta, desactivar y reactivar, enlace de restablecimiento y bitácora del usuario. Todo cambio pide motivo                                                                  |
| S-04 `/admin/catalogos`      | Pestañas de áreas, líneas, perfiles regulatorios lado a lado, catálogos, retención, marcas y maquila, matriz de permisos (solo lectura) y configuración del sistema                                                         |
| `/auth/confirmar`            | Verifica el enlace de un solo uso y abre la sesión                                                                                                                                                                          |
| `/cuenta/contrasena`         | Crear o cambiar la contraseña con la política; obligatorio tras la invitación, el restablecimiento o la caducidad                                                                                                           |
| S-01                         | Mensaje de AC-11: «Su acceso venció el DD/MM/AAAA. Solicite una ampliación a Administración.»                                                                                                                               |

## Roles configurables (solicitud del responsable, 08/10/2026)

El responsable pidió poder **crear y eliminar roles** desde Catálogos y configuración, con permisos y restricciones claros. El PRD no lo contemplaba (los 15 roles eran fijos); se actualizó a la **versión 1.5** (sección 2.6, RF-07, AC-36…38, D-39, D-40) y se construyó:

| Pieza                                   | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migración `0012_configurable_roles.sql` | Los roles pasan del tipo enumerado `app_role` a la tabla `roles` (se recrearon las 7 funciones y 4 políticas que dependían del tipo). Roles del sistema protegidos; funciones reservadas (`admin`, `dt`); matriz editable solo para roles adicionales; RPC para crear, configurar, declarar incompatibilidades y retirar o reactivar; vencimiento obligatorio por rol; la lectura de la bitácora sale del permiso de «Trazabilidad / Auditoría» |
| S-04 «Roles y permisos»                 | Panel con lo que se puede configurar y las restricciones fijas; lista de roles (tipo, opciones, usuarios vigentes, estado, versión); crear rol; configuración por rol con la matriz L/C/F/A por módulo (funciones reservadas con candado), incompatibilidades, opciones y retiro                                                                                                                                                                |
| «Eliminar» = retirar                    | Nada se borra: un rol se retira solo si nadie lo tiene vigente; su historial se conserva y puede reactivarse                                                                                                                                                                                                                                                                                                                                    |
| Pruebas                                 | pgTAP `0012_configurable_roles` (24): RF-07, AC-36, AC-37, AC-38; E2E de creación, configuración, función reservada bloqueada, matriz con la columna nueva, retiro y rol del sistema en solo lectura                                                                                                                                                                                                                                            |

## Aprobación de cambios de rol (decisiones D-39 y D-40, 08/10/2026)

El responsable resolvió que **crear o cambiar un rol pasa por Aseguramiento de la calidad** (D-39) y que los **permisos de los 15 roles del sistema se pueden ajustar con doble aprobación**, dejando las funciones reservadas con candado (D-40). PRD actualizado a la **versión 1.6** (sección 2.6, RF-07, S-04B, AC-39…41, D-41).

| Elemento                                   | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migración `0013_role_change_approvals.sql` | Solicitudes (`role_change_requests`, `CR-AAAA-NNNN`) y aprobaciones de solo-agregar (`role_change_approvals`), con RLS, bitácora y escritura solo por RPC. `admin_request_role_change` valida el cambio completo (lo aplica y lo revierte) y guarda el antes; `decide_role_change` aprueba o rechaza con contraseña y aplica el cambio al reunir las aprobaciones, en la misma transacción; `admin_cancel_role_change`; `get_role_change_requests`. Rol adicional: `aq_dir`. Rol del sistema: `aq_dir` + `dt`, personas distintas. Quien solicita no aprueba. Una solicitud pendiente por rol. Candado: el dueño de una función reservada no la pierde. Línea base del PRD por celda (`prd_cell_text`). Las RPC de cambio directo de 0012 se eliminan |
| Pantallas                                  | Bandeja **Cambios de roles** (`/cambios-roles`, menú de `admin`, `aq_dir`, `dt` y `auditor`) con antes/después y aprobaciones; solicitudes pendientes en «Roles y permisos» y en cada rol; los roles del sistema permiten proponer permisos; S-04 marca con «*» las celdas ajustadas y muestra su base del PRD                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Pruebas                                    | pgTAP `0012` reescrita al flujo con aprobación (31) y `0013_role_change_approvals` (24): RF-07, AC-39, AC-40, AC-41. E2E: rol adicional aprobado por Calidad (crear, permisos, retiro) y rol del sistema con doble aprobación y regreso a la línea base                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Resultados de pruebas

| Prueba                                                | Requisito                                              | Resultado                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| pgTAP `0008_areas_catalogs` (26)                      | RF-04, RF-06, RLS de cada catálogo                     | Aprobado                                                                                                                     |
| pgTAP `0009_admin_users` (27)                         | RF-03, AC-11, D-18, SOD-7, SOD-9, contraseñas          | Aprobado                                                                                                                     |
| pgTAP `0010_permission_matrix` (8)                    | RF-04                                                  | Aprobado                                                                                                                     |
| pgTAP `0011_sign_order` (7)                           | DI-2 (corrección)                                      | Aprobado                                                                                                                     |
| pgTAP total (0000–0011)                               |                                                        | **183/183** en la nube y en la CI                                                                                            |
| Vitest (49 casos en 13 archivos)                      | RF-04 (lectura del PRD), RF-01, RF-02, AG-05           | Aprobado                                                                                                                     |
| Playwright + axe (48 casos: 24 × escritorio y tablet) | RF-03, RF-04, RF-06, AC-11, RF-01, RF-02, DI-2, RNF-01 | Aprobado en la CI; en local contra la nube: 42 aprobados, 6 omitidos (hook, clave administrativa y acceso directo a la base) |
| Matriz requisito→prueba (12 requisitos hasta E2)      | PRD §14                                                | Aprobado                                                                                                                     |

### E2E de la etapa (CI)

- Un usuario sin rol de administrador ve «Sin permiso» en Administración.
- El administrador lista y filtra por rol.
- **Alta por invitación:**
  - el administrador crea la invitación;
  - la persona abre el enlace y la política rechaza una contraseña de 5 caracteres;
  - con una válida entra a su panel;
  - el mismo enlace usado otra vez se rechaza.
- **Baja:** el usuario desactivado no entra; se reactiva.
- **AC-11:** el auditor vencido no entra y ve la fecha de vencimiento.
- **Matriz de S-04 = PRD 2.2**, celda a celda.
- Alta y edición de una unidad: versión v1 → v2, motivo y desactivación.
- GCA es el área dueña del SGD.
- Perfiles regulatorios lado a lado.

## Decisiones tomadas

- **Organigrama de ejemplo (D-06):** Dirección general → Dirección técnica (CC, PRD, IDI, MTO), Aseguramiento de la calidad (GCA), Administrativa (ADM, TH, GLG) y Comercial. Editable en S-04.
- **D-09:** contraseña por defecto; `reauth_method` configurable en S-04 (`password` o `password_mfa`).
- **D-18:** master y admin son roles separados; la base impide asignarlos a la misma persona. Por coherencia también se impiden admin + roles que firman calidad (SOD-7) y master o aq_doc + roles de ejecución (SOD-9).
- **Invitación:** Supabase en la nube no envía correos a terceros sin un SMTP propio. El enlace de un solo uso lo genera el servidor y el administrador lo envía desde su correo («Enviar por correo» abre el mensaje redactado) o lo copia (D-37).
- **Contraseñas:**
  - mínimo 12 caracteres (encargo);
  - no reutilizar la actual ni las 5 anteriores;
  - caducidad configurable, 0 = sin caducidad por defecto (D-35).
  - **Limitación:** el historial se aplica en la app; un cambio hecho directamente contra la API de Auth no pasa por él.
- **Clave administrativa:** solo en `src/lib/db/admin.ts` (solo servidor), para generar enlaces y bloquear en Auth a los usuarios desactivados. La prueba AG-05 la permite únicamente en ese archivo.
- **Catálogos:** una sola RPC con lista blanca, en lugar de escritura directa, para exigir motivo y dejar la bitácora completa.

## Correcciones durante la etapa

- `sign_record` reiniciaba mal el contador de intentos cuando la firma fallaba por otra causa. Corregido en 0011 y probado; se reiniciaron los contadores afectados en la base de pruebas, con motivo en la bitácora.
- Error de prerender de Cache Components (`Date.now()` durante el prerender) en todas las rutas con sesión: corregido con `connection()` en la lectura de sesión y en el cliente de servidor.
- Invitación en la CI: área nula explícita, clave `service_role` en formato JWT para la API administrativa, cookies de sesión escritas en la redirección y `/auth` como ruta pública.

## Deuda técnica y notas

- Rúbrica en imagen en el registro de firmas: pendiente de Storage (D-38).
- El envío automático de correos depende de un SMTP corporativo (D-37).
- Pestaña de proveedores de maquila (Prompt 2): la tabla `external_parties` es de E4.
- Los menús de los roles del sistema siguen la tabla fija del PRD; un permiso ajustado con doble aprobación cambia `has_module_permission`, pero no agrega secciones al menú (las secciones se habilitan en sus etapas).
- En la nube faltan tres ajustes del panel de Supabase (`docs/ENTORNOS.md`): longitud mínima 12, vencimiento de enlaces 24 h y registro público desactivado.
- Para usar el alta y el restablecimiento en local y en Vercel hace falta `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).

## Preguntas abiertas

- Nuevas: D-36 (motivos de corrección), D-37 (SMTP corporativo) y D-38 (rúbrica en imagen).
- Actualizadas: D-06, D-18, D-34 y D-35.
- Resueltas el 08/10/2026: D-39 y D-40. Nueva: D-41 (quiénes dan la doble aprobación y numeración de solicitudes).

## Comandos para reproducir

```bash
git checkout etapa/E2 && npm ci
npm run ci                   # prettier, lint, tsc, vitest, matriz, versiones, build
npm run test:db              # pgTAP contra el proyecto de .env.local (183 pruebas)
E2E_SEED_USERS=1 npm run test:e2e
# Alta por invitación en local: agregar SUPABASE_SERVICE_ROLE_KEY a .env.local y E2E_ADMIN_API=1
npx tsx scripts/gen-permission-matrix.ts   # regenera el bloque de la matriz desde el PRD (para una migración nueva)
```
