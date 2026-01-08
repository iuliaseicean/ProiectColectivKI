import { useEffect, useState } from "react";

export default function TaskModal(props) {
  if (!props.open) return null; // ✅ nu există în DOM când e închis
  return <TaskModalInner {...props} />;
}

function TaskModalInner({ open, onClose, onSave, initialTask, projectId }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [priority, setPriority] = useState("medium");
  const [complexity, setComplexity] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setPriority(initialTask.priority || "medium");
      setComplexity(initialTask.complexity || "medium");
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
  }, [initialTask, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        projectId,
        priority,
        complexity,
        assignee: assignee.trim(),
        tags: tags.trim(),
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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

          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            Complexity
            <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            Assignee
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} required />
          </label>

          <label>
            Tags
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              required
              placeholder="e.g. ui,backend"
            />
          </label>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
