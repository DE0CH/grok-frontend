import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page">
      <h1>404</h1>
      <p className="subtitle">Page not found.</p>
      <p>
        <Link to="/">Go to Image to Image</Link>
      </p>
    </div>
  );
}
