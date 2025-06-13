// frontend/src/types/game.ts

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface DrawingData {
  x: number;
  y: number;
  color: string;
  brush_size: number;
  action: "start" | "draw" | "end" | "clear";
}

export interface ChatMessage {
  sender: string;
  message: string;
  isCorrectGuess: boolean;
}

export interface GameState {
  id: string;
  players: { [playerId: string]: Player };
  host_id: string;
  is_game_started: boolean;
  current_drawer_id: string | null;
  secret_word: string | null;
  guessed_word_hint: string | null;
  timer_expires_at: number | null;
  active_connections: { [playerId: string]: boolean };
  round_number: number;
  total_rounds: number;
  drawing_strokes: DrawingData[][];
  used_words: string[];
  word_category: string | null;
}
