import type { AppRole } from "@/lib/auth/roles";

export type AdminUserRole = {
  id: string;
  role: AppRole;
  granted_at: string;
  expires_at: string | null;
  active: boolean;
};

export type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  area_id: string | null;
  area_name: string | null;
  active: boolean;
  short_signature: string | null;
  roles: AdminUserRole[];
  last_sign_in_at: string | null;
  invitation_pending: boolean;
  must_change_password: boolean;
};

export type AreaOption = { id: string; name: string; process_code: string | null };
