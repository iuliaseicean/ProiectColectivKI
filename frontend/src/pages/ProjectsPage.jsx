// frontend/src/pages/ProjectsPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchProjects,
  createProject,
  deleteProject,
} from "../api/projectService";
import ProjectCard from "../components/ProjectCard";
import "./ProjectsPage.css";

export default function ProjectsPage({ user /*, onLogout */ }) {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Nume / email afișat lângă iconița de profil
  const displayName =
    user?.username || user?.name || user?.email || "Profile";

  async function loadProjects() {
    try {
      setLoading(true);
      setLoadError("");
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setLoadError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function openCreateModal() {
    setForm({ name: "", description: "", start_date: "" });
    setCreateError("");
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (!saving) {
      setShowCreate(false);
      setCreateError("");
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateError("");

    if (!form.name.trim()) {
      setCreateError("Project name is required.");
      return;
    }
    if (!form.start_date) {
      setCreateError("Start date is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: new Date(form.start_date).toISOString(),
      };

      const newProject = await createProject(payload);

      setProjects((prev) => [newProject, ...prev]);

      setShowCreate(false);
      setForm({ name: "", description: "", start_date: "" });
    } catch (err) {
      setCreateError(err.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(projectId) {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      alert(err.message || "Failed to delete project");
    }
  }

  return (
    <div className="projects-layout">
      <header className="projects-topbar">
        <div
          className="projects-topbar__brand"
          onClick={() => navigate("/projects")}
          style={{ cursor: "pointer" }}
        >
          Smart Project Management
        </div>
        <div className="projects-topbar__right">
          <button className="projects-topbar__icon-btn">
            🔔 Notifications
          </button>

          {/* Profil – merge în pagina /profile */}
          <button
            className="projects-topbar__icon-btn"
            onClick={() => navigate("/profile")}
          >
            👤 {displayName}
          </button>
        </div>
      </header>

      <main className="projects-main">
        <section className="projects-header">
          <h1>Your Projects</h1>
          <p>
            Manage and track your project progress. Store technical details and
            use AI to generate better tasks.
          </p>
          <button className="projects-new-btn" onClick={openCreateModal}>
            + New Project
          </button>
        </section>

        <section className="projects-grid">
          {loading && <div className="projects-empty">Loading projects...</div>}

          {loadError && !loading && (
            <div className="projects-empty error">{loadError}</div>
          )}

          {!loading && !loadError && projects.length === 0 && (
            <div className="projects-empty">
              You don't have any projects yet. Click{" "}
              <b>+ New Project</b> to create one.
            </div>
          )}

          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
            />
          ))}
        </section>
      </main>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="projects-modal-backdrop" onClick={closeCreateModal}>
          <div
            className="projects-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Create New Project</h2>

            <form onSubmit={handleCreateSubmit} className="projects-modal-form">
              <label>
                Project name *
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>

              <label>
                Start date *
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                  required
                />
              </label>

              {createError && (
                <div className="projects-modal-error">{createError}</div>
              )}

              <div className="projects-modal-actions">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
