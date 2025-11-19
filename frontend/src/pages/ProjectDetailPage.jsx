// frontend/src/pages/ProjectDetailPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProjectById } from "../api/projectService";
import "./ProjectDetailPage.css";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchProjectById(projectId);
        if (!cancelled) setProject(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return <div className="project-detail-layout">Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div className="project-detail-layout">
        <div className="project-detail-error">
          <p>{error || "Project not found"}</p>
          <button onClick={() => navigate("/projects")}>
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-detail-layout">
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
        <section className="project-detail-header">
          <h1>{project.name}</h1>
          <p className="project-detail-description">
            {project.description || "No description yet."}
          </p>

          <div className="project-detail-info">
            <div>
              <h4>Tech stack</h4>
              <p>{project.techStack?.join(", ") || "n/a"}</p>
            </div>
            <div>
              <h4>Infrastructure</h4>
              <p>{project.infrastructure || "n/a"}</p>
            </div>
            <div>
              <h4>Members</h4>
              <p>{project.members ?? 0}</p>
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
        </section>

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
              onClick={() => alert("TODO: open New Task modal")}
            >
              + New Task
            </button>

            <div className="project-detail-placeholder">
              <p>No tasks yet. Create the first one.</p>
            </div>
          </div>

          {/* AI Assistant column */}
          <div className="project-detail-column">
            <h2>AI Assistant</h2>
            <p className="project-detail-subtitle">
              The AI uses all existing tasks to improve descriptions, estimate
              story points and create project summaries.
            </p>

            <div className="project-detail-ai-buttons">
              <button onClick={() => alert("TODO: Generate task descriptions")}>
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
