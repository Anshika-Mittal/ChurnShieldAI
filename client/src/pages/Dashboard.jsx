import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { predictAPI } from "../services/api";
import { CardSkeleton } from "../components/Skeletons";
import { 
  Users, BarChart3, AlertTriangle, Percent, FileSpreadsheet, 
  TrendingUp, Activity, UserCheck, ArrowRight, Brain 
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await predictAPI.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to fetch analytics statistics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Analytics Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Pre-calculate charts data
  const pieData = stats ? [
    { name: "Will Churn", value: stats.total_customers_analyzed > 0 ? stats.high_risk_customers + (stats.total_predictions * (stats.churn_percentage / 100)) : 0, color: "#ef4444" },
    { name: "Will Stay", value: stats.total_customers_analyzed > 0 ? stats.total_customers_analyzed - (stats.high_risk_customers + (stats.total_predictions * (stats.churn_percentage / 100))) : 0, color: "#10b981" }
  ].filter(item => item.value > 0) : [];

  const barData = stats ? [
    { name: "High Risk", count: stats.high_risk_customers, color: "#ef4444" },
    { name: "Low Risk", count: stats.low_risk_customers, color: "#10b981" }
  ] : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Real-time customer churn intelligence and SHAP explanations
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          Refresh Stats
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Analytics Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Customers */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Total Analyzed</span>
              <h3 className="text-3xl font-extrabold">{stats.total_customers_analyzed}</h3>
              <p className="text-xs text-slate-400">Unique customer profiles</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Avg Churn Probability */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Average Churn Risk</span>
              <h3 className="text-3xl font-extrabold">{(stats.avg_churn_probability * 100).toFixed(1)}%</h3>
              <p className="text-xs text-slate-400">Mean probability rating</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 dark:text-purple-400">
              <Percent className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: High Risk Customers */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">High Risk Count</span>
              <h3 className="text-3xl font-extrabold text-red-600 dark:text-red-400">{stats.high_risk_customers}</h3>
              <p className="text-xs text-slate-400">Probability &gt; 70%</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>

          {/* Card 4: Most Influential Feature */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Top Risk Driver</span>
              <h3 className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]" title={stats.most_influential_feature}>
                {stats.most_influential_feature}
              </h3>
              <p className="text-xs text-slate-400">Highest SHAP weight</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500">
              <Brain className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Main Call to Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CTA 1: Single Prediction */}
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg flex flex-col justify-between hover:border-indigo-500/50 transition-all duration-300 relative group">
          <div className="absolute top-6 right-6 h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Activity className="h-5 w-5" />
          </div>
          <div className="space-y-3 pr-8">
            <h3 className="text-xl font-bold">Predict Single Customer</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure demographics, contract types, monthly charges, and active services to calculate individual churn risks and retrieve actionable recommendations.
            </p>
          </div>
          <Link
            to="/predict-single"
            className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow shadow-indigo-600/10 flex items-center justify-center gap-2 group-hover:shadow-lg transition-all w-fit cursor-pointer"
          >
            Open Form
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* CTA 2: Batch Prediction */}
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg flex flex-col justify-between hover:border-purple-500/50 transition-all duration-300 relative group">
          <div className="absolute top-6 right-6 h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="space-y-3 pr-8">
            <h3 className="text-xl font-bold">Predict Multiple Customers</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload customer databases with up to 10000 rows. Instantly perform bulk prediction, review visual risk charts, and download the results CSV.
            </p>
          </div>
          <Link
            to="/predict-batch"
            className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow shadow-purple-600/10 flex items-center justify-center gap-2 group-hover:shadow-lg transition-all w-fit cursor-pointer"
          >
            Upload CSV
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Visual Charts Section */}
      {stats && stats.total_customers_analyzed > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Pie Churn Risk Ratio */}
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
            <h3 className="text-lg font-bold mb-4">Customer Retention Ratio</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Customers`, "Status"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-sm font-semibold mt-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Churn Risk ({stats.churn_percentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span>Stable Stay ({stats.non_churn_percentage}%)</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Bar Risk Level Distribution */}
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
            <h3 className="text-lg font-bold mb-4">Risk Severity Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Number of customers categorized by risk threshold severity
            </p>
          </div>
        </div>
      ) : (
        <div className="glass p-12 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow text-center space-y-4">
          <TrendingUp className="h-12 w-12 text-indigo-500 mx-auto opacity-50" />
          <h3 className="text-lg font-bold">No Data Available</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You haven't run any churn prediction models yet. Complete your first single customer prediction to populate dashboard widgets!
          </p>
          <Link
            to="/predict-single"
            className="inline-flex px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
          >
            Launch Prediction
          </Link>
        </div>
      )}
    </div>
  );
}
