import { useState, FormEvent } from "react";
import { login, saveSession, Session } from "../api/auth";

interface Props {
  onLogin: (session: Session) => void;
}

export default function LoginForm({ onLogin }: Props) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(loginName, password);
      saveSession(session);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-center text-white mb-2 tracking-wide">
          Seas of Strife
        </h1>
        <p className="text-center text-slate-400 mb-8 text-sm">
          Enter your credentials to play
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-2xl shadow-xl p-8 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="login"
              className="text-slate-300 text-sm font-medium"
            >
              Login
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              maxLength={50}
              required
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              disabled={loading}
              className="rounded-lg bg-slate-700 text-white px-4 py-2.5 text-sm outline-none
                         border border-transparent focus:border-blue-500 transition
                         disabled:opacity-50 placeholder:text-slate-500"
              placeholder="Your login"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-slate-300 text-sm font-medium"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              maxLength={200}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="rounded-lg bg-slate-700 text-white px-4 py-2.5 text-sm outline-none
                         border border-transparent focus:border-blue-500 transition
                         disabled:opacity-50 placeholder:text-slate-500"
              placeholder="Your password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center -mt-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !loginName || !password}
            className="mt-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                       text-white font-semibold py-2.5 text-sm transition
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-slate-500 text-xs text-center">
            New here? Just pick a login and password — your account will be
            created automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
