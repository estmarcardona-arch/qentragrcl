import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { toAppError } from "@/lib/errors";

/*
 * Envoltorio tipado de las funciones SQL (RPC). El cliente solo muta datos por aquí
 * (AGENTS.md regla 4). Nombres, argumentos y retorno salen de los tipos generados.
 * Los errores de la base se convierten en AppError (código del PRD + regla + qué hacer).
 */

type Functions = Database["public"]["Functions"];
export type RpcName = keyof Functions;
export type RpcArgs<N extends RpcName> = Functions[N]["Args"];
export type RpcReturn<N extends RpcName> = Functions[N]["Returns"];

export type DbClient = SupabaseClient<Database>;

export async function callRpc<N extends RpcName>(
  client: DbClient,
  name: N,
  ...args: RpcArgs<N> extends never ? [] : [RpcArgs<N>]
): Promise<RpcReturn<N>> {
  // supabase-js tipa rpc() con los mismos genéricos; la conversión solo une la firma variádica.
  const rpc = client.rpc.bind(client) as unknown as (
    fn: N,
    params?: RpcArgs<N>,
  ) => PromiseLike<{ data: RpcReturn<N> | null; error: unknown }>;
  const { data, error } = await rpc(name, args[0]);
  if (error) throw toAppError(error);
  return data as RpcReturn<N>;
}
