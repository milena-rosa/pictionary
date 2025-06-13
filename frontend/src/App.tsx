import React, { useState } from "react";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import { GameStateProvider } from "./contexts/GameStateContext";

const App: React.FC = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  if (!joined) {
    return (
      <GameStateProvider>
        <HomePage
          onJoin={(room, id, name) => {
            setRoomId(room);
            setPlayerId(id);
            setPlayerName(name);
            setJoined(true);
          }}
        />
      </GameStateProvider>
    );
  }
  return (
    <GameStateProvider>
      <GamePage
        roomId={roomId!}
        playerId={playerId!}
        playerName={playerName!}
      />
    </GameStateProvider>
  );
};

export default App;
