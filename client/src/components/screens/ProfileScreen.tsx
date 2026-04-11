import { useEffect, useState } from "react";
import { fetchProfile, ProfileData } from "../../api/profile";

interface Props {
  token: string;
  onPersonalInfo: () => void;
  onResults: () => void;
  onBack: () => void;
}

export default function ProfileScreen({ token, onPersonalInfo, onResults, onBack }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile(token)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors text-2xl"
        aria-label="Back"
      >
        ← Back
      </button>

      {loading ? (
        <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">
          Loading…
        </p>
      ) : (
        <>
          <div className="flex items-center gap-8 mb-16">
            <div className="medal-item">
              <div className="medal medal-gold">🥇</div>
              <span className="medal-count">{profile?.goldMedals ?? 0}</span>
            </div>
            <div className="medal-item">
              <div className="medal medal-silver">🥈</div>
              <span className="medal-count">{profile?.silverMedals ?? 0}</span>
            </div>
            <div className="medal-item">
              <div className="medal medal-bronze">🥉</div>
              <span className="medal-count">{profile?.bronzeMedals ?? 0}</span>
            </div>
          </div>

          <nav className="flex flex-col items-center gap-2">
            <button onClick={onPersonalInfo} className="menu-item">
              Personal info
            </button>
            <button onClick={onResults} className="menu-item">
              Results
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
