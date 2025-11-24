// frontend/src/components/modals/CreateProjectModal.jsx
import { useState } from "react";
import "./Modal.css";

export default function CreateProjectModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    setError("");

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    setSaving(true);
    try {
      // trimite către ProjectsPage
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        start_date: new Date(startDate).toISOString(),
      });

      // reset după succes
      setName("");
      setDescription("");
      setStartDate("");
    } catch (e) {
      setError(e.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Create New Project</h2>

        <label>Project name *</label>
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Description</label>
        <textarea
          placeholder="Short description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label>Start date *</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn-cancel" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="modal-btn-confirm"
            disabled={saving}
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
