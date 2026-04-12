export interface ProfileData {
  login: string;
  goldMedals: number;
  silverMedals: number;
  bronzeMedals: number;
}

export interface GameParticipant {
  login: string;
  place: number;
}

export interface GameResult {
  gameId: number;
  createdAt: string;
  participants: GameParticipant[];
}

export async function fetchProfile(token: string): Promise<ProfileData> {
  const res = await fetch(`/api/profile?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function fetchResults(token: string): Promise<GameResult[]> {
  const res = await fetch(
    `/api/profile/results?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch results");
  const data = await res.json();
  return data.games;
}

export async function updateLogin(
  token: string,
  newLogin: string,
): Promise<{ login: string }> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, login: newLogin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed");
  return { login: data.login };
}
