import "./Modal.css";

export default function DeleteProjectModal({ isOpen, onClose, onDelete }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Delete Project</h2>
        <p>Are you sure you want to delete this project?</p>

        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn-cancel">Cancel</button>
          <button onClick={onDelete} className="modal-btn-delete">Delete</button>
        </div>
      </div>
    </div>
  );
}
