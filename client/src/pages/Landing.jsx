import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BrainCircuit, ShieldAlert, BarChart3, Mail, ArrowRight, Activity } from "lucide-react";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden relative selection:bg-indigo-500 selection:text-white">
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="h-20 flex items-center justify-between px-6 md:px-12 border-b border-slate-800/60 sticky top-0 bg-slate-900/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-8 w-8 text-indigo-400" />
          <span className="font-extrabold text-xl bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ChurnShield AI
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <Link 
              to="/dashboard" 
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-300 flex items-center gap-2"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link 
                to="/signin" 
                className="px-5 py-2.5 text-slate-300 hover:text-white font-medium transition-all duration-200"
              >
                Sign In
              </Link>
              <Link 
                to="/signup" 
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/25 transition-all duration-300"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-sm mb-6 animate-fade-in">
          <Activity className="h-4 w-4 text-indigo-400" />
          Powered by Logistic Regression & SHAP Explainability
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 animate-fade-in leading-tight">
          Predict Customer Churn <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            With Explainable AI Insights
          </span>
        </h1>

        <p className="text-lg text-slate-400 mb-10 max-w-2xl animate-fade-in">
          Understand which retention levers to pull. Get precise predictions, direct contribution metrics via SHAP, and natural language recommendations for every customer.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
          <Link
            to={user ? "/dashboard" : "/signup"}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all duration-300 flex items-center justify-center gap-2 group text-base"
          >
            Start Analyzing Free
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/signin"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-2xl transition-all duration-300 text-base"
          >
            Sign In to Account
          </Link>
        </div>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full max-w-5xl">
          <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-800 text-left hover:border-slate-700 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">Churn Prediction</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Instantly predict churn risk using key factors like tenure, contract locks, fiber service status, and payment methods.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-800 text-left hover:border-slate-700 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">SHAP Explainability</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Review exactly how much each customer feature pushes the risk meter up or down with horizontal contribution charts.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-800 text-left hover:border-slate-700 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-6">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">Batch CSV Analytics</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload customer databases with up to 7000 rows. Instantly map, predict, download results, and view visual analytics.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="h-16 flex items-center justify-center border-t border-slate-800/60 text-xs text-slate-500 max-w-5xl mx-auto w-full z-10">
        &copy; {new Date().getFullYear()} ChurnShield AI. All rights reserved. Built as a portfolio project.
      </footer>
    </div>
  );
}
