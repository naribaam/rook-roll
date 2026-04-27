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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      games: {
        Row: {
          ai_color: string | null
          ai_difficulty: number | null
          black_elo_after: number | null
          black_elo_before: number | null
          black_player: string | null
          black_time_ms: number | null
          created_at: string
          created_by: string | null
          draw_offer_at: string | null
          draw_offered_by: string | null
          fen: string
          finished_at: string | null
          id: string
          increment_seconds: number | null
          last_move_at: string | null
          mode: Database["public"]["Enums"]["game_mode"]
          moves: Json
          pgn: string
          result: Database["public"]["Enums"]["game_result"] | null
          result_reason: string | null
          room_code: string | null
          status: Database["public"]["Enums"]["game_status"]
          time_control: string | null
          time_limit_seconds: number | null
          updated_at: string
          white_elo_after: number | null
          white_elo_before: number | null
          white_player: string | null
          white_time_ms: number | null
        }
        Insert: {
          ai_color?: string | null
          ai_difficulty?: number | null
          black_elo_after?: number | null
          black_elo_before?: number | null
          black_player?: string | null
          black_time_ms?: number | null
          created_at?: string
          created_by?: string | null
          draw_offer_at?: string | null
          draw_offered_by?: string | null
          fen?: string
          finished_at?: string | null
          id?: string
          increment_seconds?: number | null
          last_move_at?: string | null
          mode: Database["public"]["Enums"]["game_mode"]
          moves?: Json
          pgn?: string
          result?: Database["public"]["Enums"]["game_result"] | null
          result_reason?: string | null
          room_code?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: string | null
          time_limit_seconds?: number | null
          updated_at?: string
          white_elo_after?: number | null
          white_elo_before?: number | null
          white_player?: string | null
          white_time_ms?: number | null
        }
        Update: {
          ai_color?: string | null
          ai_difficulty?: number | null
          black_elo_after?: number | null
          black_elo_before?: number | null
          black_player?: string | null
          black_time_ms?: number | null
          created_at?: string
          created_by?: string | null
          draw_offer_at?: string | null
          draw_offered_by?: string | null
          fen?: string
          finished_at?: string | null
          id?: string
          increment_seconds?: number | null
          last_move_at?: string | null
          mode?: Database["public"]["Enums"]["game_mode"]
          moves?: Json
          pgn?: string
          result?: Database["public"]["Enums"]["game_result"] | null
          result_reason?: string | null
          room_code?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: string | null
          time_limit_seconds?: number | null
          updated_at?: string
          white_elo_after?: number | null
          white_elo_before?: number | null
          white_player?: string | null
          white_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_player_fkey"
            columns: ["black_player"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_black_player_fkey"
            columns: ["black_player"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_player_fkey"
            columns: ["white_player"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_player_fkey"
            columns: ["white_player"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          fen: string
          from_sq: string
          game_id: string
          id: string
          move_number: number
          played_at: string
          played_by: string
          promotion: string | null
          san: string
          to_sq: string
        }
        Insert: {
          fen: string
          from_sq: string
          game_id: string
          id?: string
          move_number: number
          played_at?: string
          played_by: string
          promotion?: string | null
          san: string
          to_sq: string
        }
        Update: {
          fen?: string
          from_sq?: string
          game_id?: string
          id?: string
          move_number?: number
          played_at?: string
          played_by?: string
          promotion?: string | null
          san?: string
          to_sq?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_board_skin: string
          active_piece_skin: string
          avatar_url: string | null
          coins: number
          created_at: string
          elo: number
          email: string | null
          games_drawn: number
          games_lost: number
          games_played: number
          games_won: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active_board_skin?: string
          active_piece_skin?: string
          avatar_url?: string | null
          coins?: number
          created_at?: string
          elo?: number
          email?: string | null
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          active_board_skin?: string
          active_piece_skin?: string
          avatar_url?: string | null
          coins?: number
          created_at?: string
          elo?: number
          email?: string | null
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          game_id: string | null
          id: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          coins: number | null
          elo: number | null
          games_drawn: number | null
          games_lost: number | null
          games_played: number | null
          games_won: number | null
          id: string | null
          name: string | null
          win_rate: number | null
        }
        Insert: {
          avatar_url?: string | null
          coins?: number | null
          elo?: number | null
          games_drawn?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string | null
          name?: string | null
          win_rate?: never
        }
        Update: {
          avatar_url?: string | null
          coins?: number | null
          elo?: number | null
          games_drawn?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string | null
          name?: string | null
          win_rate?: never
        }
        Relationships: []
      }
    }
    Functions: {
      award_coins: {
        Args: {
          _amount: number
          _description: string
          _game_id?: string
          _type: Database["public"]["Enums"]["tx_type"]
          _user_id: string
        }
        Returns: number
      }
      equip_skin: {
        Args: {
          _item_id: string
          _item_type: Database["public"]["Enums"]["item_type"]
        }
        Returns: undefined
      }
      purchase_item: {
        Args: {
          _item_id: string
          _item_type: Database["public"]["Enums"]["item_type"]
          _price: number
        }
        Returns: Json
      }
    }
    Enums: {
      game_mode: "ai" | "multiplayer"
      game_result: "white_win" | "black_win" | "draw" | "aborted"
      game_status: "waiting" | "active" | "finished"
      item_type: "piece_skin" | "board_skin"
      tx_type:
        | "starting_bonus"
        | "win"
        | "loss"
        | "draw"
        | "move_bonus"
        | "purchase"
        | "timeout"
        | "abandoned"
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
      game_mode: ["ai", "multiplayer"],
      game_result: ["white_win", "black_win", "draw", "aborted"],
      game_status: ["waiting", "active", "finished"],
      item_type: ["piece_skin", "board_skin"],
      tx_type: [
        "starting_bonus",
        "win",
        "loss",
        "draw",
        "move_bonus",
        "purchase",
        "timeout",
        "abandoned",
      ],
    },
  },
} as const
