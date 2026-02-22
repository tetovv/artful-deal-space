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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_courses: {
        Row: {
          created_at: string
          id: string
          modules: Json | null
          progress: number | null
          slides: Json | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modules?: Json | null
          progress?: number | null
          slides?: Json | null
          status?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modules?: Json | null
          progress?: number | null
          slides?: Json | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      artifact_private: {
        Row: {
          artifact_id: string
          created_at: string
          id: string
          private_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          artifact_id: string
          created_at?: string
          id?: string
          private_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          artifact_id?: string
          created_at?: string
          id?: string
          private_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_private_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          created_at: string
          id: string
          project_id: string
          public_json: Json
          roadmap_step_id: string | null
          sort_order: number | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          public_json?: Json
          roadmap_step_id?: string | null
          sort_order?: number | null
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          public_json?: Json
          roadmap_step_id?: string | null
          sort_order?: number | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_access_snapshots: {
        Row: {
          created_at: string
          entitlement_summary: Json
          id: string
          query_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement_summary?: Json
          id?: string
          query_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement_summary?: Json
          id?: string
          query_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_access_snapshots_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "ask_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_evidence: {
        Row: {
          confidence: string
          created_at: string
          creator_name: string
          deep_link: string | null
          id: string
          query_id: string
          snippet: string
          sort_order: number
          source_id: string | null
          source_type: string
          title: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          creator_name?: string
          deep_link?: string | null
          id?: string
          query_id: string
          snippet?: string
          sort_order?: number
          source_id?: string | null
          source_type: string
          title?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          creator_name?: string
          deep_link?: string | null
          id?: string
          query_id?: string
          snippet?: string
          sort_order?: number
          source_id?: string | null
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_evidence_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "ask_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_queries: {
        Row: {
          created_at: string
          id: string
          include_workplace: boolean
          question: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_workplace?: boolean
          question: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          include_workplace?: boolean
          question?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ask_results: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          query_id: string
          validated_at: string | null
        }
        Insert: {
          answer_text?: string
          created_at?: string
          id?: string
          query_id: string
          validated_at?: string | null
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          query_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ask_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "ask_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          answers: Json
          artifact_id: string
          completed_at: string | null
          created_at: string
          feedback: Json | null
          id: string
          score: number | null
          status: string
          user_id: string
        }
        Insert: {
          answers?: Json
          artifact_id: string
          completed_at?: string | null
          created_at?: string
          feedback?: Json | null
          id?: string
          score?: number | null
          status?: string
          user_id: string
        }
        Update: {
          answers?: Json
          artifact_id?: string
          completed_at?: string | null
          created_at?: string
          feedback?: Json | null
          id?: string
          score?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          content_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          content_id: string
          created_at: string
          id: string
          likes: number
          parent_id: string | null
          user_avatar: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          content_id: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          user_avatar?: string | null
          user_id: string
          user_name?: string
        }
        Update: {
          content?: string
          content_id?: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          user_avatar?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          age_restricted: boolean | null
          chapters: Json | null
          created_at: string
          creator_avatar: string | null
          creator_id: string | null
          creator_name: string
          description: string | null
          dislikes: number | null
          duration: number | null
          geo: string | null
          id: string
          language: string | null
          likes: number | null
          monetization_type: string | null
          pinned_comment: string | null
          price: number | null
          price_min: number | null
          scheduled_at: string | null
          status: string
          subtitles_url: string | null
          tags: string[] | null
          thumbnail: string | null
          title: string
          type: string
          updated_at: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          age_restricted?: boolean | null
          chapters?: Json | null
          created_at?: string
          creator_avatar?: string | null
          creator_id?: string | null
          creator_name?: string
          description?: string | null
          dislikes?: number | null
          duration?: number | null
          geo?: string | null
          id?: string
          language?: string | null
          likes?: number | null
          monetization_type?: string | null
          pinned_comment?: string | null
          price?: number | null
          price_min?: number | null
          scheduled_at?: string | null
          status?: string
          subtitles_url?: string | null
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          type: string
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          age_restricted?: boolean | null
          chapters?: Json | null
          created_at?: string
          creator_avatar?: string | null
          creator_id?: string | null
          creator_name?: string
          description?: string | null
          dislikes?: number | null
          duration?: number | null
          geo?: string | null
          id?: string
          language?: string | null
          likes?: number | null
          monetization_type?: string | null
          pinned_comment?: string | null
          price?: number | null
          price_min?: number | null
          scheduled_at?: string | null
          status?: string
          subtitles_url?: string | null
          tags?: string[] | null
          thumbnail?: string | null
          title?: string
          type?: string
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      content_reactions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          reaction: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          reaction: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reactions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          campaign_id: string | null
          confidence_map: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          document_type: string
          extracted_fields: Json
          file_name: string | null
          file_size: number | null
          id: string
          source_snippets: Json | null
          status: string
          stored_text: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          campaign_id?: string | null
          confidence_map?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_type?: string
          extracted_fields?: Json
          file_name?: string | null
          file_size?: number | null
          id?: string
          source_snippets?: Json | null
          status?: string
          stored_text?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          campaign_id?: string | null
          confidence_map?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_type?: string
          extracted_fields?: Json
          file_name?: string | null
          file_size?: number | null
          id?: string
          source_snippets?: Json | null
          status?: string
          stored_text?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      creator_analytics: {
        Row: {
          creator_id: string
          demographics: Json | null
          geo: Json | null
          id: string
          platform_distribution: Json | null
          updated_at: string
        }
        Insert: {
          creator_id: string
          demographics?: Json | null
          geo?: Json | null
          id?: string
          platform_distribution?: Json | null
          updated_at?: string
        }
        Update: {
          creator_id?: string
          demographics?: Json | null
          geo?: Json | null
          id?: string
          platform_distribution?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      creator_offers: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          included_deliverables: string[] | null
          is_active: boolean
          offer_type: string
          price: number
          turnaround_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          included_deliverables?: string[] | null
          is_active?: boolean
          offer_type: string
          price?: number
          turnaround_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          included_deliverables?: string[] | null
          is_active?: boolean
          offer_type?: string
          price?: number
          turnaround_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      creator_platforms: {
        Row: {
          avg_views: number | null
          channel_url: string | null
          created_at: string
          creator_id: string
          id: string
          platform_name: string
          subscriber_count: number
          updated_at: string
        }
        Insert: {
          avg_views?: number | null
          channel_url?: string | null
          created_at?: string
          creator_id: string
          id?: string
          platform_name: string
          subscriber_count?: number
          updated_at?: string
        }
        Update: {
          avg_views?: number | null
          channel_url?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          platform_name?: string
          subscriber_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_exports: {
        Row: {
          categories: string[]
          created_at: string
          downloaded_at: string | null
          error: string | null
          expires_at: string | null
          file_path: string | null
          file_size: number | null
          finished_at: string | null
          format: string
          id: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          categories?: string[]
          created_at?: string
          downloaded_at?: string | null
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          finished_at?: string | null
          format?: string
          id?: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          categories?: string[]
          created_at?: string
          downloaded_at?: string | null
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          finished_at?: string | null
          format?: string
          id?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_imports: {
        Row: {
          categories: string[]
          confirmed_at: string | null
          conflict_strategy: string
          created_at: string
          error: string | null
          finished_at: string | null
          format: string
          id: string
          preview_data: Json | null
          result_data: Json | null
          status: string
          user_id: string
        }
        Insert: {
          categories?: string[]
          confirmed_at?: string | null
          conflict_strategy?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          format?: string
          id?: string
          preview_data?: Json | null
          result_data?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          categories?: string[]
          confirmed_at?: string | null
          conflict_strategy?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          format?: string
          id?: string
          preview_data?: Json | null
          result_data?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_audit_log: {
        Row: {
          action: string
          category: string
          created_at: string
          deal_id: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          deal_id: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          deal_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_audit_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_escrow: {
        Row: {
          active_ends_at: string | null
          active_started_at: string | null
          amount: number
          created_at: string
          creator_publication_due_at: string | null
          creator_response_due_at: string | null
          deal_id: string
          escrow_state: string
          id: string
          label: string
          milestone_id: string | null
          paid_out_at: string | null
          payout_amount: number | null
          platform_fee: number | null
          proof_screenshot_path: string | null
          publication_url: string | null
          refund_reason: string | null
          refunded_at: string | null
          released_at: string | null
          released_by: string | null
          reserved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_ends_at?: string | null
          active_started_at?: string | null
          amount?: number
          created_at?: string
          creator_publication_due_at?: string | null
          creator_response_due_at?: string | null
          deal_id: string
          escrow_state?: string
          id?: string
          label: string
          milestone_id?: string | null
          paid_out_at?: string | null
          payout_amount?: number | null
          platform_fee?: number | null
          proof_screenshot_path?: string | null
          publication_url?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_ends_at?: string | null
          active_started_at?: string | null
          amount?: number
          created_at?: string
          creator_publication_due_at?: string | null
          creator_response_due_at?: string | null
          deal_id?: string
          escrow_state?: string
          id?: string
          label?: string
          milestone_id?: string | null
          paid_out_at?: string | null
          payout_amount?: number | null
          platform_fee?: number | null
          proof_screenshot_path?: string | null
          publication_url?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_escrow_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_escrow_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          category: string
          created_at: string
          deal_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          pinned: boolean | null
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          deal_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          pinned?: boolean | null
          storage_path: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          deal_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          pinned?: boolean | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_invoices: {
        Row: {
          amount: number
          comment: string | null
          created_at: string
          created_by: string
          deal_id: string
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          paid_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          comment?: string | null
          created_at?: string
          created_by: string
          deal_id: string
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_proposals: {
        Row: {
          acceptance_criteria: string | null
          advertiser_id: string
          attachments: Json | null
          brief_text: string | null
          budget_max: number | null
          budget_min: number | null
          budget_value: number | null
          created_at: string
          creator_id: string
          cta: string | null
          id: string
          last_opened_at: string | null
          offer_id: string | null
          ord_responsibility: string | null
          placement_type: string
          publish_end: string | null
          publish_start: string | null
          restrictions: string | null
          revisions_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          advertiser_id: string
          attachments?: Json | null
          brief_text?: string | null
          budget_max?: number | null
          budget_min?: number | null
          budget_value?: number | null
          created_at?: string
          creator_id: string
          cta?: string | null
          id?: string
          last_opened_at?: string | null
          offer_id?: string | null
          ord_responsibility?: string | null
          placement_type?: string
          publish_end?: string | null
          publish_start?: string | null
          restrictions?: string | null
          revisions_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          advertiser_id?: string
          attachments?: Json | null
          brief_text?: string | null
          budget_max?: number | null
          budget_min?: number | null
          budget_value?: number | null
          created_at?: string
          creator_id?: string
          cta?: string | null
          id?: string
          last_opened_at?: string | null
          offer_id?: string | null
          ord_responsibility?: string | null
          placement_type?: string
          publish_end?: string | null
          publish_start?: string | null
          restrictions?: string | null
          revisions_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_terms: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string
          fields: Json
          id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id: string
          fields?: Json
          id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string
          fields?: Json
          id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_terms_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_terms_acceptance: {
        Row: {
          accepted_at: string
          id: string
          terms_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          terms_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          terms_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_terms_acceptance_terms_id_fkey"
            columns: ["terms_id"]
            isOneToOne: false
            referencedRelation: "deal_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string
          budget: number | null
          created_at: string
          creator_id: string | null
          creator_name: string
          deadline: string | null
          description: string | null
          erid: string | null
          id: string
          marking_required: boolean | null
          marking_responsibility: string | null
          marking_state: string
          marking_state_updated_at: string | null
          placement_duration_days: number | null
          publication_required: boolean | null
          publication_url: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          title: string
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_name?: string
          budget?: number | null
          created_at?: string
          creator_id?: string | null
          creator_name?: string
          deadline?: string | null
          description?: string | null
          erid?: string | null
          id?: string
          marking_required?: boolean | null
          marking_responsibility?: string | null
          marking_state?: string
          marking_state_updated_at?: string | null
          placement_duration_days?: number | null
          publication_required?: boolean | null
          publication_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          title: string
        }
        Update: {
          advertiser_id?: string | null
          advertiser_name?: string
          budget?: number | null
          created_at?: string
          creator_id?: string | null
          creator_name?: string
          deadline?: string | null
          description?: string | null
          erid?: string | null
          id?: string
          marking_required?: boolean | null
          marking_responsibility?: string | null
          marking_state?: string
          marking_state_updated_at?: string | null
          placement_duration_days?: number | null
          publication_required?: boolean | null
          publication_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          raised_by: string | null
          reason: string
          status: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          raised_by?: string | null
          reason?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          raised_by?: string | null
          reason?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      download_history: {
        Row: {
          content_id: string
          downloaded_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          downloaded_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          downloaded_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_playlist_items: {
        Row: {
          content_id: string | null
          content_type: string
          created_at: string
          est_time: number
          id: string
          playlist_id: string
          reason: string
          segment_ref: Json | null
          sort_order: number
        }
        Insert: {
          content_id?: string | null
          content_type: string
          created_at?: string
          est_time?: number
          id?: string
          playlist_id: string
          reason?: string
          segment_ref?: Json | null
          sort_order?: number
        }
        Update: {
          content_id?: string | null
          content_type?: string
          created_at?: string
          est_time?: number
          id?: string
          playlist_id?: string
          reason?: string
          segment_ref?: Json | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "goal_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_playlists: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          mix_prefs: Json
          scope: string
          status: string
          time_budget: number
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          mix_prefs?: Json
          scope?: string
          status?: string
          time_budget: number
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          mix_prefs?: Json
          scope?: string
          status?: string
          time_budget?: number
          user_id?: string
        }
        Relationships: []
      }
      ingest_jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          message: string | null
          progress: number
          project_id: string
          stage: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          progress?: number
          project_id: string
          stage?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          message?: string | null
          progress?: number
          project_id?: string
          stage?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment: string | null
          content: string
          created_at: string
          deal_id: string
          id: string
          sender_id: string | null
          sender_name: string
        }
        Insert: {
          attachment?: string | null
          content?: string
          created_at?: string
          deal_id: string
          id?: string
          sender_id?: string | null
          sender_name?: string
        }
        Update: {
          attachment?: string | null
          content?: string
          created_at?: string
          deal_id?: string
          id?: string
          sender_id?: string | null
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed: boolean | null
          deal_id: string
          due_date: string | null
          id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          completed?: boolean | null
          deal_id: string
          due_date?: string | null
          id?: string
          sort_order?: number | null
          title: string
        }
        Update: {
          completed?: boolean | null
          deal_id?: string
          due_date?: string | null
          id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_bookmarks: {
        Row: {
          created_at: string
          creator_name: string | null
          end_sec: number
          id: string
          note: string | null
          start_sec: number
          user_id: string
          video_id: string
          video_title: string | null
        }
        Insert: {
          created_at?: string
          creator_name?: string | null
          end_sec?: number
          id?: string
          note?: string | null
          start_sec?: number
          user_id: string
          video_id: string
          video_title?: string | null
        }
        Update: {
          created_at?: string
          creator_name?: string | null
          end_sec?: number
          id?: string
          note?: string | null
          start_sec?: number
          user_id?: string
          video_id?: string
          video_title?: string | null
        }
        Relationships: []
      }
      moment_index: {
        Row: {
          action_tags: Json
          created_at: string
          embedding_ref_text: string | null
          embedding_ref_vision: string | null
          emotion_tags: Json | null
          end_sec: number
          entity_tags: Json
          id: string
          popularity_signals: Json | null
          safety_flags: Json | null
          start_sec: number
          transcript_snippet: string
          video_id: string
          visual_caption: string | null
        }
        Insert: {
          action_tags?: Json
          created_at?: string
          embedding_ref_text?: string | null
          embedding_ref_vision?: string | null
          emotion_tags?: Json | null
          end_sec?: number
          entity_tags?: Json
          id?: string
          popularity_signals?: Json | null
          safety_flags?: Json | null
          start_sec?: number
          transcript_snippet?: string
          video_id: string
          visual_caption?: string | null
        }
        Update: {
          action_tags?: Json
          created_at?: string
          embedding_ref_text?: string | null
          embedding_ref_vision?: string | null
          emotion_tags?: Json | null
          end_sec?: number
          entity_tags?: Json
          id?: string
          popularity_signals?: Json | null
          safety_flags?: Json | null
          start_sec?: number
          transcript_snippet?: string
          video_id?: string
          visual_caption?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moment_index_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      montage_edit_history: {
        Row: {
          action_type: string
          created_at: string
          id: string
          montage_id: string
          payload: Json
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          montage_id: string
          payload?: Json
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          montage_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "montage_edit_history_montage_id_fkey"
            columns: ["montage_id"]
            isOneToOne: false
            referencedRelation: "montage_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      montage_projects: {
        Row: {
          created_at: string
          id: string
          scope: string
          source_query_id: string | null
          status: string
          target_duration: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scope?: string
          source_query_id?: string | null
          status?: string
          target_duration?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scope?: string
          source_query_id?: string | null
          status?: string
          target_duration?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "montage_projects_source_query_id_fkey"
            columns: ["source_query_id"]
            isOneToOne: false
            referencedRelation: "ask_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      montage_segments: {
        Row: {
          created_at: string
          deep_link: string | null
          end_sec: number
          id: string
          montage_id: string
          rationale: string
          segment_status: string
          sort_order: number
          source_id: string | null
          source_type: string
          start_sec: number
        }
        Insert: {
          created_at?: string
          deep_link?: string | null
          end_sec?: number
          id?: string
          montage_id: string
          rationale?: string
          segment_status?: string
          sort_order?: number
          source_id?: string | null
          source_type: string
          start_sec?: number
        }
        Update: {
          created_at?: string
          deep_link?: string | null
          end_sec?: number
          id?: string
          montage_id?: string
          rationale?: string
          segment_status?: string
          sort_order?: number
          source_id?: string | null
          source_type?: string
          start_sec?: number
        }
        Relationships: [
          {
            foreignKeyName: "montage_segments_montage_id_fkey"
            columns: ["montage_id"]
            isOneToOne: false
            referencedRelation: "montage_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      montage_shares: {
        Row: {
          created_at: string
          created_by: string
          id: string
          montage_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          montage_id: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          montage_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "montage_shares_montage_id_fkey"
            columns: ["montage_id"]
            isOneToOne: false
            referencedRelation: "montage_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      montage_viewer_access_log: {
        Row: {
          allowed_count: number
          created_at: string
          id: string
          locked_count: number
          share_id: string
          viewer_id: string
        }
        Insert: {
          allowed_count?: number
          created_at?: string
          id?: string
          locked_count?: number
          share_id: string
          viewer_id: string
        }
        Update: {
          allowed_count?: number
          created_at?: string
          id?: string
          locked_count?: number
          share_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "montage_viewer_access_log_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "montage_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      paid_subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          expires_at: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          expires_at?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          added_at: string
          content_id: string
          id: string
          playlist_id: string
          sort_order: number
        }
        Insert: {
          added_at?: string
          content_id: string
          id?: string
          playlist_id: string
          sort_order?: number
        }
        Update: {
          added_at?: string
          content_id?: string
          id?: string
          playlist_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_progress: {
        Row: {
          completed_items: string[]
          created_at: string
          current_item_id: string | null
          id: string
          playlist_id: string
          time_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_items?: string[]
          created_at?: string
          current_item_id?: string | null
          id?: string
          playlist_id: string
          time_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_items?: string[]
          created_at?: string
          current_item_id?: string | null
          id?: string
          playlist_id?: string
          time_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_progress_current_item_id_fkey"
            columns: ["current_item_id"]
            isOneToOne: false
            referencedRelation: "goal_playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_progress_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "goal_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_templates: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          mix_prefs: Json
          name: string
          scope: string
          share_slug: string | null
          time_budget: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          mix_prefs?: Json
          name: string
          scope?: string
          share_slug?: string | null
          time_budget: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          mix_prefs?: Json
          name?: string
          scope?: string
          share_slug?: string | null
          time_budget?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          thumbnail: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          thumbnail?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_impressions: {
        Row: {
          created_at: string
          date_bucket: string
          id: string
          post_id: string
          viewer_user_id: string
          visible_ms: number
        }
        Insert: {
          created_at?: string
          date_bucket?: string
          id?: string
          post_id: string
          viewer_user_id: string
          visible_ms?: number
        }
        Update: {
          created_at?: string
          date_bucket?: string
          id?: string
          post_id?: string
          viewer_user_id?: string
          visible_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_impressions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          content_count: number | null
          created_at: string
          deals_count: number | null
          display_name: string
          email: string | null
          followers: number | null
          geo: string | null
          id: string
          niche: string[] | null
          rating: number | null
          reach: number | null
          response_hours: number | null
          safe_deal: boolean | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string
          deals_count?: number | null
          display_name?: string
          email?: string | null
          followers?: number | null
          geo?: string | null
          id?: string
          niche?: string[] | null
          rating?: number | null
          reach?: number | null
          response_hours?: number | null
          safe_deal?: boolean | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string
          deals_count?: number | null
          display_name?: string
          email?: string | null
          followers?: number | null
          geo?: string | null
          id?: string
          niche?: string[] | null
          rating?: number | null
          reach?: number | null
          response_hours?: number | null
          safe_deal?: boolean | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      project_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          project_id: string
          source_id: string
          token_count: number | null
          tsv: unknown
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          source_id: string
          token_count?: number | null
          tsv?: unknown
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          source_id?: string
          token_count?: number | null
          tsv?: unknown
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "project_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sources: {
        Row: {
          chunk_count: number | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          project_id: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          id?: string
          project_id: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          chunk_count?: number | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          project_id?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assistant_menu_policy: Json | null
          audience: string | null
          created_at: string
          description: string | null
          goal: string | null
          id: string
          ingest_error: string | null
          ingest_progress: number
          roadmap: Json | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assistant_menu_policy?: Json | null
          audience?: string | null
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          ingest_error?: string | null
          ingest_progress?: number
          roadmap?: Json | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assistant_menu_policy?: Json | null
          audience?: string | null
          created_at?: string
          description?: string | null
          goal?: string | null
          id?: string
          ingest_error?: string | null
          ingest_progress?: number
          roadmap?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          content_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          agreement_compliance: number | null
          brief_adequacy: number | null
          communication: number | null
          created_at: string
          deal_id: string
          from_id: string | null
          id: string
          overall: number | null
          payment: number | null
          payment_timeliness: number | null
          professionalism: number | null
          repeat_willingness: number | null
          to_id: string | null
        }
        Insert: {
          agreement_compliance?: number | null
          brief_adequacy?: number | null
          communication?: number | null
          created_at?: string
          deal_id: string
          from_id?: string | null
          id?: string
          overall?: number | null
          payment?: number | null
          payment_timeliness?: number | null
          professionalism?: number | null
          repeat_willingness?: number | null
          to_id?: string | null
        }
        Update: {
          agreement_compliance?: number | null
          brief_adequacy?: number | null
          communication?: number | null
          created_at?: string
          deal_id?: string
          from_id?: string | null
          id?: string
          overall?: number | null
          payment?: number | null
          payment_timeliness?: number | null
          professionalism?: number | null
          repeat_willingness?: number | null
          to_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_answer_evidence: {
        Row: {
          captured_at: string
          confidence: string
          creator_name: string
          deep_link: string | null
          id: string
          saved_answer_id: string
          snippet: string
          source_id: string | null
          source_type: string
          title: string
        }
        Insert: {
          captured_at?: string
          confidence?: string
          creator_name?: string
          deep_link?: string | null
          id?: string
          saved_answer_id: string
          snippet?: string
          source_id?: string | null
          source_type: string
          title?: string
        }
        Update: {
          captured_at?: string
          confidence?: string
          creator_name?: string
          deep_link?: string | null
          id?: string
          saved_answer_id?: string
          snippet?: string
          source_id?: string | null
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_answer_evidence_saved_answer_id_fkey"
            columns: ["saved_answer_id"]
            isOneToOne: false
            referencedRelation: "saved_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          last_validated_at: string
          query_id: string | null
          question_text: string
          user_id: string
          validation_status: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          last_validated_at?: string
          query_id?: string | null
          question_text: string
          user_id: string
          validation_status?: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          last_validated_at?: string
          query_id?: string | null
          question_text?: string
          user_id?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_answers_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "ask_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_moment_bookmarks: {
        Row: {
          created_at: string
          end_sec: number
          id: string
          note: string | null
          start_sec: number
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          end_sec?: number
          id?: string
          note?: string | null
          start_sec?: number
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          end_sec?: number
          id?: string
          note?: string | null
          start_sec?: number
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_moment_bookmarks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_montages: {
        Row: {
          created_at: string
          id: string
          label: string | null
          lead_in_seconds: number
          montage_id: string | null
          segments_json: Json
          target_duration_sec: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          lead_in_seconds?: number
          montage_id?: string | null
          segments_json?: Json
          target_duration_sec?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          lead_in_seconds?: number
          montage_id?: string | null
          segments_json?: Json
          target_duration_sec?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_montages_montage_id_fkey"
            columns: ["montage_id"]
            isOneToOne: false
            referencedRelation: "montage_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          label: string
          query_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          query_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          query_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "video_search_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_segments: {
        Row: {
          created_at: string
          end_sec: number
          id: string
          keyframe_ref: string | null
          start_sec: number
          video_id: string
        }
        Insert: {
          created_at?: string
          end_sec?: number
          id?: string
          keyframe_ref?: string | null
          start_sec?: number
          video_id: string
        }
        Update: {
          created_at?: string
          end_sec?: number
          id?: string
          keyframe_ref?: string | null
          start_sec?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_segments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          auto_publish: boolean | null
          bank_account: string | null
          bank_bik: string | null
          bank_corr_account: string | null
          bank_name: string | null
          bank_verified: boolean | null
          brand_description: string | null
          brand_logo_url: string | null
          brand_name: string | null
          brand_website: string | null
          business_category: string | null
          business_inn: string | null
          business_name: string | null
          business_ogrn: string | null
          business_type: string | null
          business_verified: boolean | null
          channel_description: string | null
          channel_name: string | null
          contact_email: string | null
          created_at: string
          default_language: string | null
          default_monetization: string | null
          id: string
          notify_new_comment: boolean | null
          notify_new_deal: boolean | null
          notify_new_subscriber: boolean | null
          ord_identifier: string | null
          ord_token: string | null
          ord_verified: boolean | null
          updated_at: string
          user_id: string
          watermark_enabled: boolean | null
        }
        Insert: {
          auto_publish?: boolean | null
          bank_account?: string | null
          bank_bik?: string | null
          bank_corr_account?: string | null
          bank_name?: string | null
          bank_verified?: boolean | null
          brand_description?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_website?: string | null
          business_category?: string | null
          business_inn?: string | null
          business_name?: string | null
          business_ogrn?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          channel_description?: string | null
          channel_name?: string | null
          contact_email?: string | null
          created_at?: string
          default_language?: string | null
          default_monetization?: string | null
          id?: string
          notify_new_comment?: boolean | null
          notify_new_deal?: boolean | null
          notify_new_subscriber?: boolean | null
          ord_identifier?: string | null
          ord_token?: string | null
          ord_verified?: boolean | null
          updated_at?: string
          user_id: string
          watermark_enabled?: boolean | null
        }
        Update: {
          auto_publish?: boolean | null
          bank_account?: string | null
          bank_bik?: string | null
          bank_corr_account?: string | null
          bank_name?: string | null
          bank_verified?: boolean | null
          brand_description?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_website?: string | null
          business_category?: string | null
          business_inn?: string | null
          business_name?: string | null
          business_ogrn?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          channel_description?: string | null
          channel_name?: string | null
          contact_email?: string | null
          created_at?: string
          default_language?: string | null
          default_monetization?: string | null
          id?: string
          notify_new_comment?: boolean | null
          notify_new_deal?: boolean | null
          notify_new_subscriber?: boolean | null
          ord_identifier?: string | null
          ord_token?: string | null
          ord_verified?: boolean | null
          updated_at?: string
          user_id?: string
          watermark_enabled?: boolean | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      template_run_history: {
        Row: {
          generated_playlist_id: string | null
          id: string
          run_at: string
          status: string
          template_id: string
          user_id: string
        }
        Insert: {
          generated_playlist_id?: string | null
          id?: string
          run_at?: string
          status?: string
          template_id: string
          user_id: string
        }
        Update: {
          generated_playlist_id?: string | null
          id?: string
          run_at?: string
          status?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_run_history_generated_playlist_id_fkey"
            columns: ["generated_playlist_id"]
            isOneToOne: false
            referencedRelation: "goal_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_run_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "playlist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      transcript_segments: {
        Row: {
          confidence: number | null
          created_at: string
          end_sec: number
          id: string
          speaker_id: string | null
          start_sec: number
          text: string
          video_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          end_sec?: number
          id?: string
          speaker_id?: string | null
          start_sec?: number
          text?: string
          video_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          end_sec?: number
          id?: string
          speaker_id?: string | null
          start_sec?: number
          text?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          available: number
          created_at: string
          id: string
          reserved: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available?: number
          created_at?: string
          id?: string
          reserved?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available?: number
          created_at?: string
          id?: string
          reserved?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_access_snapshots: {
        Row: {
          created_at: string
          entitlement_summary: Json
          id: string
          query_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement_summary?: Json
          id?: string
          query_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement_summary?: Json
          id?: string
          query_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_access_snapshots_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "video_search_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      video_search_queries: {
        Row: {
          clarification_questions: Json | null
          clarifications: Json | null
          created_at: string
          id: string
          include_private_sources: boolean
          mode: string
          parsed_intent: Json | null
          preferences: Json | null
          query_text: string
          status: string
          user_id: string
        }
        Insert: {
          clarification_questions?: Json | null
          clarifications?: Json | null
          created_at?: string
          id?: string
          include_private_sources?: boolean
          mode?: string
          parsed_intent?: Json | null
          preferences?: Json | null
          query_text: string
          status?: string
          user_id: string
        }
        Update: {
          clarification_questions?: Json | null
          clarifications?: Json | null
          created_at?: string
          id?: string
          include_private_sources?: boolean
          mode?: string
          parsed_intent?: Json | null
          preferences?: Json | null
          query_text?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      video_search_results: {
        Row: {
          created_at: string
          id: string
          moment_id: string
          query_id: string
          rationale: Json | null
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          moment_id: string
          query_id: string
          rationale?: Json | null
          score?: number
        }
        Update: {
          created_at?: string
          id?: string
          moment_id?: string
          query_id?: string
          rationale?: Json | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_search_results_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moment_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_search_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "video_search_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          created_at: string
          date_bucket: string
          id: string
          video_id: string
          viewer_user_id: string
          watched_percent: number
        }
        Insert: {
          created_at?: string
          date_bucket?: string
          id?: string
          video_id: string
          viewer_user_id: string
          watched_percent?: number
        }
        Update: {
          created_at?: string
          date_bucket?: string
          id?: string
          video_id?: string
          viewer_user_id?: string
          watched_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views_daily: {
        Row: {
          creator_id: string
          date: string
          id: string
          views_30pct_count: number
        }
        Insert: {
          creator_id: string
          date?: string
          id?: string
          views_30pct_count?: number
        }
        Update: {
          creator_id?: string
          date?: string
          id?: string
          views_30pct_count?: number
        }
        Relationships: []
      }
      view_history: {
        Row: {
          content_id: string
          id: string
          total_seconds: number | null
          user_id: string
          viewed_at: string
          watched_seconds: number | null
        }
        Insert: {
          content_id: string
          id?: string
          total_seconds?: number | null
          user_id: string
          viewed_at?: string
          watched_seconds?: number | null
        }
        Update: {
          content_id?: string
          id?: string
          total_seconds?: number | null
          user_id?: string
          viewed_at?: string
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "view_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_achievement: {
        Args: {
          _description: string
          _icon?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      get_advertiser_brand: {
        Args: { p_user_id: string }
        Returns: {
          brand_description: string
          brand_logo_url: string
          brand_name: string
          brand_website: string
          business_category: string
          business_verified: boolean
          contact_email: string
          ord_verified: boolean
          user_id: string
        }[]
      }
      get_creator_avg_views_30pct: {
        Args: { p_creator_id: string; p_limit?: number }
        Returns: number
      }
      get_creators_avg_views_30pct: {
        Args: { p_creator_ids: string[] }
        Returns: {
          avg_views: number
          creator_id: string
          video_count: number
        }[]
      }
      get_post_impressions_batch: {
        Args: { p_post_ids: string[] }
        Returns: {
          impression_count: number
          post_id: string
        }[]
      }
      get_video_view_count_30pct: {
        Args: { p_video_id: string }
        Returns: number
      }
      get_video_views_batch: {
        Args: { p_video_ids: string[] }
        Returns: {
          video_id: string
          view_count: number
        }[]
      }
      get_video_views_trend: {
        Args: { p_creator_id: string; p_days?: number }
        Returns: {
          day: string
          view_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_chunks_fts:
        | {
            Args: {
              p_fts_config?: string
              p_limit?: number
              p_project_id: string
              p_query: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              score: number
            }[]
          }
        | {
            Args: {
              p_fts_config?: string
              p_limit?: number
              p_project_id: string
              p_query: string
              p_user_id?: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              score: number
            }[]
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "user" | "creator" | "advertiser" | "moderator" | "support"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["user", "creator", "advertiser", "moderator", "support"],
    },
  },
} as const
