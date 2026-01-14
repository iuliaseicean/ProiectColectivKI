// frontend/src/api/projectService.js

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeader() {
  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Încearcă să ia user_id din:
 *  1) localStorage.user (JSON)
 *  2) localStorage.user_id
 *  3) fallback: null (nu trimitem header)
 *
 * Dacă în app-ul tău ai user în props, ideal e să refaci serviciile
 * să primească userId ca parametru. Dar asta merge acum fără să schimbi multe.
 */
function getUserIdHeader() {
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) return { "X-User-Id": String(u.id) };
    }
  } catch {
    // ignore
  }

  const rawId = localStorage.getItem("user_id");
  if (rawId) return { "X-User-Id": String(rawId) };

  // dacă nu avem id, nu trimitem header (backend poate avea fallback 1)
  return {};
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
// --------------------------------------------------
export async function fetchProjects() {
  const res = await fetch(`${API_URL}/projects/`, {
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader(),
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
      ...getUserIdHeader(),
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
      ...getUserIdHeader(),
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
      ...getUserIdHeader(),
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
      ...getUserIdHeader(),
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
      ...getUserIdHeader(),
    },
  });

  await handleJson(res, "Failed to delete project");
  return true;
}

// --------------------------------------------------
// ✅ AI: POST /projects/{id}/ai/summary
// --------------------------------------------------
export async function createProjectSummary(projectId) {
  const res = await fetch(`${API_URL}/projects/${projectId}/ai/summary`, {
    method: "POST",
    headers: {
      ...getAuthHeader(),
      ...getUserIdHeader(),
    },
  });

  return handleJson(res, "Failed to create project summary");
}