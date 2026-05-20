import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [addOpen,    setAddOpen]    = useState(false);
  const [editing,    setEditing]    = useState(null);

  const [weather, setWeather] = useState({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await api('/location/');
      setFavourites(data.favourites);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!window.confirm('Remove this favourite?')) return;
    try {
      await api(`/location/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function fetchWeather(id) {
    setWeather((s) => ({ ...s, [id]: { loading: true } }));
    try {
      const data = await api(`/location/${id}/weather`);
      setWeather((s) => ({ ...s, [id]: { loading: false, data: data.weather } }));
    } catch (err) {
      setWeather((s) => ({ ...s, [id]: { loading: false, error: err.message } }));
    }
  }

  if (loading) return <p>Loading favourites…</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Favourite locations</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); setAddOpen(true); }}>
          + Add favourite
        </button>
      </div>

      {addOpen && (
        <FavouriteForm
          initial={editing}
          onCancel={() => { setAddOpen(false); setEditing(null); }}
          onSaved={() => { setAddOpen(false); setEditing(null); load(); }}
        />
      )}

      {favourites.length === 0 && <p className="muted">No saved locations yet.</p>}
      <div className="cards">
        {favourites.map((f) => (
          <div key={f.id} className="card">
            <div className="card-header">
              <strong>{f.name}</strong>
              <span className="card-when">{f.latitude.toFixed(3)}, {f.longitude.toFixed(3)}</span>
            </div>
            <div className="card-body">
              {f.address && <p className="muted small">{f.address}</p>}
              <WeatherSection state={weather[f.id]} onFetch={() => fetchWeather(f.id)} />
            </div>
            <div className="card-footer">
              <button className="btn-link" onClick={() => { setEditing(f); setAddOpen(true); }}>Edit</button>
              <button className="btn-link danger" onClick={() => remove(f.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FavouriteForm({ initial, onCancel, onSaved }) {
  const [name,      setName]      = useState(initial?.name      ?? '');
  const [address,   setAddress]   = useState(initial?.address   ?? '');
  const [latitude,  setLatitude]  = useState(initial?.latitude  ?? '');
  const [longitude, setLongitude] = useState(initial?.longitude ?? '');
  const [error,     setError]     = useState(null);
  const [saving,    setSaving]    = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null); setSaving(true);
    const body = { name, address, latitude: Number(latitude), longitude: Number(longitude) };
    try {
      if (initial) {
        await api(`/location/${initial.id}`, { method: 'PUT', body });
      } else {
        await api('/location/', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form inline-form">
      <h3>{initial ? 'Edit favourite' : 'New favourite'}</h3>
      <div className="row">
        <label>
          <span>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>Address (optional)</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label>
          <span>Latitude</span>
          <input type="number" step="any" required
                 value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </label>
        <label>
          <span>Longitude</span>
          <input type="number" step="any" required
                 value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function WeatherSection({ state, onFetch }) {
  if (!state) {
    return <button className="btn-link" onClick={onFetch}>Show weather</button>;
  }
  if (state.loading) return <p className="muted small">Loading weather…</p>;
  if (state.error)   return <p className="error small">{state.error}</p>;

  const { current, location, forecast } = state.data;
  return (
    <div className="weather">
      <div className="weather-current">
        {current.icon && <img src={current.icon} alt="" />}
        <div>
          <strong>{current.temp_c}°C</strong> · {current.condition}
          {location?.localtime && <div className="muted small">Local: {location.localtime}</div>}
        </div>
      </div>
      {forecast.length > 0 && (
        <div className="muted small">
          Today: {forecast[0].min_temp_c}° – {forecast[0].max_temp_c}° · {forecast[0].condition}
        </div>
      )}
    </div>
  );
}
