"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Verdadero cuando el componente ya es interactivo (después de la hidratación); falso en el servidor. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
