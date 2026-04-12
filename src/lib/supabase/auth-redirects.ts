export function getAppOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  const fallbackOrigin = import.meta.env.VITE_APP_URL;
  return fallbackOrigin ?? "";
}

export function buildAuthCallbackUrl(nextPath?: string) {
  const origin = getAppOrigin();
  if (!origin) {
    throw new Error("Nao foi possivel resolver a URL base da aplicacao para o callback de autenticacao.");
  }

  const callbackUrl = new URL("/auth/callback", origin);
  if (nextPath) {
    callbackUrl.searchParams.set("next", nextPath);
  }

  return callbackUrl.toString();
}

export function sanitizeInternalRedirectPath(path: string | null | undefined, fallback = "/dashboard") {
  if (!path) return fallback;

  const normalizedPath = path.trim();
  if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
    return fallback;
  }

  return normalizedPath;
}
