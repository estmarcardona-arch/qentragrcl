import { CircleX, Lock } from "lucide-react";
import { useId, type ReactElement, cloneElement } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
};

type FormFieldProps = {
  label: string;
  /** Un solo control (Input, select…); recibe id y atributos de accesibilidad. */
  children: ReactElement<ControlProps>;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Unidad visible a la derecha del control (kg, g, mL, °C, %, rpm, min). */
  unit?: string;
  /** Rango permitido visible («Rango 70–75 °C»). */
  range?: string;
  /** Campo firmado / bloqueado: solo lectura con candado (Prompt 0, 5.b). */
  locked?: boolean;
  className?: string;
};

/**
 * Campo de formulario con etiqueta, ayuda, unidad, rango y error con ícono + texto.
 * El error se anuncia con aria-describedby y aria-invalid.
 */
export function FormField({
  label,
  children,
  hint,
  error,
  required,
  unit,
  range,
  locked,
  className,
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const describedBy = [hint || range ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const control = cloneElement(children, {
    id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : undefined,
    readOnly: locked || children.props.readOnly,
  });

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-label text-text-strong uppercase">
        {label}
        {required ? (
          <span aria-hidden className="text-q-bad-ic">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(obligatorio)</span> : null}
        {locked ? <Lock aria-label="Campo bloqueado" className="size-3.5 text-text-muted" /> : null}
      </Label>
      <div className={cn("flex items-center gap-2", locked && "[&_input]:bg-surface-sunken")}>
        <div className="flex-1">{control}</div>
        {unit ? <span className="text-sm font-medium text-text-secondary">{unit}</span> : null}
      </div>
      {hint || range ? (
        <p id={hintId} className="text-small text-text-secondary">
          {[range, hint].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-small font-medium text-q-bad-fg">
          <CircleX aria-hidden className="size-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
