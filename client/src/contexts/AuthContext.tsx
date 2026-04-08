import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/authToken";

type AuthContextValue = {
  user: string | null;
  ready: boolean;
  skipAuth: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";

async function fetchMe(token: string): Promise<string | null> {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: string | null };
  return data.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(skipAuth ? "dev" : null);
  const [ready, setReady] = useState(skipAuth);

  useEffect(() => {
    if (skipAuth) return;
    const token = getStoredToken();
    if (!token) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void fetchMe(token).then((u) => {
      if (cancelled) return;
      if (!u) clearStoredToken();
      setUser(u);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    if (!data.token) throw new Error("Invalid server response");
    setStoredToken(data.token);
    const u = await fetchMe(data.token);
    if (!u) {
      clearStoredToken();
      throw new Error("Session could not be verified");
    }
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, skipAuth, login, logout }),
    [user, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
