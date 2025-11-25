// frontend/src/api/projectService.js

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Helper: parsează răspunsul HTTP.
 * - dacă e 204 → returnează null fără să încerce res.json()
 * - dacă e ok și are JSON → întoarce JSON
 * - dacă nu e ok → aruncă Error cu un mesaj util
 */
async function handleJson(res, defaultError) {
  // 204 No Content => nu există body, deci nu facem res.json()
  if (res.status === 204) {
    if (!res.ok) {
      throw new Error(defaultError);
    }
    return null;
  }

  if (res.ok) {
    try {
      return await res.json();
    } catch {
      // răspuns ok, dar fără JSON valid
      return null;
    }
  }

  // Eroare HTTP — încercăm să extragem mesaj
  let errMsg = defaultError;

  try {
    const data = await res.json();
    errMsg =
      data?.detail ||
      data?.message ||
      JSON.stringify(data) ||
      defaultError;
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
    },
    body: JSON.stringify(payload),
  });

  return handleJson(res, "Failed to update project");
}

// --------------------------------------------------
// PUT /projects/{id}
// (folosește-l doar dacă adaugi endpoint PUT în backend)
// --------------------------------------------------
export async function replaceProject(id, payload) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
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
    },
  });

  // dacă e 204, handleJson întoarce null dar nu aruncă eroare
  await handleJson(res, "Failed to delete project");
  return true;
}