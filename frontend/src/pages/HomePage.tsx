import React, { useState } from "react";

interface Props {
  onJoin: (roomId: string, playerId: string, playerName: string) => void;
}

const HomePage: React.FC<Props> = ({ onJoin }) => {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name) {
      return setError("Your name is required.");
    }
    setError(null);

    try {
      const resp = await fetch("/api/create_room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_name: name,
          total_rounds: 5,
          word_category: "animals",
        }),
      });

      if (resp.status === 200 || resp.status === 201) {
        const res = await resp.json();
        // Assuming the first player created is the host, and its ID is returned in res.players
        const hostId = Object.keys(res.players)[0];
        onJoin(res.id, hostId, name);
      } else {
        const errorData = await resp.json();
        setError(
          errorData.detail || "Failed to create room. Please try again."
        );
      }
    } catch (err) {
      console.error("Error creating room:", err);
      setError("Network error or server unreachable. Please try again.");
    }
  }

  async function handleJoin() {
    if (!name || !room) {
      return setError("Both name and room ID are required.");
    }
    setError(null);

    try {
      const resp = await fetch("/api/join_room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room_id: room,
          player_name: name,
        }),
      });

      if (resp.status === 200 || resp.status === 201) {
        const res = await resp.json(); // This will be of type JoinRoomResponse { player_id: string, room_state: Room }
        // Now, use the player_id received from the backend to connect to the WebSocket
        onJoin(room, res.player_id, name);
      } else {
        const errorData = await resp.json();
        setError(
          errorData.detail ||
            "Failed to join room. Please check ID and try again."
        );
      }
    } catch (err) {
      console.error("Error joining room:", err);
      setError("Network error or server unreachable. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-blue-100 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Pictionary</h1>
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <div className="mb-4 flex space-x-2">
          <button
            className={`flex-1 py-2 px-4 rounded ${
              mode === "create" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setMode("create")}
          >
            Create Room
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded ${
              mode === "join" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setMode("join")}
          >
            Join Room
          </button>
        </div>
        <input
          className="mb-2 p-2 border rounded w-full"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {mode === "join" && (
          <input
            className="mb-2 p-2 border rounded w-full"
            placeholder="Room ID"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        )}
        <button
          className="w-full bg-blue-600 text-white p-2 rounded"
          onClick={mode === "create" ? handleCreate : handleJoin}
        >
          {mode === "create" ? "Create Room" : "Join Room"}
        </button>
        {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
      </div>
    </div>
  );
};

export default HomePage;
