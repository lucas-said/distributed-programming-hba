import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    api('/payment/')
      .then((data) => setPayments(data.payments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading payments…</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Payments</h1>
      {payments.length === 0 && <p className="muted">No payments yet.</p>}
      <div className="cards">
        {payments.map((p) => <PaymentCard key={p.id} payment={p} />)}
      </div>
    </div>
  );
}

function PaymentCard({ payment }) {
  const dt = new Date(payment.createdAt);
  const b  = payment.breakdown;
  return (
    <div className="card">
      <div className="card-header">
        <span className="payment-amount">{payment.amount.toFixed(2)} {payment.currency}</span>
        <span className="card-when">{dt.toLocaleString()}</span>
      </div>
      <div className="card-body">
        <p className="muted small">Booking: {payment.bookingId}</p>
        <details>
          <summary>How was this calculated?</summary>
          <table className="breakdown">
            <tbody>
              <tr><td>Base fare</td>     <td>{b.cab_fare.toFixed(2)}</td></tr>
              <tr><td>× Cab type</td>    <td>{b.cab_multiplier}</td></tr>
              <tr><td>× Time of day</td> <td>{b.daytime_multiplier}</td></tr>
              <tr><td>× Passengers</td>  <td>{b.passengers_multiplier}</td></tr>
              <tr><td>× Discount</td>    <td>{b.discount}</td></tr>
              <tr className="total"><td>Total</td><td>{b.total.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}
