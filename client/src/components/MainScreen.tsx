import { Session } from "../api/auth";

interface Props {
  session: Session;
  onLogout: () => void;
}

const MENU_ITEMS = ["New Game", "Join Game", "Profile", "Log out"] as const;
type MenuItem = (typeof MENU_ITEMS)[number];

export default function MainScreen({ session: _session, onLogout }: Props) {
  function handleClick(label: MenuItem) {
    if (label === "Log out") {
      onLogout();
      return;
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
      <h1 className="sos-title">S.O.S</h1>

      <nav className="mt-16 flex flex-col items-center gap-2">
        {MENU_ITEMS.map((label) => (
          <button
            key={label}
            onClick={() => handleClick(label)}
            className="menu-item"
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
