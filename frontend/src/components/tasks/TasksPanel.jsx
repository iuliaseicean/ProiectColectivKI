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

  // ✅ în TasksPanel.jsx, înlocuiește loadTasks() cu asta:
async function loadTasks() {
  try {
    setLoading(true);
    setError("");
    const data = await getTasksByProject(projectId);

    console.log("📦 getTasksByProject(projectId) =", projectId, data);

    // apărare dacă backend trimite alt format (ex: {items: [...]})
    const arr = Array.isArray(data) ? data : (data?.items ?? []);
    setTasks(arr);
  } catch (err) {
    console.error("❌ loadTasks error:", err);
    // dacă e axios, ai info în err.response
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      "Could not load tasks.";
    setError(msg);
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

  // ✅ MODIFICAT: primește și trimite priority + complexity
  const handleSaveTask = async ({
  title,
  description,
  projectId,
  priority,
  complexity,
  assignee,
  tags,
}) => {
  try {
    if (editingTask) {
      await updateTask(editingTask.id, {
        title,
        description,
        priority,
        complexity,
        assignee,
        tags,
      });
    } else {
      await createTask({
        title,
        description,
        projectId,
        priority,
        complexity,
        assignee,
        tags,
      });
    }

    setIsTaskModalOpen(false);
    setEditingTask(null);
    loadTasks();
  } catch (err) {
    console.error(err);
    setError(err?.response?.data?.detail || "Could not save task.");
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
      

      {/* DEBUG UI (temporar) */}
<div style={{ marginTop: 12, padding: 10, background: "#fff", borderRadius: 8 }}>
  <div><strong>DEBUG:</strong> projectId = {String(projectId)}</div>
  <div><strong>tasks.length:</strong> {tasks.length}</div>
  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
    {JSON.stringify(tasks, null, 2)}
  </pre>
</div>

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
