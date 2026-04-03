import { useState, useRef, useCallback, useEffect } from "react";
import { Session, clearSession, getSession, logout } from "./api/auth";
import { connectWebSocket, sendWsMessage } from "./api/ws";
import LoginForm from "./components/LoginForm";
import MainScreen from "./components/MainScreen";
import NewGameLobby from "./components/NewGameLobby";
import type { ServerMessage, LobbyPlayer } from "../../shared/types/messages";

type Screen = "main" | "new-game-lobby";

interface LobbyState {
  gameId: number;
  players: LobbyPlayer[];
  creatorId: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  const [screen, setScreen] = useState<Screen>("main");
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const goToMain = useCallback(() => {
    closeWs();
    setLobbyState(null);
    setScreen("main");
  }, [closeWs]);

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "lobby_update":
          setLobbyState({
            gameId: msg.gameId,
            players: msg.players,
            creatorId: msg.creatorId,
          });
          setScreen("new-game-lobby");
          break;
        case "game_stopped":
          goToMain();
          break;
        case "error":
          console.error("Server error:", msg.message);
          break;
      }
    },
    [goToMain],
  );

  function handleNewGame() {
    if (!session) return;
    closeWs();
    setScreen("new-game-lobby");
    const ws = connectWebSocket(session.token, handleMessage, goToMain);
    wsRef.current = ws;
    ws.addEventListener("open", () => {
      sendWsMessage(ws, { type: "create_game" });
    });
  }

  function handleStartGame() {
    if (wsRef.current) sendWsMessage(wsRef.current, { type: "start_game" });
  }

  function handleStopOrLeave() {
    if (wsRef.current) {
      const msgType = lobbyState && session?.login === lobbyState.creatorId
        ? "stop_game"
        : "leave_game";
      sendWsMessage(wsRef.current, { type: msgType });
    }
    goToMain();
  }

  async function handleLogout() {
    if (!session) return;
    closeWs();
    await logout(session.token);
    clearSession();
    setSession(null);
    setScreen("main");
  }

  useEffect(() => closeWs, [closeWs]);

  if (!session) {
    return <LoginForm onLogin={setSession} />;
  }

  if (screen === "new-game-lobby") {
    if (!lobbyState) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">
            Connecting…
          </p>
        </div>
      );
    }
    return (
      <NewGameLobby
        gameId={lobbyState.gameId}
        players={lobbyState.players}
        creatorId={lobbyState.creatorId}
        currentLogin={session.login}
        onStart={handleStartGame}
        onStop={handleStopOrLeave}
      />
    );
  }

  return (
    <MainScreen session={session} onNewGame={handleNewGame} onLogout={handleLogout} />
  );
}
