// src/components/tasks/TaskCard.jsx
export default function TaskCard({ task, onEdit, onDelete, onChangeStatus }) {
  const statusLabel = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  }[task.status] || task.status;

  return (
    <div className="task-card">
      <div className="task-card-header">
        <div>
          <strong>{task.title}</strong>
          {task.description && (
            <p className="task-card-description">{task.description}</p>
          )}
        </div>
        <span className={`task-status task-status-${task.status}`}>
          {statusLabel}
        </span>
      </div>

      <div className="task-card-footer">
        <select
          className="task-status-select"
          value={task.status}
          onChange={(e) => onChangeStatus(task, e.target.value)}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="task-card-actions">
          <button onClick={() => onEdit(task)}>Edit</button>
          <button onClick={() => onDelete(task)}>Delete</button>
        </div>
      </div>
    </div>
  );
}
