import { useState } from "react";
import { forgotPassword } from "../api/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await forgotPassword(email);
      setMsg(res.message || "Check your email for reset instructions.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "4rem auto" }}>
      <h2>Forgot password</h2>
      <p>Enter your email and we’ll send you a reset link.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {msg && <p style={{ color: "green", marginTop: 12 }}>{msg}</p>}
      {err && <p style={{ color: "tomato", marginTop: 12 }}>{err}</p>}
    </div>
  );
}
