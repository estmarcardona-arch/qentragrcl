import "server-only";

import { hasAnyRole } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { callRpc } from "@/lib/rpc";
import type { DocTab } from "@/components/documents/documents-tabs";

// Acceso al SGD según la matriz 2.2: leen todos los roles con permiso en «Sistema de gestión
// documental» o «Lectura y capacitación» (no el administrador del sistema).
export async function getDocAccess() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const canRead = Boolean(await callRpc(supabase, "can_read_documents").catch(() => false));
  const roles = ctx.roles;
  return {
    ctx,
    supabase,
    canRead,
    isAqDoc: hasAnyRole(roles, ["aq_doc"]),
    isAqDir: hasAnyRole(roles, ["aq_dir"]),
    /** Vista completa del listado maestro (Prompt 2C, S-44a); los demás ven los vigentes. */
    fullView: hasAnyRole(roles, ["aq_doc", "aq_dir", "dt", "gerencia", "master", "auditor"]),
    canAuthor: !hasAnyRole(roles, ["auditor"]) || roles.length > 1,
    canEditTemplates: hasAnyRole(roles, ["master", "aq_doc"]),
    canSeeTemplates: hasAnyRole(roles, [
      "master",
      "aq_doc",
      "aq_dir",
      "dt",
      "idi",
      "prod_aux",
      "prod_coord",
      "cc_jefe",
      "gerencia",
      "auditor",
    ]),
  };
}

export function docTabs(a: Awaited<ReturnType<typeof getDocAccess>>): DocTab[] {
  const tabs: DocTab[] = [
    { href: "/documentos", label: "Listado maestro", match: ["/documentos"], exact: true },
  ];
  if (a.canAuthor)
    tabs.push({
      href: "/documentos/nuevo",
      label: "Solicitar documento",
      match: ["/documentos/nuevo"],
    });
  if (a.isAqDoc)
    tabs.push({
      href: "/documentos/estandarizacion",
      label: "Estandarización",
      match: ["/documentos/estandarizacion"],
    });
  tabs.push({
    href: "/documentos/cambios",
    label: "Cambios y anulaciones",
    match: ["/documentos/cambios"],
  });
  tabs.push({
    href: "/documentos/capacitacion",
    label: "Capacitación",
    match: ["/documentos/capacitacion"],
  });
  if (a.canSeeTemplates)
    tabs.push({
      href: "/master/plantillas",
      label: "Plantillas de proceso",
      match: ["/master/plantillas"],
    });
  return tabs;
}
