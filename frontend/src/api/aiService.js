// frontend/src/api/aiService.js
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res) {
  // backend poate returna {detail: "..."} sau alt shape
  const data = await res.json().catch(() => ({}));
  return data?.detail || data?.message || `Request failed (${res.status})`;
}

/**
 * Estimează story points pentru task-uri dintr-un proiect.
 * Backend recomandat:
 * POST /ai/estimate/story-points
 * body: { project_id, task_ids?: number[] }
 * return: { updated_task_ids: [...]} sau { estimates: [{task_id, story_points, ...}] }
 */
export async function estimateStoryPoints({ projectId, taskIds }) {
  const res = await fetch(`${API_BASE}/ai/estimate/story-points`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      project_id: Number(projectId),
      task_ids: Array.isArray(taskIds) ? taskIds : null,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return await res.json();
}

/**
 * Generează descrieri pentru task-uri (project-wide)
 * POST /ai/generate/descriptions
 * body: { project_id, task_ids?: number[] }
 */
export async function generateTaskDescriptions({ projectId, taskIds }) {
  const res = await fetch(`${API_BASE}/ai/generate/descriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      project_id: Number(projectId),
      task_ids: Array.isArray(taskIds) ? taskIds : null,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return await res.json();
}

/**
 * Creează un summary de proiect
 * POST /ai/project/summary
 * body: { project_id }
 */
export async function createProjectSummary({ projectId }) {
  const res = await fetch(`${API_BASE}/ai/project/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ project_id: Number(projectId) }),
  });

  if (!res.ok) throw new Error(await parseError(res));
  return await res.json();
}
