# backend/game_manager.py

import json
import uuid
import random
import string
import asyncio
import time  # For timer logic

from typing import Dict, Any, Optional
from fastapi import WebSocket

# Ensure all Pydantic models are imported
from models import Room, Player, DrawingData, ChatMessage


class GameManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        # This is where the actual WebSocket connections are stored, keyed by player_id
        self.connections: Dict[str, WebSocket] = {}

        # Word lists for the game
        self.word_lists = {
            "animals": [
                "lion",
                "tiger",
                "bear",
                "elephant",
                "giraffe",
                "zebra",
                "monkey",
                "dog",
                "cat",
                "fish",
                "whale",
                "snake",
                "rabbit",
                "bird",
                "spider",
            ],
            "food": [
                "pizza",
                "burger",
                "sushi",
                "pasta",
                "apple",
                "banana",
                "bread",
                "cheese",
                "cake",
                "icecream",
                "carrot",
                "broccoli",
                "chicken",
                "rice",
                "soup",
            ],
            "objects": [
                "chair",
                "table",
                "book",
                "phone",
                "computer",
                "bottle",
                "shoe",
                "hat",
                "car",
                "bicycle",
                "door",
                "window",
                "lamp",
                "mirror",
                "key",
            ],
            # Add more categories as needed
        }

    def _generate_room_id(self) -> str:
        # Simple 6-character alphanumeric ID
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    def _get_room_id_from_websocket(self, websocket: WebSocket) -> Optional[str]:
        """Helper to extract room_id from a WebSocket's scope."""
        try:
            return websocket.scope["path_params"]["room_id"]
        except KeyError:
            return None

    def _get_player_id_from_websocket(self, websocket: WebSocket) -> Optional[str]:
        """Helper to extract player_id from a WebSocket's scope."""
        try:
            return websocket.scope["path_params"]["player_id"]
        except KeyError:
            return None

    async def _send_message_to_websocket(
        self, websocket: WebSocket, message: Dict[str, Any]
    ):
        """Safely sends a JSON message to a single WebSocket."""
        try:
            await websocket.send_json(message)

        except Exception as e:
            player_id = self._get_player_id_from_websocket(websocket)
            print(f"ERROR: Failed to send message to player {player_id} via WS: {e}")
            # If sending fails, assume client is disconnected and remove
            if player_id:  # Check if player_id was successfully extracted
                await self.remove_player_connection(
                    self._get_room_id_from_websocket(websocket), player_id
                )

    async def add_player_connection(self, player_id: str, websocket: WebSocket):
        self.connections[player_id] = websocket
        print(f"Player {player_id} connected and added to GameManager.connections.")

    async def remove_player_connection(self, room_id: str, player_id: str):
        if player_id in self.connections:
            del self.connections[player_id]
            print(f"Player {player_id} removed from GameManager.connections.")

        # Logic for handling host leaving or last player leaving
        if room_id in self.rooms:
            room = self.rooms[room_id]
            # If the leaving player was the host, handle host transfer or game end
            if room.host_id == player_id:
                print(f"Host {player_id} left room {room_id}.")
                # TODO: Implement host transfer or game termination logic here

            # Remove player from room's player list if needed (e.g. if they fully leave game)
            # For now, just keep them in room.players but reflect disconnect via active_connections

            # If no players left, delete the room
            if not any(
                pid in self.connections
                and self._get_room_id_from_websocket(self.connections[pid]) == room_id
                for pid in room.players
            ):
                print(f"No active players left in room {room_id}. Deleting room.")
                del self.rooms[room_id]
                return  # Room is gone, no need to send state update

        # Broadcast update to remaining players
        await self.send_game_state_update(room_id)

    async def create_room(
        self, host_id: str, host_name: str, total_rounds: int, word_category: str
    ) -> Room:
        room_id = self._generate_room_id()
        new_room = Room(
            id=room_id,
            players={
                host_id: Player(id=host_id, name=host_name, score=0, has_guessed=False)
            },
            host_id=host_id,
            total_rounds=total_rounds,
            word_category=word_category,
            is_game_started=False,
            round_number=0,
            active_connections={},  # Populated dynamically when sending state
            drawing_strokes=[],  # Empty on creation
            used_words=[],  # Empty on creation
        )
        self.rooms[room_id] = new_room
        print(f"Room {room_id} created by {host_name} (ID: {host_id}).")
        return new_room

    async def send_game_state_update(self, room_id: str):
        if room_id not in self.rooms:
            print(f"Room {room_id} not found for state update. Cannot send.")
            return

        room = self.rooms[room_id]

        # Prepare the game state for sending:
        # 1. Convert Pydantic model to a serializable dictionary.
        # 2. Dynamically populate `active_connections` based on actual WebSocket connections.
        game_state_dict = room.model_dump()  # Use model_dump() for serializable dict

        # Populate active_connections with current player connection status
        connected_players_in_room = {}
        for player_id_str in room.players:
            print(
                f"DEBUG: Checking player ID: {player_id_str}, Type: {type(player_id_str)}"
            )

            connected_players_in_room[player_id_str] = (
                player_id_str in self.connections
                and self._get_room_id_from_websocket(self.connections[player_id_str])
                == room_id
            )
        game_state_dict["active_connections"] = connected_players_in_room

        message = {"type": "GAME_STATE_UPDATE", "payload": game_state_dict}

        try:
            json.dumps(message)  # This will raise an error if not serializable
        except TypeError as e:
            print(
                f"ERROR: GAME_STATE_UPDATE for room {room_id} is NOT JSON serializable: {e}"
            )
            # Log the full problematic payload
            print(f"Payload causing error: {game_state_dict}")
            return  # Prevent sending non-serializable data

        # Send to all connected players in this room
        tasks = []
        for (
            player_id_in_room
        ) in room.players:  # Iterate through players defined in the room
            if (
                player_id_in_room in self.connections
                and self._get_room_id_from_websocket(
                    self.connections[player_id_in_room]
                )
                == room_id
            ):
                tasks.append(
                    self._send_message_to_websocket(
                        self.connections[player_id_in_room], message
                    )
                )

        if tasks:
            await asyncio.gather(*tasks)

    async def send_game_state_to_player(self, room_id: str, player_id: str):
        """Sends the current game state to a single player."""
        if room_id not in self.rooms or player_id not in self.connections:
            print(
                f"Cannot send state: Room {room_id} or player {player_id} not found/connected."
            )
            return

        room = self.rooms[room_id]
        game_state_dict = room.model_dump()

        # Populate active_connections for this specific player's state update
        connected_players_in_room = {}
        for player_id_str in room.players:
            print(
                f"DEBUG: Checking player ID: {player_id_str}, Type: {type(player_id_str)}"
            )
            connected_players_in_room[player_id_str] = (
                player_id_str in self.connections
                and self._get_room_id_from_websocket(self.connections[player_id_str])
                == room_id
            )
        game_state_dict["active_connections"] = connected_players_in_room

        message = {"type": "GAME_STATE_UPDATE", "payload": game_state_dict}

        try:
            json.dumps(message)  # This will raise an error if not serializable
        except TypeError as e:
            print(
                f"ERROR: GAME_STATE_UPDATE for player {player_id} is NOT JSON serializable: {e}"
            )
            # Log the full problematic payload
            print(f"Payload causing error: {game_state_dict}")
            return  # Prevent sending non-serializable data

        await self._send_message_to_websocket(self.connections[player_id], message)

    async def handle_drawing_data(
        self, room_id: str, player_id: str, drawing_data: Dict[str, Any]
    ):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        # Ensure only the current drawer can send drawing data
        if room.current_drawer_id != player_id:
            await self._send_message_to_websocket(
                self.connections[player_id],
                {
                    "type": "ERROR",
                    "payload": {"message": "You are not the current drawer."},
                },
            )
            return

        # Convert dict to DrawingData Pydantic model for validation
        try:
            parsed_data = DrawingData(**drawing_data)
        except Exception as e:
            print(f"Invalid drawing data received: {e}")
            return

        # Store drawing stroke in room state
        if parsed_data.action == "start":
            room.drawing_strokes.append([])  # Start a new stroke
        if room.drawing_strokes:  # Ensure there's a stroke to add to
            room.drawing_strokes[-1].append(parsed_data)

        # Broadcast drawing update to all players in the room (excluding the drawer as they already have it)
        message = {
            "type": "DRAWING_UPDATE",
            "payload": parsed_data.model_dump(),  # Send serializable dict
        }
        tasks = []
        for pid in room.players:
            if (
                pid != player_id
                and pid in self.connections
                and self._get_room_id_from_websocket(self.connections[pid]) == room_id
            ):
                tasks.append(
                    self._send_message_to_websocket(self.connections[pid], message)
                )
        if tasks:
            await asyncio.gather(*tasks)

    async def handle_guess(self, room_id: str, player_id: str, guess_text: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        # Ensure guess_text is a string and not None or just whitespace
        if not isinstance(guess_text, str) or not guess_text.strip():
            # If the client sends an empty or invalid guess, treat it as an empty message
            print(
                f"WARNING: Invalid guess_text received from {player_id}: {guess_text}. Converting to empty string."
            )
            guess_text = ""  # Default to empty string if it's None or not a string

        sender_name = room.players.get(
            player_id, Player(id=player_id, name="Unknown", score=0, has_guessed=False)
        ).name

        # Condition to check if the guess is correct
        if (
            room.secret_word
            and guess_text.lower().strip() == room.secret_word.lower().strip()
        ):
            # Drawer cannot guess their own word
            if player_id != room.current_drawer_id:
                room.players[player_id].has_guessed = True  # Mark as guessed
                print(
                    f"Player {sender_name} (ID: {player_id}) guessed the word: {room.secret_word}"
                )
                # Award points, advance game
                await self._award_points(room_id, player_id, room.current_drawer_id)
                await self.send_chat_message(
                    room_id,
                    "System",
                    f"🎉 {sender_name} guessed the word: {room.secret_word}!",
                    True,
                )
                await self._end_round_due_to_guess(room_id)

                # await self._end_round(room_id, "guess")
            else:
                # Drawer trying to guess their own word, treat as normal chat
                await self.send_chat_message(room_id, sender_name, guess_text, False)
        else:
            # General chat message or incorrect guess
            await self.send_chat_message(room_id, sender_name, guess_text, False)

    async def send_chat_message(
        self, room_id: str, sender: str, message: str, is_correct_guess: bool = False
    ):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]
        chat_msg = ChatMessage(
            sender=sender, message=message, isCorrectGuess=is_correct_guess
        )
        message_to_send = {
            "type": "CHAT_MESSAGE",
            "payload": chat_msg.model_dump(),  # Convert to dict for sending
        }
        tasks = []
        for pid in room.players:
            if (
                pid in self.connections
                and self._get_room_id_from_websocket(self.connections[pid]) == room_id
            ):
                tasks.append(
                    self._send_message_to_websocket(
                        self.connections[pid], message_to_send
                    )
                )
        if tasks:
            await asyncio.gather(*tasks)

    async def _award_points(self, room_id: str, guesser_id: str, drawer_id: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        # Points for guesser
        guesser_points = 100
        if guesser_id in room.players:
            room.players[guesser_id].score += guesser_points
            print(f"Awarded {guesser_points} points to {room.players[guesser_id].name}")

        # Points for drawer (e.g., half of guesser's points per successful guess)
        drawer_points = 50
        if drawer_id in room.players:
            room.players[drawer_id].score += drawer_points
            print(
                f"Awarded {drawer_points} points to {room.players[drawer_id].name} (drawer)"
            )

    async def start_game(self, room_id: str, player_id: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        if room.host_id != player_id:
            await self._send_message_to_websocket(
                self.connections[player_id],
                {
                    "type": "ERROR",
                    "payload": {"message": "Only the host can start the game."},
                },
            )
            return

        if len(room.players) < 2:
            await self._send_message_to_websocket(
                self.connections[player_id],
                {
                    "type": "ERROR",
                    "payload": {"message": "Need at least 2 players to start."},
                },
            )
            return

        room.is_game_started = True
        room.round_number = 0
        room.drawing_strokes = []  # Clear canvas at start
        room.used_words = []  # Reset used words for new game
        # Ensure initial scores are 0 for all players
        for p_id in room.players:
            room.players[p_id].score = 0
            room.players[p_id].has_guessed = False  # Reset has_guessed

        print(f"Game started in room {room_id}.")
        await self.send_chat_message(room_id, "System", "The game has started!", False)
        await self.send_game_state_update(room_id)

        # Start the first round
        await self.start_new_round(room_id)

    async def start_new_round(
        self, room_id: str, triggered_by_player_id: Optional[str] = None
    ):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        # Check if the player triggering the round start is the host
        if triggered_by_player_id:
            if (
                triggered_by_player_id != "System"
                and room.host_id != triggered_by_player_id
            ):
                # Send error message to the player if they are connected
                if triggered_by_player_id in self.connections:
                    await self._send_message_to_websocket(
                        self.connections[triggered_by_player_id],
                        {
                            "type": "ERROR",
                            "payload": {
                                "message": "Only the host can start new rounds."
                            },
                        },
                    )
                return

        if not room.is_game_started:
            print(f"Game not started in room {room_id}. Cannot start new round.")
            return

        room.round_number += 1
        if room.round_number > room.total_rounds:
            await self._end_game(room_id)
            return

        print(f"Starting round {room.round_number} in room {room_id}.")
        await self.send_chat_message(
            room_id, "System", f"Starting Round {room.round_number}!", False
        )

        # Determine next drawer (round-robin)
        player_ids = list(room.players.keys())
        if not player_ids:
            print(f"No players in room {room_id} to start round.")
            await self._end_game(room_id)  # End game if no players
            return

        # Find index of current drawer or if this is the first round
        if room.current_drawer_id and room.current_drawer_id in player_ids:
            current_drawer_idx = player_ids.index(room.current_drawer_id)
            next_drawer_idx = (current_drawer_idx + 1) % len(player_ids)
        else:
            next_drawer_idx = 0  # First drawer is the first player in the list

        room.current_drawer_id = player_ids[next_drawer_idx]

        room.secret_word = None
        room.guessed_word_hint = ""  # Initial empty hint
        room.drawing_strokes = []  # Clear canvas for new round
        room.timer_expires_at = None  # Reset timer for word selection phase
        for p_id in room.players:
            room.players[p_id].has_guessed = False

        # Prepare word choices for the drawer
        category_words = self.word_lists.get(
            room.word_category, self.word_lists["animals"]
        )
        # Filter out words already used in this game session (for current game)
        available_words = [
            word for word in category_words if word not in room.used_words
        ]

        # If too few words, reset used_words for the room
        if len(available_words) < 3:
            print(f"Replenishing word pool for room {room_id}.")
            available_words = list(
                self.word_lists.get(room.word_category, self.word_lists["animals"])
            )
            room.used_words = []  # Reset used words to allow reuse within the game

        # Shuffle and pick 3 words
        random.shuffle(available_words)
        words_for_drawer = available_words[:3]

        drawer_name = "Unknown Drawer"  # Default
        if room.current_drawer_id in room.players:
            drawer_name = room.players[room.current_drawer_id].name

        # Send word choices to the current drawer only
        if room.current_drawer_id in self.connections:
            drawer_ws = self.connections[room.current_drawer_id]
            await self._send_message_to_websocket(
                drawer_ws,
                {
                    "type": "WORD_TO_DRAW",
                    "payload": {
                        "words": words_for_drawer,
                        "current_drawer_id": room.current_drawer_id,
                    },
                },
            )
            print(f"DEBUG: Sent WORD_TO_DRAW message to drawer {drawer_name}.")
        else:
            print(
                f"DEBUG: Drawer {room.current_drawer_id} not connected. Skipping their turn."
            )
            await self.send_chat_message(
                room_id,
                "System",
                f"Drawer {drawer_name} is not connected, skipping turn.",
                False,
            )
            asyncio.create_task(self._end_round(room_id, "drawer_disconnected"))
            return
            # await self._end_round(room_id, "drawer_disconnected")  # Corrected call here

        # Update all clients with new drawer, round number, clear canvas
        await self.send_game_state_update(room_id)

    async def choose_word(self, room_id: str, player_id: str, chosen_word: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        if room.current_drawer_id != player_id:
            await self._send_message_to_websocket(
                self.connections[player_id],
                {
                    "type": "ERROR",
                    "payload": {"message": "You are not the current drawer."},
                },
            )
            return

        if room.secret_word is not None:
            await self._send_message_to_websocket(
                self.connections[player_id],
                {
                    "type": "ERROR",
                    "payload": {"message": "Word already chosen for this round."},
                },
            )
            return

        room.secret_word = chosen_word
        room.used_words.append(chosen_word)  # Add to used words for this game session
        room.guessed_word_hint = "".join(["_" for _ in chosen_word])  # Create hint
        room.timer_expires_at = time.time() + 60  # 60 seconds for drawing

        await self.send_chat_message(
            room_id,
            "System",
            f"{room.players[player_id].name} has chosen a word!",
            False,
        )
        await self.send_game_state_update(room_id)  # Update state with hint and timer

    async def _end_round_due_to_guess(self, room_id: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        print(
            f"Ending round {room.round_number} for room {room_id} due to: correct guess."
        )

        # Reset round-specific state
        room.secret_word = None
        room.guessed_word_hint = ""
        room.timer_expires_at = None
        room.drawing_strokes = []  # Clear drawing for new round

        # Reset has_guessed for all players for the new round
        for p_id in room.players:
            room.players[p_id].has_guessed = False

        await self.send_game_state_update(room_id)  # Update UI immediately after guess

        # Begin next round after a short delay
        asyncio.create_task(
            self._delay_and_start_new_round(room_id, 3)
        )  # 3 seconds delay

    async def _end_round(self, room_id: str, reason: str = "time_up"):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        print(f"Ending round {room.round_number} for room {room_id} due to: {reason}")
        room.timer_expires_at = None  # Stop timer

        if room.secret_word and reason == "time_up":
            await self.send_chat_message(
                room_id,
                "System",
                f"Time's up! The word was '{room.secret_word}'.",
                False,
            )
        elif not room.secret_word and reason == "time_up":
            await self.send_chat_message(
                room_id, "System", "Time's up! No word was chosen this round.", False
            )
        elif reason == "drawer_disconnected":  # Drawer disconnected
            await self.send_chat_message(
                room_id, "System", "Drawer disconnected. Round ended.", False
            )

        room.secret_word = None  # Clear secret word after reveal/end
        room.guessed_word_hint = ""
        room.drawing_strokes = []  # Clear drawing for new round
        for p_id in room.players:
            room.players[p_id].has_guessed = False

        await self.send_game_state_update(room_id)

        if room.round_number >= room.total_rounds:
            await self._end_game(room_id)
        else:
            # Begin next round after a short delay
            asyncio.create_task(
                self._delay_and_start_new_round(room_id, 3)
            )  # 3 seconds delay

    async def _delay_and_start_new_round(self, room_id: str, delay: int = 5):
        await asyncio.sleep(delay)
        await self.start_new_round(room_id, "System")

    async def _end_game(self, room_id: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]

        room.is_game_started = False
        room.current_drawer_id = None
        room.secret_word = None
        room.guessed_word_hint = None
        room.timer_expires_at = None
        room.drawing_strokes = []
        room.round_number = 0  # Reset for next game
        for p_id in room.players:
            room.players[p_id].has_guessed = False

        # Determine winner
        winner = None
        highest_score = -1
        # Handle empty players list gracefully
        if room.players:
            for player_id, player in room.players.items():
                if player.score > highest_score:
                    highest_score = player.score
                    winner = player
                elif (
                    player.score == highest_score and winner
                ):  # Handle ties - if scores are equal, no single winner
                    winner = None

        winner_name = winner.name if winner else "No one (tie)"

        message_payload = {
            "winner_id": winner.id if winner else None,
            "winner_name": winner_name,
            "final_scores": {pid: p.score for pid, p in room.players.items()},
        }
        await self.send_chat_message(
            room_id,
            "System",
            f"GAME OVER! {winner_name} wins with {highest_score} points!",
            True,
        )

        # Send a final GAME_OVER message type to all players
        for player_id in room.players:
            if (
                player_id in self.connections
                and self._get_room_id_from_websocket(self.connections[player_id])
                == room_id
            ):
                await self._send_message_to_websocket(
                    self.connections[player_id],
                    {"type": "GAME_OVER", "payload": message_payload},
                )

        await self.send_game_state_update(
            room_id
        )  # Final state update to reflect game over


# Initialize global game manager
game_manager = GameManager()
