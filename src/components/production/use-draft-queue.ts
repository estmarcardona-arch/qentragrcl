"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveStepDraft } from "@/lib/production/actions";

export type DraftStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "queued"; pending: number };

function readLocal(key: string): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeLocal(key: string, value: Record<string, string>) {
  try {
    if (Object.keys(value).length) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento local (modo privado): el borrador sigue guardándose en el servidor.
  }
}

/**
 * Borrador por campo con cola local y reintento: cada cambio queda en el navegador y se envía al servidor
 * (save_step_draft). Si no hay red, se reintenta cada 5 s y al volver la conexión. La hora la fija el servidor.
 */
export function useDraftQueue(
  scope: { stageOrderId: string; stepKey: string; presentationId: string | null },
  initial: Record<string, string>,
) {
  const { stageOrderId, stepKey, presentationId } = scope;
  const key = `grufarcol.draft.${stageOrderId}.${stepKey}.${presentationId ?? "-"}`;
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  const pending = useRef<Record<string, string>>({});
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current || !Object.keys(pending.current).length) return;
    flushing.current = true;
    const batch = { ...pending.current };
    setStatus({ kind: "saving" });
    try {
      const res = await saveStepDraft({ stageOrderId, stepKey, presentationId, values: batch });
      if (!res.ok) throw new Error(res.code);
      for (const k of Object.keys(batch))
        if (pending.current[k] === batch[k]) delete pending.current[k];
      writeLocal(key, pending.current);
      setStatus(
        Object.keys(pending.current).length
          ? { kind: "queued", pending: Object.keys(pending.current).length }
          : { kind: "saved", at: res.savedAt },
      );
    } catch {
      setStatus({ kind: "queued", pending: Object.keys(pending.current).length });
    } finally {
      flushing.current = false;
    }
  }, [key, stageOrderId, stepKey, presentationId]);

  // Al montar: recupera lo que quedó en cola en este navegador (corte de red o recarga).
  useEffect(() => {
    const local = readLocal(key);
    if (Object.keys(local).length) {
      pending.current = { ...local };
      // Sincroniza con el almacenamiento local (sistema externo) al montar: recupera lo que no llegó al servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((v) => ({ ...v, ...local }));
      void flush();
    }
    const retry = window.setInterval(() => void flush(), 5000);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("online", online);
    };
  }, [key, flush]);

  const setField = useCallback(
    (name: string, value: string) => {
      setValues((v) => ({ ...v, [name]: value }));
      pending.current = { ...pending.current, [name]: value };
      writeLocal(key, pending.current);
      void flush();
    },
    [key, flush],
  );

  const clear = useCallback(() => {
    pending.current = {};
    writeLocal(key, {});
  }, [key]);

  return { values, setField, status, clear };
}
