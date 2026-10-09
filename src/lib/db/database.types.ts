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
      approval_route_steps: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          includes_author_head: boolean
          roles: string[]
          route_id: string
          step: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          includes_author_head?: boolean
          roles?: string[]
          route_id: string
          step: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          includes_author_head?: boolean
          roles?: string[]
          route_id?: string
          step?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_route_steps_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "approval_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_routes: {
        Row: {
          active: boolean
          allow_reviewer_as_approver: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          allow_reviewer_as_approver?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          allow_reviewer_as_approver?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
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
      brands: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          active: boolean
          attributes: Json
          catalog: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          order_no: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          attributes?: Json
          catalog: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          order_no?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          attributes?: Json
          catalog?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          order_no?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      controlled_documents: {
        Row: {
          annulled_at: string | null
          code: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          default_distribution: string[]
          external_issuer: string | null
          external_pending_confirmation: boolean
          external_version: string | null
          id: string
          next_review_date: string | null
          origin: string
          parent_code: string | null
          parent_document_id: string | null
          process_id: string | null
          regulatory_expiry_date: string | null
          route_id: string | null
          status: string
          sub_number: number | null
          sub_type: string | null
          title: string
          type_id: string | null
          updated_at: string
          updated_by: string | null
          validity_rule: string | null
        }
        Insert: {
          annulled_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          default_distribution?: string[]
          external_issuer?: string | null
          external_pending_confirmation?: boolean
          external_version?: string | null
          id?: string
          next_review_date?: string | null
          origin?: string
          parent_code?: string | null
          parent_document_id?: string | null
          process_id?: string | null
          regulatory_expiry_date?: string | null
          route_id?: string | null
          status?: string
          sub_number?: number | null
          sub_type?: string | null
          title: string
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_rule?: string | null
        }
        Update: {
          annulled_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          default_distribution?: string[]
          external_issuer?: string | null
          external_pending_confirmation?: boolean
          external_version?: string | null
          id?: string
          next_review_date?: string | null
          origin?: string
          parent_code?: string | null
          parent_document_id?: string | null
          process_id?: string | null
          regulatory_expiry_date?: string | null
          route_id?: string | null
          status?: string
          sub_number?: number | null
          sub_type?: string | null
          title?: string
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlled_documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "controlled_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "organizational_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "approval_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
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
      document_annulments: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          document_id: string
          id: string
          reason: string
          recall_status: string
          request_id: string | null
          requested_by: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          document_id: string
          id?: string
          reason: string
          recall_status?: string
          request_id?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          document_id?: string
          id?: string
          reason?: string
          recall_status?: string
          request_id?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_annulments_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_annulments_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_annulments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_annulments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_annulments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_annulments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_change_requests: {
        Row: {
          closed_at: string | null
          closed_with_version_id: string | null
          code: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          impact: string
          origin: string
          origin_ref: string | null
          parent_review: string | null
          parent_review_at: string | null
          parent_review_by: string | null
          parent_review_note: string | null
          reason: string
          requested_by: string
          status: string
          technical_change: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_with_version_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          impact?: string
          origin: string
          origin_ref?: string | null
          parent_review?: string | null
          parent_review_at?: string | null
          parent_review_by?: string | null
          parent_review_note?: string | null
          reason: string
          requested_by: string
          status?: string
          technical_change?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_with_version_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          impact?: string
          origin?: string
          origin_ref?: string | null
          parent_review?: string | null
          parent_review_at?: string | null
          parent_review_by?: string | null
          parent_review_note?: string | null
          reason?: string
          requested_by?: string
          status?: string
          technical_change?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_change_requests_closed_version_fk"
            columns: ["closed_with_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_requests_closed_version_fk"
            columns: ["closed_with_version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "document_change_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_requests_parent_review_by_fkey"
            columns: ["parent_review_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_distribution: {
        Row: {
          area_id: string | null
          copy_type: string
          created_at: string
          created_by: string | null
          delivered_at: string
          delivered_by: string
          id: string
          recall_note: string | null
          recalled_at: string | null
          recalled_by: string | null
          recipient: string | null
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          area_id?: string | null
          copy_type?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          delivered_by: string
          id?: string
          recall_note?: string | null
          recalled_at?: string | null
          recalled_by?: string | null
          recipient?: string | null
          updated_at?: string
          updated_by?: string | null
          version_id: string
        }
        Update: {
          area_id?: string | null
          copy_type?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          delivered_by?: string
          id?: string
          recall_note?: string | null
          recalled_at?: string | null
          recalled_by?: string | null
          recipient?: string | null
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_distribution_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "organizational_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_distribution_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_distribution_recalled_by_fkey"
            columns: ["recalled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_distribution_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_distribution_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
        ]
      }
      document_downloads: {
        Row: {
          copy_type: string
          created_at: string
          created_by: string | null
          downloaded_at: string
          id: string
          updated_at: string
          updated_by: string | null
          user_id: string
          version_id: string
        }
        Insert: {
          copy_type: string
          created_at?: string
          created_by?: string | null
          downloaded_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          version_id: string
        }
        Update: {
          copy_type?: string
          created_at?: string
          created_by?: string | null
          downloaded_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_downloads_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_downloads_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
        ]
      }
      document_requests: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          kind: string
          parent_document_id: string | null
          process_id: string | null
          proposed_title: string | null
          reason: string
          requested_by: string
          requested_distribution: string[]
          status: string
          template_delivered_at: string | null
          type_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          kind: string
          parent_document_id?: string | null
          process_id?: string | null
          proposed_title?: string | null
          reason: string
          requested_by: string
          requested_distribution?: string[]
          status?: string
          template_delivered_at?: string | null
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          kind?: string
          parent_document_id?: string | null
          process_id?: string | null
          proposed_title?: string | null
          reason?: string
          requested_by?: string
          requested_distribution?: string[]
          status?: string
          template_delivered_at?: string | null
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "organizational_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_trainings: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          method: string
          pass_score: number
          questions: Json
          requires_assessment: boolean
          trainer_id: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          method?: string
          pass_score?: number
          questions?: Json
          requires_assessment?: boolean
          trainer_id: string
          updated_at?: string
          updated_by?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          method?: string
          pass_score?: number
          questions?: Json
          requires_assessment?: boolean
          trainer_id?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_trainings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_trainings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_trainings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
        ]
      }
      document_types: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_route_id: string | null
          id: string
          is_subdocument: boolean
          level: number
          name: string
          requires_assessment: boolean
          requires_scope: boolean
          requires_training: boolean
          review_period_months: number | null
          stamp_required: boolean
          type_code: string
          updated_at: string
          updated_by: string | null
          validity_rule: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_route_id?: string | null
          id?: string
          is_subdocument?: boolean
          level: number
          name: string
          requires_assessment?: boolean
          requires_scope?: boolean
          requires_training?: boolean
          review_period_months?: number | null
          stamp_required?: boolean
          type_code: string
          updated_at?: string
          updated_by?: string | null
          validity_rule?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_route_id?: string | null
          id?: string
          is_subdocument?: boolean
          level?: number
          name?: string
          requires_assessment?: boolean
          requires_scope?: boolean
          requires_training?: boolean
          review_period_months?: number | null
          stamp_required?: boolean
          type_code?: string
          updated_at?: string
          updated_by?: string | null
          validity_rule?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_types_default_route_id_fkey"
            columns: ["default_route_id"]
            isOneToOne: false
            referencedRelation: "approval_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          author_id: string
          change_description: string
          change_request_id: string | null
          content: Json
          content_hash: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          effective_at: string | null
          file_path: string | null
          id: string
          issue_date: string | null
          locked_at: string | null
          obsoleted_at: string | null
          request_id: string | null
          review_due_date: string | null
          status: string
          style_check_result: Json | null
          supersedes_id: string | null
          technical_change: boolean
          updated_at: string
          updated_by: string | null
          version_no: number
        }
        Insert: {
          author_id: string
          change_description?: string
          change_request_id?: string | null
          content?: Json
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_at?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          locked_at?: string | null
          obsoleted_at?: string | null
          request_id?: string | null
          review_due_date?: string | null
          status?: string
          style_check_result?: Json | null
          supersedes_id?: string | null
          technical_change?: boolean
          updated_at?: string
          updated_by?: string | null
          version_no: number
        }
        Update: {
          author_id?: string
          change_description?: string
          change_request_id?: string | null
          content?: Json
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_at?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          locked_at?: string | null
          obsoleted_at?: string | null
          request_id?: string | null
          review_due_date?: string | null
          status?: string
          style_check_result?: Json | null
          supersedes_id?: string | null
          technical_change?: boolean
          updated_at?: string
          updated_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "document_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
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
      module_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_read: boolean
          can_sign: boolean
          cell_text: string
          created_at: string
          created_by: string | null
          id: string
          module_code: string
          prd_cell_text: string | null
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_approve: boolean
          can_create: boolean
          can_read: boolean
          can_sign: boolean
          cell_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_code: string
          prd_cell_text?: string | null
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_read?: boolean
          can_sign?: boolean
          cell_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_code?: string
          prd_cell_text?: string | null
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "module_permissions_role_fk"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
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
      organizational_areas: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          head_user_id: string | null
          id: string
          is_quality_owner: boolean
          name: string
          parent_id: string | null
          process_code: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          head_user_id?: string | null
          id?: string
          is_quality_owner?: boolean
          name: string
          parent_id?: string | null
          process_code?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          head_user_id?: string | null
          id?: string
          is_quality_owner?: boolean
          name?: string
          parent_id?: string | null
          process_code?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organizational_areas_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizational_areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizational_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_modules: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          name: string
          order_no: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          name: string
          order_no: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          name?: string
          order_no?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      process_template_steps: {
        Row: {
          checklist_item: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string
          order_no: number
          params: Json
          requires_equipment: string | null
          requires_verification: boolean
          template_id: string
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          checklist_item?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          order_no: number
          params?: Json
          requires_equipment?: string | null
          requires_verification?: boolean
          template_id: string
          text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checklist_item?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          order_no?: number
          params?: Json
          requires_equipment?: string | null
          requires_verification?: boolean
          template_id?: string
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          created_at: string
          created_by: string | null
          document_version_id: string
          id: string
          locked_at: string | null
          stage_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_version_id: string
          id?: string
          locked_at?: string | null
          stage_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_version_id?: string
          id?: string
          locked_at?: string | null
          stage_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: true
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: true
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "process_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lines: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          regulatory_profile: Database["public"]["Enums"]["regulatory_profile_kind"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          regulatory_profile: Database["public"]["Enums"]["regulatory_profile_kind"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          regulatory_profile?: Database["public"]["Enums"]["regulatory_profile_kind"]
          updated_at?: string
          updated_by?: string | null
          version?: number
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
          must_change_password: boolean
          password_changed_at: string | null
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
          must_change_password?: boolean
          password_changed_at?: string | null
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
          must_change_password?: boolean
          password_changed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_fk"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "organizational_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          label: string
          mode: string
          params: Json
          profile: Database["public"]["Enums"]["regulatory_profile_kind"]
          rule_key: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled: boolean
          id?: string
          label: string
          mode: string
          params?: Json
          profile: Database["public"]["Enums"]["regulatory_profile_kind"]
          rule_key: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label?: string
          mode?: string
          params?: Json
          profile?: Database["public"]["Enums"]["regulatory_profile_kind"]
          rule_key?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      reserved_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module_code: string
          owner_role: string
          permission: string
          reason: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_code: string
          owner_role: string
          permission: string
          reason: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_code?: string
          owner_role?: string
          permission?: string
          reason?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserved_permissions_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reserved_permissions_owner_role_fkey"
            columns: ["owner_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      retention_rules: {
        Row: {
          basis: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          note: string | null
          record_class: string
          updated_at: string
          updated_by: string | null
          version: number
          years: number | null
        }
        Insert: {
          basis: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          note?: string | null
          record_class: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          years?: number | null
        }
        Update: {
          basis?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          note?: string | null
          record_class?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          years?: number | null
        }
        Relationships: []
      }
      role_change_approvals: {
        Row: {
          approver: string
          approver_name: string
          approver_role: string
          created_at: string
          created_by: string | null
          decided_at: string
          decision: string
          id: string
          reason: string
          reauth_method: string
          request_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver: string
          approver_name: string
          approver_role: string
          created_at?: string
          created_by?: string | null
          decided_at?: string
          decision: string
          id?: string
          reason: string
          reauth_method: string
          request_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver?: string
          approver_name?: string
          approver_role?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string
          decision?: string
          id?: string
          reason?: string
          reauth_method?: string
          request_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_change_approvals_approver_fkey"
            columns: ["approver"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_change_approvals_approver_role_fkey"
            columns: ["approver_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_change_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "role_change_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_requests: {
        Row: {
          before: Json
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          payload: Json
          reason: string
          request_number: string
          requested_at: string
          requested_by: string
          required_roles: string[]
          role_code: string
          role_is_system: boolean
          status: string
          summary: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          before?: Json
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          payload?: Json
          reason: string
          request_number: string
          requested_at?: string
          requested_by: string
          required_roles: string[]
          role_code: string
          role_is_system: boolean
          status?: string
          summary: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          before?: Json
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          payload?: Json
          reason?: string
          request_number?: string
          requested_at?: string
          requested_by?: string
          required_roles?: string[]
          role_code?: string
          role_is_system?: boolean
          status?: string
          summary?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_change_requests_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_incompatibilities: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          message: string
          role_a: string
          role_b: string
          rule_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          message: string
          role_a: string
          role_b: string
          rule_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          message?: string
          role_a?: string
          role_b?: string
          rule_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_incompatibilities_a_fk"
            columns: ["role_a"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_incompatibilities_b_fk"
            columns: ["role_b"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string
          is_system: boolean
          name: string
          read_only: boolean
          requires_expiry: boolean
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          is_system?: boolean
          name: string
          read_only?: boolean
          requires_expiry?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          is_system?: boolean
          name?: string
          read_only?: boolean
          requires_expiry?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
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
          role: string
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
          role: string
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
          role?: string
          sets_status?: string | null
          table_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_permissions_role_fk"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
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
          lifecycle_columns: string[]
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
          lifecycle_columns?: string[]
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
          lifecycle_columns?: string[]
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
          signed_as: string
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
          signed_as: string
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
          signed_as?: string
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
            foreignKeyName: "signatures_signed_as_fk"
            columns: ["signed_as"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
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
      stage_definitions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          governing_document_id: string | null
          id: string
          name: string
          order_no: number
          requires_cleaning_record: boolean
          requires_clearance: boolean
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          governing_document_id?: string | null
          id?: string
          name: string
          order_no: number
          requires_cleaning_record?: boolean
          requires_clearance?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          governing_document_id?: string | null
          id?: string
          name?: string
          order_no?: number
          requires_cleaning_record?: boolean
          requires_clearance?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stage_definitions_governing_document_id_fkey"
            columns: ["governing_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_definitions_governing_document_id_fkey"
            columns: ["governing_document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
        ]
      }
      standardization_checks: {
        Row: {
          checked_at: string
          checked_by: string
          checklist: Json
          created_at: string
          created_by: string | null
          id: string
          observations: Json
          result: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          checked_at?: string
          checked_by: string
          checklist: Json
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: Json
          result: string
          updated_at?: string
          updated_by?: string | null
          version_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          checklist?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: Json
          result?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standardization_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standardization_checks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standardization_checks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["version_id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          created_by: string | null
          id: string
          training_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          training_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          training_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "document_trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attempts: {
        Row: {
          answers: Json | null
          attempt_no: number
          attempted_at: string
          certificate_code: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          passed: boolean
          score: number | null
          training_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempt_no: number
          attempted_at?: string
          certificate_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          passed: boolean
          score?: number | null
          training_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempt_no?: number
          attempted_at?: string
          certificate_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          passed?: boolean
          score?: number | null
          training_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attempts_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "document_trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          role: string
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
          role: string
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
          role?: string
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
            foreignKeyName: "user_roles_role_fk"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
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
      v_documents_overdue_by_process: {
        Row: {
          overdue: number | null
          overdue_pct: number | null
          process_code: string | null
          process_name: string | null
          total: number | null
        }
        Relationships: []
      }
      v_master_list: {
        Row: {
          children_count: number | null
          code: string | null
          document_status: string | null
          external_issuer: string | null
          external_pending_confirmation: boolean | null
          id: string | null
          issue_date: string | null
          last_update: string | null
          level: number | null
          open_version_no: number | null
          open_version_status: string | null
          origin: string | null
          parent_code: string | null
          parent_document_id: string | null
          process_code: string | null
          process_name: string | null
          review_date: string | null
          title: string | null
          type_code: string | null
          type_name: string | null
          validity: string | null
          version_id: string | null
          version_label: string | null
          version_no: number | null
          version_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlled_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "v_master_list"
            referencedColumns: ["id"]
          },
        ]
      }
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
      acknowledge_read: { Args: { p_training: string }; Returns: Json }
      admin_cancel_role_change: {
        Args: { p_reason: string; p_request: string }
        Returns: undefined
      }
      admin_grant_role: {
        Args: {
          p_expires_at: string
          p_reason: string
          p_role: string
          p_user: string
        }
        Returns: string
      }
      admin_list_users: {
        Args: never
        Returns: {
          active: boolean
          area_id: string
          area_name: string
          email: string
          full_name: string
          id: string
          invitation_pending: boolean
          job_title: string
          last_sign_in_at: string
          must_change_password: boolean
          roles: Json
          short_signature: string
        }[]
      }
      admin_request_role_change: {
        Args: {
          p_kind: string
          p_payload: Json
          p_reason: string
          p_role: string
        }
        Returns: Json
      }
      admin_revoke_role: {
        Args: { p_reason: string; p_user_role: string }
        Returns: undefined
      }
      admin_save_catalog: {
        Args: {
          p_id: string
          p_reason: string
          p_table: string
          p_values: Json
        }
        Returns: string
      }
      admin_set_role_expiry: {
        Args: { p_expires_at: string; p_reason: string; p_user_role: string }
        Returns: undefined
      }
      admin_set_short_signature: {
        Args: { p_reason: string; p_short: string; p_user: string }
        Returns: undefined
      }
      admin_set_user_active: {
        Args: { p_active: boolean; p_reason: string; p_user: string }
        Returns: undefined
      }
      admin_update_profile: {
        Args: {
          p_area_id: string
          p_document_id: string
          p_full_name: string
          p_job_title: string
          p_must_change_password: boolean
          p_reason: string
          p_user: string
        }
        Returns: undefined
      }
      admin_update_setting: {
        Args: { p_key: string; p_reason: string; p_value: Json }
        Returns: undefined
      }
      approve_document: {
        Args: { p_password: string; p_reason?: string; p_version: string }
        Returns: Json
      }
      assert_document_effective: {
        Args: { p_version_ids: string[] }
        Returns: Json
      }
      assert_training: {
        Args: { p_user?: string; p_version: string }
        Returns: Json
      }
      assign_training: {
        Args: {
          p_due_date: string
          p_method?: string
          p_pass_score?: number
          p_questions?: Json
          p_users: string[]
          p_version: string
        }
        Returns: string
      }
      bogota_today: { Args: never; Returns: string }
      can_follow_trainings: { Args: never; Returns: boolean }
      can_read_audit: { Args: never; Returns: boolean }
      can_read_documents: { Args: never; Returns: boolean }
      can_see_role_changes: { Args: never; Returns: boolean }
      can_sign: {
        Args: {
          p_meaning: Database["public"]["Enums"]["signature_meaning"]
          p_record_id: string
          p_table: string
        }
        Returns: Json
      }
      check_password_policy: { Args: { p_password: string }; Returns: Json }
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
      close_annulment: {
        Args: { p_annulment: string; p_reason: string }
        Returns: undefined
      }
      compute_review_due_date: {
        Args: {
          p_issue_date: string
          p_regulatory_expiry: string
          p_rule?: string
          p_type_id: string
        }
        Returns: string
      }
      current_user_roles: { Args: never; Returns: string[] }
      decide_annulment: {
        Args: {
          p_annulment: string
          p_decision: string
          p_password: string
          p_reason: string
        }
        Returns: Json
      }
      decide_role_change: {
        Args: {
          p_decision: string
          p_password: string
          p_reason: string
          p_request: string
        }
        Returns: Json
      }
      document_validity: {
        Args: { p_review_date: string; p_status: string }
        Returns: string
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
      get_role_change_requests: {
        Args: { p_role?: string; p_status?: string }
        Returns: Json
      }
      get_setting: { Args: { p_key: string }; Returns: Json }
      has_any_role: { Args: { p_roles: string[] }; Returns: boolean }
      has_module_permission: {
        Args: { p_module: string; p_permission: string }
        Returns: boolean
      }
      has_role: { Args: { p_role: string }; Returns: boolean }
      health_check: { Args: never; Returns: Json }
      hook_password_verification_attempt: {
        Args: { event: Json }
        Returns: Json
      }
      issue_copy: {
        Args: {
          p_area_id: string
          p_copy_type: string
          p_recipient: string
          p_version: string
        }
        Returns: string
      }
      log_document_download: {
        Args: { p_copy_type?: string; p_version: string }
        Returns: Json
      }
      log_session_event: { Args: { p_action: string }; Returns: undefined }
      next_number: { Args: { p_key: string }; Returns: string }
      practice_reauth: { Args: { p_password: string }; Returns: Json }
      publish_document: {
        Args: { p_distribution?: string[]; p_version: string }
        Returns: Json
      }
      recall_copy: {
        Args: { p_distribution: string; p_note?: string }
        Returns: undefined
      }
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
      record_password_change: {
        Args: { p_password: string }
        Returns: undefined
      }
      reference_now: { Args: never; Returns: string }
      register_change_request: {
        Args: {
          p_author_id?: string
          p_document_id: string
          p_impact: string
          p_origin: string
          p_origin_ref: string
          p_reason: string
          p_technical_change: boolean
        }
        Returns: Json
      }
      register_training_attempt: {
        Args: { p_answers: number[]; p_training: string }
        Returns: Json
      }
      regulatory_profile_snapshot: {
        Args: {
          p_profile: Database["public"]["Enums"]["regulatory_profile_kind"]
        }
        Returns: Json
      }
      request_document: {
        Args: {
          p_distribution?: string[]
          p_document_id: string
          p_kind: string
          p_parent_document_id: string
          p_process_id: string
          p_reason: string
          p_title: string
          p_type_id: string
        }
        Returns: Json
      }
      request_document_code: {
        Args: {
          p_regulatory_expiry?: string
          p_route_id?: string
          p_title?: string
          p_validity_rule?: string
          p_version: string
        }
        Returns: Json
      }
      review_document: {
        Args: { p_password: string; p_reason?: string; p_version: string }
        Returns: Json
      }
      run_style_check: {
        Args: { p_checklist?: Json; p_version: string }
        Returns: Json
      }
      save_document_draft: {
        Args: {
          p_change_description?: string
          p_content: Json
          p_technical_change?: boolean
          p_version: string
        }
        Returns: undefined
      }
      save_template_draft: {
        Args: {
          p_reason: string
          p_stage_code: string
          p_steps: Json
          p_version: string
        }
        Returns: Json
      }
      server_now: { Args: never; Returns: string }
      set_parent_review: {
        Args: { p_change_request: string; p_decision: string; p_note: string }
        Returns: undefined
      }
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
      style_observations: {
        Args: { p_content: Json; p_type_id: string }
        Returns: Json
      }
      submit_for_review: {
        Args: { p_password: string; p_version: string }
        Returns: Json
      }
      submit_for_standardization: {
        Args: { p_version: string }
        Returns: undefined
      }
      user_active_roles: { Args: { p_user: string }; Returns: string[] }
      verify_signature_integrity: {
        Args: { p_signature_id: string }
        Returns: boolean
      }
    }
    Enums: {
      regulatory_profile_kind: "cosmetico" | "medicamento"
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
      regulatory_profile_kind: ["cosmetico", "medicamento"],
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
