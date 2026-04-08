import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { user, ready, login, skipAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) setLocation("/");
  }, [ready, user, setLocation]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Sign in</h1>
            <p className="text-xs text-muted-foreground">Sales field · route app</p>
          </div>
        </div>

        {skipAuth && (
          <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 rounded-md px-3 py-2 mb-4">
            VITE_SKIP_AUTH is enabled — you are not using real authentication.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-user" className="text-xs font-medium text-muted-foreground">
              Username
            </label>
            <Input
              id="login-user"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-h-11"
              disabled={submitting || skipAuth}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-pass" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <Input
              id="login-pass"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11"
              disabled={submitting || skipAuth}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full min-h-11 font-semibold" disabled={submitting || skipAuth}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
