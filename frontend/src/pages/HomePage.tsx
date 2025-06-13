// HomePage.tsx
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
        const res = await resp.json();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-6 tracking-tight">
        Pictionary
      </h1>
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md transform transition-transform duration-300 hover:scale-[1.01]">
        {/* Mode selection buttons */}
        <div className="mb-5 flex space-x-2 p-1 bg-gray-100 rounded-lg">
          <button
            className={`flex-1 py-2.5 px-4 rounded-lg text-base font-semibold transition-all duration-300 ease-in-out cursor-pointer ${
              mode === "create"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setMode("create")}
          >
            Create Room
          </button>
          <button
            className={`flex-1 py-2.5 px-4 rounded-lg text-base font-semibold transition-all duration-300 ease-in-out cursor-pointer ${
              mode === "join"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setMode("join")}
          >
            Join Room
          </button>
        </div>
        {/* Inputs */}
        <input
          className="mb-3 p-2.5 border border-gray-300 rounded-lg w-full text-base focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your Name"
        />
        {mode === "join" && (
          <input
            className="mb-3 p-2.5 border border-gray-300 rounded-lg w-full text-base focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200"
            placeholder="Room ID"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            aria-label="Room ID"
          />
        )}
        {/* Action button */}
        <button
          className="w-full bg-indigo-700 text-white p-3 rounded-lg text-lg font-bold tracking-wide hover:bg-indigo-800 transition-colors duration-200 transform hover:-translate-y-0.5 shadow-lg cursor-pointer"
          onClick={mode === "create" ? handleCreate : handleJoin}
        >
          {mode === "create" ? "Create Room" : "Join Room"}
        </button>
        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
