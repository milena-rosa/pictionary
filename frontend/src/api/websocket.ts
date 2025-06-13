export interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const WEBSOCKET_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
console.log('\x1b[44m%s\x1b[0m', 'frontend/src/api/websocket.ts:8 process.env.VITE_WS_URL', import.meta.env.VITE_WS_URL);
export function connectWebSocket(
  roomId: string,
  playerId: string,
  playerName: string,
  onMessage: (msg: WebSocketMessage) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(
    `${WEBSOCKET_BASE}/${roomId}/${playerId}/${playerName}`
  );
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    onMessage(msg);
  };
  ws.onclose = onClose || (() => {});

  return ws;
}

export function sendMessage(
  ws: WebSocket,
  type: string,
  payload: unknown
): void {
  ws.send(JSON.stringify({ type, payload }));
}
