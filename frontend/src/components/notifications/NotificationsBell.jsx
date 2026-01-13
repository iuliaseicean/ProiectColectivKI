import { useEffect, useRef, useState } from "react";
import "./Notifications.css";

import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
} from "../../api/notificationService";

export default function NotificationsBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function refresh() {
    if (!userId) return;

    try {
      const [list, count] = await Promise.all([
        getNotifications(userId, 30),
        getUnreadCount(userId),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(Number(count) || 0);
    } catch (e) {
      console.error("Notifications refresh failed:", e);
      // nu blocăm UI-ul dacă backend-ul nu răspunde
      setItems([]);
      setUnread(0);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000); // polling
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function onOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function onMarkAll() {
    if (!userId) return;
    try {
      await markAllRead(userId);
      await refresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function onMarkOne(id) {
    if (!userId) return;
    try {
      await markNotificationRead(userId, id);
      await refresh();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div ref={ref} className="notif">
      <button className="notif-btn" onClick={onOpen} type="button" title="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-popover">
          <div className="notif-head">
            <div className="notif-title">Notifications</div>
            <button className="notif-link" onClick={onMarkAll} type="button">
              Mark all read
            </button>
          </div>

          {!userId ? (
            <div className="notif-empty">Not logged in.</div>
          ) : items.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.is_read ? "" : "unread"}`}
                  onClick={() => onMarkOne(n.id)}
                  type="button"
                >
                  <div className="notif-item-title">{n.title}</div>
                  {n.message && <div className="notif-item-msg">{n.message}</div>}
                  <div className="notif-item-meta">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}