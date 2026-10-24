"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newMasterDocument, type RdResult } from "@/lib/rd/actions";

/** Solicita el documento controlado (creación en el proceso I+D) y abre su editor en borrador. */
export function NewMasterButton({
  typeCode,
  label,
  basePath,
}: {
  typeCode: "FM" | "EP" | "IN";
  label: string;
  basePath: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  return (
    <ReasonDialog
      trigger={
        <Button>
          <Plus aria-hidden />
          {label}
        </Button>
      }
      title={label}
      description="Se crea la solicitud en el SGD (proceso I+D) y su versión en borrador. El código lo asigna estandarización."
      confirmLabel="Crear borrador"
      onOpen={() => setTitle("")}
      onConfirm={async (reason): Promise<RdResult> => {
        const res = await newMasterDocument({ typeCode, title, reason });
        if (res.ok) router.push(`${basePath}/${res.versionId}`);
        return res;
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="master-title" className="text-label uppercase">
          Título propuesto
        </Label>
        <Input id="master-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
    </ReasonDialog>
  );
}
