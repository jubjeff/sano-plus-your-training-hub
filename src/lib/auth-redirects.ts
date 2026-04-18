export function getAppOrigin() {
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();

  if (typeof window === "undefined") {
    return configuredAppUrl || "https://sanoplus.online";
  }

  return window.location.origin || configuredAppUrl || "https://sanoplus.online";
}

export function buildAuthCallbackUrl(nextPath = "/") {
  const next = sanitizeInternalRedirectPath(nextPath, "/");
  return `${getAppOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function buildAppUrl(path = "/") {
  const next = sanitizeInternalRedirectPath(path, "/");
  return `${getAppOrigin()}${next}`;
}

export function sanitizeInternalRedirectPath(input: string | null | undefined, fallback = "/") {
  if (!input) return fallback;

  try {
    const url = new URL(input, getAppOrigin());
    if (url.origin !== getAppOrigin()) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return input.startsWith("/") ? input : fallback;
  }
}
