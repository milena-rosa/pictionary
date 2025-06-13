import json
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    status,
)
from fastapi.responses import HTMLResponse
from starlette.websockets import WebSocketState
from fastapi.staticfiles import StaticFiles

from game_manager import game_manager
from models import (
    CreateRoomRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    WebSocketMessage,
    Room,
    Player,
    DrawingData,
)
import uuid  # For generating unique player IDs
import os  # Import os module to handle paths correctly

app = FastAPI()

# Get the directory of the current script (main.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Construct the path to the frontend's build directory
FRONTEND_BUILD_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")


# Mount static files for the frontend (React build)
# This serves all files inside `frontend/dist/assets` at the `/assets` URL path
app.mount(
    "/assets",
    StaticFiles(directory=os.path.join(FRONTEND_BUILD_DIR, "assets")),
    name="assets",
)


@app.get("/")
async def get_root():
    """Serves the frontend application's index.html."""
    index_html_path = os.path.join(FRONTEND_BUILD_DIR, "index.html")
    if not os.path.exists(index_html_path):
        # This means the frontend hasn't been built or path is wrong
        return HTMLResponse(
            "<h1>Frontend build not found!</h1><p>Please run `npm run build` in the /frontend directory.</p>",
            status_code=500,
        )
    with open(index_html_path, "r") as f:
        return HTMLResponse(content=f.read())


@app.post("/api/create_room", response_model=Room)
async def create_room(request: CreateRoomRequest):
    player_id = str(uuid.uuid4())
    room = await game_manager.create_room(
        host_id=player_id,
        host_name=request.player_name,
        total_rounds=request.total_rounds,
        word_category=request.word_category,
    )
    return room


@app.post("/api/join_room", response_model=JoinRoomResponse)
async def join_room_api(request: JoinRoomRequest):
    if request.room_id not in game_manager.rooms:
        raise HTTPException(status_code=404, detail="Room not found.")

    player_id = str(uuid.uuid4())  # Generate a new ID for the joining player
    room = game_manager.rooms[request.room_id]

    # Add player to the room's players dictionary
    new_player = Player(
        id=player_id, name=request.player_name, score=0, has_guessed=False
    )
    room.players[player_id] = new_player

    # Optionally: Broadcast updated game state to all players in the room
    # This ensures existing players see the new player join.
    await game_manager.send_game_state_update(request.room_id)

    # Return the new player's ID and the updated room state
    return JoinRoomResponse(player_id=player_id, room_state=room)


@app.websocket("/ws/{room_id}/{player_id}/{player_name}")
async def websocket_endpoint(
    websocket: WebSocket, room_id: str, player_id: str, player_name: str
):
    try:
        # IMPORTANT: These checks MUST happen *before* websocket.accept()
        # If they fail, we must explicitly close the WebSocket connection.
        if room_id not in game_manager.rooms:
            print(
                f"WS Connect Error: Room '{room_id}' not found for player '{player_id}'."
            )
            await websocket.close(
                code=status.WS_1003_UNSUPPORTED_DATA, reason="Room not found."
            )
            return  # Exit the function immediately

        # Check if the player ID exists within that room (it should, after create_room or join_room_api)
        if player_id not in game_manager.rooms[room_id].players:
            print(
                f"WS Connect Error: Player '{player_id}' not found in room '{room_id}'."
            )
            await websocket.close(
                code=status.WS_1003_UNSUPPORTED_DATA, reason="Player not found in room."
            )
            return  # Exit the function immediately

        # If all checks pass, accept the WebSocket connection
        await websocket.accept()
        print(f"Client {player_id} connected to room {room_id}")

        # Add the connection to the game manager's active_connections
        await game_manager.add_player_connection(player_id, websocket)

        # Send initial game state to the newly connected player
        await game_manager.send_game_state_to_player(room_id, player_id)

        # Main loop for receiving messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)  # Parse the incoming JSON message

            msg_type = message.get("type")
            payload = message.get("payload")

            # --- Your existing message handling logic ---
            if msg_type == "GUESS":
                await game_manager.handle_guess(
                    room_id, player_id, payload.get("message")
                )
            elif msg_type == "DRAWING_DATA":
                await game_manager.handle_drawing_data(room_id, player_id, payload)
            elif msg_type == "START_GAME":
                await game_manager.start_game(room_id, player_id)
            elif msg_type == "NEXT_ROUND":
                await game_manager.start_new_round(room_id, player_id)
            elif msg_type == "CHOOSE_WORD":
                await game_manager.choose_word(room_id, player_id, payload.get("word"))
            else:
                print(f"Unknown message type received from {player_id}: {msg_type}")

    except WebSocketDisconnect:
        print(f"Client {player_id} disconnected from room {room_id}")
        # Only attempt to remove if the connection was successfully added
        if (
            room_id in game_manager.rooms
            and player_id in game_manager.rooms[room_id].active_connections
        ):
            await game_manager.remove_player_connection(room_id, player_id)
    except Exception as e:
        # Catch any unexpected errors that occur during or after the handshake
        print(f"An unexpected error occurred in websocket for player {player_id}: {e}")
        # Try to send an error message to the client if the connection is still open
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.send_json(
                    {
                        "type": "ERROR",
                        "payload": {"message": "An internal server error occurred."},
                    }
                )
            except RuntimeError:  # Client might have already disconnected
                pass
        # Ensure the connection is closed if an unhandled error occurred
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close(
                code=status.WS_1011_INTERNAL_ERROR, reason="Server error."
            )


@app.get("/api/room_exists/{room_id}")
async def room_exists(room_id: str):
    return {"exists": room_id in game_manager.rooms}


@app.post("/api/start_game/{room_id}")
async def start_game(room_id: str):
    await game_manager.start_game(room_id)
    return {"message": "Game started"}


@app.websocket("/ws/{room_id}/{player_id}/{player_name}")
async def websocket_endpoint(
    websocket: WebSocket, room_id: str, player_id: str, player_name: str
):
    room = await game_manager.join_room(room_id, player_id, player_name, websocket)
    if not room:
        await websocket.close(
            code=1008, reason="Room not found or game already started"
        )
        return

    try:
        while True:
            try:
                data = await websocket.receive_json()
                message = WebSocketMessage(**data)

                if message.type == "GUESS":
                    await game_manager.handle_guess(
                        room_id, player_id, message.payload["text"]
                    )
                elif message.type == "DRAWING_DATA":
                    drawing_data = DrawingData(**message.payload)
                    await game_manager.handle_drawing_data(
                        room_id, player_id, drawing_data
                    )
                elif message.type == "CHAT_MESSAGE":
                    player_name_in_room = (
                        room.players.get(player_id).name
                        if room.players.get(player_id)
                        else "Unknown"
                    )
                    await game_manager._broadcast(
                        room_id,
                        WebSocketMessage(
                            type="CHAT_MESSAGE",
                            payload={
                                "sender": player_name_in_room,
                                "message": message.payload["message"],
                            },
                        ).dict(),
                    )
            except Exception as inner_e:
                import traceback

                traceback.print_exc()
                await game_manager.send_chat_message(
                    room_id,
                    "System",
                    f"Server error processing your request: {inner_e}",
                    False,
                )

    except WebSocketDisconnect:
        print(f"Client {player_id} disconnected from room {room_id}")
        await game_manager.remove_player_connection(room_id, player_id)
    except Exception as e:
        print(
            f"An unexpected error occurred in websocket setup/outer loop for player {player_id} in room {room_id}: {e}"
        )
        import traceback

        traceback.print_exc()
        # Corrected line below:
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.send_json(
                    {
                        "type": "ERROR",
                        "payload": {
                            "message": "An internal server error occurred during connection setup or management."
                        },
                    }
                )
            except RuntimeError:
                pass
        if (
            websocket.client_state != WebSocketState.DISCONNECTED
        ):  # <--- USE WebSocketClientState
            await websocket.close(
                code=status.WS_1011_INTERNAL_ERROR, reason="Server error."
            )
