# Entornos

Decisión vigente (D-02, parcial): **Supabase en la nube + Vercel** para el entorno de pruebas. Producción no se despliega hasta que el responsable confirme proveedor y residencia de datos (D-02) y apruebe explícitamente (AGENTS.md regla 14).

|            | Local                                                                                            | Pruebas (staging)                                                                       | Producción                        |
| ---------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------- |
| Para qué   | Desarrollo y pruebas del agente                                                                  | Revisión del responsable, demo, piloto en paralelo                                      | Uso real (después de F11)         |
| App        | `npm run dev` en el equipo                                                                       | Vercel (proyecto conectado a GitHub)                                                    | Por decidir (D-02)                |
| Base       | Proyecto Supabase de desarrollo (nube) vía `.env.local`; opcional `supabase start` si hay Docker | **El mismo proyecto Supabase de desarrollo** mientras no exista uno separado (ver nota) | Proyecto Supabase propio, aislado |
| Datos      | Solo ficticios (Prompt 0B)                                                                       | Solo ficticios (Prompt 0B)                                                              | Reales                            |
| `/_design` | Activa                                                                                           | Activa con `ENABLE_DESIGN_PAGE=true`                                                    | Desactivada                       |
| CI         | —                                                                                                | GitHub Actions: base efímera en el runner, no toca la nube                              | —                                 |

> Nota: hoy hay un solo proyecto Supabase en la nube y cumple el papel de desarrollo + pruebas. Cuando el piloto lo requiera se creará un proyecto de pruebas separado y esta tabla se actualizará.

## Variables de entorno por entorno

| Variable                               | Local (`.env.local`)                  | Pruebas (Vercel → Settings → Environment Variables) | Producción     | Pública |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------- | -------------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Sí                                    | Sí                                                  | Sí             | Sí      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí                                    | Sí                                                  | Sí             | Sí      |
| `ENABLE_DESIGN_PAGE`                   | No (activa por defecto en desarrollo) | `true`                                              | **No definir** | No      |
| `SUPABASE_PROJECT_REF`                 | Sí (tipos)                            | No                                                  | No             | No      |
| `SUPABASE_ACCESS_TOKEN`                | Sí (tipos)                            | No                                                  | No             | No      |
| `SUPABASE_DB_URL`                      | Sí (migraciones y pgTAP)              | **No** (la app no se conecta directo a Postgres)    | **No**         | No      |

La clave `service_role` no se usa en ningún entorno en E0. Ninguna variable con valor real se sube al repositorio.

## Promoción de migraciones

1. **Local:** se escribe `supabase/migrations/NNNN_*.sql` y su prueba pgTAP.
2. **CI (cada push y PR):** `supabase start` en el runner aplica todas las migraciones sobre una base vacía y corre pgTAP. Si falla, no se integra.
3. **Pruebas:** con CI en verde, el agente ejecuta `npm run db:push` contra el proyecto de pruebas (la CLI muestra las migraciones pendientes y pide confirmación) y luego `npm run test:db`.
4. **Producción:** mismo procedimiento con `SUPABASE_DB_URL` de producción, solo con aprobación explícita del responsable, después de un respaldo (RNF-04) y con registro en el control de cambios.

Nunca se edita una migración aplicada; nunca se usa `supabase db reset` contra un proyecto en la nube.

## Despliegue de la app (pruebas)

Vercel construye cada push. Los despliegues están protegidos con «Vercel Authentication»; el agente los verifica con el encabezado `x-vercel-protection-bypass` y el secreto de `.env.local`.

En el proyecto de Vercel actual, el entorno que Vercel llama «Production» (despliegue de `main`) es el **entorno de pruebas**; la producción real será otro proyecto (D-02).

Las ramas `etapa/*` generan despliegues de vista previa; `main` es el despliegue de pruebas principal. Verificación después de cada despliegue: `GET /api/health` → `200 {"status":"ok","database":"ok"}`.

## Usuarios de prueba en el entorno de pruebas

Con autorización del responsable (07/10/2026) se cargaron en el proyecto de la nube los 15 usuarios ficticios del Prompt 0B (`npm run seed:remote -- --confirmar`), con correos `@grufarcol.test` y la contraseña de desarrollo de `supabase/seed.sql`. Sirven para revisar pantallas; **nunca** deben existir en producción. El bloqueo de cuenta tras intentos fallidos no está activo en la nube (D-32, opción A).
