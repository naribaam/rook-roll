export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          last_move_at: string | null
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
          last_move_at?: string | null
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
          last_move_at?: string | null
        }
        Relationships: []
      }
      moves: {
        Row: {
          id: string
          game_id: string
          move_number: number
          san: string
          from_sq: string
          to_sq: string
          promotion: string | null
          fen: string
          played_by: string
          played_at: string
        }
        Insert: {
          id?: string
          game_id: string
          move_number: number
          san: string
          from_sq: string
          to_sq: string
          promotion?: string | null
          fen: string
          played_by: string
          played_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          move_number?: number
          san?: string
          from_sq?: string
          to_sq?: string
          promotion?: string | null
          fen?: string
          played_by?: string
          played_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          }
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
        Relationships: []
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
        Relationships: []
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
      CompositeTypes: {
        [_ in never]: never
      }
    }
  }
}
