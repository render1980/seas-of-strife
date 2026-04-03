import { useState } from "react";
import { Session, getSession, clearSession, logout } from "./api/auth";
import LoginForm from "./components/LoginForm";

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);

  async function handleLogout() {
    if (!session) return;
    await logout(session.token);
    clearSession();
    setSession(null);
  }

  if (!session) {
    return <LoginForm onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome, {session.login}!</h1>
        <p className="text-slate-400 mb-6">Main screen — coming soon</p>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-white underline transition"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
