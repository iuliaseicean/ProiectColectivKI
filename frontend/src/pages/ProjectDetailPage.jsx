// frontend/src/pages/ProjectDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProjectById, updateProject } from "../api/projectService";
import {
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
} from "../api/taskService";
import "./ProjectDetailPage.css";

// ======================
//  COMPONENTA PRINCIPALĂ
// ======================
export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // edit project details
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    description: "",
    tech_stack: "",
    infrastructure: "",
    members_count: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ======================
  //  STATE PENTRU TASKS
  // ======================
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");

  const [sortBy, setSortBy] = useState("created_at"); // created_at | title | status

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // --------------------------------------------------
  //  Load project
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError("");
        const data = await fetchProjectById(projectId);

        if (cancelled) return;

        setProject(data);

        setEditForm({
          description: data.description || "",
          tech_stack: data.tech_stack || "",
          infrastructure: data.infrastructure || "",
          members_count: data.members_count ?? 0,
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load project");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // --------------------------------------------------
  //  Load tasks pentru proiect (din backend)
  // --------------------------------------------------
  async function loadTasks() {
    if (!projectId) return;
    try {
      setTasksLoading(true);
      setTasksError("");
      const data = await getTasksByProject(projectId);
      setTasks(data);
    } catch (err) {
      console.error(err);
      setTasksError(err.message || "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // --------------------------------------------------
  //  Handlers edit project
  // --------------------------------------------------
  function startEdit() {
    if (!project) return;
    setEditForm({
      description: project.description || "",
      tech_stack: project.tech_stack || "",
      infrastructure: project.infrastructure || "",
      members_count: project.members_count ?? 0,
    });
    setSaveError("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setSaveError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError("");

    try {
      setSaving(true);

      const payload = {
        description: editForm.description.trim() || null,
        tech_stack: editForm.tech_stack.trim() || null,
        infrastructure: editForm.infrastructure.trim() || null,
        members_count:
          editForm.members_count === "" || editForm.members_count == null
            ? 0
            : Number(editForm.members_count),
      };

      const updated = await updateProject(project.id, payload);
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  //  Handlers pentru Task & Story Management
  // --------------------------------------------------
  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return -1; // sortare mereu ascendentă
      if (aVal > bVal) return 1;
      return 0;
    });
    return copy;
  }, [tasks, sortBy]);

  function openNewTaskModal() {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  }

  function openEditTask(task) {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }

  async function handleSaveTask({ title, description }) {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, { title, description });
      } else {
        await createTask({ title, description, projectId });
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      await loadTasks();
    } catch (err) {
      console.error(err);
      setTasksError(err.message || "Failed to save task");
    }
  }

  async function handleChangeStatus(task, status) {
    try {
      await updateTaskStatus(task.id, status);
      await loadTasks();
    } catch (err) {
      console.error(err);
      setTasksError(err.message || "Failed to update task status");
    }
  }

  function askDeleteTask(task) {
    setTaskToDelete(task);
    setIsDeleteOpen(true);
  }

  async function confirmDeleteTask() {
    try {
      if (taskToDelete) {
        await deleteTask(taskToDelete.id);
      }
      setTaskToDelete(null);
      setIsDeleteOpen(false);
      await loadTasks();
    } catch (err) {
      console.error(err);
      setTasksError(err.message || "Failed to delete task");
    }
  }

  // --------------------------------------------------
  //  RENDER
  // --------------------------------------------------
  if (loading) {
    return <div className="project-detail-layout">Loading project...</div>;
  }

  if (loadError || !project) {
    return (
      <div className="project-detail-layout">
        <div className="project-detail-error">
          <p>{loadError || "Project not found"}</p>
          <button onClick={() => navigate("/projects")}>Back to projects</button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-detail-layout">
      {/* Top bar – doar back button aici */}
      <header className="project-detail-topbar">
        <button
          className="project-detail-back"
          onClick={() => navigate("/projects")}
        >
          ← Back to projects
        </button>
      </header>

      <main className="project-detail-main">
        {/* HEADER + INFO */}
        <section className="project-detail-header">
          <div className="project-detail-header-row">
            <div>
              <h1>{project.name}</h1>
            </div>
            <div>
              {!isEditing && (
                <button
                  className="project-detail-edit-btn"
                  onClick={startEdit}
                >
                  ✏ Edit details
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <form
              className="project-detail-edit-form"
              onSubmit={handleSave}
            >
              <label>
                Description
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Tech stack (comma-separated)
                <input
                  type="text"
                  value={editForm.tech_stack}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, tech_stack: e.target.value }))
                  }
                  placeholder="React, FastAPI, PostgreSQL"
                />
              </label>

              <label>
                Infrastructure
                <input
                  type="text"
                  value={editForm.infrastructure}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      infrastructure: e.target.value,
                    }))
                  }
                  placeholder="Docker + Render"
                />
              </label>

              <label>
                Members
                <input
                  type="number"
                  min="0"
                  value={editForm.members_count}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      members_count: e.target.value,
                    }))
                  }
                />
              </label>

              {saveError && (
                <div className="project-detail-save-error">{saveError}</div>
              )}

              <div className="project-detail-edit-actions">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="project-detail-description">
                {project.description || "No description yet."}
              </p>

              <div className="project-detail-info">
                <div>
                  <h4>Tech stack</h4>
                  <p>{project.tech_stack || "n/a"}</p>
                </div>
                <div>
                  <h4>Infrastructure</h4>
                  <p>{project.infrastructure || "n/a"}</p>
                </div>
                <div>
                  <h4>Members</h4>
                  <p>{project.members_count ?? 0}</p>
                </div>
                <div>
                  <h4>Start date</h4>
                  <p>
                    {project.start_date
                      ? new Date(project.start_date).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* COLUMNS: Tasks & AI assistant */}
        <section className="project-detail-columns">
          {/* Tasks column */}
          <div className="project-detail-column">
            <h2>Tasks</h2>
            <p className="project-detail-subtitle">
              Define new tasks with title and short description. Later they can
              be sent to the AI model for better descriptions and estimations.
            </p>

            {/* Toolbar: New task + Sorting */}
            <div className="project-detail-tasks-toolbar">
              <button
                className="project-detail-primary-btn"
                onClick={openNewTaskModal}
              >
                + New Task
              </button>

              <div className="project-detail-tasks-sort">
                <span>Sort by&nbsp;</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="created_at">Created date</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            {/* Task states: loading / error / empty / list */}
            {tasksLoading && <p>Loading tasks…</p>}
            {tasksError && (
              <p className="project-detail-save-error">{tasksError}</p>
            )}

            {!tasksLoading && !tasksError && sortedTasks.length === 0 && (
              <div className="project-detail-placeholder">
                <p>No tasks yet. Create the first one.</p>
              </div>
            )}

            {!tasksLoading && sortedTasks.length > 0 && (
              <ul className="project-detail-task-list">
                {sortedTasks.map((t) => (
                  <li key={t.id} className="project-detail-task-item">
                    <div className="project-detail-task-main">
                      <div>
                        <strong>{t.title}</strong>
                        {t.description && (
                          <span className="project-detail-task-desc">
                            {" "}
                            — {t.description}
                          </span>
                        )}
                      </div>

                      <span
                        className={`project-detail-task-status badge-${t.status}`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="project-detail-task-actions">
                      <select
                        value={t.status || "todo"}
                        onChange={(e) =>
                          handleChangeStatus(t, e.target.value)
                        }
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>

                      <button onClick={() => openEditTask(t)}>Edit</button>
                      <button onClick={() => askDeleteTask(t)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Assistant column */}
          <div className="project-detail-column">
            <h2>AI Assistant</h2>
            <p className="project-detail-subtitle">
              The AI uses all existing tasks to improve descriptions, estimate
              story points and create project summaries.
            </p>

            <div className="project-detail-ai-buttons">
              <button
                onClick={() => alert("TODO: Generate task descriptions")}
              >
                Generate task descriptions
              </button>
              <button onClick={() => alert("TODO: Estimate story points")}>
                Estimate story points
              </button>
              <button onClick={() => alert("TODO: Create project summary")}>
                Create project summary
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modale pentru Task & Story Management */}
      <TaskModal
        open={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
      />

      <ConfirmDeleteModal
        open={isDeleteOpen}
        onCancel={() => {
          setIsDeleteOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={confirmDeleteTask}
      />
    </div>
  );
}

// ======================
//  COMPONENTE MODALE
// ======================

// Modal pentru creare / editare task
function TaskModal({ open, onClose, onSave, initialTask }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
    } else {
      setTitle("");
      setDescription("");
    }
  }, [initialTask, open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSave({ title: trimmedTitle, description: description.trim() });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{initialTask ? "Edit Task" : "New Task"}</h3>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal pentru confirmare ștergere
function ConfirmDeleteModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <p>Are you sure you want to delete this task?</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
