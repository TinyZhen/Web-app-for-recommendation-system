// src/App.jsx
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Survey from "./pages/Survey.jsx";
import Recommend from "./pages/Recommend.jsx";
import Favorites from "./pages/Favourite.jsx";
import Auth from "./pages/Auth.jsx";
import Register from "./pages/Register.jsx";

export default function App() {
  return (
    <div>
      <nav style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #eee" }}>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/survey">Survey</NavLink>
        <NavLink to="/recommend">Recommend</NavLink>
        <NavLink to="/favorites">Favorites</NavLink>
        <NavLink to="/auth" style={{ marginLeft: "auto" }}>Sign in</NavLink>
        {/* <NavLink to="/register">Register</NavLink> */}
      </nav>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
    </div>
  );
}
