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
// import { signOut } from "firebase/auth";
// import { auth } from "./firebase";

// function Navbar() {
//   const { user, loading } = useAuth();

//   return (
//     <nav
//       style={{
//         display: "flex",
//         gap: 12,
//         padding: 12,
//         borderBottom: "1px solid #eee",
//         alignItems: "center",
//       }}
//     >
//       <NavLink to="/">Home</NavLink>
//       <NavLink to="/survey">Survey</NavLink>
//       <NavLink to="/recommend">Recommend</NavLink>
//       <NavLink to="/favorites">Favorites</NavLink>

//       <div style={{ marginLeft: "auto" }}>
//         {loading ? (
//           <span>Loading...</span>
//         ) : user ? (
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             <span style={{ fontSize: "0.9rem" }}> {user.email}</span>
//             <button
//               onClick={() => signOut(auth)}
//               style={{
//                 background: "transparent",
//                 border: "1px solid #888",
//                 borderRadius: 4,
//                 padding: "2px 8px",
//                 cursor: "pointer",
//               }}
//             >
//               Logout
//             </button>
//           </div>
//         ) : (
//           <>
//             <NavLink to="/login">Sign In</NavLink>
//             <NavLink to="/register">Register</NavLink>
//           </>
//         )}
//       </div>
//     </nav>
//   );
// }

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
