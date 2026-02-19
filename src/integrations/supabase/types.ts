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
          id: string
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
          id?: string
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
          id?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          content_count: number | null
          created_at: string
          display_name: string
          email: string | null
          followers: number | null
          geo: string | null
          id: string
          niche: string[] | null
          rating: number | null
          reach: number | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string
          display_name?: string
          email?: string | null
          followers?: number | null
          geo?: string | null
          id?: string
          niche?: string[] | null
          rating?: number | null
          reach?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string
          display_name?: string
          email?: string | null
          followers?: number | null
          geo?: string | null
          id?: string
          niche?: string[] | null
          rating?: number | null
          reach?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
