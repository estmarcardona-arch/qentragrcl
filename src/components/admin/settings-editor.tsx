"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSetting } from "@/lib/admin/actions";
import { ReasonDialog } from "./reason-dialog";

export type Setting = { key: string; value: unknown; description: string; updated_at: string };

function display(v: unknown) {
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

/** Configuración del sistema (una sola tabla con bitácora): tiempos, umbrales, reautenticación, maquila. */
export function SettingsEditor({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<unknown>(null);
  return (
    <section aria-label="Configuración del sistema" className="grid gap-3">
      <h2 className="text-card-title">Configuración del sistema</h2>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Parámetros de configuración</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                Parámetro
              </th>
              <th scope="col" className="border-b border-border px-4 py-2.5 text-label uppercase">
                Valor
              </th>
              <th scope="col" className="border-b border-border px-4 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.key} className="border-b border-divider last:border-0">
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <span className="block">{s.description}</span>
                  <span className="font-mono text-xs text-text-muted">{s.key}</span>
                </th>
                <td className="px-4 py-2.5 font-mono font-semibold">{display(s.value)}</td>
                <td className="px-4 py-2.5 text-right">
                  <ReasonDialog
                    trigger={
                      <Button size="sm" variant="ghost" aria-label={`Cambiar ${s.key}`}>
                        Cambiar
                      </Button>
                    }
                    title={`Cambiar ${s.key}`}
                    description={s.description}
                    confirmLabel="Guardar"
                    onOpen={() => setDraft(s.value)}
                    onConfirm={(reason) => updateSetting({ key: s.key, value: draft, reason })}
                    onDone={() => router.refresh()}
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor={`set-${s.key}`} className="text-label uppercase">
                        Valor
                      </Label>
                      {typeof s.value === "boolean" ? (
                        <select
                          id={`set-${s.key}`}
                          defaultValue={String(s.value)}
                          onChange={(e) => setDraft(e.target.value === "true")}
                          className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
                        >
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      ) : s.key === "reauth_method" ? (
                        <select
                          id={`set-${s.key}`}
                          defaultValue={String(s.value)}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-9 rounded-md border border-border-control bg-white px-2 text-sm"
                        >
                          <option value="password">Contraseña</option>
                          <option value="password_mfa">Contraseña + segundo factor</option>
                        </select>
                      ) : (
                        <Input
                          id={`set-${s.key}`}
                          type="number"
                          defaultValue={String(s.value)}
                          onChange={(e) => setDraft(Number(e.target.value))}
                        />
                      )}
                    </div>
                  </ReasonDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
