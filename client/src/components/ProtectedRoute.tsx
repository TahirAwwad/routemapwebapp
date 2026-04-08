import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready, skipAuth } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (ready && !user && !skipAuth) setLocation("/login");
  }, [ready, user, skipAuth, setLocation]);

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user && !skipAuth) return null;

  return <>{children}</>;
}
