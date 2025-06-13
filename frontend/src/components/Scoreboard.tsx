import React from "react";
import type { Player } from "../types/game";

const Scoreboard: React.FC<{
  players: Player[];
  current_drawer_id: string | null;
}> = ({ players, current_drawer_id }) => (
  <div className="p-4 border-b bg-gray-50">
    <h3 className="text-lg font-semibold mb-2">Scoreboard</h3>
    <ul>
      {players.map((p) => (
        <li
          key={p.id}
          className={`flex justify-between items-center py-1 ${
            current_drawer_id === p.id ? "font-bold text-blue-600" : ""
          }`}
        >
          <span>
            {p.name}
            {current_drawer_id === p.id && (
              <span className="ml-1 text-xs text-green-600">🎨</span>
            )}
          </span>
          <span>{p.score}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default Scoreboard;
