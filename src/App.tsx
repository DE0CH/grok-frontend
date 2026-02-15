import { useEffect } from "react";
import { Link, Routes, Route, useNavigate, useLocation } from "react-router-dom";

const SITE_TITLE = "Grok Image & Video";

const PAGE_TITLES: Record<string, string> = {
  "/": "Image to Image",
  "/login": "Log in",
  "/image-to-video": "Image to Video",
};

function usePageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pageTitle = PAGE_TITLES[pathname];
    document.title = pageTitle ? `${pageTitle} — ${SITE_TITLE}` : `Not found — ${SITE_TITLE}`;
  }, [pathname]);
}
import { setGrokApiKey } from "./lib/grokApi";
import { getApiKeyFromCookie, clearApiKeyCookie } from "./lib/cookies";
import Login from "./pages/Login";
import ImageToImage from "./pages/ImageToImage";
import ImageToVideo from "./pages/ImageToVideo";
import NotFound from "./pages/NotFound";
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

  const handleLogout = () => {
    clearApiKeyCookie();
    setGrokApiKey(null);
    navigate("/login");
  };

  return (
    <>
      <nav className="nav">
        <Link to="/">Image to Image</Link>
        <Link to="/image-to-video">Image to Video</Link>
        <button type="button" className="nav-logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <main>{children}</main>
    </>
  );
}

function App() {
  usePageTitle();
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
