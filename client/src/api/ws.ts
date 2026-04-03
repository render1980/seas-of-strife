import type { ServerMessage } from "../../../shared/types/messages";

export function connectWebSocket(
  token: string,
  onMessage: (msg: ServerMessage) => void,
  onClose: () => void,
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(
    `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`,
  );

  ws.addEventListener("message", (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      onMessage(msg);
    } catch {
      // ignore malformed messages
    }
  });

  ws.addEventListener("close", onClose);

  return ws;
}

export function sendWsMessage(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
