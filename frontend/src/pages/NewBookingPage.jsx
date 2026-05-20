import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const CAB_TYPES = ['Economic', 'Premium', 'Executive'];

export default function NewBookingPage() {
  const [favourites, setFavourites] = useState([]);
  const [start,      setStart]      = useState({ name: '', latitude: '', longitude: '' });
  const [end,        setEnd]        = useState({ name: '', latitude: '', longitude: '' });
  const [dateTime,   setDateTime]   = useState(defaultDateTime());
  const [passengers, setPassengers] = useState(1);
  const [cabType,    setCabType]    = useState('Economic');
  const [estimate,   setEstimate]   = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    api('/location/').then((data) => setFavourites(data.favourites)).catch(() => {});
  }, []);

  function fillFromFavourite(slot, fav) {
    const target = slot === 'start' ? setStart : setEnd;
    target({ name: fav.name, latitude: String(fav.latitude), longitude: String(fav.longitude) });
  }

  async function getEstimate() {
    setEstimating(true);
    setError(null);
    try {
      const data = await api('/fare/estimate', {
        method: 'POST',
        body: {
          pickup:  { latitude: Number(start.latitude), longitude: Number(start.longitude) },
          dropoff: { latitude: Number(end.latitude),   longitude: Number(end.longitude) },
        },
      });
      setEstimate(data.estimate);
    } catch (err) {
      setError(err.message);
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/booking/', {
        method: 'POST',
        body: {
          startingLocation: { name: start.name, latitude: Number(start.latitude), longitude: Number(start.longitude) },
          endingLocation:   { name: end.name,   latitude: Number(end.latitude),   longitude: Number(end.longitude)   },
          dateTime: new Date(dateTime).toISOString(),
          numberOfPassengers: Number(passengers),
          cabType,
        },
      });
      navigate('/bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New booking</h1>
      <form onSubmit={submit} className="form">
        <fieldset>
          <legend>Pickup</legend>
          <LocationInputs slot="start" value={start} onChange={setStart}
                          favourites={favourites} onPick={(f) => fillFromFavourite('start', f)} />
        </fieldset>

        <fieldset>
          <legend>Drop-off</legend>
          <LocationInputs slot="end" value={end} onChange={setEnd}
                          favourites={favourites} onPick={(f) => fillFromFavourite('end', f)} />
        </fieldset>

        <div className="row">
          <label>
            <span>Date &amp; time</span>
            <input type="datetime-local" required
                   value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </label>
          <label>
            <span>Passengers</span>
            <input type="number" min={1} max={8} required
                   value={passengers} onChange={(e) => setPassengers(e.target.value)} />
          </label>
          <label>
            <span>Cab type</span>
            <select value={cabType} onChange={(e) => setCabType(e.target.value)}>
              {CAB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <div className="estimate-bar">
          <button type="button" className="btn-secondary" onClick={getEstimate} disabled={estimating}>
            {estimating ? 'Estimating…' : 'Get fare estimate'}
          </button>
          {estimate && (
            <span className="estimate-result">
              ≈ {estimate.fare.toFixed(2)} {estimate.currency}
              {estimate.distance_km != null && ` · ${estimate.distance_km} km`}
              {estimate.duration_min != null && ` · ${estimate.duration_min} min`}
            </span>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create booking'}
        </button>
      </form>
    </div>
  );
}

function LocationInputs({ value, onChange, favourites, onPick }) {
  return (
    <div>
      {favourites.length > 0 && (
        <div className="muted small" style={{ marginBottom: 8 }}>
          Quick pick:&nbsp;
          {favourites.map((f) => (
            <button type="button" key={f.id} className="chip" onClick={() => onPick(f)}>{f.name}</button>
          ))}
        </div>
      )}
      <div className="row">
        <label>
          <span>Name (optional)</span>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
        <label>
          <span>Latitude</span>
          <input type="number" step="any" required
                 value={value.latitude} onChange={(e) => onChange({ ...value, latitude: e.target.value })} />
        </label>
        <label>
          <span>Longitude</span>
          <input type="number" step="any" required
                 value={value.longitude} onChange={(e) => onChange({ ...value, longitude: e.target.value })} />
        </label>
      </div>
    </div>
  );
}

function defaultDateTime() {
  const t = new Date(Date.now() + 2 * 3600_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
