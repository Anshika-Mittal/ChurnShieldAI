import React, { createContext, useState, useEffect, useContext } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    // Check for saved token and profile on load
    const savedToken = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("user_profile");
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);

    // Set theme styling on load
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }

    // Listener for cross-tab auth sync or logout triggers
    const handleAuthChanged = () => {
      const activeToken = localStorage.getItem("auth_token");
      const activeUser = localStorage.getItem("user_profile");
      if (!activeToken) {
        setToken(null);
        setUser(null);
      } else {
        setToken(activeToken);
        setUser(JSON.parse(activeUser));
      }
    };
    
    window.addEventListener("auth-changed", handleAuthChanged);
    return () => window.removeEventListener("auth-changed", handleAuthChanged);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const nextTheme = !prev;
      localStorage.setItem("theme", nextTheme ? "dark" : "light");
      if (nextTheme) {
        document.body.classList.add("dark");
      } else {
        document.body.classList.remove("dark");
      }
      return nextTheme;
    });
  };

  const loginUser = async (email, password, captchaToken, captchaAns) => {
    setLoading(true);
    try {
      const res = await authAPI.login(email, password, captchaToken, captchaAns);
      localStorage.setItem("auth_token", res.token);
      localStorage.setItem("user_profile", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const signupUser = async (name, email, password) => {
    setLoading(true);
    try {
      return await authAPI.signup(name, email, password);
    } finally {
      setLoading(false);
    }
  };

  const verifyUserOtp = async (email, otp) => {
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email, otp);
      localStorage.setItem("auth_token", res.token);
      localStorage.setItem("user_profile", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken) => {
    setLoading(true);
    try {
      const res = await authAPI.googleLogin(idToken);
      localStorage.setItem("auth_token", res.token);
      localStorage.setItem("user_profile", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_profile");
    setToken(null);
    setUser(null);
    authAPI.logout().catch(() => {});
  };

  const refreshProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      localStorage.setItem("user_profile", JSON.stringify(res.user));
      setUser(res.user);
    } catch (e) {
      console.error("Failed to refresh user profile:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        darkMode,
        toggleDarkMode,
        login: loginUser,
        signup: signupUser,
        verifyOtp: verifyUserOtp,
        googleLogin: loginWithGoogle,
        logout: logoutUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
