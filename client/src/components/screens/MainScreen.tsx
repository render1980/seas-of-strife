import { FormEvent, useState } from "react";
import { SanitizedGameState } from "../../../../shared/types/messages";
import { Session } from "../../api/auth";

interface Props {
  session: Session;
  state: SanitizedGameState | null;
  onNewGame: () => void;
  onContinueGame: () => void;
  onJoinGame: (gameId: number) => void;
  onLogout: () => void;
}

export default function MainScreen({
  session: _session,
  state,
  onNewGame,
  onContinueGame,
  onJoinGame,
  onLogout,
}: Props) {
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");

  console.log(`state: ${JSON.stringify(state)}`);

  function handleJoinSubmit(e: FormEvent) {
    e.preventDefault();
    const id = parseInt(joinInput, 10);
    if (!Number.isInteger(id) || id <= 0) {
      setJoinError("Enter a valid game ID");
      return;
    }
    setShowJoin(false);
    setJoinInput("");
    setJoinError("");
    onJoinGame(id);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
      <h1 className="sos-title">S.O.S.</h1>

      <nav className="mt-16 flex flex-col items-center gap-2">
        {state && state.phase !== "game-end" && (
          <button onClick={onContinueGame} className="menu-item">
            Continue
          </button>
        )}
        {!state && (
          <>
            <button onClick={onNewGame} className="menu-item">
              New Game
            </button>
            <button
              onClick={() => {
                setShowJoin(true);
                setJoinError("");
                setJoinInput("");
              }}
              className="menu-item"
            >
              Join Game
            </button>
          </>
        )}

        <button className="menu-item opacity-40 cursor-not-allowed" disabled>
          Profile
        </button>
        <button onClick={onLogout} className="menu-item">
          Log out
        </button>
      </nav>

      {/* Join Game modal */}
      {showJoin &&
        joinGameModal(
          handleJoinSubmit,
          joinInput,
          setJoinInput,
          setJoinError,
          joinError,
          setShowJoin,
        )}
    </div>
  );
}

function joinGameModal(
  handleJoinSubmit: (e: FormEvent) => void,
  joinInput: string,
  setJoinInput: (value: string) => void,
  setJoinError: (value: string) => void,
  joinError: string,
  setShowJoin: (value: boolean) => void,
) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={() => setShowJoin(false)}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-white font-bold text-xl text-center mb-1"
          style={{ fontFamily: "'Black Ops One', cursive" }}
        >
          Join Game
        </h2>
        <p className="text-slate-400 text-xs text-center mb-5">
          Enter the game ID you received from the host
        </p>
        <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3">
          <input
            type="number"
            min={1}
            autoFocus
            value={joinInput}
            onChange={(e) => {
              setJoinInput(e.target.value);
              setJoinError("");
            }}
            placeholder="Game ID"
            className="rounded-lg bg-slate-700 text-white text-center text-xl font-mono
                           px-4 py-3 outline-none border border-transparent
                           focus:border-blue-500 transition placeholder:text-slate-500
                           [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {joinError && (
            <p className="text-red-400 text-xs text-center">{joinError}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-800
                           text-white font-bold py-3 text-sm tracking-widest uppercase transition"
            style={{ fontFamily: "'Black Ops One', cursive" }}
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setShowJoin(false)}
            className="text-slate-400 hover:text-white text-sm underline transition text-center"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
