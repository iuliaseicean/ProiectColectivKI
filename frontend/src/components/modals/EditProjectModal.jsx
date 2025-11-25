// frontend/src/components/modals/EditProjectModal.jsx
import "./Modal.css";

export default function EditProjectModal({ project, isOpen, onClose, onSave }) {
  if (!isOpen || !project) return null;

  const [form, setForm] = React.useState({
    name: project.name || "",
    description: project.description || "",
    tech_stack: project.tech_stack || "",
    infrastructure: project.infrastructure || "",
    members_count: project.members_count ?? 0,
    start_date: project.start_date ? project.start_date.slice(0, 10) : "",
  });

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setForm({
      name: project.name || "",
      description: project.description || "",
      tech_stack: project.tech_stack || "",
      infrastructure: project.infrastructure || "",
      members_count: project.members_count ?? 0,
      start_date: project.start_date ? project.start_date.slice(0, 10) : "",
    });
    setError("");
    setSaving(false);
  }, [project]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        tech_stack: form.tech_stack.trim() || null,
        infrastructure: form.infrastructure.trim() || null,
        members_count: Number(form.members_count) || 0,
        start_date: form.start_date
          ? new Date(form.start_date).toISOString()
          : null,
      };

      const updated = await onSave(payload); // onSave va chema updateProject
      if (updated) {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Edit project</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label">
            Name *
            <input
              className="modal-input"
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </label>

          <label className="modal-label">
            Description
            <textarea
              className="modal-textarea"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>

          <label className="modal-label">
            Tech stack
            <input
              className="modal-input"
              type="text"
              placeholder="React, FastAPI, PostgreSQL..."
              value={form.tech_stack}
              onChange={(e) =>
                setForm((f) => ({ ...f, tech_stack: e.target.value }))
              }
            />
          </label>

          <label className="modal-label">
            Infrastructure
            <input
              className="modal-input"
              type="text"
              placeholder="Render, AWS, Docker..."
              value={form.infrastructure}
              onChange={(e) =>
                setForm((f) => ({ ...f, infrastructure: e.target.value }))
              }
            />
          </label>

          <label className="modal-label">
            Members
            <input
              className="modal-input"
              type="number"
              min="0"
              value={form.members_count}
              onChange={(e) =>
                setForm((f) => ({ ...f, members_count: e.target.value }))
              }
            />
          </label>

          <label className="modal-label">
            Start date
            <input
              className="modal-input"
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_date: e.target.value }))
              }
            />
          </label>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn-cancel"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="modal-btn-confirm" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
