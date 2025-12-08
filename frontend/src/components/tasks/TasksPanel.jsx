// src/components/tasks/TasksPanel.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
} from "../../api/taskService";
import TaskCard from "./TaskCard";
import TaskModal from "../modals/TaskModal";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";

export default function TasksPanel({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("asc");

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");
      const data = await getTasksByProject(projectId);
      setTasks(data);
    } catch (err) {
      console.error(err);
      setError("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) loadTasks();
  }, [projectId]);

  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [tasks, sortBy, sortDir]);

  const openCreateModal = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async ({ title, description, projectId }) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, { title, description });
      } else {
        await createTask({ title, description, projectId });
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      loadTasks();
    } catch (err) {
      console.error(err);
      setError("Could not save task.");
    }
  };

  const handleChangeStatus = async (task, status) => {
    try {
      await updateTaskStatus(task.id, status);
      loadTasks();
    } catch (err) {
      console.error(err);
      setError("Could not change task status.");
    }
  };

  const askDeleteTask = (task) => {
    setTaskToDelete(task);
    setIsDeleteOpen(true);
  };

  const confirmDeleteTask = async () => {
    try {
      await deleteTask(taskToDelete.id);
      setTaskToDelete(null);
      setIsDeleteOpen(false);
      loadTasks();
    } catch (err) {
      console.error(err);
      setError("Could not delete task.");
    }
  };

  return (
    <div className="tasks-panel">
      <div className="tasks-toolbar">
        <button className="primary-btn" onClick={openCreateModal}>
          + New Task
        </button>

        <div className="tasks-sort">
          <label>
            Sort by{" "}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at">Created date</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {loading && <p>Loading tasks…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && sortedTasks.length === 0 && (
        <p>No tasks yet for this project.</p>
      )}

      <div className="tasks-list">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={openEditModal}
            onDelete={askDeleteTask}
            onChangeStatus={handleChangeStatus}
          />
        ))}
      </div>

      <TaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={editingTask}
        projectId={projectId}
      />

      <ConfirmDeleteModal
        open={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={confirmDeleteTask}
      />
    </div>
  );
}
