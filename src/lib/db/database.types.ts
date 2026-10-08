export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          ip: string | null
          reason: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: number
          ip?: string | null
          reason?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: number
          ip?: string | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          created_at: string
          created_by: string | null
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string
          record_id: string
          record_table: string
          short_signature: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          created_at?: string
          created_by?: string | null
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason: string
          record_id: string
          record_table: string
          short_signature: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string
          record_id?: string
          record_table?: string
          short_signature?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_record_table_fkey"
            columns: ["record_table"]
            isOneToOne: false
            referencedRelation: "signable_tables"
            referencedColumns: ["table_name"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          created_by: string | null
          failed_count: number
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      numbering_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          format: string
          key: string
          last_value: number
          updated_at: string
          updated_by: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          format: string
          key: string
          last_value?: number
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          format?: string
          key?: string
          last_value?: number
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          area_id: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          email: string
          full_name: string
          id: string
          job_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sign_attempts: {
        Row: {
          created_at: string
          created_by: string | null
          failed_count: number
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sign_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meaning: Database["public"]["Enums"]["signature_meaning"]
          requires_meaning:
            | Database["public"]["Enums"]["signature_meaning"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          sets_status: string | null
          table_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meaning: Database["public"]["Enums"]["signature_meaning"]
          requires_meaning?:
            | Database["public"]["Enums"]["signature_meaning"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          sets_status?: string | null
          table_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meaning?: Database["public"]["Enums"]["signature_meaning"]
          requires_meaning?:
            | Database["public"]["Enums"]["signature_meaning"]
            | null
          role?: Database["public"]["Enums"]["app_role"]
          sets_status?: string | null
          table_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_permissions_table_name_fkey"
            columns: ["table_name"]
            isOneToOne: false
            referencedRelation: "signable_tables"
            referencedColumns: ["table_name"]
          },
        ]
      }
      signable_tables: {
        Row: {
          author_column: string
          created_at: string
          created_by: string | null
          group_column: string | null
          is_document: boolean
          is_execution: boolean
          is_quality: boolean
          kind: string
          label: string
          table_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          author_column?: string
          created_at?: string
          created_by?: string | null
          group_column?: string | null
          is_document?: boolean
          is_execution?: boolean
          is_quality?: boolean
          kind: string
          label: string
          table_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          author_column?: string
          created_at?: string
          created_by?: string | null
          group_column?: string | null
          is_document?: boolean
          is_execution?: boolean
          is_quality?: boolean
          kind?: string
          label?: string
          table_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      signature_registry: {
        Row: {
          created_at: string
          created_by: string | null
          registered_at: string
          short_signature: string
          specimen_file: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          registered_at?: string
          short_signature: string
          specimen_file?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          registered_at?: string
          short_signature?: string
          specimen_file?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_registry_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          created_at: string
          created_by: string | null
          group_key: string | null
          id: string
          meaning: Database["public"]["Enums"]["signature_meaning"]
          reason: string | null
          reauth_method: string
          record_hash: string
          record_id: string
          record_table: string
          short_signature: string
          signed_as: Database["public"]["Enums"]["app_role"]
          signed_at: string
          signer_name: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_key?: string | null
          id?: string
          meaning: Database["public"]["Enums"]["signature_meaning"]
          reason?: string | null
          reauth_method: string
          record_hash: string
          record_id: string
          record_table: string
          short_signature: string
          signed_as: Database["public"]["Enums"]["app_role"]
          signed_at?: string
          signer_name: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_key?: string | null
          id?: string
          meaning?: Database["public"]["Enums"]["signature_meaning"]
          reason?: string | null
          reauth_method?: string
          record_hash?: string
          record_id?: string
          record_table?: string
          short_signature?: string
          signed_as?: Database["public"]["Enums"]["app_role"]
          signed_at?: string
          signer_name?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_record_table_fkey"
            columns: ["record_table"]
            isOneToOne: false
            referencedRelation: "signable_tables"
            referencedColumns: ["table_name"]
          },
          {
            foreignKeyName: "signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_cross_rules: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string
          kind: string | null
          meaning: Database["public"]["Enums"]["signature_meaning"]
          prior_kind: string | null
          prior_meaning: Database["public"]["Enums"]["signature_meaning"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description: string
          kind?: string | null
          meaning: Database["public"]["Enums"]["signature_meaning"]
          prior_kind?: string | null
          prior_meaning: Database["public"]["Enums"]["signature_meaning"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          kind?: string | null
          meaning?: Database["public"]["Enums"]["signature_meaning"]
          prior_kind?: string | null
          prior_meaning?: Database["public"]["Enums"]["signature_meaning"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_record_corrections: {
        Row: {
          corrections_count: number | null
          last_corrected_at: string | null
          record_id: string | null
          record_table: string | null
          warning: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "corrections_record_table_fkey"
            columns: ["record_table"]
            isOneToOne: false
            referencedRelation: "signable_tables"
            referencedColumns: ["table_name"]
          },
        ]
      }
    }
    Functions: {
      can_read_audit: { Args: never; Returns: boolean }
      can_sign: {
        Args: {
          p_meaning: Database["public"]["Enums"]["signature_meaning"]
          p_record_id: string
          p_table: string
        }
        Returns: Json
      }
      check_sod: {
        Args: {
          p_meaning: Database["public"]["Enums"]["signature_meaning"]
          p_record_id: string
          p_row: Json
          p_table: string
          p_user: string
        }
        Returns: undefined
      }
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      format_sequence_code: {
        Args: { p_format: string; p_value: number; p_year: number }
        Returns: string
      }
      get_audit_trail: {
        Args: { p_record_id: string; p_table: string }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          actor_short_signature: string
          after: Json
          at: string
          before: Json
          id: number
          reason: string
          table_name: string
        }[]
      }
      get_my_context: { Args: never; Returns: Json }
      get_setting: { Args: { p_key: string }; Returns: Json }
      has_any_role: {
        Args: { p_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      health_check: { Args: never; Returns: Json }
      hook_password_verification_attempt: {
        Args: { event: Json }
        Returns: Json
      }
      log_session_event: { Args: { p_action: string }; Returns: undefined }
      next_number: { Args: { p_key: string }; Returns: string }
      record_correction: {
        Args: {
          p_field: string
          p_new_value: Json
          p_reason: string
          p_record_id: string
          p_table: string
        }
        Returns: Json
      }
      record_hash: { Args: { p_row: Json }; Returns: string }
      reference_now: { Args: never; Returns: string }
      server_now: { Args: never; Returns: string }
      short_signature_of: { Args: { p_full_name: string }; Returns: string }
      sign_record: {
        Args: {
          p_meaning: Database["public"]["Enums"]["signature_meaning"]
          p_password: string
          p_reason?: string
          p_record_id: string
          p_table: string
        }
        Returns: Json
      }
      user_active_roles: {
        Args: { p_user: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      verify_signature_integrity: {
        Args: { p_signature_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "comercial"
        | "idi"
        | "bodega_aux"
        | "bodega_jefe"
        | "prod_aux"
        | "prod_coord"
        | "lab_aux"
        | "cc_jefe"
        | "aq_dir"
        | "dt"
        | "admin"
        | "master"
        | "aq_doc"
        | "gerencia"
        | "auditor"
      signature_meaning:
        | "ejecuto"
        | "verifico"
        | "reviso"
        | "aprobo"
        | "libero"
        | "actualizo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
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
      ],
      signature_meaning: [
        "ejecuto",
        "verifico",
        "reviso",
        "aprobo",
        "libero",
        "actualizo",
      ],
    },
  },
} as const
