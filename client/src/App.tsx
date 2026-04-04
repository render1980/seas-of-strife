import { useState, useRef, useCallback, useEffect } from "react";
import { Session, clearSession, getSession, logout } from "./api/auth";
import { connectWebSocket, sendWsMessage } from "./api/ws";
import LoginForm from "./components/LoginForm";
import MainScreen from "./components/MainScreen";
import NewGameLobby from "./components/NewGameLobby";
import GameScreen from "./components/GameScreen";
import type {
  ServerMessage,
  LobbyPlayer,
  SanitizedGameState,
  RoundWinner,
} from "../../shared/types/messages";

type Screen = "main" | "new-game-lobby" | "game";

interface LobbyState {
  gameId: number;
  players: LobbyPlayer[];
  creatorId: string;
}

type RoundScores = { playerId: string; tricksTaken: number }[];

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  const [screen, setScreen] = useState<Screen>("main");
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [winners, setWinners] = useState<RoundWinner[] | null>(null);
  const [lastRoundScores, setLastRoundScores] = useState<RoundScores | null>(
    null,
  );
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
    setGameState(null);
    setWinners(null);
    setLastRoundScores(null);
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
        case "game_state":
          setGameState(msg.state);
          setScreen("game");
          break;
        case "trick_resolved":
          setGameState(msg.state);
          setScreen("game");
          break;
        case "round_ended":
          setGameState(msg.state);
          setLastRoundScores(msg.scores);
          setScreen("game");
          break;
        case "game_ended":
          setGameState(msg.state);
          setWinners(msg.winners);
          setScreen("game");
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
      const msgType =
        lobbyState && session?.login === lobbyState.creatorId
          ? "stop_game"
          : "leave_game";
      sendWsMessage(wsRef.current, { type: msgType });
    }
    goToMain();
  }

  function handlePlayCard(card: number) {
    if (wsRef.current)
      sendWsMessage(wsRef.current, { type: "play_card", card });
  }

  function handleSelectLeader(playerIndex: number) {
    if (wsRef.current)
      sendWsMessage(wsRef.current, { type: "select_leader", playerIndex });
  }

  function handleLeaveGame() {
    if (wsRef.current) sendWsMessage(wsRef.current, { type: "leave_game" });
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

  if (screen === "game" && gameState) {
    return (
      <GameScreen
        state={gameState}
        myLogin={session.login}
        winners={winners}
        lastRoundScores={lastRoundScores}
        onPlayCard={handlePlayCard}
        onSelectLeader={handleSelectLeader}
        onLeave={handleLeaveGame}
        onDismissRoundEnd={() => setLastRoundScores(null)}
      />
    );
  }

  return (
    <MainScreen
      session={session}
      onNewGame={handleNewGame}
      onLogout={handleLogout}
    />
  );
}
