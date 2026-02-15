import { useEffect } from "react";
import { Link, Routes, Route, useNavigate, useLocation } from "react-router-dom";

const SITE_TITLE = "Grok Image & Video";

/** Set this to your repo URL, e.g. "https://github.com/username/grok-frontend" */
const GITHUB_REPO = "https://github.com/DE0CH/grok-frontend";

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
    <div className="app-layout">
      <div className="app-content">
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
      </div>
      <footer className="footer-github">
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </footer>
    </div>
  );
}

export default App;
