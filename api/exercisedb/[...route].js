const DEFAULT_BASE_URL = "https://exercisedb.p.rapidapi.com";
const DEFAULT_TIMEOUT_MS = 8000;

function getConfig() {
  return {
    baseUrl: (process.env.EXERCISEDB_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: process.env.EXERCISEDB_RAPIDAPI_KEY,
    apiHost: process.env.EXERCISEDB_RAPIDAPI_HOST || "exercisedb.p.rapidapi.com",
    timeoutMs: Number(process.env.EXERCISEDB_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

function buildUpstreamUrl(baseUrl, route, query) {
  const normalizedRoute = Array.isArray(route) ? route.join("/") : route || "";
  const queryWithoutRoute = { ...(query || {}) };
  delete queryWithoutRoute.route;
  const search = new URLSearchParams(queryWithoutRoute).toString();
  return `${baseUrl}/${normalizedRoute}${search ? `?${search}` : ""}`;
}

module.exports = async function handler(req, res) {
  const { baseUrl, apiKey, apiHost, timeoutMs } = getConfig();

  if (!apiKey) {
    return res.status(500).json({ error: "ExerciseDB RapidAPI key is not configured." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamUrl = buildUpstreamUrl(baseUrl, req.query.route, req.query);
    const response = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": apiHost,
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", contentType);
    res.send(body);
  } catch (error) {
    const isAbort = error && typeof error === "object" && error.name === "AbortError";
    res.status(isAbort ? 504 : 502).json({
      error: isAbort ? "ExerciseDB request timed out." : "ExerciseDB request failed.",
    });
  } finally {
    clearTimeout(timeout);
  }
};
