import { HashRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Library from "./pages/Library";
import Engine from "./pages/Engine";
import Profile from "./pages/Profile";
import Overlay from "./pages/Overlay";
import ProtectedRoute from "./shared/ProtectedRoute";
import Layout  from "./shared/Layout";
import { I18nProvider } from "./shared/i18n";
import { NotificationProvider } from "./shared/Notifications";

function AnimatedRoutes() {
  return (
    <Routes>

      {/* Auth — sans layout */}
      <Route path="/" element={<Auth />} />

      {/* Overlay window — aucune auth, aucun layout */}
      <Route path="/overlay" element={<Overlay />} />

      {/* Routes protégées — avec layout (Layout ne se remonte pas lors des navigations) */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/home"    element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/library" element={<Library />} />
        <Route path="/engine" element={<Engine />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

    </Routes>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <I18nProvider>
        <HashRouter>
          <AnimatedRoutes />
        </HashRouter>
      </I18nProvider>
    </NotificationProvider>
  );
}