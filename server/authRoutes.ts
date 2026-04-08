import type { Express, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "JWT_SECRET is missing or too short; set a strong secret in production."
    );
  }
  return "dev-only-change-JWT_SECRET-in-production-min-16-chars";
}

const JWT_SECRET = getJwtSecret();
const AUTH_USERNAME = (process.env.AUTH_USERNAME ?? "Habib").trim();
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? "Neverforget@96";

export function mountAuthRoutes(app: Express): void {
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const body = req.body as { username?: string; password?: string } | undefined;
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, username });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
      return res.status(401).json({ user: null });
    }
    try {
      const decoded = jwt.verify(h.slice(7), JWT_SECRET) as JwtPayload;
      const user = typeof decoded.sub === "string" ? decoded.sub : null;
      return res.json({ user });
    } catch {
      return res.status(401).json({ user: null });
    }
  });
}
