// ─────────────────────────────────────────────────────────────────────────────
// Apps Script Web App URL — the ONLY place it lives.
//
// Redeploy the SAME deployment to keep this URL forever:
//   Apps Script → Deploy → Manage deployments → ✏️ Edit → Version: "New version" → Deploy
// Only if you ever make a brand-new deployment, paste the new /exec URL below
// (or set VITE_GAS_URL in Netlify → Site configuration → Environment variables and redeploy).
// ─────────────────────────────────────────────────────────────────────────────
export const EXEC_URL =
  (import.meta.env.VITE_GAS_URL || "").trim() ||
  "https://script.google.com/macros/s/AKfycbzrcCNCZ3Hj6NGDs55g1siauRxtBGke1hrNm2YigucEWCYY9POSPHrkRpMCKUX7gC83/exec";
