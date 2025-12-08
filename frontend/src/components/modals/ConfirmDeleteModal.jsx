// src/components/modals/ConfirmDeleteModal.jsx
export default function ConfirmDeleteModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <p>Are you sure you want to delete this task?</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
