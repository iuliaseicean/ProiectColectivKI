// frontend/src/components/ProjectCard.jsx
import { useNavigate } from "react-router-dom";
import "./ProjectCard.css";

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();

  const members = project.members_count ?? 0;
  const techStack = project.tech_stack || "n/a";
  const lastUpdated = project.updated_at || project.created_at;

  return (
    <div className="project-card">
      <h3 className="project-card__title">{project.name}</h3>

      <p className="project-card__description">
        {project.description || "No description yet."}
      </p>

      <div className="project-card__meta">
        <div className="project-card__meta-row">
          <span className="project-card__meta-icon">👥</span>
          <span>{members} Members</span>
        </div>
        <div className="project-card__meta-row">
          <span className="project-card__meta-icon">⚙</span>
          <span>Tech stack: {techStack}</span>
        </div>
      </div>

      <div className="project-card__progress">
        <div className="project-card__progress-bar" style={{ width: "0%" }} />
      </div>

      <div className="project-card__progress-label">
        0% of planned work completed
      </div>

      <div className="project-card__footer">
        <span className="project-card__updated">
          Last updated:{" "}
          {lastUpdated
            ? new Date(lastUpdated).toLocaleDateString()
            : "-"}
        </span>

        <div className="project-card__buttons">
          <button
            className="project-card__button"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            View Project
          </button>

          <button
            className="project-card__button project-card__button--delete"
            onClick={() => onDelete && onDelete(project.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
