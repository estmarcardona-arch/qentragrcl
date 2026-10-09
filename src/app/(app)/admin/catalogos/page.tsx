import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { CatalogEditor, type FieldDef } from "@/components/admin/catalog-editor";
import { PermissionMatrix, type MatrixRow } from "@/components/admin/permission-matrix";
import { RegulatoryProfiles, type ProfileRule } from "@/components/admin/regulatory-profiles";
import { RolesManager, type ReservedPermission } from "@/components/admin/roles-manager";
import { SettingsEditor, type Setting } from "@/components/admin/settings-editor";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/state-card";
import type { RoleInfo } from "@/lib/auth/roles";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Catálogos y configuración · GRUFARCOL eBR" };

const TABS = [
  ["roles", "Roles y permisos"],
  ["areas", "Áreas"],
  ["lineas", "Líneas de producto"],
  ["perfiles", "Perfiles regulatorios"],
  ["catalogos", "Catálogos"],
  ["retencion", "Retención"],
  ["marcas", "Marcas / maquila"],
  ["matriz", "Matriz de permisos"],
  ["configuracion", "Configuración"],
] as const;
type Tab = (typeof TABS)[number][0];

const GENERIC = [
  ["unidades", "Unidades"],
  ["tipos_material", "Tipos de material"],
  ["tipos_equipo", "Tipos de equipo"],
  ["clasificacion_desviacion", "Clasificación de desviaciones"],
  ["motivos_correccion", "Motivos de corrección"],
] as const;

// S-04 · Catálogos y perfiles regulatorios (RF-04, RF-06). Guarda de administrador en el layout.
export default async function CatalogsPage({ searchParams }: PageProps<"/admin/catalogos">) {
  const sp = await searchParams;
  const tab = (TABS.find(([t]) => t === sp.tab)?.[0] ?? "roles") as Tab;
  const catalog = GENERIC.find(([c]) => c === sp.c)?.[0] ?? "unidades";

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title="Catálogos y configuración"
        description="Catálogos versionados con bitácora: todo cambio exige motivo. Nada se borra; se desactiva."
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Administración" },
          { label: "Catálogos y configuración" },
        ]}
      />
      <nav aria-label="Catálogos" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/admin/catalogos?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm no-underline",
              t === tab
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-strong",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <TabContent tab={tab} catalog={catalog} />
    </main>
  );
}

async function TabContent({ tab, catalog }: { tab: Tab; catalog: (typeof GENERIC)[number][0] }) {
  const supabase = await createClient();

  if (tab === "roles") {
    const [{ data: roles }, { data: assigned }, { data: reserved }, { data: modules }] =
      await Promise.all([
        supabase.from("roles").select("*").order("is_system", { ascending: false }).order("name"),
        supabase.rpc("admin_list_users"),
        supabase.from("reserved_permissions").select("module_code, permission, owner_role, reason"),
        supabase.from("permission_modules").select("code, name"),
      ]);
    const holders: Record<string, number> = {};
    for (const u of (assigned ?? []) as unknown as {
      active: boolean;
      roles: { role: string; active: boolean }[];
    }[]) {
      if (!u.active) continue;
      for (const r of u.roles) if (r.active) holders[r.role] = (holders[r.role] ?? 0) + 1;
    }
    const reservedRows: ReservedPermission[] = (reserved ?? []).map((r) => ({
      ...r,
      module_name: modules?.find((m) => m.code === r.module_code)?.name ?? r.module_code,
    }));
    return (
      <RolesManager roles={(roles ?? []) as RoleInfo[]} holders={holders} reserved={reservedRows} />
    );
  }

  if (tab === "areas") {
    const { data: areas } = await supabase
      .from("organizational_areas")
      .select(
        "id, code, name, process_code, parent_id, head_user_id, is_quality_owner, active, version",
      )
      .order("code");
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name");
    const areaOptions = (areas ?? []).map((a) => ({ value: a.id, label: a.name }));
    const rows = (areas ?? []).map((a) => ({
      ...a,
      parent_name: areas?.find((p) => p.id === a.parent_id)?.name ?? "—",
      head_name: people?.find((p) => p.id === a.head_user_id)?.full_name ?? "—",
      owner: a.is_quality_owner ? "Dueña del SGD" : "",
    }));
    const fields: FieldDef[] = [
      { name: "code", label: "Código", type: "text", createOnly: true, mono: true },
      { name: "name", label: "Nombre", type: "text" },
      { name: "process_code", label: "Sigla de proceso (documentos)", type: "text", mono: true },
      { name: "parent_id", label: "Depende de", type: "select", options: areaOptions },
      {
        name: "head_user_id",
        label: "Jefe del área",
        type: "select",
        options: (people ?? []).map((p) => ({ value: p.id, label: p.full_name })),
      },
      { name: "active", label: "Activa", type: "checkbox" },
    ];
    return (
      <CatalogEditor
        table="organizational_areas"
        title="Áreas de la empresa"
        rows={rows}
        fields={fields}
        columns={[
          ["code", "Código"],
          ["name", "Nombre"],
          ["process_code", "Sigla"],
          ["parent_name", "Depende de"],
          ["head_name", "Jefe"],
          ["owner", "SGD"],
          ["active", "Estado"],
        ]}
      />
    );
  }

  if (tab === "lineas") {
    const { data } = await supabase.from("product_lines").select("*").order("code");
    return (
      <CatalogEditor
        table="product_lines"
        title="Líneas de producto"
        rows={data ?? []}
        fields={[
          { name: "code", label: "Código", type: "text", createOnly: true, mono: true },
          { name: "name", label: "Nombre", type: "text" },
          {
            name: "regulatory_profile",
            label: "Perfil regulatorio",
            type: "select",
            options: [
              { value: "cosmetico", label: "Cosmético" },
              { value: "medicamento", label: "Medicamento" },
            ],
          },
          { name: "active", label: "Activa", type: "checkbox" },
        ]}
        columns={[
          ["code", "Código"],
          ["name", "Nombre"],
          ["regulatory_profile", "Perfil regulatorio"],
          ["active", "Estado"],
        ]}
      />
    );
  }

  if (tab === "perfiles") {
    const { data } = await supabase
      .from("regulatory_profiles")
      .select("id, profile, rule_key, label, enabled, mode, version")
      .order("rule_key");
    return <RegulatoryProfiles rules={(data ?? []) as ProfileRule[]} />;
  }

  if (tab === "catalogos") {
    const { data } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("catalog", catalog)
      .order("order_no");
    return (
      <div className="grid gap-3">
        <nav aria-label="Catálogo" className="flex flex-wrap gap-2">
          {GENERIC.map(([c, label]) => (
            <Link
              key={c}
              href={`/admin/catalogos?tab=catalogos&c=${c}`}
              aria-current={c === catalog ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm no-underline",
                c === catalog
                  ? "border-primary bg-primary text-white"
                  : "border-border-control bg-white text-text-strong",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <CatalogEditor
          table="catalog_items"
          title={GENERIC.find(([c]) => c === catalog)![1]}
          rows={data ?? []}
          fixed={{ catalog }}
          fields={[
            { name: "code", label: "Código", type: "text", createOnly: true, mono: true },
            { name: "name", label: "Nombre", type: "text" },
            { name: "description", label: "Descripción", type: "text" },
            { name: "order_no", label: "Orden", type: "number" },
            { name: "active", label: "Activo", type: "checkbox" },
          ]}
          columns={[
            ["code", "Código"],
            ["name", "Nombre"],
            ["description", "Descripción"],
            ["active", "Estado"],
          ]}
        />
      </div>
    );
  }

  if (tab === "retencion") {
    const { data } = await supabase.from("retention_rules").select("*").order("record_class");
    return (
      <CatalogEditor
        table="retention_rules"
        title="Reglas de retención (RNF-05)"
        rows={data ?? []}
        allowCreate={false}
        fields={[
          { name: "label", label: "Clase de registro", type: "text" },
          { name: "years", label: "Años", type: "number" },
          {
            name: "basis",
            label: "Desde",
            type: "select",
            options: [
              { value: "desde_obsolescencia", label: "Desde la obsolescencia" },
              { value: "desde_vencimiento_registro", label: "Desde el vencimiento del registro" },
              { value: "vida_util_equipo", label: "Vida útil del equipo" },
              { value: "norma_aplicable", label: "Según norma aplicable" },
            ],
          },
          { name: "note", label: "Nota", type: "text" },
        ]}
        columns={[
          ["label", "Clase de registro"],
          ["years", "Años"],
          ["basis", "Desde"],
          ["note", "Nota"],
        ]}
      />
    );
  }

  if (tab === "marcas") {
    const [{ data: setting }, { data: brands }] = await Promise.all([
      supabase
        .from("app_settings")
        .select("key, value, description, updated_at")
        .eq("key", "maquila_enabled"),
      supabase.from("brands").select("*").order("name"),
    ]);
    const enabled = setting?.[0]?.value === true;
    return (
      <div className="grid gap-4">
        <SettingsEditor settings={(setting ?? []) as Setting[]} />
        {enabled ? (
          <CatalogEditor
            table="brands"
            title="Marcas / clientes de maquila"
            rows={brands ?? []}
            fields={[
              { name: "name", label: "Nombre", type: "text" },
              { name: "active", label: "Activa", type: "checkbox" },
            ]}
            columns={[
              ["name", "Nombre"],
              ["active", "Estado"],
            ]}
          />
        ) : (
          <EmptyState
            title="La maquila está desactivada"
            text="Active «maquila_enabled» si GRUFARCOL fabrica para terceros (D-01, por confirmar con Dirección)."
          />
        )}
      </div>
    );
  }

  if (tab === "matriz") {
    const [{ data: modules }, { data: perms }, { data: catalog }] = await Promise.all([
      supabase.from("permission_modules").select("code, name, order_no").order("order_no"),
      supabase.from("module_permissions").select("module_code, role, cell_text"),
      supabase.from("roles").select("*").order("created_at"),
    ]);
    // Roles del sistema en el orden del PRD 2.2; después los adicionales.
    const ORDER = [
      "comercial",
      "idi",
      "bodega_aux",
      "bodega_jefe",
      "prod_aux",
      "prod_coord",
      "lab_aux",
      "cc_jefe",
      "aq_dir",
      "dt",
      "admin",
      "master",
      "aq_doc",
      "gerencia",
      "auditor",
    ];
    const roles = ((catalog ?? []) as RoleInfo[]).sort(
      (a, b) => (ORDER.indexOf(a.code) + 1 || 99) - (ORDER.indexOf(b.code) + 1 || 99),
    );
    const rows: MatrixRow[] = (modules ?? []).map((m) => ({
      code: m.code,
      name: m.name,
      cells: Object.fromEntries(
        (perms ?? []).filter((p) => p.module_code === m.code).map((p) => [p.role, p.cell_text]),
      ),
    }));
    return <PermissionMatrix roles={roles} rows={rows} />;
  }

  const { data } = await supabase
    .from("app_settings")
    .select("key, value, description, updated_at")
    .neq("key", "maquila_enabled")
    .order("key");
  return <SettingsEditor settings={(data ?? []) as Setting[]} />;
}
