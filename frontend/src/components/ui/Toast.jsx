// frontend/src/components/ui/Toast.jsx
import "./Toast.css";

export default function Toast({ open, type = "error", message, onClose }) {
  if (!open) return null;

  return (
    <div className={`toast toast--${type}`} role="status" aria-live="polite">
      <div className="toast__content">
        <div className="toast__title">
          {type === "success" ? "Success" : "Error"}
        </div>
        <div className="toast__message">{message}</div>
      </div>

      <button className="toast__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}
