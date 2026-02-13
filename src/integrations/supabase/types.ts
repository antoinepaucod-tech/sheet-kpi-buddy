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
      accounting_categories: {
        Row: {
          created_at: string
          default_amount: number | null
          id: string
          is_indefinite_recurrence: boolean | null
          is_recurring: boolean | null
          name: string
          position: number
          recurrence_day: number | null
          recurrence_end_date: string | null
          requires_training_tracking: boolean
          revenue_type: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_amount?: number | null
          id?: string
          is_indefinite_recurrence?: boolean | null
          is_recurring?: boolean | null
          name: string
          position?: number
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          requires_training_tracking?: boolean
          revenue_type?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_amount?: number | null
          id?: string
          is_indefinite_recurrence?: boolean | null
          is_recurring?: boolean | null
          name?: string
          position?: number
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          requires_training_tracking?: boolean
          revenue_type?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounting_transactions: {
        Row: {
          amount: number
          amount_received: number | null
          category: string
          client_name: string | null
          created_at: string
          id: string
          invoice_number: string | null
          is_auto_generated: boolean | null
          is_validated: boolean | null
          month: number
          month_name: string
          notes: string | null
          payment_method: string | null
          product_description: string | null
          service_description: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          amount_received?: number | null
          category: string
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          is_auto_generated?: boolean | null
          is_validated?: boolean | null
          month: number
          month_name: string
          notes?: string | null
          payment_method?: string | null
          product_description?: string | null
          service_description?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          amount_received?: number | null
          category?: string
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          is_auto_generated?: boolean | null
          is_validated?: boolean | null
          month?: number
          month_name?: string
          notes?: string | null
          payment_method?: string | null
          product_description?: string | null
          service_description?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      challenge_weekly_checkins: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          member_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_weekly_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
            referencedColumns: ["id"]
          },
        ]
      }
      course_kpis: {
        Row: {
          attendance_rate: number | null
          course_name: string
          created_at: string
          day_of_week: string
          id: string
          instructor: string | null
          max_capacity: number | null
          month: number
          month_name: string
          monthly_expenses: number | null
          time_slot: string
          updated_at: string
          week1_attendance: number | null
          week1_instructor: string | null
          week2_attendance: number | null
          week2_instructor: string | null
          week3_attendance: number | null
          week3_instructor: string | null
          week4_attendance: number | null
          week4_instructor: string | null
          week5_attendance: number | null
          week5_instructor: string | null
          year: number
        }
        Insert: {
          attendance_rate?: number | null
          course_name: string
          created_at?: string
          day_of_week: string
          id?: string
          instructor?: string | null
          max_capacity?: number | null
          month: number
          month_name: string
          monthly_expenses?: number | null
          time_slot: string
          updated_at?: string
          week1_attendance?: number | null
          week1_instructor?: string | null
          week2_attendance?: number | null
          week2_instructor?: string | null
          week3_attendance?: number | null
          week3_instructor?: string | null
          week4_attendance?: number | null
          week4_instructor?: string | null
          week5_attendance?: number | null
          week5_instructor?: string | null
          year: number
        }
        Update: {
          attendance_rate?: number | null
          course_name?: string
          created_at?: string
          day_of_week?: string
          id?: string
          instructor?: string | null
          max_capacity?: number | null
          month?: number
          month_name?: string
          monthly_expenses?: number | null
          time_slot?: string
          updated_at?: string
          week1_attendance?: number | null
          week1_instructor?: string | null
          week2_attendance?: number | null
          week2_instructor?: string | null
          week3_attendance?: number | null
          week3_instructor?: string | null
          week4_attendance?: number | null
          week4_instructor?: string | null
          week5_attendance?: number | null
          week5_instructor?: string | null
          year?: number
        }
        Relationships: []
      }
      course_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_members: {
        Row: {
          cash_collected: number | null
          contract_signed_date: string | null
          created_at: string
          exit_date: string | null
          id: string
          is_primary_subscriber: boolean
          member_type: string | null
          membership: string
          name: string
          onboarding_bsport: boolean
          onboarding_hubfit: boolean
          onboarding_nutrition: boolean
          persons_count: number
          questionnaire_coaching: boolean
          session_introduction: boolean
          sold_by: string | null
          subscription_end_date: string | null
          subscription_group_id: string | null
          updated_at: string
        }
        Insert: {
          cash_collected?: number | null
          contract_signed_date?: string | null
          created_at?: string
          exit_date?: string | null
          id?: string
          is_primary_subscriber?: boolean
          member_type?: string | null
          membership: string
          name: string
          onboarding_bsport?: boolean
          onboarding_hubfit?: boolean
          onboarding_nutrition?: boolean
          persons_count?: number
          questionnaire_coaching?: boolean
          session_introduction?: boolean
          sold_by?: string | null
          subscription_end_date?: string | null
          subscription_group_id?: string | null
          updated_at?: string
        }
        Update: {
          cash_collected?: number | null
          contract_signed_date?: string | null
          created_at?: string
          exit_date?: string | null
          id?: string
          is_primary_subscriber?: boolean
          member_type?: string | null
          membership?: string
          name?: string
          onboarding_bsport?: boolean
          onboarding_hubfit?: boolean
          onboarding_nutrition?: boolean
          persons_count?: number
          questionnaire_coaching?: boolean
          session_introduction?: boolean
          sold_by?: string | null
          subscription_end_date?: string | null
          subscription_group_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          email: string
          enabled: boolean | null
          id: string
          send_hour: number | null
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean | null
          id?: string
          send_hour?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean | null
          id?: string
          send_hour?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      excluded_recurring_expenses: {
        Row: {
          category: string
          created_at: string
          id: string
          month: number
          service_description: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month: number
          service_description: string
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: number
          service_description?: string
          year?: number
        }
        Relationships: []
      }
      instructors: {
        Row: {
          created_at: string
          hourly_rate: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          expected_quantity: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expected_quantity?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expected_quantity?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_monthly_checks: {
        Row: {
          actual_quantity: number
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          item_id: string
          month: number
          month_name: string
          notes: string | null
          updated_at: string
          year: number
        }
        Insert: {
          actual_quantity?: number
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          month: number
          month_name: string
          notes?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          actual_quantity?: number
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          month?: number
          month_name?: string
          notes?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_monthly_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      member_comments: {
        Row: {
          comment: string
          created_at: string
          created_by: string
          id: string
          member_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          created_by: string
          id?: string
          member_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_comments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_onboarding_history: {
        Row: {
          action_date: string
          action_type: string
          id: string
          member_id: string
          new_value: boolean
          performed_by: string | null
          previous_value: boolean
        }
        Insert: {
          action_date?: string
          action_type: string
          id?: string
          member_id: string
          new_value: boolean
          performed_by?: string | null
          previous_value: boolean
        }
        Update: {
          action_date?: string
          action_type?: string
          id?: string
          member_id?: string
          new_value?: boolean
          performed_by?: string | null
          previous_value?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_onboarding_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_persons: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string
          member_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name: string
          member_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string
          member_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_persons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_renewal_history: {
        Row: {
          created_at: string
          id: string
          member_id: string
          new_end_date: string
          notes: string | null
          performed_by: string | null
          previous_end_date: string
          renewal_date: string
          renewal_duration: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          new_end_date: string
          notes?: string | null
          performed_by?: string | null
          previous_end_date: string
          renewal_date?: string
          renewal_duration: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          new_end_date?: string
          notes?: string | null
          performed_by?: string | null
          previous_end_date?: string
          renewal_date?: string
          renewal_duration?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_renewal_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_kpis: {
        Row: {
          ad_spend: number | null
          advertising_promotion: number | null
          bank_finance_charges: number | null
          cac: number | null
          calls_made: number | null
          cash_collected: number | null
          charitable_donations: number | null
          close: number | null
          computer_software: number | null
          converted: number | null
          cpl: number | null
          cpr: number | null
          created_at: string
          credit_repayment: number | null
          fast_cash_revenue: number | null
          food_expenses: number | null
          general_acrm: number | null
          general_churn: number | null
          general_eft_revenue: number | null
          general_exits: number | null
          general_ltv: number | null
          gym_floor_sqft: number | null
          id: string
          in_trial: number | null
          insurance: number | null
          internet_telephone: number | null
          leads: number | null
          legal_professional: number | null
          month: number
          month_name: string
          organic_cash_collected: number | null
          organic_close: number | null
          organic_leads: number | null
          pauses: number | null
          pif_churn: number | null
          pif_exits: number | null
          pif_members: number | null
          profit: number | null
          pt_acrm: number | null
          pt_churn: number | null
          pt_exits: number | null
          pt_ltv: number | null
          pt_members: number | null
          pt_revenue: number | null
          recurring_general_members: number | null
          rent: number | null
          repairs_maintenance: number | null
          retail_revenue: number | null
          ro_ads: number | null
          salaries: number | null
          salaries_coach: number | null
          scheduled: number | null
          show: number | null
          stationary: number | null
          subscriptions: number | null
          total_active_members: number | null
          total_classes: number | null
          total_expenses: number | null
          total_revenue: number | null
          trial_ending: number | null
          updated_at: string
          utilities: number | null
          year: number
        }
        Insert: {
          ad_spend?: number | null
          advertising_promotion?: number | null
          bank_finance_charges?: number | null
          cac?: number | null
          calls_made?: number | null
          cash_collected?: number | null
          charitable_donations?: number | null
          close?: number | null
          computer_software?: number | null
          converted?: number | null
          cpl?: number | null
          cpr?: number | null
          created_at?: string
          credit_repayment?: number | null
          fast_cash_revenue?: number | null
          food_expenses?: number | null
          general_acrm?: number | null
          general_churn?: number | null
          general_eft_revenue?: number | null
          general_exits?: number | null
          general_ltv?: number | null
          gym_floor_sqft?: number | null
          id?: string
          in_trial?: number | null
          insurance?: number | null
          internet_telephone?: number | null
          leads?: number | null
          legal_professional?: number | null
          month: number
          month_name: string
          organic_cash_collected?: number | null
          organic_close?: number | null
          organic_leads?: number | null
          pauses?: number | null
          pif_churn?: number | null
          pif_exits?: number | null
          pif_members?: number | null
          profit?: number | null
          pt_acrm?: number | null
          pt_churn?: number | null
          pt_exits?: number | null
          pt_ltv?: number | null
          pt_members?: number | null
          pt_revenue?: number | null
          recurring_general_members?: number | null
          rent?: number | null
          repairs_maintenance?: number | null
          retail_revenue?: number | null
          ro_ads?: number | null
          salaries?: number | null
          salaries_coach?: number | null
          scheduled?: number | null
          show?: number | null
          stationary?: number | null
          subscriptions?: number | null
          total_active_members?: number | null
          total_classes?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          trial_ending?: number | null
          updated_at?: string
          utilities?: number | null
          year: number
        }
        Update: {
          ad_spend?: number | null
          advertising_promotion?: number | null
          bank_finance_charges?: number | null
          cac?: number | null
          calls_made?: number | null
          cash_collected?: number | null
          charitable_donations?: number | null
          close?: number | null
          computer_software?: number | null
          converted?: number | null
          cpl?: number | null
          cpr?: number | null
          created_at?: string
          credit_repayment?: number | null
          fast_cash_revenue?: number | null
          food_expenses?: number | null
          general_acrm?: number | null
          general_churn?: number | null
          general_eft_revenue?: number | null
          general_exits?: number | null
          general_ltv?: number | null
          gym_floor_sqft?: number | null
          id?: string
          in_trial?: number | null
          insurance?: number | null
          internet_telephone?: number | null
          leads?: number | null
          legal_professional?: number | null
          month?: number
          month_name?: string
          organic_cash_collected?: number | null
          organic_close?: number | null
          organic_leads?: number | null
          pauses?: number | null
          pif_churn?: number | null
          pif_exits?: number | null
          pif_members?: number | null
          profit?: number | null
          pt_acrm?: number | null
          pt_churn?: number | null
          pt_exits?: number | null
          pt_ltv?: number | null
          pt_members?: number | null
          pt_revenue?: number | null
          recurring_general_members?: number | null
          rent?: number | null
          repairs_maintenance?: number | null
          retail_revenue?: number | null
          ro_ads?: number | null
          salaries?: number | null
          salaries_coach?: number | null
          scheduled?: number | null
          show?: number | null
          stationary?: number | null
          subscriptions?: number | null
          total_active_members?: number | null
          total_classes?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          trial_ending?: number | null
          updated_at?: string
          utilities?: number | null
          year?: number
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          amount: number
          amount_received: number | null
          category: string
          client_name: string | null
          created_at: string
          id: string
          invoice_number_prefix: string | null
          is_active: boolean | null
          notes: string | null
          payment_method: string | null
          product_description: string | null
          recurrence_day: number | null
          service_description: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_received?: number | null
          category: string
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_number_prefix?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_method?: string | null
          product_description?: string | null
          recurrence_day?: number | null
          service_description?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_received?: number | null
          category?: string
          client_name?: string | null
          created_at?: string
          id?: string
          invoice_number_prefix?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_method?: string | null
          product_description?: string | null
          recurrence_day?: number | null
          service_description?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_templates: {
        Row: {
          course_name: string
          created_at: string
          day_of_week: string
          id: string
          instructor_name: string | null
          time_slot: string
          updated_at: string
        }
        Insert: {
          course_name: string
          created_at?: string
          day_of_week: string
          id?: string
          instructor_name?: string | null
          time_slot: string
          updated_at?: string
        }
        Update: {
          course_name?: string
          created_at?: string
          day_of_week?: string
          id?: string
          instructor_name?: string | null
          time_slot?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutorial_views: {
        Row: {
          completed: boolean | null
          id: string
          tutorial_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          completed?: boolean | null
          id?: string
          tutorial_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          completed?: boolean | null
          id?: string
          tutorial_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_views_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          id: string
          order_index: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_type: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          order_index?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_type: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          order_index?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_type?: string
          video_url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_trainings: {
        Row: {
          calendar_week: number | null
          calendar_year: number | null
          created_at: string
          id: string
          member_id: string
          trainings_count: number
          updated_at: string
          week_number: number
        }
        Insert: {
          calendar_week?: number | null
          calendar_year?: number | null
          created_at?: string
          id?: string
          member_id: string
          trainings_count?: number
          updated_at?: string
          week_number: number
        }
        Update: {
          calendar_week?: number | null
          calendar_year?: number | null
          created_at?: string
          id?: string
          member_id?: string
          trainings_count?: number
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_trainings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "customer_members"
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      is_coach: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer" | "coach"
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
      app_role: ["admin", "staff", "viewer", "coach"],
    },
  },
} as const
