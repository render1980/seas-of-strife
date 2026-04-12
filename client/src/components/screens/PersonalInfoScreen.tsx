import { FormEvent, useState } from "react";
import { updateLogin } from "../../api/profile";

interface Props {
  token: string;
  currentLogin: string;
  onLoginUpdated: (newLogin: string) => void;
  onBack: () => void;
}

export default function PersonalInfoScreen({
  token,
  currentLogin,
  onLoginUpdated,
  onBack,
}: Props) {
  const [login, setLogin] = useState(currentLogin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = login.trim();
    if (!trimmed) {
      setError("Login cannot be empty");
      return;
    }
    if (trimmed === currentLogin) {
      setError("Login is unchanged");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const result = await updateLogin(token, trimmed);
      onLoginUpdated(result.login);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors text-2xl"
        aria-label="Back"
      >
        ← Back
      </button>

      <h2 className="text-slate-200 text-2xl font-bold mb-8 tracking-wide">
        Personal Info
      </h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4 w-72"
      >
        <label className="text-slate-400 text-sm self-start">Login</label>
        <input
          type="text"
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            setSuccess(false);
            setError("");
          }}
          maxLength={50}
          disabled={saving}
          className="w-full px-4 py-2 rounded bg-slate-800 border border-slate-600 text-slate-200 focus:border-sky-500 focus:outline-none disabled:opacity-50"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">Login updated!</p>}

        <button type="submit" disabled={saving} className="menu-item mt-2">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
