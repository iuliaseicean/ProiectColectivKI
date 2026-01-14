// frontend/src/api/taskService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// -----------------------------
// Axios instance
// -----------------------------
const api = axios.create({
  baseURL: API_URL,
});

// ia user_id din localStorage (setat la login)
function getUserIdValue() {
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id != null) return String(u.id);
    }
  } catch {
    // ignore
  }

  const rawId = localStorage.getItem("user_id");
  if (rawId) return String(rawId);

  return null;
}

// Atașăm automat Bearer token + X-User-Id
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");

  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const uid = getUserIdValue();
  if (uid) {
    config.headers["X-User-Id"] = uid;
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

export async function generateAiDescription(taskId) {
  try {
    const res = await api.post(`/tasks/${taskId}/ai-description`);
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to generate AI description"));
  }
}

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
    return res.data;
  } catch (err) {
    throw new Error(
      extractError(err, "Failed to generate task descriptions for project")
    );
  }
}

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
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to create project summary"));
  }
}

// -----------------------------
// AI: effort estimation
// -----------------------------
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
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to estimate task effort"));
  }
}

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
    return res.data;
  } catch (err) {
    throw new Error(extractError(err, "Failed to estimate effort for project"));
  }
}