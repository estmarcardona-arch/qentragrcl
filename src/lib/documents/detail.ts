import "server-only";

import type { DbClient } from "@/lib/rpc";
import type { SignatureBoxRow } from "@/components/documents/document-view";

// Datos de un documento controlado y sus versiones para S-46 (detalle) y el PDF.

export async function loadDocument(supabase: DbClient, documentId: string) {
  const { data: doc } = await supabase
    .from("controlled_documents")
    .select(
      "*, document_types(id, type_code, name, level, is_subdocument, stamp_required, validity_rule), organizational_areas!controlled_documents_process_id_fkey(id, name, process_code, head_user_id), approval_routes(id, code, name, allow_reviewer_as_approver)",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return null;

  const [{ data: versions }, { data: steps }] = await Promise.all([
    supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .order("version_no", { ascending: false }),
    supabase
      .from("approval_route_steps")
      .select("step, roles, includes_author_head")
      .eq("route_id", doc.route_id ?? ""),
  ]);
  const ids = (versions ?? []).map((v) => v.id);
  const authorIds = [...new Set((versions ?? []).map((v) => v.author_id))];
  const [
    { data: sigs },
    { data: dist },
    { data: authors },
    { data: changes },
    { data: checks },
    { data: trainings },
  ] = await Promise.all([
    supabase
      .from("signatures")
      .select(
        "id, record_id, meaning, user_id, signer_name, short_signature, signed_at, signed_as, reason",
      )
      .eq("record_table", "document_versions")
      .in("record_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("document_distribution")
      .select("*, organizational_areas(name, process_code)")
      .in("version_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("delivered_at"),
    supabase
      .from("profiles")
      .select("id, full_name, job_title, area_id")
      .in("id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("document_change_requests")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("standardization_checks")
      .select("*")
      .in("version_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("checked_at", { ascending: false }),
    supabase
      .from("document_trainings")
      .select("id, version_id, due_date, pass_score, trainer_id")
      .in("version_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const signerIds = [...new Set((sigs ?? []).map((s) => s.user_id))];
  const { data: signers } = await supabase
    .from("profiles")
    .select("id, full_name, job_title")
    .in("id", signerIds.length ? signerIds : ["00000000-0000-0000-0000-000000000000"]);

  const signatureBox = (versionId: string): SignatureBoxRow[] =>
    (["actualizo", "reviso", "aprobo"] as const).map((m) => {
      const s = (sigs ?? []).find((x) => x.record_id === versionId && x.meaning === m);
      if (!s) return null;
      return {
        meaning: m,
        name: s.signer_name,
        jobTitle: signers?.find((p) => p.id === s.user_id)?.job_title ?? null,
        shortSignature: s.short_signature,
        signedAt: s.signed_at,
      };
    });

  return {
    doc,
    type: doc.document_types as unknown as {
      id: string;
      type_code: string;
      name: string;
      level: number;
      is_subdocument: boolean;
      stamp_required: boolean;
    } | null,
    area: doc.organizational_areas as unknown as {
      id: string;
      name: string;
      process_code: string;
      head_user_id: string | null;
    } | null,
    route: doc.approval_routes as unknown as {
      id: string;
      code: string;
      name: string;
      allow_reviewer_as_approver: boolean;
    } | null,
    routeSteps: steps ?? [],
    versions: versions ?? [],
    signatures: sigs ?? [],
    distribution: dist ?? [],
    authors: authors ?? [],
    changes: changes ?? [],
    checks: checks ?? [],
    trainings: trainings ?? [],
    signatureBox,
  };
}

export type LoadedDocument = NonNullable<Awaited<ReturnType<typeof loadDocument>>>;
