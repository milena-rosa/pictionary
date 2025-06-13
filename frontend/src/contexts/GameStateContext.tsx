import React, { createContext, useContext, useState } from "react";
import type { GameState } from "../types/game";

interface GameContextType {
  gameState: GameState | null;
  setGameState: (gs: GameState) => void;
}

const GameStateContext = createContext<GameContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  return (
    <GameStateContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameStateContext.Provider>
  );
};

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error("useGameState must be used in GameStateProvider");
  }
  return ctx;
}
