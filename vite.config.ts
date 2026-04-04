import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && {
        name: "exercisedb-dev-proxy",
        configureServer(server) {
          server.middlewares.use("/api/exercisedb", async (req, res) => {
            const apiKey = env.EXERCISEDB_RAPIDAPI_KEY;
            const apiHost = env.EXERCISEDB_RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
            const baseUrl = (env.EXERCISEDB_API_BASE_URL || "https://exercisedb.p.rapidapi.com").replace(/\/+$/, "");
            const timeoutMs = Number(env.EXERCISEDB_API_TIMEOUT_MS || 8000);

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "ExerciseDB RapidAPI key is not configured." }));
              return;
            }

            const requestUrl = new URL(req.url || "/", "http://localhost");
            const upstreamUrl = `${baseUrl}${requestUrl.pathname.replace("/api/exercisedb", "")}${requestUrl.search}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
              const response = await fetch(upstreamUrl, {
                signal: controller.signal,
                headers: {
                  "X-RapidAPI-Key": apiKey,
                  "X-RapidAPI-Host": apiHost,
                  Accept: "application/json",
                },
              });

              const body = await response.text();
              res.statusCode = response.status;
              res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
              res.end(body);
            } catch (error) {
              const isAbort = error instanceof Error && error.name === "AbortError";
              res.statusCode = isAbort ? 504 : 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: isAbort ? "ExerciseDB request timed out." : "ExerciseDB request failed." }));
            } finally {
              clearTimeout(timeout);
            }
          });
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
