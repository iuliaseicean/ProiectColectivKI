import { useEffect, useRef } from "react";
import "./Modal.css";

export default function ConfirmDeleteModal({ open, onCancel, onConfirm }) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // focus Cancel by default (sa nu dai delete accidental)
    setTimeout(() => cancelBtnRef.current?.focus(), 0);

    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onCancel} role="presentation">
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: "min(520px, 96vw)" }}
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Danger zone</div>
            <h2 id="confirm-delete-title">Delete task</h2>
          </div>

          <button
            type="button"
            className="modal-icon-btn"
            onClick={onCancel}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          <p style={{ margin: 0, color: "rgba(0,0,0,0.78)", lineHeight: 1.5 }}>
            Are you sure you want to delete this task? This action can’t be undone.
          </p>

          <div className="modal-actions" style={{ paddingBottom: 18 }}>
            <button ref={cancelBtnRef} className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}