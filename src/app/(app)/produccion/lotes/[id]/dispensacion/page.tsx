import type { Metadata } from "next";
import { NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { BatchHeader } from "@/components/production/batch-header";
import { AddLotForm, SumIndicator, type LotOption } from "@/components/production/dispense-line";
import { VerifyButton } from "@/components/production/prep-forms";
import { StageShell } from "@/components/production/stage-shell";
import { Stamps } from "@/components/production/stamps";
import { formatDate, formatNumber } from "@/lib/format";
import { loadEquipment, trainingNotice } from "@/lib/production/batch";
import { batchPage } from "@/lib/production/page";

export const metadata: Metadata = { title: "Dispensación · GRUFARCOL eBR" };

type Line = {
  id: string;
  order_no: number;
  required_qty: number;
  unit: string;
  material_id: string;
  materials: { code: string; name: string } | null;
};

// S-18 · Dispensación multi-lote (RF-33): cada materia prima admite varios lotes; solo aprobados y vigentes (FEFO),
// balanza válida y verificación por otra persona (SOD-4).
export default async function DispensingPage({
  params,
}: PageProps<"/produccion/lotes/[id]/dispensacion">) {
  const { id } = await params;
  const p = await batchPage(id);
  if (!p) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { a, data } = p;
  const stage = data.stages.find((s) => s.stage === "dispensacion")!;
  const req = data.requests.find((r) => r.type === "dispensacion");
  const lines = ((req?.material_request_lines as Line[] | null) ?? []).sort(
    (x, y) => x.order_no - y.order_no,
  );
  const [{ data: lots }, equipment, training] = await Promise.all([
    a.supabase
      .from("v_lot_stock")
      .select("id, internal_code, material_id, status, effective_status, expiry_date, qty_on_hand")
      .in(
        "material_id",
        lines.map((l) => l.material_id),
      )
      .gt("qty_on_hand", 0)
      .order("expiry_date"),
    loadEquipment(a),
    trainingNotice(a, stage.governing_version_id),
  ]);
  const balances = equipment.filter((e) => e.type === "balanza");
  const lotOptions = (materialId: string): LotOption[] =>
    (lots ?? [])
      .filter((l) => l.material_id === materialId)
      .map((l) => ({
        id: String(l.id),
        code: String(l.internal_code),
        expiry: formatDate(String(l.expiry_date)),
        qty: Number(l.qty_on_hand),
        status: String(l.effective_status),
        reason:
          l.effective_status === "aprobado"
            ? null
            : l.effective_status === "vencido"
              ? `vencido el ${formatDate(String(l.expiry_date))}`
              : l.effective_status === "cuarentena"
                ? "en cuarentena: espere la liberación de Control de calidad"
                : String(l.effective_status),
      }));
  const th = "px-3 py-2 text-label uppercase";
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <BatchHeader
        data={data}
        title="Dispensación"
        current="dispensacion"
        stage="dispensacion"
        training={training}
      />
      <StageShell a={a} data={data} stage={stage}>
        <section
          className="grid gap-3"
          aria-label="Líneas de dispensación"
          data-testid="dispensing"
        >
          {lines.map((l) => {
            const done = data.lots.filter((x) => x.request_line_id === l.id);
            const sum = done.reduce((s, x) => s + Number(x.qty), 0);
            const code = l.materials?.code ?? "";
            return (
              <article
                key={l.id}
                className="grid gap-3 rounded-[10px] border border-border bg-surface p-4"
                data-code={code}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[15px] font-semibold">
                    {l.materials?.name}{" "}
                    <span className="font-mono text-xs text-text-secondary">{code}</span>
                  </h3>
                  <span className="text-sm">
                    requerida {formatNumber(Number(l.required_qty), 2)} {l.unit}
                  </span>
                  <SumIndicator dispensed={sum} required={Number(l.required_qty)} unit={l.unit} />
                </div>
                {done.length ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-sunken">
                      <tr>
                        {["Lote", "Peso", "Tara", "Balanza", "Ubicación", "Firmas", ""].map((h) => (
                          <th key={h} scope="col" className={th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {done.map((x) => (
                        <tr
                          key={x.id}
                          className="border-t border-divider align-top"
                          data-lot={x.lotCode}
                        >
                          <td className="px-3 py-2 font-mono text-xs font-semibold">{x.lotCode}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatNumber(Number(x.qty), 2)} {l.unit}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {x.tare != null ? formatNumber(Number(x.tare), 2) : "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{x.balanceCode}</td>
                          <td className="px-3 py-2 font-mono text-xs">{x.locationCode}</td>
                          <td className="px-3 py-2">
                            <Stamps
                              executedBy={x.executedBy}
                              executedAt={x.executed_at}
                              verifiedBy={x.verifiedBy}
                              verifiedAt={x.verified_at}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {x.status !== "verificado" && a.sign ? (
                              <VerifyButton
                                kind="dispensing"
                                batchId={id}
                                recordId={x.id}
                                label="Verificar"
                                title={`Verificar dispensación · ${l.materials?.name}`}
                                summary={[
                                  { label: "Lote", value: x.lotCode, mono: true },
                                  {
                                    label: "Peso",
                                    value: `${formatNumber(Number(x.qty), 2)} ${l.unit}`,
                                    mono: true,
                                  },
                                  { label: "Dispensó", value: x.executedBy },
                                ]}
                                signer={a.signer}
                                testId={`verify-${x.lotCode}`}
                              />
                            ) : x.status === "verificado" ? (
                              <StatusBadge status="firmada" label="Verificada" />
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {stage.status === "en_curso" && a.execute && sum < Number(l.required_qty) ? (
                  <AddLotForm
                    key={`${l.id}-${sum}`}
                    batchId={id}
                    lineId={l.id}
                    material={code}
                    unit={l.unit}
                    required={Number(l.required_qty)}
                    dispensed={sum}
                    lots={lotOptions(l.material_id)}
                    balances={balances}
                    signer={a.signer}
                  />
                ) : null}
              </article>
            );
          })}
        </section>
      </StageShell>
    </main>
  );
}
