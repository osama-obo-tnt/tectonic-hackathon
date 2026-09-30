"use client";

/** Fire-and-forget report of voice/mic problems to the dev server log. */
export function diag(event: string, detail = "") {
  if (process.env.NODE_ENV === "production") return;
  const env = `secure=${window.isSecureContext} host=${location.host} ua=${navigator.userAgent.slice(-60)}`;
  fetch("/api/diag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, detail: `${detail} | ${env}`.slice(0, 500) }),
  }).catch(() => {});
}
