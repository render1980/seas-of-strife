export interface Session {
  token: string;
  login: string;
}

const SESSION_KEY = "session";

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function login(
  loginName: string,
  password: string,
): Promise<Session> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: loginName, password }),
  });

  const data = (await res.json()) as {
    token?: string;
    login?: string;
    error?: string;
  };

  if (!res.ok || data.error) {
    throw new Error(data.error ?? "Login failed");
  }

  return { token: data.token!, login: data.login! };
}

export async function logout(token: string): Promise<void> {
  await fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}
