# backend/models.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class WebSocketMessage(BaseModel):
    type: str  # e.g., "JOIN_ROOM", "GUESS", "DRAWING_DATA", "GAME_STATE_UPDATE"
    payload: Dict[str, Any]


class Player(BaseModel):
    id: str
    name: str
    score: int = 0
    has_guessed: bool = False


class DrawingData(BaseModel):
    x: float
    y: float
    color: str
    brush_size: int
    action: str  # 'start', 'draw', 'end' or 'clear'


class ChatMessage(BaseModel):
    sender: str
    message: str
    is_correct_guess: bool = False


class Room(BaseModel):
    id: str
    players: Dict[str, Player] = Field(default_factory=dict)
    host_id: str
    is_game_started: bool = False
    current_drawer_id: Optional[str] = None
    secret_word: Optional[str] = None
    guessed_word_hint: Optional[str] = None
    timer_expires_at: Optional[float] = None  # Unix timestamp
    active_connections: Dict[str, bool] = Field(default_factory=dict)
    round_number: int = 0
    total_rounds: int = 5
    drawing_strokes: List[List[DrawingData]] = Field(default_factory=list)
    used_words: List[str] = Field(default_factory=list)
    word_category: Optional[str] = None


class CreateRoomRequest(BaseModel):
    player_name: str
    total_rounds: int = 5
    word_category: str = "animals"


class JoinRoomRequest(BaseModel):
    room_id: str
    player_name: str


class JoinRoomResponse(BaseModel):
    player_id: str
    room_state: Room
