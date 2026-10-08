import type { Database } from "@/lib/db/database.types";

export type SignatureMeaning = Database["public"]["Enums"]["signature_meaning"];

/** Significado de la firma: etiqueta en primera persona (modal) y en el sello (tercera persona). */
export const MEANINGS: Record<SignatureMeaning, { chip: string; stamp: string }> = {
  ejecuto: { chip: "Ejecuté", stamp: "Ejecutó" },
  verifico: { chip: "Verifiqué", stamp: "Verificó" },
  reviso: { chip: "Revisé", stamp: "Revisó" },
  aprobo: { chip: "Aprobé", stamp: "Aprobó" },
  libero: { chip: "Liberé", stamp: "Liberó" },
  actualizo: { chip: "Actualicé", stamp: "Actualizó" },
};

/** Los cinco significados que muestra el modal (Prompt 0, 5.a); «actualizo» es del SGD. */
export const MODAL_MEANINGS: SignatureMeaning[] = [
  "ejecuto",
  "verifico",
  "reviso",
  "aprobo",
  "libero",
];
