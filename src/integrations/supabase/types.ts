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
      ai_courses: {
        Row: {
          created_at: string
          id: string
          modules: Json | null
          progress: number | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modules?: Json | null
          progress?: number | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modules?: Json | null
          progress?: number | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          created_at: string
          creator_avatar: string | null
          creator_id: string | null
          creator_name: string
          description: string | null
          id: string
          likes: number | null
          price: number | null
          tags: string[] | null
          thumbnail: string | null
          title: string
          type: string
          views: number | null
        }
        Insert: {
          created_at?: string
          creator_avatar?: string | null
          creator_id?: string | null
          creator_name?: string
          description?: string | null
          id?: string
          likes?: number | null
          price?: number | null
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          type: string
          views?: number | null
        }
        Update: {
          created_at?: string
          creator_avatar?: string | null
          creator_id?: string | null
          creator_name?: string
          description?: string | null
          id?: string
          likes?: number | null
          price?: number | null
          tags?: string[] | null
          thumbnail?: string | null
          title?: string
          type?: string
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
          communication: number | null
          created_at: string
          deal_id: string
          from_id: string | null
          id: string
          overall: number | null
          payment: number | null
          professionalism: number | null
          to_id: string | null
        }
        Insert: {
          communication?: number | null
          created_at?: string
          deal_id: string
          from_id?: string | null
          id?: string
          overall?: number | null
          payment?: number | null
          professionalism?: number | null
          to_id?: string | null
        }
        Update: {
          communication?: number | null
          created_at?: string
          deal_id?: string
          from_id?: string | null
          id?: string
          overall?: number | null
          payment?: number | null
          professionalism?: number | null
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
