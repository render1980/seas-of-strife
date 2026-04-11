import { useEffect, useState } from "react";
import { fetchResults, GameResult } from "../../api/profile";

interface Props {
  token: string;
  currentLogin: string;
  onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResultsScreen({ token, currentLogin, onBack }: Props) {
  const [games, setGames] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults(token)
      .then(setGames)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center py-12 relative">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors text-2xl"
        aria-label="Back"
      >
        ← Back
      </button>

      <h2 className="text-slate-200 text-2xl font-bold mb-8 tracking-wide">
        Results
      </h2>

      {loading ? (
        <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">
          Loading…
        </p>
      ) : games.length === 0 ? (
        <p className="text-slate-500 text-sm">No games played yet.</p>
      ) : (
        <div className="flex flex-col gap-6 w-full max-w-md px-4">
          {games.map((game) => (
            <div key={game.gameId} className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-400 text-xs">
                  Game #{game.gameId}
                </span>
                <span className="text-slate-500 text-xs">
                  {formatDate(game.createdAt)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1 px-2 font-medium">Place</th>
                    <th className="text-left py-1 px-2 font-medium">Login</th>
                  </tr>
                </thead>
                <tbody>
                  {game.participants.map((p) => (
                    <tr
                      key={p.login}
                      className={
                        p.login === currentLogin
                          ? "text-sky-300 font-bold"
                          : "text-slate-300"
                      }
                    >
                      <td className="py-1 px-2">{p.place}</td>
                      <td className="py-1 px-2">{p.login}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <p className="text-slate-600 text-xs text-center mt-2">
            Showing last 10 games
          </p>
        </div>
      )}
    </div>
  );
}
