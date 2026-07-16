import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { 
  LayoutDashboard, User, FileSpreadsheet, History, LogOut, 
  Menu, X, Sun, Moon, BrainCircuit, Activity, Upload, Trash2,
  Loader2, AlertCircle, CheckCircle2, Camera
} from "lucide-react";

export default function Layout({ children }) {
  const { user, logout, darkMode, toggleDarkMode, refreshProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Avatar Upload States
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  useEffect(() => {
    const closeDropdown = () => setDropdownOpen(false);
    if (dropdownOpen) {
      window.addEventListener("click", closeDropdown);
    }
    return () => window.removeEventListener("click", closeDropdown);
  }, [dropdownOpen]);

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setSelectedFile(null);
    setPreviewUrl("");
    setUploadError("");
    setUploadSuccess("");
  };

  const handleFileChange = (e) => {
    setUploadError("");
    setUploadSuccess("");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!validTypes.includes(file.type)) {
        setUploadError("Invalid format. Please select a JPG, JPEG, or PNG image.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File size exceeds the 5 MB limit.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setUploadLoading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      await authAPI.uploadProfileImage(selectedFile);
      setUploadSuccess("Profile picture updated successfully!");
      await refreshProfile();
      setTimeout(() => {
        closeUploadModal();
      }, 1000);
    } catch (err) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;
    try {
      await authAPI.removeProfileImage();
      await refreshProfile();
    } catch (err) {
      alert("Failed to remove profile picture: " + err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Single Predict", path: "/predict-single", icon: Activity },
    { name: "Batch Predict", path: "/predict-batch", icon: FileSpreadsheet },
    { name: "Prediction History", path: "/history", icon: History },
    { name: "User Profile", path: "/profile", icon: User },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 glass border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 z-20">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <BrainCircuit className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            ChurnShield AI
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  active 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-white" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-medium transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 glass border-r border-slate-200 dark:border-slate-800 z-40 transform transition-transform duration-300 md:hidden flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              ChurnShield AI
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 p-1.5 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  active 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-medium transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 glass border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 p-2 rounded-xl"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="hidden md:flex flex-col">
            <span className="text-xs text-slate-500 dark:text-slate-400">Enterprise AI Portal</span>
            <span className="text-sm font-semibold">Churn Risk Management</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Profile Brief with Dropdown */}
            {user && (
              <div className="relative">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800 cursor-pointer hover:opacity-85 select-none"
                >
                  <div className="flex flex-col text-right hidden sm:flex">
                    <span className="text-sm font-bold">{user.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
                  </div>
                  {user.profile_image ? (
                    <img 
                      src={user.profile_image} 
                      alt={user.name} 
                      className="h-9 w-9 rounded-full ring-2 ring-indigo-500/20 object-cover" 
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-11 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2.5 z-50 animate-fade-in"
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Signed in as</p>
                      <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200">{user.name}</p>
                    </div>
                    
                    <div className="py-1">
                      <Link 
                        to="/profile" 
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40 w-full text-left"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        View Profile
                      </Link>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setUploadModalOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40 w-full text-left cursor-pointer"
                      >
                        <Upload className="h-4 w-4 text-slate-400" />
                        Upload Profile Picture
                      </button>

                      {user.profile_image && (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            handleRemoveProfileImage();
                          }}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 w-full text-left cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          Remove Profile Picture
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 w-full text-left cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full animate-fade-in">
          {children}
        </main>
      </div>

      {/* Upload Avatar Modal */}
      {uploadModalOpen && (
        <div 
          onClick={closeUploadModal}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-6 animate-fade-in"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Upload Profile Picture</h3>
              <button 
                onClick={closeUploadModal}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex gap-2">
                <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 flex-shrink-0" />
                {uploadSuccess}
              </div>
            )}

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-500/20 shadow-md" 
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-405 text-slate-400">
                  <Camera className="h-8 w-8" />
                </div>
              )}

              <div className="space-y-1">
                <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors inline-block">
                  Choose Image File
                  <input 
                    type="file" 
                    accept=".png,.jpg,.jpeg" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    disabled={uploadLoading}
                  />
                </label>
                <p className="text-[10px] text-slate-400">Supports PNG, JPG, or JPEG up to 5 MB</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeUploadModal}
                disabled={uploadLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={!selectedFile || uploadLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                {uploadLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Confirm Upload"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
