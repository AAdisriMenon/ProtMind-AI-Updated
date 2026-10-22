// Thin client for the FastAPI backend (see backend/api.py).
const rawBase = import.meta.env.VITE_API_URL || "https://protmind-ai-react.onrender.com";
const BASE = rawBase.replace(/\/+$/, "");

async function request(path, options) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Server error (${res.status}) on ${path}`);
  return res;
}

export async function postJson(path, payload) {
  const res = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function validateInput({ uniprotId, mutation, sequence, file }) {
  const fd = new FormData();
  fd.append("uniprot_id", uniprotId);
  fd.append("mutation", mutation);
  fd.append("sequence_input", sequence);
  if (file) fd.append("file", file);
  const res = await request("/api/step1/validate", { method: "POST", body: fd });
  return res.json();
}

export async function fetchReportPdf(payload) {
  const res = await request("/api/step10/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.blob();
}
