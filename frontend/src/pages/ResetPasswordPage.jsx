import { useMemo, useState } from "react";
import { resetPassword } from "../api/authService";
import { useLocation } from "react-router-dom";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPasswordPage() {
  const q = useQuery();
  const token = q.get("token") || "";

  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await resetPassword(token, newPass, confirm);
      setMsg(res.message || "Password updated. You can login now.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <p style={{ margin: "4rem auto", maxWidth: 420 }}>Missing token.</p>;

  return (
    <div style={{ maxWidth: 420, margin: "4rem auto" }}>
      <h2>Reset password</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          placeholder="New password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button disabled={loading}>
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>

      {msg && <p style={{ color: "green", marginTop: 12 }}>{msg}</p>}
      {err && <p style={{ color: "tomato", marginTop: 12 }}>{err}</p>}
    </div>
  );
}
