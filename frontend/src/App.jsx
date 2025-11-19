// frontend/src/App.jsx
import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [backendMessage, setBackendMessage] = useState("Checking backend...");

  // -------- BACKEND HEALTH CHECK ----------
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => res.json())
      .then((data) => setBackendMessage(data.message || "Backend OK ✅"))
      .catch(() => setBackendMessage("Backend unreachable ❌"));
  }, []);

  // -------- AUTOLOGIN / ME ----------
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          localStorage.removeItem("token");
          setToken("");
          setMe(null);
          return;
        }

        const data = await res.json();
        setMe(data);
      } catch {
        localStorage.removeItem("token");
        setToken("");
        setMe(null);
      }
    };

    fetchMe();
  }, [token]);

  function handleLogout() {
    localStorage.removeItem("token");
    setToken("");
    setMe(null);
  }

  // helper pentru onLoginSuccess – acceptă fie string, fie {access_token}
  function handleLoginSuccess(tok) {
    const accessToken = typeof tok === "string" ? tok : tok?.access_token;
    if (!accessToken) return;

    localStorage.setItem("token", accessToken);
    setToken(accessToken);
  }

  return (
    <Router>
      <>
        <Routes>
          {/* LOGIN */}
          <Route
            path="/login"
            element={
              token ? (
                <Navigate to="/projects" replace />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          {/* REGISTER */}
          <Route
            path="/register"
            element={
              token ? <Navigate to="/projects" replace /> : <RegisterPage />
            }
          />

          {/* MAIN: redirect / -> /projects când ești logat */}
          <Route
            path="/"
            element={
              token ? (
                <Navigate to="/projects" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* PROJECTS LIST (Project Screen) */}
          <Route
            path="/projects"
            element={
              token ? (
                <ProjectsPage user={me} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* PROJECT DETAIL (Project Cards Screen) */}
          <Route
            path="/projects/:projectId"
            element={
              token ? (
                <ProjectDetailPage user={me} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* fallback – orice altceva merge la /projects sau /login */}
          <Route
            path="*"
            element={
              token ? (
                <Navigate to="/projects" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>

        {/* mesaj mic cu status backend, vizibil peste tot */}
        <div
          style={{
            position: "fixed",
            bottom: 10,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 12,
            color: "#666",
            pointerEvents: "none",
          }}
        >
          {backendMessage}
        </div>
      </>
    </Router>
  );
}
