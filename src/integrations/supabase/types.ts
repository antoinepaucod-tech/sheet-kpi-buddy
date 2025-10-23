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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      email_preferences: {
        Row: {
          created_at: string
          email: string
          enabled: boolean | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_kpis: {
        Row: {
          ad_spend: number | null
          advertising_promotion: number | null
          bank_finance_charges: number | null
          calls_made: number | null
          cash_collected: number | null
          charitable_donations: number | null
          close: number | null
          computer_software: number | null
          converted: number | null
          created_at: string
          fast_cash_revenue: number | null
          general_eft_revenue: number | null
          general_exits: number | null
          id: string
          in_trial: number | null
          insurance: number | null
          internet_telephone: number | null
          leads: number | null
          legal_professional: number | null
          organic_cash_collected: number | null
          organic_close: number | null
          organic_leads: number | null
          pauses: number | null
          pif_exits: number | null
          pif_members: number | null
          pt_exits: number | null
          pt_members: number | null
          pt_revenue: number | null
          recurring_general_members: number | null
          rent: number | null
          repairs_maintenance: number | null
          retail_revenue: number | null
          scheduled: number | null
          show: number | null
          stationary: number | null
          subscriptions: number | null
          total_classes: number | null
          total_revenue: number | null
          trial_ending: number | null
          updated_at: string
          utilities: number | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Insert: {
          ad_spend?: number | null
          advertising_promotion?: number | null
          bank_finance_charges?: number | null
          calls_made?: number | null
          cash_collected?: number | null
          charitable_donations?: number | null
          close?: number | null
          computer_software?: number | null
          converted?: number | null
          created_at?: string
          fast_cash_revenue?: number | null
          general_eft_revenue?: number | null
          general_exits?: number | null
          id?: string
          in_trial?: number | null
          insurance?: number | null
          internet_telephone?: number | null
          leads?: number | null
          legal_professional?: number | null
          organic_cash_collected?: number | null
          organic_close?: number | null
          organic_leads?: number | null
          pauses?: number | null
          pif_exits?: number | null
          pif_members?: number | null
          pt_exits?: number | null
          pt_members?: number | null
          pt_revenue?: number | null
          recurring_general_members?: number | null
          rent?: number | null
          repairs_maintenance?: number | null
          retail_revenue?: number | null
          scheduled?: number | null
          show?: number | null
          stationary?: number | null
          subscriptions?: number | null
          total_classes?: number | null
          total_revenue?: number | null
          trial_ending?: number | null
          updated_at?: string
          utilities?: number | null
          week_end_date: string
          week_number: number
          week_start_date: string
          year: number
        }
        Update: {
          ad_spend?: number | null
          advertising_promotion?: number | null
          bank_finance_charges?: number | null
          calls_made?: number | null
          cash_collected?: number | null
          charitable_donations?: number | null
          close?: number | null
          computer_software?: number | null
          converted?: number | null
          created_at?: string
          fast_cash_revenue?: number | null
          general_eft_revenue?: number | null
          general_exits?: number | null
          id?: string
          in_trial?: number | null
          insurance?: number | null
          internet_telephone?: number | null
          leads?: number | null
          legal_professional?: number | null
          organic_cash_collected?: number | null
          organic_close?: number | null
          organic_leads?: number | null
          pauses?: number | null
          pif_exits?: number | null
          pif_members?: number | null
          pt_exits?: number | null
          pt_members?: number | null
          pt_revenue?: number | null
          recurring_general_members?: number | null
          rent?: number | null
          repairs_maintenance?: number | null
          retail_revenue?: number | null
          scheduled?: number | null
          show?: number | null
          stationary?: number | null
          subscriptions?: number | null
          total_classes?: number | null
          total_revenue?: number | null
          trial_ending?: number | null
          updated_at?: string
          utilities?: number | null
          week_end_date?: string
          week_number?: number
          week_start_date?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
