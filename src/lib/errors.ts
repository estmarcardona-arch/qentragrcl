// Manejo centralizado de errores.
// Las RPC de la base levantan excepciones cuyo mensaje es un código del PRD (p. ej. SOD_VIOLATION).
// Aquí se traducen a mensajes para el usuario que dicen QUÉ REGLA y QUÉ HACER (PRD §13, regla 6).
// No se inventan reglas: solo se catalogan los códigos definidos en el PRD.

export const ERROR_MESSAGES = {
  SOD_VIOLATION: {
    rule: "Segregación de funciones: usted no puede realizar esta acción sobre este registro.",
    action: "Solicite que otra persona autorizada la realice.",
  },
  FORBIDDEN_ROLE: {
    rule: "Su rol no permite esta acción.",
    action: "Solicite el permiso a Administración si lo necesita.",
  },
  RECORD_LOCKED: {
    rule: "El registro está firmado y bloqueado.",
    action: "Registre una corrección con motivo o cree una versión nueva en borrador.",
  },
  INVALID_TRANSITION: {
    rule: "El registro no puede pasar a ese estado desde el estado actual.",
    action: "Revise el flujo del registro y complete los pasos previos.",
  },
  REAUTH_FAILED: {
    rule: "No se pudo confirmar su identidad.",
    action: "Verifique su contraseña y su segundo factor e intente de nuevo.",
  },
  NO_APPROVED_VERSION: {
    rule: "No hay una versión aprobada del documento maestro.",
    action: "Solicite la aprobación al Director técnico.",
  },
  DOCUMENT_NOT_EFFECTIVE: {
    rule: "El documento no está vigente.",
    action: "Use la versión vigente o solicite su publicación a Aseguramiento de la calidad.",
  },
  LOT_NOT_APPROVED: {
    rule: "El lote no está aprobado por Control de calidad.",
    action: "Espere la liberación del lote o elija otro lote aprobado.",
  },
  LOT_EXPIRED: {
    rule: "El lote está vencido.",
    action: "Elija otro lote aprobado y vigente.",
  },
  EQUIPMENT_NOT_VALID: {
    rule: "El equipo no tiene calibración o limpieza vigente.",
    action: "Registre una desviación o use otro equipo.",
  },
  CLEARANCE_MISSING: {
    rule: "Falta el despeje de línea verificado.",
    action: "Complete y verifique el despeje de línea antes de iniciar la etapa.",
  },
  RELEASE_BLOCKED: {
    rule: "La liberación está bloqueada.",
    action: "Resuelva las causas listadas antes de liberar.",
  },
  REAUTH_LOCKED: {
    rule: "La firma está bloqueada temporalmente por intentos fallidos de contraseña.",
    action: "Espere unos minutos o solicite el desbloqueo a Administración.",
  },
  MFA_REQUIRED: {
    rule: "Esta firma exige un segundo factor de autenticación.",
    action: "Confirme su identidad con el segundo factor e intente de nuevo.",
  },
  RECORD_NOT_FOUND: {
    rule: "El registro no existe o no admite esta operación.",
    action: "Actualice la página y verifique el registro.",
  },
  REASON_REQUIRED: {
    rule: "Toda corrección exige un motivo.",
    action: "Escriba el motivo de la corrección.",
  },
  INVALID_FIELD: {
    rule: "Este campo no se puede corregir.",
    action: "Corrija solo los datos registrados del formato.",
  },
  NO_CHANGE: {
    rule: "El nuevo valor es igual al vigente.",
    action: "Escriba un valor distinto o cancele la corrección.",
  },
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class AppError extends Error {
  readonly code: ErrorCode | "UNEXPECTED";
  readonly rule: string;
  readonly action: string;
  readonly details?: string;

  constructor(code: ErrorCode | "UNEXPECTED", details?: string) {
    const msg =
      code === "UNEXPECTED"
        ? {
            rule: "Ocurrió un error inesperado.",
            action: "Intente de nuevo. Si continúa, informe el código de referencia.",
          }
        : ERROR_MESSAGES[code];
    super(`${msg.rule} ${msg.action}`);
    this.name = "AppError";
    this.code = code;
    this.rule = msg.rule;
    this.action = msg.action;
    this.details = details;
  }
}

function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_MESSAGES, value);
}

/**
 * Convierte cualquier error (de Postgres/PostgREST, de red o de la app) en AppError.
 * La base levanta `raise exception 'CODIGO: detalle'`; se toma el código antes de «:».
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const [head, ...rest] = message.split(":");
  const code = head.trim();
  if (isErrorCode(code)) return new AppError(code, rest.join(":").trim() || undefined);
  return new AppError("UNEXPECTED", message);
}
