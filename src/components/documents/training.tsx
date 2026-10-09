"use client";

import { CircleCheck, CircleX, Download, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acknowledgeRead,
  assignTraining,
  submitQuiz,
  type DocResult,
  type QuizQuestion,
} from "@/lib/documents/actions";
import { formatNumber } from "@/lib/format";

/** Barra del resultado con la línea de aprobación (S-47). */
export function ScoreBar({ score, pass }: { score: number; pass: number }) {
  const ok = score >= pass;
  return (
    <div className="grid gap-1">
      <div
        className="relative h-3 rounded-full bg-surface-sunken"
        role="img"
        aria-label={`Resultado ${formatNumber(score, 0)} %; mínimo ${pass} %`}
      >
        <div
          className={cn("h-3 rounded-full", ok ? "bg-primary" : "bg-neutral-strong")}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
        <div className="absolute top-[-4px] h-5 w-0.5 bg-foreground" style={{ left: `${pass}%` }} />
      </div>
      <span className="text-xs text-text-secondary">Línea de aprobación: {pass} %</span>
    </div>
  );
}

/** Cuestionario de opción múltiple; la base califica (no se envía la respuesta correcta al navegador). */
export function Quiz({
  trainingId,
  questions,
  passScore,
  attemptNo,
}: {
  trainingId: string;
  questions: { q: string; options: string[] }[];
  passScore: number;
  attemptNo: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [result, setResult] = useState<{ score: number; certificate?: string } | null>(null);
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const complete = answers.every((x) => x !== null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitQuiz({ trainingId, answers: answers.map((x) => x ?? -1) });
          if (res.ok) setResult({ score: res.score, certificate: res.certificateCode });
          else if (res.code === "TRAINING_NOT_PASSED") setResult({ score: res.score ?? 0 });
          else setError(res);
          router.refresh();
        });
      }}
    >
      <p className="text-small text-text-secondary">
        Intento {attemptNo} · mínimo para aprobar {passScore} %
      </p>
      {questions.map((q, i) => (
        <fieldset key={i} className="grid gap-2 rounded-lg border border-border bg-white p-3.5">
          <legend className="px-1 text-sm font-semibold">
            {i + 1}. {q.q}
          </legend>
          {q.options.map((o, j) => (
            <label
              key={j}
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-sm",
                answers[i] === j ? "border-primary bg-tram-revision-bg" : "border-border-control",
              )}
            >
              <input
                type="radio"
                name={`q-${i}`}
                checked={answers[i] === j}
                onChange={() => setAnswers(answers.map((x, k) => (k === i ? j : x)))}
              />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      {result ? (
        <div
          role="status"
          className={cn(
            "grid gap-2 rounded-lg border p-3.5",
            result.score >= passScore
              ? "border-primary bg-tram-revision-bg"
              : "border-neutral-strong bg-surface-sunken",
          )}
        >
          <b className="flex items-center gap-1.5 text-base">
            {result.score >= passScore ? (
              <CircleCheck aria-hidden className="size-5" />
            ) : (
              <CircleX aria-hidden className="size-5" />
            )}
            {formatNumber(result.score, 0)} % ·{" "}
            {result.score >= passScore
              ? "Aprobó. Su constancia ya está disponible."
              : "No aprobó. Puede intentarlo de nuevo."}
          </b>
          <ScoreBar score={result.score} pass={passScore} />
          {result.certificate ? (
            <span className="font-mono text-sm">Constancia {result.certificate}</span>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-q-bad-fg">
          {error.rule} {error.action}
        </p>
      ) : null}
      {!result || result.score < passScore ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !complete} className="min-h-12">
            {pending ? "Calificando…" : result ? "Presentar de nuevo" : "Enviar respuestas"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function AcknowledgeButton({ trainingId }: { trainingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await acknowledgeRead({ trainingId });
          router.refresh();
        })
      }
    >
      Confirmo que leí el documento
    </Button>
  );
}

export function CertificateLink({ attemptId }: { attemptId: string }) {
  return (
    <Button variant="secondary" size="sm" asChild>
      <a href={`/documentos/capacitacion/constancia/${attemptId}`} target="_blank" rel="noopener">
        <Download aria-hidden />
        Descargar constancia
      </a>
    </Button>
  );
}

/** Asignar la divulgación de una versión vigente (aq_doc): personas, fecha límite y cuestionario. */
export function AssignTraining({
  versions,
  people,
}: {
  versions: { id: string; label: string }[];
  people: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [versionId, setVersionId] = useState("");
  const [users, setUsers] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [qs, setQs] = useState<QuizQuestion[]>([{ q: "", options: ["", ""], answer: 0 }]);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState<Exclude<DocResult, { ok: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4 rounded-[10px] border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await assignTraining({
            versionId,
            users,
            dueDate: due,
            questions: readOnly ? [] : qs,
          });
          if (!res.ok) return setError(res);
          setError(null);
          setMessage("Capacitación asignada.");
          setUsers([]);
          router.refresh();
        });
      }}
    >
      <h2 className="text-card-title">Asignar divulgación</h2>
      <div className="grid grid-cols-2 items-start gap-3 max-[1279px]:grid-cols-1">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="tr-version" className="text-label uppercase">
            Documento vigente
          </Label>
          <select
            id="tr-version"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="h-10 w-full min-w-0 truncate rounded-md border border-border-control bg-white px-2.5 text-sm"
          >
            <option value="">Seleccione…</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="tr-due" className="text-label uppercase">
            Fecha límite
          </Label>
          <Input
            id="tr-due"
            type="date"
            className="h-10"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
      </div>
      <fieldset className="grid min-w-0 gap-1.5">
        <legend className="mb-1 text-label text-text-strong uppercase">Personas</legend>
        <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto max-[1279px]:grid-cols-2">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={users.includes(p.id)}
                onChange={(e) =>
                  setUsers(e.target.checked ? [...users, p.id] : users.filter((x) => x !== p.id))
                }
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
        />
        Solo confirmación de lectura (sin cuestionario)
      </label>
      {!readOnly ? (
        <div className="grid gap-3">
          {qs.map((q, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Pregunta ${i + 1}`}
                  placeholder={`Pregunta ${i + 1}`}
                  value={q.q}
                  onChange={(e) =>
                    setQs(qs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar la pregunta ${i + 1}`}
                  onClick={() => setQs(qs.filter((_, k) => k !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {q.options.map((o, j) => (
                <label key={j} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`ans-${i}`}
                    checked={q.answer === j}
                    onChange={() => setQs(qs.map((x, k) => (k === i ? { ...x, answer: j } : x)))}
                    aria-label={`Respuesta correcta: opción ${j + 1}`}
                  />
                  <Input
                    aria-label={`Opción ${j + 1} de la pregunta ${i + 1}`}
                    value={o}
                    onChange={(e) =>
                      setQs(
                        qs.map((x, k) =>
                          k === i
                            ? {
                                ...x,
                                options: x.options.map((y, m) => (m === j ? e.target.value : y)),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() =>
                  setQs(qs.map((x, k) => (k === i ? { ...x, options: [...x.options, ""] } : x)))
                }
              >
                <Plus aria-hidden /> Opción
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            onClick={() => setQs([...qs, { q: "", options: ["", ""], answer: 0 }])}
          >
            <Plus aria-hidden /> Agregar pregunta
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-q-bad-fg">
          {error.rule} {error.detail ? `(${error.detail}) ` : ""}
          {error.action}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-tram-en-curso-fg">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !versionId || users.length === 0 || !due}>
          Asignar
        </Button>
      </div>
    </form>
  );
}
