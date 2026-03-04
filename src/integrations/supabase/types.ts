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
      activity_nodes: {
        Row: {
          activity_id: string
          activity_index: number | null
          class: string | null
          created_at: string | null
          description: string | null
          duration_hint: string | null
          grouping: string | null
          materials: Json | null
          methods: Json | null
          row_id: string | null
          subject: string | null
          term: string | null
          topic: string | null
        }
        Insert: {
          activity_id: string
          activity_index?: number | null
          class?: string | null
          created_at?: string | null
          description?: string | null
          duration_hint?: string | null
          grouping?: string | null
          materials?: Json | null
          methods?: Json | null
          row_id?: string | null
          subject?: string | null
          term?: string | null
          topic?: string | null
        }
        Update: {
          activity_id?: string
          activity_index?: number | null
          class?: string | null
          created_at?: string | null
          description?: string | null
          duration_hint?: string | null
          grouping?: string | null
          materials?: Json | null
          methods?: Json | null
          row_id?: string | null
          subject?: string | null
          term?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      blooms_tags: {
        Row: {
          blooms_level: string | null
          blooms_verb: string | null
          class: string | null
          created_at: string | null
          curriculum_tag: string | null
          difficulty: string | null
          outcome_id: string | null
          outcome_text: string | null
          quiz_question_stem: string | null
          related_node_ids: Json | null
          row_id: string | null
          subject: string | null
          tag_id: string
          term: string | null
          theme: string | null
          topic: string | null
        }
        Insert: {
          blooms_level?: string | null
          blooms_verb?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_tag?: string | null
          difficulty?: string | null
          outcome_id?: string | null
          outcome_text?: string | null
          quiz_question_stem?: string | null
          related_node_ids?: Json | null
          row_id?: string | null
          subject?: string | null
          tag_id: string
          term?: string | null
          theme?: string | null
          topic?: string | null
        }
        Update: {
          blooms_level?: string | null
          blooms_verb?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_tag?: string | null
          difficulty?: string | null
          outcome_id?: string | null
          outcome_text?: string | null
          quiz_question_stem?: string | null
          related_node_ids?: Json | null
          row_id?: string | null
          subject?: string | null
          tag_id?: string
          term?: string | null
          theme?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      curriculum_edges: {
        Row: {
          confidence: string | null
          connection_type: string | null
          created_at: string | null
          edge_id: string
          edge_type: string
          from_concept: string | null
          from_node_id: string | null
          from_subject: string | null
          reason: string | null
          strength: string | null
          student_explanation: string | null
          subject: string | null
          to_concept: string | null
          to_node_id: string | null
          to_subject: string | null
        }
        Insert: {
          confidence?: string | null
          connection_type?: string | null
          created_at?: string | null
          edge_id: string
          edge_type: string
          from_concept?: string | null
          from_node_id?: string | null
          from_subject?: string | null
          reason?: string | null
          strength?: string | null
          student_explanation?: string | null
          subject?: string | null
          to_concept?: string | null
          to_node_id?: string | null
          to_subject?: string | null
        }
        Update: {
          confidence?: string | null
          connection_type?: string | null
          created_at?: string | null
          edge_id?: string
          edge_type?: string
          from_concept?: string | null
          from_node_id?: string | null
          from_subject?: string | null
          reason?: string | null
          strength?: string | null
          student_explanation?: string | null
          subject?: string | null
          to_concept?: string | null
          to_node_id?: string | null
          to_subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "curriculum_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      curriculum_nodes: {
        Row: {
          class: string | null
          concept_type: string | null
          created_at: string | null
          definition: string | null
          embedding: string | null
          name: string
          node_id: string
          node_type: string
          row_id: string | null
          skills: Json | null
          subject: string | null
          term: string | null
          theme: string | null
          topic: string | null
          vocabulary: Json | null
        }
        Insert: {
          class?: string | null
          concept_type?: string | null
          created_at?: string | null
          definition?: string | null
          embedding?: string | null
          name: string
          node_id: string
          node_type?: string
          row_id?: string | null
          skills?: Json | null
          subject?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
          vocabulary?: Json | null
        }
        Update: {
          class?: string | null
          concept_type?: string | null
          created_at?: string | null
          definition?: string | null
          embedding?: string | null
          name?: string
          node_id?: string
          node_type?: string
          row_id?: string | null
          skills?: Json | null
          subject?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
          vocabulary?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
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
      outcome_nodes: {
        Row: {
          blooms_level: string | null
          class: string | null
          created_at: string | null
          curriculum_tag: string | null
          difficulty: string | null
          distractor_hints: Json | null
          embedding: string | null
          outcome_id: string
          outcome_text: string | null
          related_node_ids: Json | null
          row_id: string | null
          subject: string | null
          tag_id: string | null
          term: string | null
          theme: string | null
          topic: string | null
        }
        Insert: {
          blooms_level?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_tag?: string | null
          difficulty?: string | null
          distractor_hints?: Json | null
          embedding?: string | null
          outcome_id: string
          outcome_text?: string | null
          related_node_ids?: Json | null
          row_id?: string | null
          subject?: string | null
          tag_id?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
        }
        Update: {
          blooms_level?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_tag?: string | null
          difficulty?: string | null
          distractor_hints?: Json | null
          embedding?: string | null
          outcome_id?: string
          outcome_text?: string | null
          related_node_ids?: Json | null
          row_id?: string | null
          subject?: string | null
          tag_id?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_nodes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blooms_tags"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      profiles: {
        Row: {
          class: string | null
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          subject: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subject?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subject?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          burst_count: number
          daily_count: number
          id: string
          last_day: string | null
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          burst_count?: number
          daily_count?: number
          id?: string
          last_day?: string | null
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          burst_count?: number
          daily_count?: number
          id?: string
          last_day?: string | null
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      realworld_applications: {
        Row: {
          application_id: string
          class: string | null
          concept_connected: string | null
          context: string | null
          created_at: string | null
          explanation: string | null
          node_id: string | null
          row_id: string | null
          subject: string | null
          title: string | null
          topic: string | null
          wow_factor: string | null
        }
        Insert: {
          application_id: string
          class?: string | null
          concept_connected?: string | null
          context?: string | null
          created_at?: string | null
          explanation?: string | null
          node_id?: string | null
          row_id?: string | null
          subject?: string | null
          title?: string | null
          topic?: string | null
          wow_factor?: string | null
        }
        Update: {
          application_id?: string
          class?: string | null
          concept_connected?: string | null
          context?: string | null
          created_at?: string | null
          explanation?: string | null
          node_id?: string | null
          row_id?: string | null
          subject?: string | null
          title?: string | null
          topic?: string | null
          wow_factor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realworld_applications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      student_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: string | null
          node_id: string | null
          session_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          node_id?: string | null
          session_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          node_id?: string | null
          session_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_interactions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "student_interactions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topic_nodes"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      student_progress: {
        Row: {
          attempts: number | null
          id: string
          last_score: number | null
          outcome_id: string | null
          status: string | null
          topic_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          id?: string
          last_score?: number | null
          outcome_id?: string | null
          status?: string | null
          topic_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          id?: string
          last_score?: number | null
          outcome_id?: string | null
          status?: string | null
          topic_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcome_nodes"
            referencedColumns: ["outcome_id"]
          },
          {
            foreignKeyName: "student_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topic_nodes"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      topic_edges: {
        Row: {
          created_at: string | null
          edge_id: string
          edge_type: string
          from_id: string
          from_type: string
          row_id: string | null
          subject: string | null
          to_id: string
          to_type: string
        }
        Insert: {
          created_at?: string | null
          edge_id: string
          edge_type: string
          from_id: string
          from_type: string
          row_id?: string | null
          subject?: string | null
          to_id: string
          to_type: string
        }
        Update: {
          created_at?: string | null
          edge_id?: string
          edge_type?: string
          from_id?: string
          from_type?: string
          row_id?: string | null
          subject?: string | null
          to_id?: string
          to_type?: string
        }
        Relationships: []
      }
      topic_nodes: {
        Row: {
          activity_count: number | null
          application_count: number | null
          assessment_strategy_raw: string | null
          blooms_levels_covered: Json | null
          blooms_tag_count: number | null
          class: string | null
          concept_count: number | null
          created_at: string | null
          difficulty_distribution: Json | null
          embedding: string | null
          learning_outcomes_raw: string | null
          node_type: string
          outcome_count: number | null
          periods: string | null
          row_id: string | null
          sequence_position: number | null
          subject: string | null
          suggested_activities_raw: string | null
          term: string | null
          theme: string | null
          topic: string | null
          topic_id: string
        }
        Insert: {
          activity_count?: number | null
          application_count?: number | null
          assessment_strategy_raw?: string | null
          blooms_levels_covered?: Json | null
          blooms_tag_count?: number | null
          class?: string | null
          concept_count?: number | null
          created_at?: string | null
          difficulty_distribution?: Json | null
          embedding?: string | null
          learning_outcomes_raw?: string | null
          node_type?: string
          outcome_count?: number | null
          periods?: string | null
          row_id?: string | null
          sequence_position?: number | null
          subject?: string | null
          suggested_activities_raw?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
          topic_id: string
        }
        Update: {
          activity_count?: number | null
          application_count?: number | null
          assessment_strategy_raw?: string | null
          blooms_levels_covered?: Json | null
          blooms_tag_count?: number | null
          class?: string | null
          concept_count?: number | null
          created_at?: string | null
          difficulty_distribution?: Json | null
          embedding?: string | null
          learning_outcomes_raw?: string | null
          node_type?: string
          outcome_count?: number | null
          periods?: string | null
          row_id?: string | null
          sequence_position?: number | null
          subject?: string | null
          suggested_activities_raw?: string | null
          term?: string | null
          theme?: string | null
          topic?: string | null
          topic_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_interdisciplinary_links: {
        Args: { p_node_id: string }
        Returns: {
          confidence: string
          connected_class: string
          connected_name: string
          connected_node_id: string
          connected_subject: string
          connected_topic: string
          connection_type: string
          direction: string
          edge_id: string
          student_explanation: string
        }[]
      }
      get_prerequisites: {
        Args: { max_depth?: number; p_node_id: string }
        Returns: {
          class: string
          definition: string
          depth: number
          name: string
          node_id: string
          reason: string
          strength: string
          subject: string
          topic: string
        }[]
      }
      get_quiz_outcomes: {
        Args: {
          blooms_filter?: string
          difficulty_filter?: string
          p_topic_id: string
          result_limit?: number
        }
        Returns: {
          blooms_level: string
          blooms_verb: string
          curriculum_tag: string
          difficulty: string
          distractor_hints: Json
          outcome_id: string
          outcome_text: string
          quiz_question_stem: string
        }[]
      }
      get_student_progress: {
        Args: {
          class_filter?: string
          p_user_id: string
          subject_filter?: string
        }
        Returns: {
          class: string
          demonstrated: number
          in_progress: number
          mastered: number
          mastery_pct: number
          not_started: number
          subject: string
          term: string
          topic: string
          topic_id: string
          total_outcomes: number
        }[]
      }
      get_topic_context: { Args: { p_topic_id: string }; Returns: Json }
      get_topic_neighbours: {
        Args: { p_topic_id: string }
        Returns: {
          class: string
          direction: string
          sequence_position: number
          subject: string
          term: string
          topic: string
          topic_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_concept_nodes: {
        Args: {
          class_filter?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
          subject_filter?: string
        }
        Returns: {
          class: string
          concept_type: string
          definition: string
          name: string
          node_id: string
          row_id: string
          similarity: number
          skills: Json
          subject: string
          term: string
          theme: string
          topic: string
          vocabulary: Json
        }[]
      }
      match_outcome_nodes: {
        Args: {
          class_filter?: string
          difficulty_filter?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
          subject_filter?: string
        }
        Returns: {
          blooms_level: string
          class: string
          curriculum_tag: string
          difficulty: string
          distractor_hints: Json
          outcome_id: string
          outcome_text: string
          row_id: string
          similarity: number
          subject: string
          tag_id: string
          term: string
          topic: string
        }[]
      }
      match_topic_nodes: {
        Args: {
          class_filter?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
          subject_filter?: string
        }
        Returns: {
          activity_count: number
          application_count: number
          blooms_levels_covered: Json
          blooms_tag_count: number
          class: string
          concept_count: number
          difficulty_distribution: Json
          outcome_count: number
          periods: string
          sequence_position: number
          similarity: number
          subject: string
          term: string
          theme: string
          topic: string
          topic_id: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "school"
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
      app_role: ["student", "school"],
    },
  },
} as const
