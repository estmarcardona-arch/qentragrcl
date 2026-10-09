import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/state-card";
import {
  AcknowledgeButton,
  AssignTraining,
  CertificateLink,
  Quiz,
  ScoreBar,
} from "@/components/documents/training";
import { StatusBadge } from "@/components/gxp/status-badge";
import { getDocAccess } from "@/lib/documents/access";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Capacitación · GRUFARCOL eBR" };

type Training = {
  id: string;
  version_id: string;
  due_date: string | null;
  pass_score: number;
  requires_assessment: boolean;
  questions: { q: string; options: string[] }[];
  trainer_id: string;
  method: string;
  created_at: string;
  document_versions: {
    version_no: number;
    controlled_documents: { id: string; code: string; title: string } | null;
  } | null;
};

// S-47 · Divulgación y capacitación (RF-97): mis capacitaciones con cuestionario y constancia; seguimiento
// y asignación para la analista de gestión documental.
export default async function TrainingPage({
  searchParams,
}: PageProps<"/documentos/capacitacion">) {
  const sp = await searchParams;
  const a = await getDocAccess();
  const { supabase, ctx } = a;
  const follower = a.isAqDoc || a.isAqDir || ctx.roles.includes("auditor");
  const sel = typeof sp.t === "string" ? sp.t : null;
  const view = sp.vista === "seguimiento" && follower ? "seguimiento" : "mias";

  const { data: mine } = await supabase
    .from("training_assignments")
    .select(
      "training_id, document_trainings(id, version_id, due_date, pass_score, requires_assessment, questions, trainer_id, method, created_at, document_versions(version_no, controlled_documents!document_versions_document_id_fkey(id, code, title)))",
    )
    .eq("user_id", ctx.userId);
  const myTrainings = (mine ?? [])
    .map((m) => m.document_trainings as unknown as Training)
    .filter(Boolean);
  const { data: myAttempts } = await supabase
    .from("training_attempts")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("attempted_at");
  const label = (t: Training) =>
    `${t.document_versions?.controlled_documents?.code} v${String(t.document_versions?.version_no).padStart(2, "0")}`;

  const tabs = (
    <nav aria-label="Vista" className="flex gap-2">
      {[["mias", "Mis capacitaciones"], ...(follower ? [["seguimiento", "Seguimiento"]] : [])].map(
        ([k, l]) => (
          <Link
            key={k}
            href={`/documentos/capacitacion?vista=${k}`}
            aria-current={view === k ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm no-underline",
              view === k
                ? "border-primary bg-primary text-white"
                : "border-border-control bg-white text-text-strong",
            )}
          >
            {l}
          </Link>
        ),
      )}
    </nav>
  );

  if (view === "seguimiento") {
    const [
      { data: all },
      { data: assigns },
      { data: attempts },
      { data: people },
      { data: vigentes },
    ] = await Promise.all([
      supabase
        .from("document_trainings")
        .select(
          "id, version_id, due_date, pass_score, requires_assessment, questions, trainer_id, method, created_at, document_versions(version_no, controlled_documents!document_versions_document_id_fkey(id, code, title))",
        )
        .order("created_at", { ascending: false }),
      supabase.from("training_assignments").select("training_id, user_id"),
      supabase
        .from("training_attempts")
        .select("training_id, user_id, attempt_no, score, passed, attempted_at"),
      supabase
        .from("profiles")
        .select("id, full_name, area_id, organizational_areas!profiles_area_fk(name)")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("v_master_list")
        .select("version_id, code, title, version_label")
        .eq("document_status", "vigente")
        .eq("origin", "interno")
        .order("code"),
    ]);
    const trainings = (all ?? []) as unknown as Training[];
    const cur = trainings.find((t) => t.id === sel) ?? trainings[0];
    const asg = (assigns ?? []).filter((x) => x.training_id === cur?.id);
    const at = (attempts ?? []).filter((x) => x.training_id === cur?.id);
    const passed = new Set(at.filter((x) => x.passed).map((x) => x.user_id));
    const person = (id: string) => people?.find((p) => p.id === id);
    return (
      <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
        <PageHeader
          title="Seguimiento de capacitación"
          description="Divulga quien elaboró, revisó o aprobó el documento, o la analista de gestión documental."
          breadcrumbs={[
            { label: "Inicio", href: "/inicio" },
            { label: "Documentos", href: "/documentos" },
            { label: "Capacitación" },
          ]}
        />
        {tabs}
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-4 max-[1279px]:grid-cols-1">
          <nav aria-label="Capacitaciones" className="grid content-start gap-2">
            {trainings.length === 0 ? (
              <EmptyState title="No hay capacitaciones asignadas" />
            ) : (
              trainings.map((t) => {
                const n = (assigns ?? []).filter((x) => x.training_id === t.id).length;
                const ok = new Set(
                  (attempts ?? [])
                    .filter((x) => x.training_id === t.id && x.passed)
                    .map((x) => x.user_id),
                ).size;
                return (
                  <Link
                    key={t.id}
                    href={`/documentos/capacitacion?vista=seguimiento&t=${t.id}`}
                    aria-current={t.id === cur?.id ? "page" : undefined}
                    className={cn(
                      "grid gap-0.5 rounded-[10px] border bg-surface p-3 text-sm no-underline",
                      t.id === cur?.id ? "border-primary bg-tram-revision-bg" : "border-border",
                    )}
                  >
                    <span className="font-mono text-xs font-semibold">{label(t)}</span>
                    <b className="font-medium text-foreground">
                      {t.document_versions?.controlled_documents?.title}
                    </b>
                    <span className="text-xs text-text-secondary">
                      {ok} de {n} aprobaron · límite {t.due_date ? formatDate(t.due_date) : "—"}
                    </span>
                  </Link>
                );
              })
            )}
          </nav>
          <div className="grid content-start gap-4">
            {cur ? (
              <>
                <section
                  className="grid gap-2 rounded-[10px] border border-border bg-surface p-4"
                  aria-label="Resumen de la capacitación"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-card-title">
                      {passed.size} de {asg.length} aprobaron
                    </h2>
                    <StatusBadge
                      status={passed.size === asg.length ? "completada" : "en_curso"}
                      label={passed.size === asg.length ? "Completada" : "En curso"}
                    />
                  </div>
                  <dl className="grid grid-cols-4 gap-3 text-sm max-[1279px]:grid-cols-2">
                    <div>
                      <dt className="text-text-secondary">Fecha límite</dt>
                      <dd className="font-semibold">
                        {cur.due_date ? formatDate(cur.due_date) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Pendientes</dt>
                      <dd>
                        {asg
                          .filter((x) => !passed.has(x.user_id))
                          .map((x) => person(x.user_id)?.full_name)
                          .join(", ") || "Ninguno"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Aprobación mínima</dt>
                      <dd className="font-semibold">{formatNumber(Number(cur.pass_score), 0)} %</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Quién divulga</dt>
                      <dd>{person(cur.trainer_id)?.full_name}</dd>
                    </div>
                  </dl>
                </section>
                <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
                  <table className="w-full text-left text-sm" data-testid="training-follow">
                    <caption className="sr-only">Personas asignadas</caption>
                    <thead className="bg-surface-sunken">
                      <tr>
                        {["Persona", "Área", "Intento", "Estado"].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="border-b border-border px-3 py-2.5 text-label uppercase"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {asg.map((x) => {
                        const last = at
                          .filter((y) => y.user_id === x.user_id)
                          .sort((p, q) => q.attempt_no - p.attempt_no)[0];
                        const p = person(x.user_id);
                        return (
                          <tr
                            key={x.user_id}
                            className="border-b border-divider last:border-0"
                            data-person={p?.full_name}
                          >
                            <td className="px-3 py-2.5 font-medium">{p?.full_name}</td>
                            <td className="px-3 py-2.5">
                              {(p?.organizational_areas as unknown as { name: string } | null)
                                ?.name ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {last
                                ? `${last.attempt_no} · ${last.score != null ? `${formatNumber(Number(last.score), 0)} %` : "lectura"}`
                                : "Ninguno"}
                            </td>
                            <td className="px-3 py-2.5">
                              {passed.has(x.user_id) ? (
                                <StatusBadge status="completada" label="Aprobó" />
                              ) : last ? (
                                <StatusBadge status="bloqueada" label="No aprobó" />
                              ) : (
                                <StatusBadge status="pendiente" label="Sin intento" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <section
                  className="grid gap-1 rounded-[10px] border border-border bg-surface p-4 text-sm"
                  aria-label="Registro de capacitación y entrenamiento"
                >
                  <h2 className="text-card-title">Registro de capacitación y entrenamiento</h2>
                  <p>
                    {formatDate(cur.created_at)} · divulgó {person(cur.trainer_id)?.full_name} ·{" "}
                    {cur.requires_assessment
                      ? "cuestionario de opción múltiple"
                      : "confirmación de lectura"}{" "}
                    ({cur.method}) · {asg.length} asignados · aprobación{" "}
                    {formatNumber(Number(cur.pass_score), 0)} %
                  </p>
                </section>
              </>
            ) : null}
            {a.isAqDoc ? (
              <AssignTraining
                versions={(vigentes ?? [])
                  .filter((v) => v.version_id)
                  .map((v) => ({
                    id: v.version_id as string,
                    label: `${v.code} v${v.version_label} · ${v.title}`,
                  }))}
                people={(people ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
              />
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const cur =
    myTrainings.find((t) => t.id === sel) ??
    myTrainings.find((t) => !(myAttempts ?? []).some((x) => x.training_id === t.id && x.passed)) ??
    myTrainings[0];
  const curAttempts = (myAttempts ?? []).filter((x) => x.training_id === cur?.id);
  const passedAttempt = curAttempts.find((x) => x.passed);
  const lastAttempt = curAttempts[curAttempts.length - 1];
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Mis capacitaciones"
        description={`${myTrainings.length} documentos asignados · ${myTrainings.filter((t) => !(myAttempts ?? []).some((x) => x.training_id === t.id && x.passed)).length} pendientes`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos", href: "/documentos" },
          { label: "Mis capacitaciones" },
        ]}
      />
      {tabs}
      {myTrainings.length === 0 ? (
        <EmptyState
          title="No tiene capacitaciones asignadas"
          text="Cuando Aseguramiento de la calidad divulgue un documento que usted usa, aparecerá aquí."
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4 max-[1279px]:grid-cols-1">
          <div className="grid content-start gap-4">
            <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
              <table className="w-full text-left text-sm" data-testid="my-trainings">
                <caption className="sr-only">Documentos asignados</caption>
                <thead className="bg-surface-sunken">
                  <tr>
                    {["Documento", "Fecha límite", "Intentos", "Estado"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border-b border-border px-3 py-2.5 text-label uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myTrainings.map((t) => {
                    const att = (myAttempts ?? []).filter((x) => x.training_id === t.id);
                    const ok = att.some((x) => x.passed);
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "border-b border-divider last:border-0",
                          t.id === cur?.id && "bg-tram-revision-bg",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <Link href={`/documentos/capacitacion?t=${t.id}`}>
                            <span className="font-mono text-xs font-semibold">{label(t)}</span> ·{" "}
                            {t.document_versions?.controlled_documents?.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          {t.due_date ? formatDate(t.due_date) : "—"}
                        </td>
                        <td className="px-3 py-2.5">{att.length}</td>
                        <td className="px-3 py-2.5">
                          {ok ? (
                            <StatusBadge status="completada" label="Capacitado" />
                          ) : (
                            <StatusBadge status="pendiente" label="Pendiente de capacitación" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {cur && !passedAttempt ? (
              <section
                className="grid gap-3 rounded-[10px] border border-border bg-surface p-5"
                aria-label="Cuestionario"
              >
                <h2 className="text-card-title">
                  {cur.requires_assessment ? "Cuestionario" : "Confirmación de lectura"} ·{" "}
                  {label(cur)}
                </h2>
                {cur.requires_assessment ? (
                  <Quiz
                    key={cur.id}
                    trainingId={cur.id}
                    questions={cur.questions}
                    passScore={Number(cur.pass_score)}
                    attemptNo={curAttempts.length + 1}
                  />
                ) : (
                  <AcknowledgeButton trainingId={cur.id} />
                )}
              </section>
            ) : null}
          </div>
          <aside
            className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-4"
            aria-label="Resultado"
          >
            <h2 className="text-card-title">Resultado</h2>
            {passedAttempt ? (
              <>
                <b className="text-base">
                  {passedAttempt.score != null
                    ? `${formatNumber(Number(passedAttempt.score), 0)} % · `
                    : ""}
                  Aprobó
                </b>
                {passedAttempt.score != null ? (
                  <ScoreBar score={Number(passedAttempt.score)} pass={Number(cur?.pass_score)} />
                ) : null}
                <span className="font-mono text-sm">
                  Constancia {passedAttempt.certificate_code}
                </span>
                <CertificateLink attemptId={passedAttempt.id} />
              </>
            ) : lastAttempt ? (
              <>
                <b className="text-base">
                  {formatNumber(Number(lastAttempt.score), 0)} % · No aprobó. Puede intentarlo de
                  nuevo.
                </b>
                <ScoreBar score={Number(lastAttempt.score)} pass={Number(cur?.pass_score)} />
              </>
            ) : (
              <p className="text-sm text-text-secondary">Aún no presenta el cuestionario.</p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
