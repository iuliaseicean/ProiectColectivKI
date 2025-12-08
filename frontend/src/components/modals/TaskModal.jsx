// src/components/modals/TaskModal.jsx
import { useEffect, useState } from "react";

export default function TaskModal({ open, onClose, onSave, initialTask, projectId }) {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ title, description, projectId });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{initialTask ? "Edit Task" : "New Task"}</h3>
        <form onSubmit={handleSubmit} className="modal-form">
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

