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
  roomId: string; // This is the ID of the room we're in, passed from App.tsx
  playerId: string;
  playerName: string;
}

const GamePage: React.FC<Props> = ({ roomId, playerId, playerName }) => {
  const { gameState, setGameState } = useGameState();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [drawingHistory, setDrawingHistory] = useState<DrawingData[][]>([]); // Full drawing history
  const [currentRemoteDrawingPoint, setCurrentRemoteDrawingPoint] =
    useState<DrawingData | null>(null); // For real-time point updates
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
          // Ensure drawing strokes from full state update are applied
          setDrawingHistory(msg.payload.drawing_strokes || []);
          setCurrentRemoteDrawingPoint(null); // Clear single point as full history is provided

          // Handle client-side timer
          if (msg.payload.timer_expires_at) {
            const expiresAt = msg.payload.timer_expires_at;
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }
            timerIntervalRef.current = window.setInterval(() => {
              const now = Date.now() / 1000; // Current time in seconds
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
              // in the backend, Pydantic does the conversion from snake_case to camelCase by default in model_dump().
              isCorrectGuess: msg.payload.isCorrectGuess || false,
            },
          ]);
          break;
        case "DRAWING_UPDATE":
          // This is a single point update for real-time drawing, not full history
          setCurrentRemoteDrawingPoint(msg.payload);
          break;
        case "WORD_TO_DRAW":
          // This message is only sent to the current drawer with word options
          if (playerId === msg.payload.current_drawer_id) {
            setWordsToChoose(msg.payload.words);
          }
          break;
        case "GAME_OVER":
          setGameState(msg.payload); // Update game state one last time for scores etc.
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
          // Potentially show a dedicated game over modal/screen here (not implemented in this snippet)
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

  // Effect for WebSocket connection
  useEffect(() => {
    const websocket = connectWebSocket(
      roomId,
      playerId,
      playerName,
      handleWebSocketMessage, // Pass the handler
      () => {
        // OnClose handler
        setWs(null); // Clear WS state to indicate disconnection
        // Implement reconnection logic here if desired (e.g., display error, go back to home)
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
    // Add handleWebSocketMessage to dependencies since it's a useCallback, ensures it's fresh
  }, [roomId, playerId, playerName, handleWebSocketMessage]);

  // Host actions
  const handleStartGame = () => {
    if (ws) {
      sendMessage(ws, "START_GAME", {});
    }
  };

  const handleSelectWord = (word: string) => {
    if (ws) {
      sendMessage(ws, "CHOOSE_WORD", { word });
    }
    setWordsToChoose([]); // Clear modal after selection
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
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <span className="text-xl text-gray-700">Connecting to game...</span>
      </div>
    );
  }

  const isHost = gameState.host_id === playerId;
  const isDrawingPhaseActive =
    gameState.is_game_started &&
    !!gameState.secret_word &&
    !!gameState.current_drawer_id;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      {wordsToChoose.length > 0 && (
        <WordSelectionModal
          words={wordsToChoose}
          onSelectWord={handleSelectWord}
        />
      )}

      <main className="flex-1 flex flex-col items-center p-4">
        {/* Room ID and Share Info */}
        <div className="text-center bg-blue-50 p-4 rounded-lg shadow-md mb-6 w-full max-w-md">
          <h2 className="text-xl font-semibold text-blue-800 mb-2">
            Share Room ID
          </h2>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-4xl font-extrabold text-blue-600 tracking-wider">
              {roomId} {/* This prop is the one passed from App.tsx */}
            </span>
            <button
              onClick={handleCopyRoomId}
              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200"
              title="Copy to clipboard"
            >
              📋
            </button>
          </div>
          {copyStatus && (
            <p
              className={`mt-2 text-sm ${
                copyStatus === "Copied!" ? "text-green-600" : "text-red-600"
              }`}
            >
              {copyStatus}
            </p>
          )}
          <p className="text-gray-700 mt-2">
            Give this to your friends so they can join!
          </p>
        </div>
        {/* Host Controls */}
        {isHost && !gameState.is_game_started && (
          <button
            onClick={handleStartGame}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 text-xl"
            disabled={Object.keys(gameState.players).length < 2 || !ws} // Needs at least 2 players to start
          >
            {Object.keys(gameState.players).length < 2
              ? "Need 2+ players to start"
              : "Start Game"}
          </button>
        )}
        {/* Game State Info */}
        <h3 className="my-4 text-2xl font-bold text-gray-800">
          Round {gameState.round_number} / {gameState.total_rounds}
        </h3>
        {gameState.is_game_started && (
          <div className="mb-4 text-xl">
            {gameStateRef.current?.current_drawer_id === playerId ? (
              <p className="font-bold text-green-700">You are drawing!</p>
            ) : (
              <p>
                <span className="font-bold text-gray-700">Guess the word:</span>{" "}
                <span className="font-mono text-purple-700 text-2xl">
                  {gameState.guessed_word_hint || "Wait for hint..."}
                </span>
              </p>
            )}
            {gameState.secret_word &&
              gameStateRef.current?.current_drawer_id === playerId && (
                <p className="text-xl font-bold text-indigo-700 mt-2">
                  Your word is: {gameState.secret_word}
                </p>
              )}
          </div>
        )}
        {!gameState.is_game_started && (
          <p className="text-xl text-gray-600 mb-4">
            Waiting for host to start the game...
          </p>
        )}
        {/* Drawing Canvas */}
        <DrawingCanvas
          isDrawer={
            gameStateRef.current?.current_drawer_id === playerId &&
            isDrawingPhaseActive
          } // Can only draw if it's your turn AND game is active
          ws={ws}
          remoteDrawingStrokes={drawingHistory}
          currentDrawingData={currentRemoteDrawingPoint}
        />

        {gameState.current_drawer_id && (
          <div className="mt-4 text-3xl font-bold text-red-600">
            Timer: <span className="font-mono">{timeLeft}s</span>
          </div>
        )}
        {!gameState.current_drawer_id &&
          gameState.is_game_started &&
          gameState.round_number > 0 && (
            <p className="mt-4 text-xl text-orange-600 font-semibold">
              Waiting for next drawer to pick a word...
            </p>
          )}
      </main>
      <aside className="w-full md:w-80 border-l bg-white flex flex-col shadow-lg">
        {gameState.players && (
          <Scoreboard
            players={Object.values(gameState.players)}
            current_drawer_id={gameState.current_drawer_id}
          />
        )}{" "}
        <Chat ws={ws} playerName={playerName} messages={chatMessages} />
      </aside>
    </div>
  );
};

export default GamePage;
