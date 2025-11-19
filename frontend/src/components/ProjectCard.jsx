// frontend/src/components/ProjectCard.jsx
import { useNavigate } from "react-router-dom";
import "./ProjectCard.css";

export default function ProjectCard({ project }) {
  const navigate = useNavigate();

  const progress = project.progress ?? 0; // dacă pe viitor adaugi câmp
  const lastUpdated = project.created_at
    ? new Date(project.created_at).toLocaleDateString()
    : "-";

  return (
    <div className="project-card">
      <h3 className="project-card__title">{project.name}</h3>

      <p className="project-card__description">
        {project.description || "No description yet."}
      </p>

      <div className="project-card__meta">
        <div>👥 {project.members ?? 0} Members</div>
        <div>⚙️ Tech stack: {project.techStack?.join(", ") || "n/a"}</div>
      </div>

      <div className="project-card__progress">
        <div
          className="project-card__progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="project-card__progress-label">
        {progress}% of planned work completed
      </div>

      <div className="project-card__footer">
        <span className="project-card__updated">
          Last updated: {lastUpdated}
        </span>
        <button
          className="project-card__button"
          onClick={() => navigate(`/projects/${project.id}`)}
        >
          View Project
        </button>
      </div>
    </div>
  );
}
