import { connection } from "next/server";
import { createClient } from "@/lib/db/server";
import { docDate } from "@/lib/documents/labels";
import { log } from "@/lib/log";

// GET /documentos/exportar · listado maestro (RF-92) en CSV con BOM y «;», que Excel abre directamente.
export async function GET() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_master_list").select("*").order("code");
  if (error) return new Response("No se pudo exportar el listado maestro", { status: 500 });
  const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const header = [
    "Código",
    "Título",
    "Tipo",
    "Nivel",
    "Proceso",
    "Versión",
    "Fecha de emisión",
    "Última actualización",
    "Fecha de revisión",
    "Estado",
    "Vigencia",
    "Documento padre",
  ];
  const lines = (data ?? []).map((r) =>
    [
      r.origin === "externo" ? `${r.code} (externo)` : r.code,
      r.title,
      r.type_name ?? "Externo",
      r.level,
      r.process_code ?? "",
      r.version_label ?? "",
      docDate(r.issue_date),
      r.last_update ? docDate(String(r.last_update)) : "",
      docDate(r.review_date),
      r.document_status,
      r.validity,
      r.parent_code ?? "",
    ]
      .map(cell)
      .join(";"),
  );
  log.info("documents.exported", { rows: lines.length });
  return new Response(`﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="listado-maestro.csv"',
      "Cache-Control": "no-store",
    },
  });
}
