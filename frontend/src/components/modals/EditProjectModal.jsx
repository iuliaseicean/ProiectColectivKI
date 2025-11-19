import "./Modal.css";

export default function EditProjectModal({ isOpen, onClose, project, onSubmit }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Edit Project</h2>

        <label>Name</label>
        <input type="text" defaultValue={project?.name} />

        <label>Description</label>
        <textarea defaultValue={project?.description} />

        <label>Start date</label>
        <input type="date" defaultValue={project?.start_date?.slice(0,10)} />

        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn-cancel">Cancel</button>
          <button onClick={onSubmit} className="modal-btn-confirm">Save</button>
        </div>
      </div>
    </div>
  );
}

