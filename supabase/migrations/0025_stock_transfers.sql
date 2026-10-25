-- 0025_stock_transfers.sql · Etapa E5 (PRD F4)
-- Traslados entre bodegas y envíos a bodegas externas (RF-25, S-42): borrador → despachado (en tránsito) →
-- recibido | anulado. Prepara bodega (firma «Ejecuté» al despachar), aprueba el jefe de bodega (firma «Aprobé»;
-- otra persona) y se firma la recepción con el acta. Solo salen lotes aprobados y vigentes (LOT_NOT_APPROVED,
-- LOT_EXPIRED); una bodega externa exige tercero calificado y vigente (EXTERNAL_SITE_NOT_QUALIFIED, AC-24).

insert into public.numbering_sequences (key, format, description) values
  ('stock_transfer', 'TR-{YYYY}-{NNNN}', 'Traslados entre bodegas y envíos a bodegas externas (Prompt 0B: TR-2026-0007).');

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  from_warehouse_id uuid not null references public.warehouses (id),
  to_warehouse_id uuid not null references public.warehouses (id),
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'borrador' check (status in ('borrador', 'despachado', 'recibido', 'anulado')),
  dispatched_by uuid references public.profiles (id),
  dispatched_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  received_by uuid references public.profiles (id),
  received_at timestamptz,
  reception_ref text,
  cancel_reason text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (from_warehouse_id <> to_warehouse_id)
);

comment on table public.stock_transfers is 'Traslados y envíos a bodegas externas (RF-25). Estados del PRD 9: borrador → despachado → recibido | anulado.';
select app_private.register_table('public.stock_transfers', p_no_delete => true);
insert into public.signable_tables (table_name, label, kind, author_column)
values ('stock_transfers', 'Traslado entre bodegas', 'traslado', 'created_by');

create table public.stock_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers (id),
  lot_id uuid not null references public.material_lots (id),
  qty numeric(14, 4) not null check (qty > 0),
  from_location_id uuid not null references public.storage_locations (id),
  to_location_id uuid references public.storage_locations (id),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.stock_transfer_lines is 'Líneas del traslado: lote, cantidad, ubicación de origen y de destino (esta se asigna al recibir).';
select app_private.register_table('public.stock_transfer_lines');

alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_lines enable row level security;
create policy "inventory readers" on public.stock_transfers for select to authenticated
  using (public.can_read_inventory() or public.can_read_warehouses());
create policy "inventory readers" on public.stock_transfer_lines for select to authenticated
  using (public.can_read_inventory() or public.can_read_warehouses());
create policy "inventory readers read transfer signatures" on public.signatures for select to authenticated
  using (record_table = 'stock_transfers' and (public.can_read_inventory() or public.can_read_warehouses()));
revoke all on table public.stock_transfers, public.stock_transfer_lines from anon;
revoke insert, update, delete, truncate on table public.stock_transfers, public.stock_transfer_lines from authenticated;

-- Las líneas de un traslado despachado, recibido o anulado no cambian.
create or replace function public.protect_transfer_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.stock_transfers
  where id = case when tg_op = 'DELETE' then old.transfer_id else new.transfer_id end;
  if v_status = 'borrador' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Al recibir solo se asigna la ubicación de destino.
  if tg_op = 'UPDATE' and v_status = 'despachado' and old.qty = new.qty and old.lot_id = new.lot_id
     and old.from_location_id = new.from_location_id then
    return new;
  end if;
  raise exception 'RECORD_LOCKED: el traslado está %; sus líneas no cambian', v_status;
end;
$$;
create trigger stock_transfer_lines_protect before insert or update or delete on public.stock_transfer_lines
  for each row execute function public.protect_transfer_lines();
revoke execute on function public.protect_transfer_lines() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validaciones comunes
-- ---------------------------------------------------------------------------
create or replace function app_private.check_transfer_destination(p_warehouse uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_wh public.warehouses;
  v_party public.external_parties;
begin
  select * into v_wh from public.warehouses where id = p_warehouse;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe la bodega de destino';
  end if;
  if v_wh.site_type = 'externa' then
    select * into v_party from public.external_parties where id = v_wh.external_party_id;
    if not public.party_is_qualified(v_party.id) then
      raise exception 'EXTERNAL_SITE_NOT_QUALIFIED: %: %. No se pueden enviar materiales a esta bodega',
        v_party.name,
        case when v_party.qualified and v_party.qualification_expires is not null
             then 'calificación vencida el ' || to_char(v_party.qualification_expires, 'DD/MM/YYYY')
             else 'sin calificación vigente' end;
    end if;
  end if;
  if v_wh.status <> 'activa' then
    raise exception 'LOCATION_RULE_VIOLATION: la bodega % no está activa (%)', v_wh.code, replace(v_wh.status, '_', ' ');
  end if;
end;
$$;
revoke execute on function app_private.check_transfer_destination(uuid) from public, anon, authenticated;

-- Lote apto para salir: aprobado, vigente y con existencias en la ubicación de origen de la bodega de origen.
create or replace function app_private.check_transfer_line(p_from_warehouse uuid, p_to_warehouse uuid, p_line jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.v_lot_stock;
  v_avail numeric;
  v_from uuid := (p_line ->> 'from_location_id')::uuid;
  v_to uuid := nullif(p_line ->> 'to_location_id', '')::uuid;
  v_qty numeric := (p_line ->> 'qty')::numeric;
begin
  select * into v from public.v_lot_stock where id = (p_line ->> 'lot_id')::uuid;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el lote';
  end if;
  if v.status <> 'aprobado' then
    raise exception 'LOT_NOT_APPROVED: el lote % está en %; los lotes en cuarentena o rechazados no salen de la bodega',
      v.internal_code, v.status;
  end if;
  if v.effective_status = 'vencido' then
    raise exception 'LOT_EXPIRED: el lote % venció el %', v.internal_code, to_char(v.expiry_date, 'DD/MM/YYYY');
  end if;
  if v_qty is null or v_qty <= 0 then
    raise exception 'INVALID_FIELD: la cantidad de cada línea debe ser mayor que cero';
  end if;
  if not exists (select 1 from public.storage_locations where id = v_from and warehouse_id = p_from_warehouse) then
    raise exception 'INVALID_FIELD: la ubicación de origen no pertenece a la bodega de origen';
  end if;
  select qty into v_avail from public.stock_by_location where lot_id = v.id and location_id = v_from;
  if coalesce(v_avail, 0) < v_qty then
    raise exception 'INSUFFICIENT_STOCK: el lote % tiene % en la ubicación de origen y se piden %', v.internal_code,
      coalesce(v_avail, 0), v_qty;
  end if;
  if v_to is not null then
    if not exists (select 1 from public.storage_locations where id = v_to and warehouse_id = p_to_warehouse) then
      raise exception 'INVALID_FIELD: la ubicación de destino no pertenece a la bodega de destino';
    end if;
    perform app_private.check_location(v_to, 'aprobado', app_private.material_class(v.material_type), false);
  end if;
end;
$$;
revoke execute on function app_private.check_transfer_line(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------
create or replace function public.save_transfer_draft(p_id uuid, p_from uuid, p_to uuid, p_reason text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.stock_transfers;
  v_line jsonb;
begin
  if not public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'create') then
    raise exception 'FORBIDDEN_ROLE: los traslados los prepara bodega';
  end if;
  perform app_private.require_reason(p_reason);
  if p_from = p_to then
    raise exception 'INVALID_FIELD: el origen y el destino son la misma bodega';
  end if;
  if exists (select 1 from public.warehouses where id = p_from and (site_type = 'externa' or status <> 'activa')) then
    raise exception 'INVALID_FIELD: el origen es una bodega interna activa';
  end if;
  perform app_private.check_transfer_destination(p_to);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'INVALID_FIELD: agregue al menos una línea';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    perform app_private.check_transfer_line(p_from, p_to, v_line);
  end loop;
  perform set_config('app.audit_reason', trim(p_reason), true);
  if p_id is null then
    insert into public.stock_transfers (code, from_warehouse_id, to_warehouse_id, reason)
    values (public.next_number('stock_transfer'), p_from, p_to, trim(p_reason)) returning * into v_t;
  else
    select * into v_t from public.stock_transfers where id = p_id for update;
    if not found then
      raise exception 'RECORD_NOT_FOUND: no existe el traslado';
    end if;
    if v_t.status <> 'borrador' then
      raise exception 'RECORD_LOCKED: el traslado % está %', v_t.code, v_t.status;
    end if;
    update public.stock_transfers set from_warehouse_id = p_from, to_warehouse_id = p_to, reason = trim(p_reason)
    where id = p_id returning * into v_t;
    delete from public.stock_transfer_lines where transfer_id = p_id;
  end if;
  insert into public.stock_transfer_lines (transfer_id, lot_id, qty, from_location_id, to_location_id)
  select v_t.id, (l ->> 'lot_id')::uuid, (l ->> 'qty')::numeric, (l ->> 'from_location_id')::uuid,
         nullif(l ->> 'to_location_id', '')::uuid
  from jsonb_array_elements(p_lines) l;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('id', v_t.id, 'code', v_t.code);
end;
$$;

-- Despacho: quien prepara firma «Ejecuté»; el jefe de bodega (otra persona) firma «Aprobé» y sale el material.
create or replace function public.dispatch_transfer(p_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.stock_transfers;
  v_res jsonb;
  v_line record;
  v_signed boolean;
begin
  select * into v_t from public.stock_transfers where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el traslado';
  end if;
  if v_t.status <> 'borrador' then
    raise exception 'INVALID_TRANSITION: el traslado % está %', v_t.code, v_t.status;
  end if;
  perform app_private.check_transfer_destination(v_t.to_warehouse_id);
  for v_line in select * from public.stock_transfer_lines where transfer_id = p_id loop
    perform app_private.check_transfer_line(v_t.from_warehouse_id, v_t.to_warehouse_id, to_jsonb(v_line));
  end loop;
  v_signed := exists (select 1 from public.signatures where record_table = 'stock_transfers' and record_id = p_id and meaning = 'ejecuto');

  if not v_signed then
    if not public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'create') then
      raise exception 'FORBIDDEN_ROLE: el despacho lo firma bodega';
    end if;
    v_res := app_private.sign_simple('stock_transfers', p_id, 'ejecuto', p_password, null,
      app_private.first_role(array['bodega_aux', 'bodega_jefe']));
    if (v_res ->> 'ok')::boolean then
      update public.stock_transfers set dispatched_by = auth.uid(), dispatched_at = now() where id = p_id;
    end if;
    return v_res || jsonb_build_object('status', 'borrador', 'next', 'aprobacion');
  end if;

  if not public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'approve') then
    raise exception 'FORBIDDEN_ROLE: aprueba el despacho el jefe de bodega';
  end if;
  if v_t.dispatched_by = auth.uid() then
    raise exception 'SOD_VIOLATION: quien despacha no aprueba el mismo traslado';
  end if;
  v_res := app_private.sign_simple('stock_transfers', p_id, 'aprobo', p_password, null, 'bodega_jefe');
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', 'Despacho del traslado ' || v_t.code, true);
  insert into public.inventory_movements (lot_id, type, qty, from_location_id, ref_table, ref_id, ref_code, reason)
  select l.lot_id,
    case when w.site_type = 'externa' then 'envio_externo' else 'traslado' end,
    l.qty, l.from_location_id, 'stock_transfers', p_id, v_t.code, v_t.reason
  from public.stock_transfer_lines l join public.warehouses w on w.id = v_t.to_warehouse_id
  where l.transfer_id = p_id;
  update public.stock_transfers set status = 'despachado', approved_by = auth.uid(), approved_at = now() where id = p_id;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('status', 'despachado');
end;
$$;

-- Recepción con el acta del destino y la ubicación de cada línea.
create or replace function public.receive_transfer(p_id uuid, p_locations jsonb, p_reference text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.stock_transfers;
  v_wh public.warehouses;
  v_line record;
  v_loc uuid;
  v_res jsonb;
begin
  if not public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'create') then
    raise exception 'FORBIDDEN_ROLE: la recepción del traslado la registra bodega';
  end if;
  select * into v_t from public.stock_transfers where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el traslado';
  end if;
  if v_t.status <> 'despachado' then
    raise exception 'INVALID_TRANSITION: el traslado % está %; se recibe después del despacho', v_t.code, v_t.status;
  end if;
  select * into v_wh from public.warehouses where id = v_t.to_warehouse_id;
  if v_wh.site_type = 'externa' and coalesce(length(trim(p_reference)), 0) = 0 then
    raise exception 'INVALID_FIELD: registre la referencia del acta de recepción del maquilador';
  end if;
  v_res := app_private.sign_simple('stock_transfers', p_id, 'verifico', p_password, null,
    app_private.first_role(array['bodega_jefe', 'bodega_aux']));
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  perform set_config('app.audit_reason', 'Recepción del traslado ' || v_t.code, true);
  for v_line in select l.*, m.type as material_type from public.stock_transfer_lines l
                join public.material_lots ml on ml.id = l.lot_id join public.materials m on m.id = ml.material_id
                where l.transfer_id = p_id loop
    v_loc := coalesce(nullif(p_locations ->> v_line.id::text, '')::uuid, v_line.to_location_id);
    if v_loc is null or not exists (select 1 from public.storage_locations where id = v_loc and warehouse_id = v_t.to_warehouse_id) then
      raise exception 'INVALID_FIELD: asigne una ubicación de la bodega de destino a cada línea';
    end if;
    perform app_private.check_location(v_loc, app_private.lot_rule_status(v_line.lot_id),
      app_private.material_class(v_line.material_type), false);
    update public.stock_transfer_lines set to_location_id = v_loc where id = v_line.id;
    insert into public.inventory_movements (lot_id, type, qty, to_location_id, ref_table, ref_id, ref_code, reason)
    values (v_line.lot_id, case when v_wh.site_type = 'externa' then 'recepcion_externa' else 'traslado' end,
            v_line.qty, v_loc, 'stock_transfers', p_id, v_t.code, 'Recepción');
  end loop;
  update public.stock_transfers set status = 'recibido', received_by = auth.uid(), received_at = now(),
    reception_ref = nullif(trim(p_reference), ''), locked_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
  return v_res || jsonb_build_object('status', 'recibido');
end;
$$;

create or replace function public.cancel_transfer(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.stock_transfers;
begin
  if not public.has_module_permission('traslados_y_envios_a_bodegas_externas', 'create') then
    raise exception 'FORBIDDEN_ROLE: anula el traslado bodega';
  end if;
  perform app_private.require_reason(p_reason);
  select * into v_t from public.stock_transfers where id = p_id for update;
  if not found then
    raise exception 'RECORD_NOT_FOUND: no existe el traslado';
  end if;
  if v_t.status <> 'borrador' then
    raise exception 'INVALID_TRANSITION: solo se anula un traslado en borrador (está %)', v_t.status;
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.stock_transfers set status = 'anulado', cancel_reason = trim(p_reason), locked_at = now() where id = p_id;
  perform set_config('app.audit_reason', '', true);
  return jsonb_build_object('ok', true, 'status', 'anulado');
end;
$$;

revoke execute on function public.save_transfer_draft(uuid, uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.dispatch_transfer(uuid, text) from public, anon;
revoke execute on function public.receive_transfer(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.cancel_transfer(uuid, text) from public, anon;
grant execute on function public.save_transfer_draft(uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.dispatch_transfer(uuid, text) to authenticated;
grant execute on function public.receive_transfer(uuid, jsonb, text, text) to authenticated;
grant execute on function public.cancel_transfer(uuid, text) to authenticated;
