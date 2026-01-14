// frontend/src/pages/ProjectDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchProjectById,
  updateProject,
  createProjectSummary,
} from "../api/projectService";

import {
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  estimateTaskEffort,
  generateDescriptionsForProject,
} from "../api/taskService";

import TaskModal from "../components/modals/TaskModal";
import ConfirmDeleteModal from "../components/modals/ConfirmDeleteModal";

import "./ProjectDetailPage.css";

const PREFS_KEY_PREFIX = "pcai_profile_prefs_";

function safeLoadPrefs(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getPrefsKeyForUser(user) {
  if (user?.id != null) return `${PREFS_KEY_PREFIX}id_${user.id}`;
  if (user?.email) return `${PREFS_KEY_PREFIX}${user.email}`;
  return null;
}

export default function ProjectDetailPage({ user }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ✅ AI enabled (from Profile prefs)
  const [aiEnabled, setAiEnabled] = useState(true);

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
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [sortBy, setSortBy] = useState("created_at");

  // task modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // AI state
  const [aiScope, setAiScope] = useState("open"); // open | all | selected
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiMessageType, setAiMessageType] = useState("error"); // error | success | info

  // Summary UI
  const [projectSummary, setProjectSummary] = useState("");

  function setAiFeedback(type, msg) {
    setAiMessageType(type);
    setAiMessage(msg);
  }

  const aiFeedbackClass =
    aiMessageType === "success"
      ? "project-detail-ai-feedback project-detail-ai-feedback--success"
      : aiMessageType === "info"
      ? "project-detail-ai-feedback project-detail-ai-feedback--info"
      : "project-detail-ai-feedback project-detail-ai-feedback--error";

  // --------------------------------------------------
  // ✅ Load AI preference + listen for changes (same tab)
  // --------------------------------------------------
  useEffect(() => {
    const key = getPrefsKeyForUser(user);

    function applyPrefs() {
      if (!key) return;
      const prefs = safeLoadPrefs(key);
      if (prefs && typeof prefs.aiSuggestions === "boolean") {
        setAiEnabled(prefs.aiSuggestions);
      } else {
        setAiEnabled(true);
      }
    }

    applyPrefs();

    function onPrefsChanged(e) {
      const eventKey = e?.detail?.key;
      if (key && eventKey && eventKey !== key) return;

      applyPrefs();

      const prefs = key ? safeLoadPrefs(key) : null;
      if (prefs && prefs.aiSuggestions === false) {
        setAiBusy(false);
        setAiMessage("");
        setProjectSummary("");
        setAiScope("open");
        setSelectedTaskIds(new Set());
      }
    }

    window.addEventListener("pcai:prefs-changed", onPrefsChanged);
    window.addEventListener("storage", applyPrefs);

    return () => {
      window.removeEventListener("pcai:prefs-changed", onPrefsChanged);
      window.removeEventListener("storage", applyPrefs);
    };
  }, [user]);

  // --------------------------------------------------
  // Load project
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // ✅ IMPORTANT: când se schimbă proiectul, golim task-urile imediat
    setTasks([]);
    setTasksError("");
    setTasksLoading(false);
    setSelectedTaskIds(new Set());

    setIsTaskModalOpen(false);
    setEditingTask(null);
    setIsDeleteOpen(false);
    setTaskToDelete(null);

    setAiScope("open");
    setAiMessage("");
    setAiBusy(false);
    setProjectSummary("");

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
        if (!cancelled) setLoadError(err.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // --------------------------------------------------
  // Load tasks (safe against stale projectId)
  // --------------------------------------------------
  async function loadTasks(pid) {
    if (!pid) return;

    try {
      setTasksLoading(true);
      setTasksError("");

      const data = await getTasksByProject(Number(pid));
      const arr = Array.isArray(data) ? data : data?.items ?? [];

      const normalized = arr.map((t) => ({
        ...t,
        status: (t.status || "todo").toLowerCase(),
        priority: t.priority ? String(t.priority).toLowerCase() : "medium",
        complexity: t.complexity ? String(t.complexity).toLowerCase() : "medium",
        assignee: t.assignee ?? "",
        tags: t.tags ?? "",
        story_points:
          t.story_points !== undefined && t.story_points !== null
            ? t.story_points
            : t.estimated_story_points ?? null,
      }));

      setTasks(normalized);

      setSelectedTaskIds((prev) => {
        const next = new Set();
        const valid = new Set(normalized.map((t) => t.id));
        prev.forEach((id) => {
          if (valid.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err) {
      console.error(err);
      setTasksError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load tasks"
      );
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const pid = projectId;

    (async () => {
      // ✅ dacă user-ul schimbă proiectul rapid, evităm să setăm tasks pentru alt pid
      try {
        setTasksLoading(true);
        setTasksError("");

        const data = await getTasksByProject(Number(pid));
        if (cancelled) return;

        const arr = Array.isArray(data) ? data : data?.items ?? [];
        const normalized = arr.map((t) => ({
          ...t,
          status: (t.status || "todo").toLowerCase(),
          priority: t.priority ? String(t.priority).toLowerCase() : "medium",
          complexity: t.complexity ? String(t.complexity).toLowerCase() : "medium",
          assignee: t.assignee ?? "",
          tags: t.tags ?? "",
          story_points:
            t.story_points !== undefined && t.story_points !== null
              ? t.story_points
              : t.estimated_story_points ?? null,
        }));

        setTasks(normalized);
        setSelectedTaskIds((prev) => {
          const next = new Set();
          const valid = new Set(normalized.map((t) => t.id));
          prev.forEach((id) => {
            if (valid.has(id)) next.add(id);
          });
          return next;
        });
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setTasksError(
            err?.response?.data?.detail ||
              err?.response?.data?.message ||
              err?.message ||
              "Failed to load tasks"
          );
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // --------------------------------------------------
  // Project edit handlers
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
  // Task sorting
  // --------------------------------------------------
  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      let aVal = a?.[sortBy];
      let bVal = b?.[sortBy];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
    return copy;
  }, [tasks, sortBy]);

  // --------------------------------------------------
  // Task modal handlers
  // --------------------------------------------------
  function openNewTaskModal() {
    setTasksError("");
    setEditingTask(null);
    setIsTaskModalOpen(true);
  }

  function openEditTask(task) {
    setTasksError("");
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }

  async function handleSaveTask({
    title,
    description,
    projectId: pidFromModal,
    priority,
    complexity,
    assignee,
    tags,
  }) {
    try {
      setTasksError("");

      const payload = { title, description, priority, complexity, assignee, tags };

      if (editingTask) {
        await updateTask(editingTask.id, payload);
      } else {
        await createTask({
          ...payload,
          projectId: pidFromModal ?? Number(projectId),
        });
      }

      setIsTaskModalOpen(false);
      setEditingTask(null);
      await loadTasks(projectId);
    } catch (err) {
      console.error(err);
      setTasksError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save task"
      );
    }
  }

  async function handleChangeStatus(task, status) {
    try {
      setTasksError("");
      await updateTaskStatus(task.id, status);
      await loadTasks(projectId);
    } catch (err) {
      console.error(err);
      setTasksError(err?.message || "Failed to update task status");
    }
  }

  function askDeleteTask(task) {
    setTasksError("");
    setTaskToDelete(task);
    setIsDeleteOpen(true);
  }

  async function confirmDeleteTask() {
    try {
      setTasksError("");
      if (taskToDelete) await deleteTask(taskToDelete.id);

      setTaskToDelete(null);
      setIsDeleteOpen(false);

      await loadTasks(projectId);
    } catch (err) {
      console.error(err);
      setTasksError(err?.message || "Failed to delete task");
    }
  }

  // --------------------------------------------------
  // AI helpers
  // --------------------------------------------------
  function getScopedTasks() {
    if (aiScope === "all") return tasks;

    if (aiScope === "selected") {
      const ids = selectedTaskIds;
      return tasks.filter((t) => ids.has(t.id));
    }

    return tasks.filter((t) => (t.status || "todo") !== "done");
  }

  function toggleSelectedTask(taskId) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function selectAllVisible() {
    const visible = getScopedTasks();
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      visible.forEach((t) => next.add(t.id));
      return next;
    });
    setAiScope("selected");
    setAiFeedback("info", `Selected ${visible.length} tasks.`);
  }

  function clearSelection() {
    setSelectedTaskIds(new Set());
    setAiScope("open");
    setAiMessage("");
    setProjectSummary("");
  }

  const scopeTasks = getScopedTasks();
  const scopeCount = scopeTasks.length;

  // --------------------------------------------------
  // AI: Estimate story points
  // --------------------------------------------------
  async function handleEstimateStoryPoints() {
    if (!scopeTasks.length) {
      setAiFeedback("error", "No tasks in the selected scope.");
      return;
    }
    if (aiScope === "selected" && selectedTaskIds.size === 0) {
      setAiFeedback("error", "Scope is 'Selected' but no tasks are selected.");
      return;
    }

    setAiBusy(true);
    setAiMessage("");

    try {
      const scopeIds = new Set(scopeTasks.map((t) => t.id));

      const updated = await Promise.all(
        tasks.map(async (t) => {
          if (!scopeIds.has(t.id)) return t;
          if ((t.status || "todo") === "done") return t;

          try {
            const result = await estimateTaskEffort(t.id);
            const sp =
              result?.story_points !== undefined && result?.story_points !== null
                ? result.story_points
                : null;

            return { ...t, story_points: sp, estimated_story_points: sp };
          } catch {
            return t;
          }
        })
      );

      setTasks(updated);
      setAiFeedback("success", "Story points updated.");
    } catch (err) {
      console.error(err);
      setAiFeedback("error", "AI estimation failed for some tasks.");
    } finally {
      setAiBusy(false);
    }
  }

  // --------------------------------------------------
  // AI: Generate descriptions (batch)
  // --------------------------------------------------
  async function handleGenerateDescriptions() {
    if (!scopeTasks.length) {
      setAiFeedback("error", "No tasks in the selected scope.");
      return;
    }
    if (aiScope === "selected" && selectedTaskIds.size === 0) {
      setAiFeedback("error", "Scope is 'Selected' but no tasks are selected.");
      return;
    }

    setAiBusy(true);
    setAiMessage("");

    try {
      const taskIds = aiScope === "selected" ? scopeTasks.map((t) => t.id) : null;
      const includeDone = aiScope === "all";

      const updatedTasks = await generateDescriptionsForProject(projectId, {
        task_ids: taskIds,
        include_done: includeDone,
      });

      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        for (const u of updatedTasks) {
          const old = map.get(u.id) || {};
          map.set(u.id, {
            ...old,
            ...u,
            status: (u.status || old.status || "todo").toLowerCase(),
            priority: (u.priority || old.priority || "medium").toLowerCase(),
            complexity: (u.complexity || old.complexity || "medium").toLowerCase(),
            assignee: u.assignee ?? old.assignee ?? "",
            tags: u.tags ?? old.tags ?? "",
            story_points:
              u.story_points !== undefined && u.story_points !== null
                ? u.story_points
                : u.estimated_story_points ?? old.story_points ?? null,
          });
        }
        return Array.from(map.values());
      });

      setAiFeedback("success", `Generated descriptions for ${updatedTasks.length} task(s).`);
    } catch (err) {
      console.error(err);
      setAiFeedback("error", err?.message || "Failed to generate descriptions.");
    } finally {
      setAiBusy(false);
    }
  }

  // --------------------------------------------------
  // AI: Create project summary
  // --------------------------------------------------
  async function handleCreateProjectSummary() {
    if (!scopeTasks.length) {
      setAiFeedback("error", "No tasks in the selected scope.");
      return;
    }
    if (aiScope === "selected" && selectedTaskIds.size === 0) {
      setAiFeedback("error", "Scope is 'Selected' but no tasks are selected.");
      return;
    }

    setAiBusy(true);
    setAiMessage("");
    setProjectSummary("");

    try {
      const out = await createProjectSummary(projectId);
      const summaryText = out?.summary || out?.data?.summary || "";
      setProjectSummary(summaryText);
      setAiFeedback("success", "Project summary generated.");
    } catch (err) {
      console.error(err);
      setAiFeedback("error", err?.message || "Failed to create project summary.");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(projectSummary);
      setAiFeedback("success", "Summary copied to clipboard.");
    } catch {
      setAiFeedback("error", "Copy failed. Select the text and copy manually.");
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  if (loading) return <div className="project-detail-layout">Loading project...</div>;

  if (loadError || !project) {
    return (
      <div className="project-detail-layout">
        <div className="project-detail-error">
          <p>{loadError || "Project not found"}</p>
          <button className="btn" onClick={() => navigate("/projects")}>
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-detail-layout">
      <header className="project-detail-topbar">
        <button className="project-detail-back" onClick={() => navigate("/projects")}>
          ← Back to projects
        </button>
      </header>

      <main className="project-detail-main">
        {/* HEADER */}
        <section className="project-detail-header">
          <div className="project-detail-header-row">
            <div>
              <h1>{project.name}</h1>
            </div>

            {!isEditing && (
              <button className="project-detail-edit-btn" onClick={startEdit}>
                ✏ Edit details
              </button>
            )}
          </div>

          {isEditing ? (
            <form className="project-detail-edit-form" onSubmit={handleSave}>
              <label>
                Description
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>

              <label>
                Tech stack (comma-separated)
                <input
                  type="text"
                  value={editForm.tech_stack}
                  onChange={(e) => setEditForm((f) => ({ ...f, tech_stack: e.target.value }))}
                  placeholder="React, FastAPI, PostgreSQL"
                />
              </label>

              <label>
                Infrastructure
                <input
                  type="text"
                  value={editForm.infrastructure}
                  onChange={(e) => setEditForm((f) => ({ ...f, infrastructure: e.target.value }))}
                  placeholder="Docker + Render"
                />
              </label>

              <label>
                Members
                <input
                  type="number"
                  min="0"
                  value={editForm.members_count}
                  onChange={(e) => setEditForm((f) => ({ ...f, members_count: e.target.value }))}
                />
              </label>

              {saveError && <div className="project-detail-save-error">{saveError}</div>}

              <div className="project-detail-edit-actions">
                <button className="btn btn-ghost" type="button" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="project-detail-description">{project.description || "No description yet."}</p>

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
                  <p>{project.start_date ? new Date(project.start_date).toLocaleDateString() : "-"}</p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* COLUMNS */}
        <section className="project-detail-columns">
          {/* Tasks */}
          <div className="project-detail-column">
            <h2>Tasks</h2>

            <div className="project-detail-tasks-toolbar">
              <button className="btn btn-primary" onClick={openNewTaskModal}>
                + New Task
              </button>

              <div className="project-detail-tasks-sort">
                <span>Sort by&nbsp;</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="created_at">Created date</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            {tasksLoading && <p>Loading tasks…</p>}
            {tasksError && <p className="project-detail-save-error">{tasksError}</p>}

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
                        {t.description && <span className="project-detail-task-desc"> — {t.description}</span>}

                        <div className="project-detail-task-meta">
                          <span className={`meta-chip meta-${t.priority || "medium"}`}>
                            Priority: {t.priority || "—"}
                          </span>
                          <span className={`meta-chip meta-${t.complexity || "medium"}`}>
                            Complexity: {t.complexity || "—"}
                          </span>
                          <span className="meta-chip">Assignee: {t.assignee || "—"}</span>
                          <span className="meta-chip">Tags: {t.tags || "—"}</span>
                          {t.story_points !== undefined && t.story_points !== null && (
                            <span className="meta-chip">SP: {t.story_points}</span>
                          )}
                        </div>
                      </div>

                      <span className={`project-detail-task-status badge-${t.status}`}>{t.status}</span>
                    </div>

                    <div className="project-detail-task-actions">
                      <select value={t.status || "todo"} onChange={(e) => handleChangeStatus(t, e.target.value)}>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>

                      <button className="btn" onClick={() => openEditTask(t)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => askDeleteTask(t)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ✅ AI: render only when enabled */}
          <div className="project-detail-column">
            <h2>AI Assistant</h2>

            {!aiEnabled ? (
              <p className="project-detail-subtitle">
                AI suggestions are disabled in your Profile. Enable them to use AI tools.
              </p>
            ) : (
              <>
                <p className="project-detail-subtitle">Project-wide AI actions: run AI on tasks in this project.</p>

                <div className="project-detail-ai-controls">
                  <label style={{ fontWeight: 600 }}>Scope</label>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <select
                      value={aiScope}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAiScope(v);
                        setAiMessage("");
                        setProjectSummary("");
                        if (v !== "selected") setSelectedTaskIds(new Set());
                      }}
                      disabled={aiBusy}
                      style={{ flex: 1 }}
                    >
                      <option value="open">Open tasks (TODO / IN_PROGRESS)</option>
                      <option value="all">All tasks</option>
                      <option value="selected">Selected tasks</option>
                    </select>

                    <span style={{ fontSize: 12, color: "#666", fontWeight: 800, whiteSpace: "nowrap" }}>
                      {scopeCount} tasks
                    </span>
                  </div>
                </div>

                <div className="project-detail-ai-selection-actions">
                  <button type="button" onClick={selectAllVisible} disabled={aiBusy || tasks.length === 0}>
                    Select visible
                  </button>

                  <button type="button" onClick={clearSelection} disabled={aiBusy}>
                    Clear
                  </button>
                </div>

                {(aiScope === "selected" || selectedTaskIds.size > 0) && (
                  <div className="ai-selection">
                    <div className="ai-selection-head">
                      <div className="hint">Click tasks below to (un)select:</div>
                      <div className="hint" style={{ fontWeight: 800 }}>
                        Selected: {selectedTaskIds.size}
                      </div>
                    </div>

                    <div className="ai-task-checkboxes">
                      {sortedTasks.map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(t.id)}
                            onChange={() => toggleSelectedTask(t.id)}
                            disabled={aiBusy}
                          />
                          <span style={{ fontSize: 14, fontWeight: 800 }}>
                            {t.title}{" "}
                            <span style={{ color: "#777", fontWeight: 700 }}>({t.status})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessage && <div className={aiFeedbackClass}>{aiMessage}</div>}

                <div className="project-detail-ai-buttons">
                  <button onClick={handleGenerateDescriptions} disabled={aiBusy}>
                    {aiBusy ? "Working..." : "Generate task descriptions"}
                  </button>

                  <button onClick={handleEstimateStoryPoints} disabled={aiBusy}>
                    {aiBusy ? "Working..." : "Estimate story points"}
                  </button>

                  <button onClick={handleCreateProjectSummary} disabled={aiBusy}>
                    {aiBusy ? "Working..." : "Create project summary"}
                  </button>
                </div>

                {projectSummary && (
                  <div className="ai-summary">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>Project summary</strong>
                      <button className="btn btn-ghost" onClick={handleCopySummary} disabled={aiBusy} type="button">
                        Copy
                      </button>
                    </div>

                    <div style={{ marginTop: 10 }}>{projectSummary}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <TaskModal
        open={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        projectId={Number(projectId)}
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