// src/components/tasks/TaskCard.jsx
import { useState } from "react";
import { estimateTaskEffort } from "../../api/taskService";

export default function TaskCard({ task, onEdit, onDelete, onChangeStatus }) {
  const statusLabel = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  }[task.status] || task.status;

  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimatedSP, setEstimatedSP] = useState(task.story_points || null);
  const [error, setError] = useState(null);

  const handleEstimateEffort = async () => {
    try {
      setLoadingEstimate(true);
      setError(null);

      // 🔹 Mock rapid pentru test vizual
      await new Promise((r) => setTimeout(r, 500)); // simulare delay
      const mockResult = { story_points: 5 };        // valoare mock
      setEstimatedSP(mockResult.story_points);

      // Dacă vrei backend real, folosește comentariul de mai jos:
      // const result = await estimateTaskEffort(task.id);
      // setEstimatedSP(result.story_points);

    } catch (err) {
      setError("Estimarea AI a eșuat");
    } finally {
      setLoadingEstimate(false);
    }
  };

  return (
    <div
      className="task-card"
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        borderRadius: "6px",
        marginBottom: "10px",
        backgroundColor: "#f9f9f9",
      }}
    >
      <div className="task-card-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <strong>{task.title}</strong>
          {task.description && (
            <p style={{ margin: "4px 0" }}>{task.description}</p>
          )}
        </div>

        <span
          className={`task-status task-status-${task.status}`}
          style={{
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor:
              task.status === "done"
                ? "#d1e7dd"
                : task.status === "in_progress"
                ? "#fff3cd"
                : "#f8d7da",
            color:
              task.status === "done"
                ? "#0f5132"
                : task.status === "in_progress"
                ? "#664d03"
                : "#842029",
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* 🔹 Estimare efort */}
      <div
        className="task-card-estimation"
        style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}
      >
        {estimatedSP !== null && (
          <span
            className="task-estimation-badge"
            title="Estimat automat de AI"
            style={{
              backgroundColor: "#d1e7dd",
              color: "#0f5132",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            SP: {estimatedSP}
          </span>
        )}

        <button
          onClick={handleEstimateEffort}
          disabled={loadingEstimate}
          style={{
            padding: "4px 8px",
            cursor: loadingEstimate ? "not-allowed" : "pointer",
          }}
        >
          {loadingEstimate ? "Se estimează..." : "Estimează efortul"}
        </button>

        {error && (
          <span
            className="task-estimation-error"
            style={{ color: "red", fontSize: "0.9em" }}
          >
            {error}
          </span>
        )}
      </div>

      {/* 🔹 Footer cu status + acțiuni */}
      <div className="task-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <select
          className="task-status-select"
          value={task.status}
          onChange={(e) => onChangeStatus(task, e.target.value)}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="task-card-actions" style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => onEdit(task)}>Edit</button>
          <button onClick={() => onDelete(task)}>Delete</button>
        </div>
      </div>
    </div>
  );
}
