import React from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/35 mx-auto">
          <BrainCircuit className="h-8 w-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            404
          </h2>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Page not found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The page you are looking for does not exist or has been relocated.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all duration-300 cursor-pointer"
        >
          <Home className="h-4.5 w-4.5" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
