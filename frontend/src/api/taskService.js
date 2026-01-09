// src/api/taskService.js
import axios from "axios";

const API_URL = "http://127.0.0.1:8000"; // aceeași bază ca la auth/projectService

export async function getTasksByProject(projectId) {
  const res = await axios.get(`${API_URL}/tasks/project/${projectId}`);
  return res.data;
}

export async function createTask({ title, description, projectId, priority, complexity, assignee, tags }) {
  const payload = {
    title,
    description,
    project_id: projectId,
    priority: priority || "medium",
    complexity: complexity || "medium",
    assignee: assignee || null,
    tags: tags || null,
  };
  const res = await axios.post(`${API_URL}/tasks/`, payload);
  return res.data;
}

export async function updateTask(taskId, data) {
  const res = await axios.patch(`${API_URL}/tasks/${taskId}`, data);
  return res.data;
}

export async function deleteTask(taskId) {
  await axios.delete(`${API_URL}/tasks/${taskId}`);
}

export async function updateTaskStatus(taskId, status) {
  const res = await axios.patch(
    `${API_URL}/tasks/${taskId}/status`,
    null,
    { params: { status } }
  );
  return res.data;
}

export async function generateAiStory(taskId) {
  const res = await axios.post(`${API_URL}/tasks/${taskId}/generate-story`);
  return res.data;
}

/**
 * 🔹 Estimare automată a efortului folosind AI
 * Backend: POST /tasks/{task_id}/estimate
 */
export async function estimateTaskEffort(taskId, options = { include_history: true, max_history_tasks: 20 }) {
  const payload = {
    include_history: options.include_history,
    max_history_tasks: options.max_history_tasks,
  };
  const res = await axios.post(`${API_URL}/tasks/${taskId}/estimate`, payload);
  return res.data;
}
