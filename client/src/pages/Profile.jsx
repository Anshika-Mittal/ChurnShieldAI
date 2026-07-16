import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { User, Mail, Shield, Calendar, Key, AlertCircle, CheckCircle2, Loader2, Upload, Trash2 } from "lucide-react";

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  
  const [name, setName] = useState(user?.name || "");
  const [profileImage, setProfileImage] = useState(user?.profile_image || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!name.trim()) {
      setError("Name cannot be left empty.");
      return;
    }

    setLoading(true);
    try {
      await authAPI.updateProfile(name, profileImage);
      await refreshProfile();
      setSuccess("Profile settings updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">User Profile Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Manage your account credentials and personal preferences
        </p>
      </div>

      <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-md space-y-6">
        {success && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium flex gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            {success}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium flex gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar representation */}
          <div className="flex items-center gap-6 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt={name} 
                className="h-16 w-16 rounded-full object-cover ring-4 ring-indigo-500/20 shadow" 
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-2xl shadow">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-lg">{user?.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase font-bold tracking-wider">
                {user?.google_auth ? "Connected via Google OAuth" : "Email + Password Credentials"}
              </p>
            </div>
          </div>

          {/* Full Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Email Read-only */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Registered Email (Immutable)
            </label>
            <div className="relative opacity-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                value={user?.email}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          {/* Profile Image Actions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              Profile Picture
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-600 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow flex items-center gap-1.5">
                <Upload className="h-4 w-4" />
                Upload New Image
                <input 
                  type="file" 
                  accept=".png,.jpg,.jpeg" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
                        setError("Invalid format. Please select a JPG, JPEG, or PNG image.");
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setError("File size exceeds the 5 MB limit.");
                        return;
                      }
                      setLoading(true);
                      setError("");
                      setSuccess("");
                      try {
                        const res = await authAPI.uploadProfileImage(file);
                        setProfileImage(res.profile_image);
                        await refreshProfile();
                        setSuccess("Profile picture updated successfully!");
                      } catch (err) {
                        setError(err.message || "Failed to upload image.");
                      } finally {
                        setLoading(false);
                      }
                    }
                  }} 
                  className="hidden" 
                  disabled={loading}
                />
              </label>

              {profileImage && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;
                    setLoading(true);
                    setError("");
                    setSuccess("");
                    try {
                      await authAPI.removeProfileImage();
                      setProfileImage("");
                      await refreshProfile();
                      setSuccess("Profile picture removed successfully!");
                    } catch (err) {
                      setError(err.message || "Failed to remove image.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Picture
                </button>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
