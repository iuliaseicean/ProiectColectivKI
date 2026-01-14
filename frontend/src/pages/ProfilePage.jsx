// frontend/src/pages/ProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchProjects } from "../api/projectService";
import NotificationsBell from "../components/notifications/NotificationsBell";

import "./ProfilePage.css";

const PREFS_KEY_PREFIX = "pcai_profile_prefs_";

function loadPrefs(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePrefs(key, prefs) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export default function ProfilePage({ user, onLogout }) {
  const navigate = useNavigate();

  // ------------ USER DISPLAY ------------
  const displayName = user?.username || user?.name || user?.email || "Your account";
  const email = user?.email || "";
  const avatarLetter = (displayName || "U").charAt(0).toUpperCase();

  // ✅ IMPORTANT: cheie stabilă -> prefer user.id
  const storageKey = useMemo(() => {
    if (user?.id != null) return `${PREFS_KEY_PREFIX}id_${user.id}`;
    if (user?.email) return `${PREFS_KEY_PREFIX}${user.email}`;
    return null; // încă nu avem user stabil -> NU citim/scriem nimic
  }, [user?.id, user?.email]);

  // ------------ STATE: projects count ------------
  const [projectsCount, setProjectsCount] = useState(null);
  const [projectsError, setProjectsError] = useState("");

  // ------------ STATE: preferences (localStorage) ------------
  const [preferredStack, setPreferredStack] = useState("React, FastAPI");
  const [joinedAt, setJoinedAt] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // ✅ flag: nu salvăm până nu am încărcat prefs prima dată
  const [prefsReady, setPrefsReady] = useState(false);

  // UI state pentru editarea stack-ului
  const [isEditingStack, setIsEditingStack] = useState(false);
  const [stackDraft, setStackDraft] = useState("");

  // ------------ LOAD DATA ON MOUNT ------------
  useEffect(() => {
    (async () => {
      try {
        const projects = await fetchProjects();
        setProjectsCount(Array.isArray(projects) ? projects.length : 0);
      } catch (err) {
        setProjectsError(err?.message || "Failed to load projects.");
      }
    })();
  }, []);

  // ✅ LOAD PREFS when storageKey becomes available / changes (user loaded)
  useEffect(() => {
    if (!storageKey) return;

    const stored = loadPrefs(storageKey);

    if (stored) {
      if (stored.preferredStack) setPreferredStack(stored.preferredStack);
      if (stored.joinedAt) setJoinedAt(stored.joinedAt);

      if (typeof stored.aiSuggestions === "boolean") setAiSuggestions(stored.aiSuggestions);
      else setAiSuggestions(true);

      if (typeof stored.emailNotifications === "boolean")
        setEmailNotifications(stored.emailNotifications);
      else setEmailNotifications(false);

      // dacă lipsește joinedAt în storage, îl setăm o singură dată
      if (!stored.joinedAt) {
        const now = new Date().toISOString();
        setJoinedAt(now);
        savePrefs(storageKey, { ...stored, joinedAt: now });
      }
    } else {
      // dacă nu există nimic salvat, inițializăm o singură dată
      const now = new Date().toISOString();
      const initialPrefs = {
        preferredStack: "React, FastAPI",
        aiSuggestions: true,
        emailNotifications: false,
        joinedAt: now,
      };

      setPreferredStack(initialPrefs.preferredStack);
      setAiSuggestions(initialPrefs.aiSuggestions);
      setEmailNotifications(initialPrefs.emailNotifications);
      setJoinedAt(initialPrefs.joinedAt);

      savePrefs(storageKey, initialPrefs);
    }

    setPrefsReady(true);
  }, [storageKey]);

  // ✅ SAVE PREFS (doar după ce au fost încărcate)
  useEffect(() => {
    if (!storageKey) return;
    if (!prefsReady) return;

    const prefs = { preferredStack, aiSuggestions, emailNotifications, joinedAt };
    savePrefs(storageKey, prefs);

    // ✅ ajută ProjectDetailPage să se actualizeze în același tab
    // (storage event nu pornește în același tab, așa că emitem un event custom)
    window.dispatchEvent(new CustomEvent("pcai:prefs-changed", { detail: { key: storageKey, prefs } }));
  }, [preferredStack, aiSuggestions, emailNotifications, joinedAt, storageKey, prefsReady]);

  // ------------ HANDLERS ------------
  function handleStartEditStack() {
    setStackDraft(preferredStack);
    setIsEditingStack(true);
  }

  function handleCancelEditStack() {
    setIsEditingStack(false);
    setStackDraft("");
  }

  function handleSaveStack() {
    const trimmed = stackDraft.trim();
    if (!trimmed) return;
    setPreferredStack(trimmed);
    setIsEditingStack(false);
  }

  const joinedLabel = joinedAt ? new Date(joinedAt).toLocaleDateString() : "Not available";

  const projectsLabel =
    projectsCount == null ? "Loading…" : projectsError ? "Error" : projectsCount;

  return (
    <div className="profile-layout">
      {/* Top bar */}
      <header className="profile-topbar">
        <button className="profile-back" onClick={() => navigate("/projects")} type="button">
          ← Back to projects
        </button>

        <div className="profile-topbar-right">
          <NotificationsBell userId={user?.id} />

          <button className="profile-topbar-btn profile-topbar-active" type="button">
            👤 Profile
          </button>
        </div>
      </header>

      {/* Conținut principal */}
      <main className="profile-main">
        <section className="profile-card">
          {/* Header cu avatar + nume */}
          <div className="profile-header">
            <div className="profile-avatar">{avatarLetter}</div>
            <div>
              <h1 className="profile-name">{displayName}</h1>
              <p className="profile-email">{email || "—"}</p>
            </div>
          </div>

          {/* Detalii cont */}
          <div className="profile-section">
            <h3>Account details</h3>
            <div className="profile-grid">
              <div>
                <h4>Role</h4>
                <p>{user?.role || "Project member"}</p>
              </div>
              <div>
                <h4>Joined</h4>
                <p>{joinedLabel}</p>
              </div>
              <div>
                <h4>Projects</h4>
                <p>{projectsLabel}</p>
              </div>
              <div>
                <h4>Preferred stack</h4>

                {!isEditingStack ? (
                  <div className="profile-stack-row">
                    <p>{preferredStack}</p>
                    <button type="button" className="profile-link-btn" onClick={handleStartEditStack}>
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="profile-stack-edit">
                    <input
                      type="text"
                      value={stackDraft}
                      onChange={(e) => setStackDraft(e.target.value)}
                      placeholder="e.g. React, FastAPI, PostgreSQL"
                    />
                    <div className="profile-stack-edit-actions">
                      <button type="button" onClick={handleCancelEditStack}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleSaveStack}>
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preferințe */}
          <div className="profile-section">
            <h3>Preferences</h3>

            <div className="profile-settings">
              <div className="profile-setting-row">
                <div>
                  <strong>AI suggestions</strong>
                  <p className="profile-muted">Allow AI to suggest task descriptions and estimates.</p>
                </div>

                <button
                  type="button"
                  className={aiSuggestions ? "profile-pill profile-pill-on" : "profile-pill profile-pill-off"}
                  onClick={() => setAiSuggestions((v) => !v)}
                  disabled={!storageKey} // dacă nu avem user stabil
                  title={!storageKey ? "User not loaded yet" : ""}
                >
                  {aiSuggestions ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="profile-setting-row">
                <div>
                  <strong>Email notifications</strong>
                  <p className="profile-muted">
                    Receive a summary when project tasks change significantly.
                  </p>
                </div>

                <button
                  type="button"
                  className={emailNotifications ? "profile-pill profile-pill-on" : "profile-pill profile-pill-off"}
                  onClick={() => setEmailNotifications((v) => !v)}
                  disabled={!storageKey}
                  title={!storageKey ? "User not loaded yet" : ""}
                >
                  {emailNotifications ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="profile-section">
            <h3>About</h3>
            <p className="profile-muted">
              Preferences are stored locally in the browser. Later you can connect this to real backend settings.
            </p>
          </div>

          {/* Butoane jos */}
          <div className="profile-footer">
            <button className="profile-secondary-btn" onClick={() => navigate("/projects")} type="button">
              Back to projects
            </button>
            {onLogout && (
              <button className="profile-danger-btn" onClick={onLogout} type="button">
                Log out
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}