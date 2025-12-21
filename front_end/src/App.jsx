// src/App.jsx
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Survey from "./pages/Survey.jsx";
import Recommend from "./pages/Recommend.jsx";
import Favorites from "./pages/Favourite.jsx";
import SignIn from "./pages/SignIn.jsx";
import Register from "./pages/Register.jsx";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import PrivateRoute from "./auth/PrivateRoute.jsx";
import Navbar from "./pages/Navbar.jsx";
import Profile from "./pages/personal.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Navbar />

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />

          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/survey" element={<Survey />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/profile" element={<Profile />} />

          </Route>

          {/* fallback */}
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
