import "server-only";

import { notFound } from "next/navigation";
import { getProductionAccess } from "./access";
import { loadBatch } from "./batch";

/** Acceso y datos del lote para una pantalla; null si no tiene permiso de lectura. */
export async function batchPage(id: string) {
  const a = await getProductionAccess();
  if (!a.read) return null;
  const data = await loadBatch(a, id);
  if (!data) notFound();
  return { a, data };
}
