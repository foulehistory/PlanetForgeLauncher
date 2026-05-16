import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import ProtectedRoute from "./shared/ProtectedRoute";
import Layout  from "./shared/Layout";

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
        </Route>

      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AnimatedRoutes />
    </HashRouter>
  );
}