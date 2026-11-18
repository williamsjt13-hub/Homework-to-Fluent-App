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
      activities: {
        Row: {
          answers: Json | null
          completed: boolean
          completed_at: string | null
          content: Json
          created_at: string
          day_id: string
          description: string | null
          est_minutes: number
          id: string
          kind: string
          lesson_id: string
          plan_added: boolean
          position: number
          removed_at: string | null
          results: Json | null
          score: number | null
          source: string
          title: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed?: boolean
          completed_at?: string | null
          content?: Json
          created_at?: string
          day_id: string
          description?: string | null
          est_minutes?: number
          id?: string
          kind: string
          lesson_id: string
          plan_added?: boolean
          position?: number
          removed_at?: string | null
          results?: Json | null
          score?: number | null
          source?: string
          title: string
          user_id?: string
        }
        Update: {
          answers?: Json | null
          completed?: boolean
          completed_at?: string | null
          content?: Json
          created_at?: string
          day_id?: string
          description?: string | null
          est_minutes?: number
          id?: string
          kind?: string
          lesson_id?: string
          plan_added?: boolean
          position?: number
          removed_at?: string | null
          results?: Json | null
          score?: number | null
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "study_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          activity_id: string | null
          created_at: string
          evaluation: Json | null
          id: string
          lesson_id: string
          messages: Json
          scenario: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          evaluation?: Json | null
          id?: string
          lesson_id: string
          messages?: Json
          scenario?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          evaluation?: Json | null
          id?: string
          lesson_id?: string
          messages?: Json
          scenario?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_coach_access_blocks: {
        Row: {
          created_at: string
          message: string
          status: number
          user_id: string
        }
        Insert: {
          created_at?: string
          message: string
          status: number
          user_id?: string
        }
        Update: {
          created_at?: string
          message?: string
          status?: number
          user_id?: string
        }
        Relationships: []
      }
      plan_coach_proposals: {
        Row: {
          additions: Json
          changes: Json
          created_at: string
          id: string
          lesson_id: string
          removals: Json
          status: string
          summary: string
          thread_id: string
          user_id: string
        }
        Insert: {
          additions: Json
          changes?: Json
          created_at?: string
          id?: string
          lesson_id: string
          removals?: Json
          status?: string
          summary: string
          thread_id: string
          user_id?: string
        }
        Update: {
          additions?: Json
          changes?: Json
          created_at?: string
          id?: string
          lesson_id?: string
          removals?: Json
          status?: string
          summary?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_coach_proposals_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_coach_proposals_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "plan_coach_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_coach_threads: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_coach_threads_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          level: string
          native_language: string
          target_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          level?: string
          native_language?: string
          target_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          level?: string
          native_language?: string
          target_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_mistakes: {
        Row: {
          category: string
          concept: string
          correct_text: string | null
          created_at: string
          explanation: string | null
          id: string
          lesson_id: string | null
          occurrences: number
          resolved: boolean
          source: string
          student_text: string | null
          user_id: string
        }
        Insert: {
          category?: string
          concept: string
          correct_text?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          occurrences?: number
          resolved?: boolean
          source?: string
          student_text?: string | null
          user_id?: string
        }
        Update: {
          category?: string
          concept?: string
          correct_text?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          occurrences?: number
          resolved?: boolean
          source?: string
          student_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_mistakes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      study_days: {
        Row: {
          completed_at: string | null
          content_status: string
          created_at: string
          day_number: number
          id: string
          lesson_id: string
          minutes_completed: number
          purpose: string
          score: number | null
          target_minutes: number
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_status?: string
          created_at?: string
          day_number: number
          id?: string
          lesson_id: string
          minutes_completed?: number
          purpose: string
          score?: number | null
          target_minutes?: number
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          content_status?: string
          created_at?: string
          day_number?: number
          id?: string
          lesson_id?: string
          minutes_completed?: number
          purpose?: string
          score?: number | null
          target_minutes?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_days_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          activity_id: string | null
          created_at: string
          day_id: string | null
          id: string
          lesson_id: string | null
          minutes: number
          study_date: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          day_id?: string | null
          id?: string
          lesson_id?: string | null
          minutes: number
          study_date?: string
          user_id?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          day_id?: string | null
          id?: string
          lesson_id?: string | null
          minutes?: number
          study_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "study_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          created_at: string
          file_name: string
          id: string
          lesson_id: string
          mime_type: string
          page_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          lesson_id: string
          mime_type: string
          page_order?: number
          storage_path: string
          user_id?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          lesson_id?: string
          mime_type?: string
          page_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          daily_goal_minutes: number
          speech_rate: number
          updated_at: string
          user_id: string
          voice_accent: string
        }
        Insert: {
          created_at?: string
          daily_goal_minutes?: number
          speech_rate?: number
          updated_at?: string
          user_id: string
          voice_accent?: string
        }
        Update: {
          created_at?: string
          daily_goal_minutes?: number
          speech_rate?: number
          updated_at?: string
          user_id?: string
          voice_accent?: string
        }
        Relationships: []
      }
      vocabulary: {
        Row: {
          created_at: string
          id: string
          language: string
          lesson_id: string | null
          term: string
          times_correct: number
          times_missed: number
          translation: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          lesson_id?: string | null
          term: string
          times_correct?: number
          times_missed?: number
          translation?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          lesson_id?: string | null
          term?: string
          times_correct?: number
          times_missed?: number
          translation?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_assessments: {
        Row: {
          category_scores: Json
          created_at: string
          id: string
          lesson_id: string
          recommendations: Json
          strong_areas: Json
          total_score: number
          user_id: string
          weak_areas: Json
        }
        Insert: {
          category_scores?: Json
          created_at?: string
          id?: string
          lesson_id: string
          recommendations?: Json
          strong_areas?: Json
          total_score: number
          user_id?: string
          weak_areas?: Json
        }
        Update: {
          category_scores?: Json
          created_at?: string
          id?: string
          lesson_id?: string
          recommendations?: Json
          strong_areas?: Json
          total_score?: number
          user_id?: string
          weak_areas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "weekly_assessments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_lessons: {
        Row: {
          created_at: string
          extracted: Json | null
          id: string
          language: string
          overall_score: number | null
          status: string
          topic: string | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          extracted?: Json | null
          id?: string
          language?: string
          overall_score?: number | null
          status?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          extracted?: Json | null
          id?: string
          language?: string
          overall_score?: number | null
          status?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_plan_originals: {
        Row: {
          created_at: string
          days: Json
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days: Json
          lesson_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          days?: Json
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plan_originals_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "weekly_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_plan_coach_proposal: {
        Args: { generated: Json; proposal_id: string }
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
