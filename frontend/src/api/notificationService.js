import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getNotifications(userId, limit = 30) {
  const { data } = await axios.get(`${API}/notifications`, {
    params: { user_id: userId, limit },
  });
  return data;
}

export async function getUnreadCount(userId) {
  const { data } = await axios.get(`${API}/notifications/unread_count`, {
    params: { user_id: userId },
  });
  return data?.unread ?? 0;
}

export async function markNotificationRead(userId, notificationId) {
  const { data } = await axios.post(
    `${API}/notifications/${notificationId}/read`,
    null,
    { params: { user_id: userId } }
  );
  return data;
}

export async function markAllRead(userId) {
  const { data } = await axios.post(`${API}/notifications/read_all`, null, {
    params: { user_id: userId },
  });
  return data;
}

export async function deleteNotification(userId, notificationId) {
  await axios.delete(`${API}/notifications/${notificationId}`, {
    params: { user_id: userId },
  });
}