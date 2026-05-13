import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await api('/customer/notifications');
      setNotifications(data.notifications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api(`/customer/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p>Loading inbox…</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Inbox</h1>
        <button className="btn-link" onClick={load}>Refresh</button>
      </div>
      {notifications.length === 0 && <p className="muted">No notifications.</p>}
      <div className="notifications">
        {notifications.map((n) => (
          <div key={n.id} className={`notification ${n.read ? 'read' : 'unread'}`}>
            <div className="notification-head">
              <span className={`badge badge-${n.type}`}>{n.type.replace('_', ' ')}</span>
              <span className="card-when">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <h3>{n.title}</h3>
            {n.body && <p>{n.body}</p>}
            {!n.read && (
              <button className="btn-link" onClick={() => markRead(n.id)}>Mark as read</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
