import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './auth.jsx';

import Layout         from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import LoginPage         from './pages/LoginPage.jsx';
import RegisterPage      from './pages/RegisterPage.jsx';
import BookingsPage      from './pages/BookingsPage.jsx';
import NewBookingPage    from './pages/NewBookingPage.jsx';
import PaymentsPage      from './pages/PaymentsPage.jsx';
import FavouritesPage    from './pages/FavouritesPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/"               element={<Navigate to="/bookings" replace />} />
            <Route path="/bookings"       element={<BookingsPage />} />
            <Route path="/bookings/new"   element={<NewBookingPage />} />
            <Route path="/payments"       element={<PaymentsPage />} />
            <Route path="/favourites"     element={<FavouritesPage />} />
            <Route path="/notifications"  element={<NotificationsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
