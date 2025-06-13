import React, { useState, useEffect, useRef } from "react";
import { sendMessage } from "../api/websocket";
import type { ChatMessage } from "../types/game"; // Import ChatMessage type

interface ChatProps {
  ws: WebSocket | null;
  playerName: string;
  messages: ChatMessage[]; // Now receives messages as a prop
}

const Chat: React.FC<ChatProps> = ({ ws, messages }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom(); // Scroll to bottom when messages change
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (ws && input.trim()) {
      sendMessage(ws, "GUESS", { message: input.trim() }); // Send 'GUESS' message type
      setInput("");
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4 bg-gray-50 border-t border-gray-200">
      <h3 className="text-lg font-semibold mb-2">Chat</h3>
      <div
        className="flex-1 overflow-y-auto bg-white rounded p-2 mb-2 shadow-inner border border-gray-200"
        style={{ minHeight: "150px" }}
      >
        {messages.map((m, i) => (
          <div key={`${m}-${i}`} className="text-sm my-1">
            <span className="font-bold mr-1">{m.sender}:</span>
            <span
              className={
                m.isCorrectGuess
                  ? "text-green-600 font-medium"
                  : "text-gray-800"
              }
            >
              {m.message}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Dummy div for scrolling */}
      </div>
      <form onSubmit={send} className="flex">
        <input
          className="flex-1 border rounded-l p-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Type your guess or message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!ws} // Disable if WS not connected
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r transition-colors duration-200"
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
