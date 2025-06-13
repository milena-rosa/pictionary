// Scoreboard.tsx
import React from "react";
import type { Player } from "../types/game";

const Scoreboard: React.FC<{
  players: Player[];
  current_drawer_id: string | null;
}> = ({ players, current_drawer_id }) => (
  <div className="p-4 bg-white shadow-lg rounded-t-xl border-b border-gray-200 flex-none">
    <h3 className="text-lg font-bold mb-3 text-gray-800 border-b pb-2">
      🏆 Scoreboard
    </h3>
    <ul>
      {players
        .sort((a, b) => b.score - a.score)
        .map((p) => (
          <li
            key={p.id}
            className={`flex justify-between items-center py-2 px-3 my-0.5 rounded-lg transition-colors duration-200 cursor-default ${
              current_drawer_id === p.id
                ? "bg-indigo-50 text-indigo-700 font-extrabold shadow-sm scale-105"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center text-base">
              {current_drawer_id === p.id && (
                <span className="mr-2 text-xl animate-bounce">✍️</span>
              )}
              {p.name}
            </span>
            <span className="text-lg font-bold text-gray-900">{p.score}</span>
          </li>
        ))}
    </ul>
  </div>
);

export default Scoreboard;
