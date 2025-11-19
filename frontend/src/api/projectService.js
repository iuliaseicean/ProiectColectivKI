// frontend/src/api/projectService.js

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// GET /projects
export async function fetchProjects() {
  const res = await fetch(`${API_URL}/projects`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to load projects");
  }

  return res.json(); // list[ProjectRead]
}

// GET /projects/{id}
export async function fetchProjectById(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new Error("Project not found");
  }

  return res.json(); // ProjectRead
}
