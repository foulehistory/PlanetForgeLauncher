import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Library from "./pages/Library";
import Engine from "./pages/Engine";
import ProtectedRoute from "./shared/ProtectedRoute";
import Layout  from "./shared/Layout";
import { I18nProvider } from "./shared/i18n";
import { NotificationProvider } from "./shared/Notifications";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="sync">
      <Routes location={location} key={location.pathname}>

        {/* Auth — sans layout */}
        <Route path="/" element={<Auth />} />

        {/* Routes protégées — avec layout */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/home"    element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/library" element={<Library />} />
          <Route path="/engine" element={<Engine />} />
        </Route>

      </Routes>
    </AnimatePresence>
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