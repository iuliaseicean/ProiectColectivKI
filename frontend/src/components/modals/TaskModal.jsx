import { useEffect, useRef, useState } from "react";
import "./Modal.css";

export default function TaskModal({ open, onClose, onSave, initialTask, projectId }) {
  if (!open) return null;
  return (
    <TaskModalInner
      open={open}
      onClose={onClose}
      onSave={onSave}
      initialTask={initialTask}
      projectId={projectId}
    />
  );
}

function TaskModalInner({ open, onClose, onSave, initialTask, projectId }) {
  const dialogRef = useRef(null);
  const firstInputRef = useRef(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [complexity, setComplexity] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setSaving(false);

    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setPriority((initialTask.priority || "medium").toLowerCase());
      setComplexity((initialTask.complexity || "medium").toLowerCase());
      setAssignee(initialTask.assignee ?? "");
      setTags(initialTask.tags ?? "");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setComplexity("medium");
      setAssignee("");
      setTags("");
    }

    // focus first input
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [initialTask, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Title is required.");
      return;
    }

    try {
      setSaving(true);

      await onSave({
        title: cleanTitle,
        description: description.trim(),
        projectId,
        priority,
        complexity,
        assignee: assignee.trim(),
        tags: tags.trim(),
      });

      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="modal-box"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">{initialTask ? "Edit" : "Create"}</div>
            <h2 id="task-modal-title">{initialTask ? "Edit Task" : "New Task"}</h2>
          </div>

          <button
            type="button"
            className="modal-icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-grid">
            <label className="modal-field modal-col-2">
              <span>Title</span>
              <input
                ref={firstInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Implement auth middleware"
              />
            </label>

            <label className="modal-field modal-col-2">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs to be done? Include details, edge cases, acceptance criteria..."
              />
            </label>

            <label className="modal-field">
              <span>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="modal-field">
              <span>Complexity</span>
              <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="modal-field">
              <span>Assignee</span>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. Daria"
              />
            </label>

            <label className="modal-field">
              <span>Tags</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. ui, backend"
              />
            </label>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}