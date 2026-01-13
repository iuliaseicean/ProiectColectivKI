// Acest fisier gestioneaza toate cererile legate de autentificare:
//  - login
//  - verificarea utilizatorului curent (/me)
//  - manipularea tokenului JWT
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Trimite datele de autentificare catre backend si primeste tokenul JWT
export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Invalid credentials");
  }

  return await response.json(); // { access_token, token_type }
}

// Verifica datele utilizatorului curent folosind tokenul JWT din localStorage
export async function fetchMe() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not authorized");
  return await res.json();
}

/**
 * Register a new user.
 * Expects: { email, password, confirm_password }
 * Returns backend JSON on success, throws Error(detail) on failure.
 */
export async function registerUser(email, password, confirm_password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, confirm_password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    // backend might return { detail: "..." } or other shape
    throw new Error(data.detail || data.message || "Registration failed");
  }

  return await response.json(); // e.g. { message: "User registered successfully", email: ... }
}


export async function forgotPassword(email) {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to send reset email");
  }

  return await response.json();
}

export async function resetPassword(token, new_password, confirm_password) {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password, confirm_password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to reset password");
  }

  return await response.json();
}
