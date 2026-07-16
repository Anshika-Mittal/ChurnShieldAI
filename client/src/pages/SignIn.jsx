import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { 
  BrainCircuit, Mail, Lock, Loader2, ArrowRight, ShieldCheck, 
  RefreshCw, Eye, EyeOff, X, AlertCircle, HelpCircle 
} from "lucide-react";

export default function SignIn() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAns, setCaptchaAns] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Captcha states
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Google OAuth States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Fetch captcha and check for official Google client initialization
  useEffect(() => {
    fetchCaptcha();
    
    if (googleClientId && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "outline", size: "large", text: "continue_with", width: 384 }
        );
      } catch (err) {
        console.error("Google accounts initialization failed:", err);
      }
    }
  }, [googleClientId]);

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await authAPI.getCaptcha();
      setCaptchaQuestion(res.question);
      setCaptchaToken(res.captcha_token);
      setCaptchaAns("");
    } catch (err) {
      setError("Failed to load Captcha verification. Please refresh the page.");
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !captchaAns) {
      setError("Please fill in all sign-in fields.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password, captchaToken, captchaAns);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Invalid credentials.");
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setError("");
    setLoading(true);
    try {
      await googleLogin(response.credential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMockLogin = async () => {
    setShowGoogleModal(false);
    setError("");
    setLoading(true);
    try {
      await googleLogin("mock-google-token");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in z-10">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/35 mb-4">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Sign in to access your churn analytics panel
          </p>
        </div>

        {/* Card Form */}
        <div className="glass p-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input (with visibility toggle) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Captcha Verification */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Human Verification
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center justify-between px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 select-none">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <ShieldCheck className="h-5 w-5 text-indigo-500" />
                    <span className="font-bold text-sm">{captchaQuestion || "Loading..."}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={captchaLoading || loading}
                    className="text-indigo-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                    title="Refresh Captcha"
                  >
                    <RefreshCw className={`h-4 w-4 ${captchaLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Answer"
                  value={captchaAns}
                  onChange={(e) => setCaptchaAns(e.target.value)}
                  className="w-24 text-center py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">Or</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Google Login Trigger */}
          {googleClientId ? (
            <div className="w-full flex justify-center">
              <div id="google-signin-btn"></div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors font-semibold flex items-center justify-center gap-3 cursor-pointer text-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>
          )}

          {/* Footer Navigation */}
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{" "}
            <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Google Setup Warning Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-lg">Google Sign-In Options</h3>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Google Client ID credential keys are not configured in your environment files. You can choose to log in immediately using a **Simulated Demo Account** (Mock Mode), or configure OAuth.
            </p>
            
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-500 font-semibold">
              <p className="font-bold text-slate-700 dark:text-slate-300">To enable real Google Account Chooser:</p>
              <p>1. Open Google Cloud Console and create OAuth Web application credentials.</p>
              <p>2. Paste your client ID inside <code className="text-indigo-500 font-mono">client/.env</code> as <code className="text-indigo-500 font-mono">VITE_GOOGLE_CLIENT_ID</code>.</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleGoogleMockLogin}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer shadow text-sm"
              >
                Log In with Mock Demo Profile
              </button>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900/50 rounded-xl font-bold transition-all text-sm cursor-pointer"
              >
                Cancel / Return to Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
