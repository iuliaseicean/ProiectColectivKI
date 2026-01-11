// frontend/src/api/taskService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// -----------------------------
// Axios instance + Auth header
// -----------------------------
const api = axios.create({
  baseURL: API_URL,
});

// Atașăm automat Bearer token (dacă există)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper: error message normalizat
function extractError(err, fallback) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

// -----------------------------
// Tasks CRUD
// -----------------------------
export async function getTasksByProject(projectId) {
  try {
    const res = await api.get(`/tasks/project/${projectId}`);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to load tasks"));
  }
}

export async function createTask({
  title,
  description,
  projectId,
  priority,
  complexity,
  assignee,
  tags,
  source, // opțional
}) {
  try {
    const payload = {
      title,
      description: description || null,
      project_id: projectId,
      priority: priority || "medium",
      complexity: complexity || "medium",
      assignee: assignee || null,
      tags: tags || null,
      source: source || "manual",
    };
    const res = await api.post(`/tasks/`, payload);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to create task"));
  }
}

export async function updateTask(taskId, data) {
  try {
    const res = await api.patch(`/tasks/${taskId}`, data);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to update task"));
  }
}

export async function deleteTask(taskId) {
  try {
    await api.delete(`/tasks/${taskId}`);
  } catch (err) {
    throw new Error(extractError(err, "Failed to delete task"));
  }
}

export async function updateTaskStatus(taskId, status) {
  try {
    const res = await api.patch(`/tasks/${taskId}/status`, null, {
      params: { status },
    });
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to update task status"));
  }
}

// -----------------------------
// AI: generate story / description
// -----------------------------
export async function generateAiStory(taskId) {
  try {
    const res = await api.post(`/tasks/${taskId}/generate-story`);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to generate AI story"));
  }
}

export async function generateAiDescription(taskId) {
  // Backend: POST /tasks/{task_id}/ai-description
  try {
    const res = await api.post(`/tasks/${taskId}/ai-description`);
    return res.data; // TaskRead
  } catch (err) {
    throw new Error(extractError(err, "Failed to generate AI description"));
  }
}

/**
 * Estimare automată a efortului (Story Points)
 * Backend: POST /tasks/{task_id}/estimate
 */
export async function estimateTaskEffort(
  taskId,
  options = { include_history: true, max_history_tasks: 20 }
) {
  try {
    const payload = {
      include_history: options.include_history ?? true,
      max_history_tasks: options.max_history_tasks ?? 20,
    };

    const res = await api.post(`/tasks/${taskId}/estimate`, payload);
    return res.data; // EffortEstimateResponse { story_points, confidence, ... }
  } catch (err) {
    throw new Error(extractError(err, "Failed to estimate task effort"));
  }
}

// -----------------------------
// ✅ AI: batch estimate (project-wide)
// Backend: POST /tasks/ai/estimate-effort
// Body: { project_id, include_history, max_history_tasks }
// -----------------------------
export async function estimateEffortForProject(
  projectId,
  options = { include_history: true, max_history_tasks: 20 }
) {
  try {
    const payload = {
      project_id: Number(projectId),
      include_history: options.include_history ?? true,
      max_history_tasks: options.max_history_tasks ?? 20,
    };

    const res = await api.post(`/tasks/ai/estimate-effort`, payload);
    return res.data; // list[EffortEstimateResponse]
  } catch (err) {
    throw new Error(extractError(err, "Failed to estimate effort for project"));
  }
}
