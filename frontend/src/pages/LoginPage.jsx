import { useState } from "react";
import "./LoginPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoginSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid credentials");
      }

      const data = await res.json();

      // 1) Save token
      const token = data.access_token;
      localStorage.setItem("token", token);
      localStorage.setItem("access_token", token); // optional, pt compatibilitate

      // 2) Get user (din login response sau /auth/me)
      let user = data.user;

      if (!user) {
        const meRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          const meData = await meRes.json().catch(() => ({}));
          throw new Error(meData.detail || "Failed to fetch user profile (/auth/me)");
        }

        user = await meRes.json();
      }

      // 3) Save user + user_id for X-User-Id header logic
      if (user?.id != null) {
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("user_id", String(user.id));
      } else {
        // dacă backend-ul nu trimite id, atunci trebuie fixat în /auth/me sau /auth/login
        throw new Error("Login succeeded, but user.id is missing. Fix backend to return user id.");
      }

      setLoginSuccess("You are now logged in! 🎉");

      // notify parent
      if (onLoginSuccess) onLoginSuccess(token, user);

      // redirect
      setTimeout(() => (window.location.href = "/"), 400);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="title">Smart Project Management Platform</h2>
        <p className="subtitle">
          Welcome back 👋 <br /> Login to manage your projects efficiently
        </p>

        <form onSubmit={handleLogin} className="login-form">
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        {loginSuccess && <p className="success">{loginSuccess}</p>}

        <div className="links">
          <a href="/forgot-password">Forgot password?</a>
          <a href="/register">Don’t have an account? Register</a>
        </div>
      </div>
    </div>
  );
}