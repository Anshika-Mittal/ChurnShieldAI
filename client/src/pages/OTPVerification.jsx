import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { BrainCircuit, Loader2, ArrowLeft, RefreshCw } from "lucide-react";

export default function OTPVerification() {
  const { verifyOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract email passed during sign up
  const email = location.state?.email || "";
  
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Timers states
  const [expireSeconds, setExpireSeconds] = useState(300); // 5 minutes expiration
  const [cooldownSeconds, setCooldownSeconds] = useState(60); // 60s resend cooldown
  
  const inputRefs = useRef([]);

  // Redirect if no email is found
  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
  }, [email, navigate]);

  // Handle countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setExpireSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (index, val) => {
    if (isNaN(val)) return;
    
    const newValues = [...otpValues];
    newValues[index] = val.substring(val.length - 1);
    setOtpValues(newValues);
    
    // Shift focus to next input if filled
    if (val && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: shift focus to previous input
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && !isNaN(pasteData)) {
      const splitVals = pasteData.split("");
      setOtpValues(splitVals);
      inputRefs.current[5].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    const code = otpValues.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (expireSeconds <= 0) {
      setError("This code has expired. Please request a new OTP code.");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email, code);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0) return;
    
    setError("");
    setSuccessMsg("");
    setResending(true);
    try {
      await authAPI.resendOtp(email);
      setSuccessMsg("A new verification code has been sent successfully.");
      setOtpValues(["", "", "", "", "", ""]);
      setCooldownSeconds(60);
      setExpireSeconds(300);
      inputRefs.current[0].focus();
    } catch (err) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in">
        {/* Navigation back */}
        <button
          onClick={() => navigate("/signup")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 font-medium group transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Sign Up
        </button>

        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/35 mb-4">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Verify email address</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            We have sent a 6-digit verification code to <br />
            <strong className="text-slate-700 dark:text-slate-300">{email}</strong>
          </p>
        </div>

        {/* Form Card */}
        <div className="glass p-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Group Inputs */}
            <div className="flex justify-between gap-2" onPaste={handlePaste}>
              {otpValues.map((val, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength="1"
                  value={val}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={loading || expireSeconds === 0}
                  className="w-12 h-14 text-center font-extrabold text-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              ))}
            </div>

            {/* Expiration Clock */}
            <div className="text-center text-sm font-medium">
              {expireSeconds > 0 ? (
                <span className="text-slate-500 dark:text-slate-400">
                  Code expires in: <strong className="text-indigo-600 dark:text-indigo-400">{formatTime(expireSeconds)}</strong>
                </span>
              ) : (
                <span className="text-red-500 font-semibold">Code has expired. Please request a new code.</span>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || expireSeconds === 0}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </button>
          </form>

          {/* Resend actions */}
          <div className="text-center pt-2">
            <button
              onClick={handleResend}
              disabled={cooldownSeconds > 0 || resending}
              className={`inline-flex items-center gap-2 text-sm font-bold transition-all ${
                cooldownSeconds > 0 
                  ? "text-slate-400 cursor-not-allowed" 
                  : "text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              }`}
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend Verification Code
                </>
              )}
            </button>
            
            {cooldownSeconds > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Resend disabled for {cooldownSeconds} seconds
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
