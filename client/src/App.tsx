import { useState } from "react";
import { Session, clearSession, getSession, logout } from "./api/auth";
import LoginForm from "./components/LoginForm";
import MainScreen from "./components/MainScreen";

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

  return <MainScreen session={session} onLogout={handleLogout} />;
}
