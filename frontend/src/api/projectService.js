// frontend/src/api/projectService.js

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// helper: parsează răspunsul și aruncă eroare cu mesaj util
async function handleJson(res, defaultError) {
  if (res.ok) return res.json();

  // încearcă să citească eroarea din JSON (FastAPI: { detail: "..." })
  let errMsg = defaultError;
  try {
    const data = await res.json();
    errMsg =
      data?.detail ||
      data?.message ||
      JSON.stringify(data) ||
      defaultError;
  } catch {
    // fallback pe text
    const text = await res.text().catch(() => "");
    if (text) errMsg = text;
  }

  throw new Error(errMsg);
}

// GET /projects
export async function fetchProjects() {
  const res = await fetch(`${API_URL}/projects`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  return handleJson(res, "Failed to load projects");
}

// GET /projects/{id}
export async function fetchProjectById(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  return handleJson(res, "Project not found");
}

// POST /projects
export async function createProject(payload) {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  return handleJson(res, "Failed to create project");
}

// PATCH /projects/{id}
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

// PUT /projects/{id} (NU ai endpoint acum, îl folosești doar dacă îl adaugi în backend)
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

// DELETE /projects/{id}
// ATENȚIE: backend-ul tău NU are endpoint DELETE încă.
// Dacă nu îl adăugați, funcția asta va da 405.
export async function deleteProject(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader(),
    },
  });

  await handleJson(res, "Failed to delete project");
  return true;
}
