"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveCatalog } from "@/lib/admin/actions";
import { ReasonDialog } from "./reason-dialog";

export type ProfileRule = {
  id: string;
  profile: "cosmetico" | "medicamento";
  rule_key: string;
  label: string;
  enabled: boolean;
  mode: "obligatorio" | "configurable" | "segun_criticidad";
  version: number;
};

const MODE: Record<ProfileRule["mode"], string> = {
  obligatorio: "Obligatorio",
  configurable: "Configurable",
  segun_criticidad: "Según criticidad",
};

/** Perfiles regulatorios lado a lado (Prompt 2, S-04; PRD §10). */
export function RegulatoryProfiles({ rules }: { rules: ProfileRule[] }) {
  const router = useRouter();
  const keys = [...new Set(rules.map((r) => r.rule_key))];
  const cell = (key: string, profile: ProfileRule["profile"]) => {
    const r = rules.find((x) => x.rule_key === key && x.profile === profile);
    if (!r) return <td className="px-4 py-3">—</td>;
    return (
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-semibold ${r.enabled ? "text-primary" : "text-text-secondary"}`}
          >
            {r.enabled ? "Activa" : "Inactiva"}
          </span>
          <span className="text-small text-text-secondary">
            · {MODE[r.mode]} · v{r.version}
          </span>
          <ReasonDialog
            trigger={
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${r.enabled ? "Desactivar" : "Activar"} ${r.label} en ${profile}`}
              >
                {r.enabled ? "Desactivar" : "Activar"}
              </Button>
            }
            title={`${r.enabled ? "Desactivar" : "Activar"}: ${r.label}`}
            description="Un cambio de perfil no altera los lotes ya creados: cada lote guarda la foto de su perfil."
            confirmLabel={r.enabled ? "Desactivar" : "Activar"}
            onConfirm={(reason) =>
              saveCatalog({
                table: "regulatory_profiles",
                id: r.id,
                values: { enabled: !r.enabled },
                reason,
              })
            }
            onDone={() => router.refresh()}
          />
        </div>
      </td>
    );
  };
  return (
    <section aria-label="Perfiles regulatorios" className="grid gap-3">
      <h2 className="text-card-title">Perfiles regulatorios</h2>
      <p className="flex items-center gap-2 rounded-lg bg-primary-tint px-3 py-2 text-sm text-primary-hover">
        <Info aria-hidden className="size-4" />
        Un cambio de perfil no altera los lotes ya creados. Valores de partida por confirmar con
        regulatorio (D-05).
      </p>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Reglas por perfil regulatorio</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                Regla
              </th>
              <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                Cosmético
              </th>
              <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                Medicamento
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-b border-divider last:border-0">
                <th scope="row" className="px-4 py-3 font-medium">
                  {rules.find((r) => r.rule_key === k)?.label}
                  <span className="block font-mono text-xs text-text-muted">{k}</span>
                </th>
                {cell(k, "cosmetico")}
                {cell(k, "medicamento")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
