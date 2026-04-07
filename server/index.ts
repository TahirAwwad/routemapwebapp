import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveStaticPath(): string {
  const nextToBundle = path.join(__dirname, "public");
  if (fs.existsSync(nextToBundle)) {
    return nextToBundle;
  }
  return path.resolve(__dirname, "..", "dist", "public");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const staticPath = resolveStaticPath();

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
