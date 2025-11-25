// frontend/src/pages/ProjectDetailPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProjectById, updateProject } from "../api/projectService";
import "./ProjectDetailPage.css";

// ----------------------
// Helpers pentru task-uri
// ----------------------
const TASKS_KEY_PREFIX = "pcai_tasks_";

function loadTasksFromStorage(projectId) {
  try {
    const raw = localStorage.getItem(`${TASKS_KEY_PREFIX}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("Failed to load tasks from storage", e);
    return [];
  }
}

function saveTasksToStorage(projectId, tasks) {
  try {
    localStorage.setItem(
      `${TASKS_KEY_PREFIX}${projectId}`,
      JSON.stringify(tasks)
    );
  } catch (e) {
    console.error("Failed to save tasks to storage", e);
  }
}

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

  // tasks
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });

  // --------------------------------------------------
  //  Load project + tasks
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

        // încarcă task-urile din localStorage
        const storedTasks = loadTasksFromStorage(projectId);
        setTasks(storedTasks);
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
  //  Handlers tasks
  // --------------------------------------------------
  function openNewTaskForm() {
    setTaskForm({ title: "", description: "" });
    setShowTaskForm(true);
  }

  function cancelNewTask() {
    setShowTaskForm(false);
  }

  function handleTaskSubmit(e) {
    e.preventDefault();
    const title = taskForm.title.trim();
    const description = taskForm.description.trim();

    if (!title) return;

    const newTask = {
      id: Date.now(),
      title,
      description,
    };

    const nextTasks = [...tasks, newTask];
    setTasks(nextTasks);
    saveTasksToStorage(projectId, nextTasks);
    setShowTaskForm(false);
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
      {/* Top bar */}
      <header className="project-detail-topbar">
        <button
          className="project-detail-back"
          onClick={() => navigate("/projects")}
        >
          ← Back to projects
        </button>
        <div className="project-detail-topbar__right">
          <button className="project-detail-topbar__icon-btn">
            🔔 Notifications
          </button>
          <button className="project-detail-topbar__icon-btn">👤 Profile</button>
        </div>
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

            <button
              className="project-detail-primary-btn"
              onClick={openNewTaskForm}
            >
              + New Task
            </button>

            {showTaskForm && (
              <form
                className="project-detail-task-form"
                onSubmit={handleTaskSubmit}
              >
                <input
                  type="text"
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                />
                <textarea
                  placeholder="Short description..."
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                />
                <div className="project-detail-task-form-actions">
                  <button type="button" onClick={cancelNewTask}>
                    Cancel
                  </button>
                  <button type="submit">Add task</button>
                </div>
              </form>
            )}

            {tasks.length === 0 ? (
              <div className="project-detail-placeholder">
                <p>No tasks yet. Create the first one.</p>
              </div>
            ) : (
              <ul className="project-detail-task-list">
                {tasks.map((t) => (
                  <li key={t.id} className="project-detail-task-item">
                    <strong>{t.title}</strong>
                    {t.description && (
                      <span className="project-detail-task-desc">
                        {" "}
                        — {t.description}
                      </span>
                    )}
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
    </div>
  );
}