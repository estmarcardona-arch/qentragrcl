import "server-only";

import type { RdAccess } from "./access";

// Documentos maestros (FM, EP, IN) sobre el SGD: la versión es la del documento controlado o de su solicitud.
export type MasterType = "FM" | "EP" | "IN";

export type MasterVersion = {
  versionId: string;
  documentId: string | null;
  code: string;
  title: string;
  versionNo: number;
  status: string;
  authorId: string;
  lockedAt: string | null;
  updatedAt: string;
};

const SELECT =
  "id, status, version_no, author_id, document_id, locked_at, updated_at, controlled_documents!document_versions_document_id_fkey(code, title, type_id), document_requests(code, proposed_title, type_id)";

type Row = {
  id: string;
  status: string;
  version_no: number;
  author_id: string;
  document_id: string | null;
  locked_at: string | null;
  updated_at: string;
  controlled_documents: { code: string; title: string; type_id: string } | null;
  document_requests: { code: string; proposed_title: string; type_id: string } | null;
};

function map(r: Row): MasterVersion {
  return {
    versionId: r.id,
    documentId: r.document_id,
    code: r.controlled_documents?.code ?? r.document_requests?.code ?? "—",
    title: r.controlled_documents?.title ?? r.document_requests?.proposed_title ?? "",
    versionNo: r.version_no,
    status: r.status,
    authorId: r.author_id,
    lockedAt: r.locked_at,
    updatedAt: r.updated_at,
  };
}

export async function loadMasterVersions(a: RdAccess, type: MasterType): Promise<MasterVersion[]> {
  const { data: t } = await a.supabase
    .from("document_types")
    .select("id")
    .eq("type_code", type)
    .maybeSingle();
  if (!t) return [];
  const { data } = await a.supabase
    .from("document_versions")
    .select(SELECT)
    .neq("status", "obsoleto")
    .order("updated_at", { ascending: false });
  return ((data ?? []) as unknown as Row[])
    .filter((r) => (r.controlled_documents?.type_id ?? r.document_requests?.type_id) === t.id)
    .map(map);
}

export async function loadMasterVersion(
  a: RdAccess,
  versionId: string,
): Promise<(MasterVersion & { editable: boolean }) | null> {
  const { data } = await a.supabase
    .from("document_versions")
    .select(SELECT)
    .eq("id", versionId)
    .maybeSingle();
  if (!data) return null;
  const v = map(data as unknown as Row);
  return {
    ...v,
    editable:
      a.masterCreate &&
      v.authorId === a.ctx.userId &&
      !v.lockedAt &&
      ["solicitado", "preliminar"].includes(v.status),
  };
}

/** Enlace al trámite del SGD (envío a estandarización, revisión, aprobación). */
export function sgdHref(v: MasterVersion) {
  return v.documentId
    ? `/documentos/${v.documentId}?v=${v.versionNo}`
    : `/documentos/versiones/${v.versionId}`;
}
