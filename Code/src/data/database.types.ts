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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          balance_chf: number | null
          created_at: string
          currency: string
          further_product: boolean
          iban: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          persona_id: string
          source_bank: string | null
          source_type: string
        }
        Insert: {
          balance: number
          balance_chf?: number | null
          created_at?: string
          currency?: string
          further_product?: boolean
          iban: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          persona_id: string
          source_bank?: string | null
          source_type?: string
        }
        Update: {
          balance?: number
          balance_chf?: number | null
          created_at?: string
          currency?: string
          further_product?: boolean
          iban?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          persona_id?: string
          source_bank?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          persona_id: string
          session_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          persona_id: string
          session_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          persona_id?: string
          session_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          persona_id: string
          session_id: string
          target_amount: number
          target_date: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          persona_id: string
          session_id: string
          target_amount: number
          target_date?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          persona_id?: string
          session_id?: string
          target_amount?: number
          target_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          computed_at: string
          engine_version: string
          id: string
          kind: string
          payload: Json
          period_end: string | null
          period_start: string | null
          persona_id: string
        }
        Insert: {
          computed_at?: string
          engine_version?: string
          id?: string
          kind: string
          payload: Json
          period_end?: string | null
          period_start?: string | null
          persona_id: string
        }
        Update: {
          computed_at?: string
          engine_version?: string
          id?: string
          kind?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          persona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          execute_on: string
          id: string
          kind: string
          persona_id: string
          recipient: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency?: string
          execute_on: string
          id: string
          kind: string
          persona_id: string
          recipient: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          execute_on?: string
          id?: string
          kind?: string
          persona_id?: string
          recipient?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          id: string
          name: string
          quote: string | null
          role: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          quote?: string | null
          role: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quote?: string | null
          role?: string
          source?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          persona_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          persona_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          persona_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          booked_on: string
          brand: Json | null
          category: Database["public"]["Enums"]["category"]
          counter_account_id: string | null
          created_at: string
          currency: string
          description: string
          id: string
          pending: boolean
          persona_id: string
          series_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          booked_on: string
          brand?: Json | null
          category: Database["public"]["Enums"]["category"]
          counter_account_id?: string | null
          created_at?: string
          currency?: string
          description: string
          id: string
          pending?: boolean
          persona_id: string
          series_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          booked_on?: string
          brand?: Json | null
          category?: Database["public"]["Enums"]["category"]
          counter_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          pending?: boolean
          persona_id?: string
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey"
            columns: ["counter_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_kind:
        | "private"
        | "savings"
        | "youth"
        | "foreign"
        | "retirement3a"
        | "card"
        | "loan"
        | "custody"
      category:
        | "income"
        | "groceries"
        | "eatingOut"
        | "shopping"
        | "transport"
        | "housing"
        | "health"
        | "subscriptions"
        | "leisure"
        | "taxes"
        | "insurance"
        | "transfer"
        | "cash"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: [
        "private",
        "savings",
        "youth",
        "foreign",
        "retirement3a",
        "card",
        "loan",
        "custody",
      ],
      category: [
        "income",
        "groceries",
        "eatingOut",
        "shopping",
        "transport",
        "housing",
        "health",
        "subscriptions",
        "leisure",
        "taxes",
        "insurance",
        "transfer",
        "cash",
        "other",
      ],
    },
  },
} as const
