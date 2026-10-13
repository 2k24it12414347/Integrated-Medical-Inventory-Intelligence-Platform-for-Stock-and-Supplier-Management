import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginUser({
        email,
        password,
      });

      login(response);

      // Single login for all roles (Admin / Pharmacist / Staff).
      // Everyone lands on /dashboard; the dashboard shows features by role.
      // If admins need a different page, uncomment below and adjust the
      // role value after checking console.log(response):
      //
      // if (response.role === "ADMIN") {
      //   navigate("/admin-dashboard");
      //   return;
      // }
      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      setError(
          error.response?.data?.message ||
          "Login failed. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="login-page">
        {/* Floating medical icons */}
        <div className="floating-icon icon-one">💊</div>
        <div className="floating-icon icon-two">🩺</div>
        <div className="floating-icon icon-three">💉</div>
        <div className="floating-icon icon-four">🏥</div>

        <div className="login-card">
          <div className="logo-circle">Ⓜ️</div>

          <div className="brand-badge">HEALTHCARE INVENTORY</div>

          <h1>MediStock</h1>

          <p className="subtitle">Smart medicine inventory management</p>

          <div className="security-message">
            🔐 Secure healthcare inventory access
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>

              <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <div className="password-wrapper">
                <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                />

                <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && <p className="error-message">⚠️ {error}</p>}

            <button
                type="submit"
                className="primary-button"
                disabled={loading}
            >
              {loading ? (
                  <span className="button-loading">
                <span className="loading-spinner"></span>
                Signing in...
              </span>
              ) : (
                  "Login"
              )}
            </button>
          </form>

          <p className="account-text">
            Don't have an account? <Link to="/register">Register here</Link>
          </p>

          <p className="login-footer">
            MediStock • Secure & Reliable Healthcare Management
          </p>
        </div>
      </div>
  );
}

export default Login;
