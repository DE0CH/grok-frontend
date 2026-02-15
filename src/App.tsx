import { useEffect } from "react";
import { Link, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { setGrokApiKey } from "./lib/grokApi";
import { getApiKeyFromCookie } from "./lib/cookies";
import Login from "./pages/Login";
import ImageToImage from "./pages/ImageToImage";
import ImageToVideo from "./pages/ImageToVideo";
import "./App.css";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const key = getApiKeyFromCookie();

  useEffect(() => {
    if (!key) {
      navigate("/login", { state: { from: location }, replace: true });
    } else {
      setGrokApiKey(key);
    }
  }, [key, navigate, location]);

  if (!key) return null;

  return (
    <>
      <nav className="nav">
        <Link to="/">Image to Image</Link>
        <Link to="/image-to-video">Image to Video</Link>
      </nav>
      <main>{children}</main>
    </>
  );
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <ImageToImage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/image-to-video"
          element={
            <ProtectedLayout>
              <ImageToVideo />
            </ProtectedLayout>
          }
        />
      </Routes>
    </>
  );
}

export default App;
