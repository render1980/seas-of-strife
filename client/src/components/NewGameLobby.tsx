import { useState } from "react";
import type { LobbyPlayer } from "../../../shared/types/messages";

interface Props {
  gameId: number;
  players: LobbyPlayer[];
  creatorId: string;
  currentLogin: string;
  onStart: () => void;
  onStop: () => void;
}

export default function NewGameLobby({
  gameId,
  players,
  creatorId,
  currentLogin,
  onStart,
  onStop,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isCreator = currentLogin === creatorId;

  function copyGameId() {
    navigator.clipboard.writeText(String(gameId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <h1 className="sos-title">S.O.S</h1>
      <p className="text-slate-400 mt-2 mb-8 text-xs tracking-widest uppercase">
        Start New Game
      </p>

      {/* Game ID */}
      <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-6 py-3 mb-8">
        <span className="text-slate-400 text-sm">Game ID</span>
        <span className="text-white font-mono text-2xl font-bold">{gameId}</span>
        <button
          onClick={copyGameId}
          className="ml-2 text-xs text-slate-400 hover:text-white border border-slate-600
                     hover:border-slate-400 rounded px-2 py-1 transition"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {isCreator && (
          <button
            onClick={onStart}
            className="w-full rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-800
                       text-white font-bold py-3 text-sm tracking-widest uppercase transition"
            style={{ fontFamily: "'Black Ops One', cursive" }}
          >
            Start Game
          </button>
        )}
        <button
          onClick={onStop}
          className="text-sm text-slate-400 hover:text-white transition underline"
        >
          {isCreator ? "Cancel" : "Leave"}
        </button>
      </div>
    </div>
  );
}
