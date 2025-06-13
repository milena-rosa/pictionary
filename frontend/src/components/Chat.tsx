// Chat.tsx
import React, { useState, useEffect, useRef } from "react";
import { sendMessage } from "../api/websocket";
import type { ChatMessage } from "../types/game";

interface ChatProps {
  ws: WebSocket | null;
  playerName: string;
  messages: ChatMessage[];
}

const Chat: React.FC<ChatProps> = ({ ws, messages }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (ws && input.trim()) {
      sendMessage(ws, "GUESS", { message: input.trim() });
      setInput("");
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4 bg-white">
      <h3 className="text-lg font-bold mb-3 text-gray-800 border-b pb-2">
        💬 Game Chat
      </h3>
      <div
        className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-3 mb-3 shadow-inner border border-gray-200"
        style={{ minHeight: "120px" }}
      >
        {messages.map((m, i) => (
          <div
            key={`${m.message}-${i}`}
            className="text-sm my-1 leading-relaxed"
          >
            <span className="font-semibold text-gray-700 mr-1">
              {m.sender}:
            </span>
            <span
              className={
                m.isCorrectGuess
                  ? "text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md"
                  : "text-gray-800"
              }
            >
              {m.message}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={send} className="flex">
        <input
          className="flex-1 border border-gray-300 rounded-l-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 placeholder-gray-500"
          placeholder="Type your guess or message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!ws}
          aria-label="Chat input"
        />
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-r-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
          type="submit"
          disabled={!ws || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
