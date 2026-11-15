// Thin client for the FastAPI backend (see backend/api.py).

function resolveApiBase() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  }
  // When running locally in browser (e.g. localhost:5173), prioritize local backend on port 8000
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return "http://localhost:8000";
    }
    // Production deployment (e.g. Railway container serving frontend + backend on the same origin)
    return window.location.origin;
  }
  return "";
}

let BASE = resolveApiBase();
const FALLBACK_BASE = "";

async function request(path, options) {
  let url = `${BASE}${path}`;
  try {
    const res = await fetch(url, options);
    // If primary server returns 404 on an upgraded endpoint, attempt fallback server
    if (!res.ok && res.status === 404 && FALLBACK_BASE && BASE !== FALLBACK_BASE) {
      try {
        const altRes = await fetch(`${FALLBACK_BASE}${path}`, options);
        if (altRes.ok) {
          BASE = FALLBACK_BASE;
          return altRes;
        }
      } catch {
        // Fallback network failure, proceed to standard error
      }
    }
    if (!res.ok) throw new Error(`Server error (${res.status}) on ${path}`);
    return res;
  } catch (err) {
    // If primary server failed to connect (e.g. local backend wasn't running), attempt fallback
    if (FALLBACK_BASE && BASE !== FALLBACK_BASE) {
      try {
        const altRes = await fetch(`${FALLBACK_BASE}${path}`, options);
        if (altRes.ok) {
          BASE = FALLBACK_BASE;
          return altRes;
        }
      } catch {
        // Ignore fallback failure
      }
    }
    throw new Error(`Failed to reach backend (${err.message}) on ${path}`);
  }
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

export async function predictStep9({ uniprotId = "P04637", mutation = "Y220C", sequence = "" } = {}) {
  const payload = {
    uniprot_id: uniprotId,
    mutation: mutation,
    sequence: sequence
  };
  try {
    return await postJson("/predict-step9", payload);
  } catch (err) {
    return await postJson("/api/step9/predict", payload);
  }
}

export async function registerUser({ name, full_name, email, password, captcha_token }) {
  const payload = {
    full_name: full_name || name,
    email,
    password,
    captcha_token
  };
  try {
    return await postJson("/register", payload);
  } catch (err) {
    try {
      return await postJson("/api/register", payload);
    } catch {
      throw err;
    }
  }
}

export async function loginUser({ email, password, captcha_token }) {
  const payload = {
    email,
    password,
    captcha_token
  };
  try {
    return await postJson("/login", payload);
  } catch (err) {
    try {
      return await postJson("/api/login", payload);
    } catch {
      throw err;
    }
  }
}

export async function sendChatMessage({ message, history = [], pipeline_data = {} }) {
  const payload = {
    message,
    history,
    pipeline_data
  };
  try {
    return await postJson("/chat-assistant", payload);
  } catch (err) {
    try {
      return await postJson("/api/chat-assistant", payload);
    } catch {
      throw err;
    }
  }
}
