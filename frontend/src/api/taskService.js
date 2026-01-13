// src/api/taskService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// -----------------------------
// Axios instance + Auth header
// -----------------------------
const api = axios.create({
  baseURL: API_URL,
});

// Atașăm automat Bearer token (token sau access_token)
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");

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
  source,
}) {
  try {
    const payload = {
      title,
      description: description || null,
      project_id: Number(projectId),
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
// AI: story / descriptions
// -----------------------------
export async function generateAiStory(taskId) {
  try {
    const res = await api.post(`/tasks/${taskId}/generate-story`);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to generate AI story"));
  }
}

// ✅ Single task description
// Backend: POST /tasks/{task_id}/ai-description
export async function generateAiDescription(taskId) {
  try {
    const res = await api.post(`/tasks/${taskId}/ai-description`);
    return res.data; // TaskRead
  } catch (err) {
    throw new Error(extractError(err, "Failed to generate AI description"));
  }
}

// ✅ Batch generate descriptions (project-wide)
// Backend: POST /tasks/ai/generate-descriptions
// Body: { project_id, task_ids?: [ids] | null, include_done?: boolean }
export async function generateDescriptionsForProject(
  projectId,
  options = { task_ids: null, include_done: false }
) {
  try {
    const payload = {
      project_id: Number(projectId),
      task_ids: Array.isArray(options.task_ids) ? options.task_ids : null,
      include_done: Boolean(options.include_done),
    };

    const res = await api.post(`/tasks/ai/generate-descriptions`, payload);
    return res.data; // list[TaskRead]
  } catch (err) {
    throw new Error(
      extractError(err, "Failed to generate task descriptions for project")
    );
  }
}

// ✅ Create project summary
// Backend: POST /tasks/ai/project-summary
// Body: { project_id, task_ids?: [ids] | null, include_done?: boolean }
export async function createProjectSummary(
  projectId,
  options = { task_ids: null, include_done: true }
) {
  try {
    const payload = {
      project_id: Number(projectId),
      task_ids: Array.isArray(options.task_ids) ? options.task_ids : null,
      include_done: Boolean(options.include_done),
    };

    const res = await api.post(`/tasks/ai/project-summary`, payload);
    return res.data; // { project_id, summary, method }
  } catch (err) {
    throw new Error(extractError(err, "Failed to create project summary"));
  }
}

// -----------------------------
// AI: effort estimation
// -----------------------------
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
    return res.data; // EffortEstimateResponse
  } catch (err) {
    throw new Error(extractError(err, "Failed to estimate task effort"));
  }
}

// ✅ Batch estimate (project-wide)
// Backend: POST /tasks/ai/estimate-effort
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