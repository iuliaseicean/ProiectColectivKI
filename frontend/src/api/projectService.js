// frontend/src/api/projectService.js

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("access_token");
}

function getAuthHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getUserIdValue() {
  // 1) localStorage.user (JSON)
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id != null) return String(u.id);
    }
  } catch {
    // ignore
  }

  // 2) localStorage.user_id
  const rawId = localStorage.getItem("user_id");
  if (rawId != null && rawId !== "") return String(rawId);

  return null;
}

/**
 * include = true -> atașăm X-User-Id dacă există (altfel aruncăm eroare)
 * include = false -> atașăm X-User-Id doar dacă există (fără să forțăm)
 */
function getUserIdHeader({ include } = { include: false }) {
  const uid = getUserIdValue();

  if (!uid) {
    if (include) {
      // eroare explicită, ca să știi exact ce lipsește
      throw new Error("Missing user identity (X-User-Id). Please re-login.");
    }
    return {};
  }

  return { "X-User-Id": uid };
}

/**
 * Helper: parsează răspunsul HTTP.
 */
async function handleJson(res, defaultError) {
  if (res.status === 204) {
    if (!res.ok) throw new Error(defaultError);
    return null;
  }

  if (res.ok) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  let errMsg = defaultError;

  try {
    const data = await res.json();
    errMsg = data?.detail || data?.message || JSON.stringify(data) || defaultError;
  } catch {
    const text = await res.text().catch(() => "");
    if (text) errMsg = text;
  }

  throw new Error(errMsg);
}

// --------------------------------------------------
// GET /projects/
// IMPORTANT: backend-ul tău poate cere identity.
// Trimitem X-User-Id DOAR dacă există deja (fără preflight “forțat”).
// --------------------------------------------------
export async function fetchProjects() {
  const res = await fetch(`${API_URL}/projects/`, {
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader({ include: false }),
    },
  });

  return handleJson(res, "Failed to load projects");
}

// --------------------------------------------------
// GET /projects/{id}
// --------------------------------------------------
export async function fetchProjectById(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader({ include: false }),
    },
  });

  return handleJson(res, "Project not found");
}

// --------------------------------------------------
// POST /projects/
// --------------------------------------------------
export async function createProject(payload) {
  const res = await fetch(`${API_URL}/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...getUserIdHeader({ include: true }),
    },
    body: JSON.stringify(payload),
  });

  return handleJson(res, "Failed to create project");
}

// --------------------------------------------------
// PATCH /projects/{id}
// --------------------------------------------------
export async function updateProject(id, payload) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...getUserIdHeader({ include: true }),
    },
    body: JSON.stringify(payload),
  });

  return handleJson(res, "Failed to update project");
}

// --------------------------------------------------
// PUT /projects/{id}
// --------------------------------------------------
export async function replaceProject(id, payload) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...getUserIdHeader({ include: true }),
    },
    body: JSON.stringify(payload),
  });

  return handleJson(res, "Failed to replace project");
}

// --------------------------------------------------
// DELETE /projects/{id}
// --------------------------------------------------
export async function deleteProject(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader({ include: true }),
    },
  });

  await handleJson(res, "Failed to delete project");
  return true;
}

// --------------------------------------------------
// AI: POST /projects/{id}/ai/summary
// --------------------------------------------------
export async function createProjectSummary(projectId) {
  const res = await fetch(`${API_URL}/projects/${projectId}/ai/summary`, {
    method: "POST",
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader({ include: true }),
    },
  });

  return handleJson(res, "Failed to create project summary");
}