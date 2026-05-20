import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function BookingsPage() {
  const [current, setCurrent] = useState([]);
  const [past,    setPast]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [paying, setPaying]       = useState({});
  const [payResult, setPayResult] = useState({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const [c, p] = await Promise.all([
        api('/booking/current'),
        api('/booking/past'),
      ]);
      setCurrent(c.bookings);
      setPast(p.bookings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function pay(bookingId) {
    setPaying((s) => ({ ...s, [bookingId]: true }));
    setPayResult((s) => ({ ...s, [bookingId]: null }));
    try {
      const data = await api('/payment/pay', {
        method: 'POST',
        body:   { bookingId },
      });
      setPayResult((s) => ({
        ...s,
        [bookingId]: { ok: true, message: 'Paid!', payment: data.payment },
      }));
      setTimeout(load, 800);
    } catch (err) {
      setPayResult((s) => ({ ...s, [bookingId]: { ok: false, message: err.message } }));
    } finally {
      setPaying((s) => ({ ...s, [bookingId]: false }));
    }
  }

  if (loading) return <p>Loading bookings…</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Bookings</h1>
        <Link to="/bookings/new" className="btn-primary">+ New booking</Link>
      </div>

      <h2>Upcoming ({current.length})</h2>
      {current.length === 0 && <p className="muted">No upcoming bookings.</p>}
      <div className="cards">
        {current.map((b) => (
          <BookingCard key={b.id} booking={b}
                       onPay={pay}
                       paying={paying[b.id]}
                       result={payResult[b.id]} />
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Past ({past.length})</h2>
      {past.length === 0 && <p className="muted">No past bookings.</p>}
      <div className="cards">
        {past.map((b) => <BookingCard key={b.id} booking={b} />)}
      </div>
    </div>
  );
}

function BookingCard({ booking, onPay, paying, result }) {
  const dt = new Date(booking.dateTime);
  const start = booking.startingLocation;
  const end   = booking.endingLocation;

  return (
    <div className="card">
      <div className="card-header">
        <span className={`badge badge-${booking.status}`}>{booking.status}</span>
        <span className="card-when">{dt.toLocaleString()}</span>
      </div>
      <div className="card-body">
        <div className="trip-line">
          <strong>{start.name || `${start.latitude}, ${start.longitude}`}</strong>
          <span> → </span>
          <strong>{end.name || `${end.latitude}, ${end.longitude}`}</strong>
        </div>
        <div className="muted small">
          {booking.cabType} · {booking.numberOfPassengers} passenger(s)
        </div>
      </div>
      {onPay && booking.status === 'pending' && (
        <div className="card-footer">
          <button className="btn-primary" disabled={paying}
                  onClick={() => onPay(booking.id)}>
            {paying ? 'Processing…' : 'Pay now'}
          </button>
          {result && !result.ok && <p className="error">{result.message}</p>}
          {result && result.ok && result.payment && (
            <p className="success">
              Paid {result.payment.amount.toFixed(2)} {result.payment.currency}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
