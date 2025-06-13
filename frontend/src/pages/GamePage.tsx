// GamePage.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useGameState } from "../contexts/GameStateContext";
import {
  connectWebSocket,
  sendMessage,
  type WebSocketMessage,
} from "../api/websocket";
import DrawingCanvas from "../components/DrawingCanvas";
import Scoreboard from "../components/Scoreboard";
import Chat from "../components/Chat";
import WordSelectionModal from "../components/WordSelectionModal";
import type { ChatMessage, DrawingData } from "../types/game";

interface Props {
  roomId: string;
  playerId: string;
  playerName: string;
}

const GamePage: React.FC<Props> = ({ roomId, playerId, playerName }) => {
  const { gameState, setGameState } = useGameState();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [drawingHistory, setDrawingHistory] = useState<DrawingData[][]>([]);
  const [currentRemoteDrawingPoint, setCurrentRemoteDrawingPoint] =
    useState<DrawingData | null>(null);
  const [wordsToChoose, setWordsToChoose] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (msg: WebSocketMessage) => {
      switch (msg.type) {
        case "GAME_STATE_UPDATE":
          setGameState(msg.payload);
          setDrawingHistory(msg.payload.drawing_strokes || []);
          setCurrentRemoteDrawingPoint(null);

          if (msg.payload.timer_expires_at) {
            const expiresAt = msg.payload.timer_expires_at;
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }
            timerIntervalRef.current = window.setInterval(() => {
              const now = Date.now() / 1000;
              const remaining = Math.max(0, Math.floor(expiresAt - now));
              setTimeLeft(remaining);
              if (remaining === 0 && timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
              }
            }, 1000);
          } else {
            setTimeLeft(0);
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
          }
          break;
        case "CHAT_MESSAGE":
          setChatMessages((prev) => [
            ...prev,
            {
              sender: msg.payload.sender,
              message: msg.payload.message,
              isCorrectGuess: msg.payload.isCorrectGuess || false,
            },
          ]);
          break;
        case "DRAWING_UPDATE":
          setCurrentRemoteDrawingPoint(msg.payload);
          break;
        case "WORD_TO_DRAW":
          if (playerId === msg.payload.current_drawer_id) {
            setWordsToChoose(msg.payload.words);
          }
          break;
        case "GAME_OVER":
          setGameState(msg.payload);
          setChatMessages((prev) => [
            ...prev,
            {
              sender: "Game",
              message: `GAME OVER! Winner: ${
                msg.payload.winner_name || "No one (tie)"
              }`,
              isCorrectGuess: true,
            },
          ]);
          break;
        case "ERROR":
          console.error("WS Error:", msg.payload.message);
          setChatMessages((prev) => [
            ...prev,
            {
              sender: "System",
              message: `Error: ${msg.payload.message}`,
              isCorrectGuess: false,
            },
          ]);
          break;
        default:
          console.warn("Unhandled WS message type:", msg.type);
      }
    },
    [playerId, setGameState]
  );

  useEffect(() => {
    const websocket = connectWebSocket(
      roomId,
      playerId,
      playerName,
      handleWebSocketMessage,
      () => {
        setWs(null);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "System",
            message: "Disconnected from game. Please refresh or try again.",
            isCorrectGuess: false,
          },
        ]);
      }
    );
    setWs(websocket);

    return () => {
      websocket.close();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [roomId, playerId, playerName, handleWebSocketMessage]);

  const handleStartGame = () => {
    if (ws) {
      sendMessage(ws, "START_GAME", {});
    }
  };

  const handleSelectWord = (word: string) => {
    if (ws) {
      sendMessage(ws, "CHOOSE_WORD", { word });
    }
    setWordsToChoose([]);
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyStatus("Copied!");
    } catch (err) {
      setCopyStatus("Failed to copy.");
      console.error("Failed to copy room ID: ", err);
    } finally {
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  if (!gameState) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 text-gray-700">
        <p className="text-xl">Connecting to game...</p>
      </div>
    );
  }

  const isHost = gameState.host_id === playerId;
  const isDrawingPhaseActive =
    gameState.is_game_started &&
    !!gameState.secret_word &&
    !!gameState.current_drawer_id;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans text-gray-800">
      {wordsToChoose.length > 0 && (
        <WordSelectionModal
          words={wordsToChoose}
          onSelectWord={handleSelectWord}
        />
      )}

      <main className="flex-1 flex flex-col items-center p-4 md:p-6">
        {/* Room ID and Share Info */}
        <div className="relative text-center bg-white p-5 rounded-2xl shadow-xl mb-6 w-full max-w-lg border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Invite Your Friends!
          </h2>
          <p className="text-gray-600 mb-3 text-sm">
            Share this Room ID with your friends to join the game:
          </p>
          <div className="flex items-center justify-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl p-2 text-xl md:text-2xl font-extrabold text-indigo-700 tracking-wide select-text">
            <span className="truncate">{roomId}</span>
            <button
              onClick={handleCopyRoomId}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 cursor-pointer"
              title="Copy to clipboard"
              aria-label="Copy Room ID to clipboard"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-7 4H9m2 0h2m-2 4h2m-2 4h2m-2 4h2"
                ></path>
              </svg>
            </button>
          </div>
          {copyStatus && (
            <p
              className={`mt-2 text-sm font-medium ${
                copyStatus === "Copied!" ? "text-green-600" : "text-red-600"
              }`}
            >
              {copyStatus}
            </p>
          )}
        </div>

        {/* Host Controls */}
        {isHost && !gameState.is_game_started && (
          <button
            onClick={handleStartGame}
            className={`mb-6 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-full text-lg shadow-lg transition-all duration-300 transform ${
              Object.keys(gameState.players).length < 2
                ? "opacity-60 cursor-not-allowed"
                : "hover:scale-105 cursor-pointer"
            } focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50`}
            disabled={Object.keys(gameState.players).length < 2 || !ws}
          >
            {Object.keys(gameState.players).length < 2
              ? "Need 2+ players to start"
              : "Start Game"}
          </button>
        )}

        {/* Game State Info */}
        <div className="bg-white p-5 rounded-2xl shadow-xl mb-6 w-full max-w-lg border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-800 mb-3">
            Round {gameState.round_number} / {gameState.total_rounds}
          </h3>
          {gameState.is_game_started && (
            <div className="text-base">
              {gameStateRef.current?.current_drawer_id === playerId ? (
                <p className="font-bold text-green-700 mb-1">
                  You are drawing!
                </p>
              ) : (
                <p>
                  <span className="font-bold text-gray-700">
                    Guess the word:
                  </span>{" "}
                  <span className="font-mono text-indigo-700 text-2xl block mt-1">
                    {gameState.guessed_word_hint || "Waiting for hint..."}
                  </span>
                </p>
              )}
              {gameState.secret_word &&
                gameStateRef.current?.current_drawer_id === playerId && (
                  <p className="text-xl font-bold text-indigo-700 mt-3">
                    Your word is:{" "}
                    <span className="underline">{gameState.secret_word}</span>
                  </p>
                )}
            </div>
          )}
          {!gameState.is_game_started && (
            <p className="text-base text-gray-600 mb-3">
              Waiting for host to start the game...
            </p>
          )}
        </div>

        {/* Drawing Canvas */}
        <DrawingCanvas
          isDrawer={
            gameStateRef.current?.current_drawer_id === playerId &&
            isDrawingPhaseActive
          }
          ws={ws}
          remoteDrawingStrokes={drawingHistory}
          currentDrawingData={currentRemoteDrawingPoint}
        />

        {/* Timer */}
        {gameState.current_drawer_id && (
          <div className="mt-4 text-3xl font-extrabold text-indigo-700 bg-white p-3 rounded-xl shadow-md border border-gray-100 min-w-[150px] text-center">
            Time Left:{" "}
            <span className="font-mono text-red-600">{timeLeft}s</span>
          </div>
        )}
        {!gameState.current_drawer_id &&
          gameState.is_game_started &&
          gameState.round_number > 0 && (
            <p className="mt-4 text-base text-orange-600 font-semibold bg-white p-3 rounded-xl shadow-md border border-gray-100">
              Waiting for next drawer to pick a word...
            </p>
          )}
      </main>
      <aside className="w-full md:w-80 lg:w-96 border-l border-gray-200 bg-white flex flex-col shadow-2xl p-4">
        {gameState.players && (
          <Scoreboard
            players={Object.values(gameState.players)}
            current_drawer_id={gameState.current_drawer_id}
          />
        )}
        <Chat ws={ws} playerName={playerName} messages={chatMessages} />
      </aside>
    </div>
  );
};

export default GamePage;
