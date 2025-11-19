import "./Modal.css";

export default function CreateProjectModal({ isOpen, onClose, onSubmit }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Create Project</h2>

        <label>Name</label>
        <input type="text" placeholder="Project name" />

        <label>Description</label>
        <textarea placeholder="Short description..." />

        <label>Start date</label>
        <input type="date" />

        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn-cancel">Cancel</button>
          <button onClick={onSubmit} className="modal-btn-confirm">Create</button>
        </div>
      </div>
    </div>
  );
}
