// src/api/taskService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getTasksByProject(projectId) {
  const res = await axios.get(`${API_URL}/tasks/project/${projectId}`);
  return res.data;
}

export async function createTask({
  title,
  description,
  projectId,
  priority = "medium",
  complexity = "medium",
  assignee = "",
  tags = "general",
  source = "manual",
}) {
  const payload = {
    title,
    description,
    project_id: projectId,
    priority,
    complexity,
    assignee: (assignee ?? "").trim(),
    tags: (tags ?? "").trim() || "general",
    source,
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
  const res = await axios.patch(`${API_URL}/tasks/${taskId}/status`, null, {
    params: { status },
  });
  return res.data;
}

export async function generateAiStory(taskId) {
  const res = await axios.post(`${API_URL}/tasks/${taskId}/generate-story`);
  return res.data;
}
