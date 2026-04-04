import { Session } from "../api/auth";

interface Props {
  session: Session;
  onNewGame: () => void;
  onLogout: () => void;
}

export default function MainScreen({
  session: _session,
  onNewGame,
  onLogout,
}: Props) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
      <h1 className="sos-title">S.O.S</h1>

      <nav className="mt-16 flex flex-col items-center gap-2">
        <button onClick={onNewGame} className="menu-item">
          New Game
        </button>
        <button className="menu-item opacity-40 cursor-not-allowed" disabled>
          Join Game
        </button>
        <button className="menu-item opacity-40 cursor-not-allowed" disabled>
          Profile
        </button>
        <button onClick={onLogout} className="menu-item">
          Log out
        </button>
      </nav>
    </div>
  );
}
