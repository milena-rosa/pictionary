export interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const WEBSOCKET_BASE = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws";

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
