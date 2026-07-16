import React, { useState, useEffect } from "react";
import { predictAPI } from "../services/api";
import { TableSkeleton } from "../components/Skeletons";
import { 
  Search, Trash2, Calendar, AlertTriangle, Eye, ShieldCheck, 
  Trash, Filter, ChevronLeft, ChevronRight, X, Sparkles, CheckCircle2 
} from "lucide-react";

export default function History() {
  const [predictions, setPredictions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Query Filter States
  const [riskLevel, setRiskLevel] = useState("");
  const [predictionFilter, setPredictionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Detail Modal States
  const [selectedPred, setSelectedPred] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [currentPage, riskLevel, predictionFilter]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedPred(null);
      }
    };
    if (selectedPred) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPred]);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await predictAPI.getHistory({
        page: currentPage,
        per_page: itemsPerPage,
        risk_level: riskLevel,
        prediction: predictionFilter,
        sort_by: "created_at",
        sort_dir: "desc"
      });
      setPredictions(data.predictions);
      setTotal(data.total);
    } catch (err) {
      setError(err.message || "Failed to retrieve history logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (id) => {
    setModalLoading(true);
    try {
      const data = await predictAPI.getDetails(id);
      setSelectedPred(data);
    } catch (err) {
      alert("Failed to load prediction details: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this prediction log?")) return;
    
    try {
      await predictAPI.deletePrediction(id);
      fetchHistory();
      if (selectedPred && selectedPred._id === id) {
        setSelectedPred(null);
      }
    } catch (err) {
      alert("Failed to delete record: " + err.message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("WARNING: This will permanently wipe all your single prediction history. Proceed?")) return;
    
    try {
      await predictAPI.clearHistory();
      setCurrentPage(1);
      fetchHistory();
    } catch (err) {
      alert("Failed to clear history: " + err.message);
    }
  };

  const totalPages = Math.ceil(total / itemsPerPage) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Prediction History</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Browse and query explainable model outputs computed in previous runs
          </p>
        </div>
        {total > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-xs font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Clear All History
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filter panel */}
      <div className="glass p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
          <Filter className="h-4 w-4 text-indigo-500" />
          Filter Queries
        </div>

        {/* Prediction Churn Filter */}
        <select
          value={predictionFilter}
          onChange={(e) => {
            setPredictionFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600 dark:text-slate-300"
        >
          <option value="">All Predictions</option>
          <option value="Customer Will Churn">Customer Will Churn</option>
          <option value="Customer Will Stay">Customer Will Stay</option>
        </select>

        {/* Risk Level Filter */}
        <select
          value={riskLevel}
          onChange={(e) => {
            setRiskLevel(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600 dark:text-slate-300"
        >
          <option value="">All Risk Levels</option>
          <option value="High">High Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="Low">Low Risk</option>
        </select>
      </div>

      {/* History Table Grid */}
      {loading ? (
        <TableSkeleton />
      ) : predictions.length > 0 ? (
        <div className="glass rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 uppercase border-b border-slate-200/50 dark:border-slate-800/50">
                  <th className="px-6 py-4">Execution Date</th>
                  <th className="px-6 py-4">Prediction</th>
                  <th className="px-6 py-4">Probability</th>
                  <th className="px-6 py-4">Risk Severity</th>
                  <th className="px-6 py-4">Contract</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50 text-sm font-medium">
                {predictions.map((row) => (
                  <tr 
                    key={row._id} 
                    onClick={() => handleOpenDetails(row._id)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer"
                  >
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        row.prediction.includes("Churn") 
                          ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900" 
                          : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900"
                      }`}>
                        {row.prediction}
                      </span>
                    </td>
                    <td className="px-6 py-4">{(row.probability * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold ${
                        row.risk_level === "High" 
                          ? "text-red-600 dark:text-red-400" 
                          : row.risk_level === "Medium"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {row.risk_level} Risk
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{row.input_data?.contract || "Month-to-month"}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetails(row._id)}
                          className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-indigo-500 transition-colors"
                          title="View SHAP details"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(row._id, e)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-500 hover:text-red-500 transition-colors"
                          title="Delete record"
                        >
                          <Trash className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination panel */}
          {total > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} entries
              </span>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass p-12 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm text-center text-slate-400 space-y-4">
          <Calendar className="h-10 w-10 mx-auto opacity-50 text-indigo-500" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300">No predictions found</h4>
          <p className="text-xs max-w-xs mx-auto text-slate-500">You do not have any saved single prediction records matching active filters.</p>
        </div>
      )}

      {/* SHAP EXPLANATION MODAL POPUP */}
      {selectedPred && (
        <div 
          onClick={() => setSelectedPred(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fade-in"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">Prediction Analysis Output</h3>
                <p className="text-xs text-slate-500 mt-1">Calculated on {new Date(selectedPred.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedPred(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                aria-label="Close details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Score card */}
              <div className={`p-6 rounded-2xl border ${
                selectedPred.risk_level === "High" 
                  ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60" 
                  : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-extrabold text-base">{selectedPred.prediction}</h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    selectedPred.risk_level === "High" 
                      ? "bg-red-100 text-red-700 border-red-200" 
                      : "bg-emerald-100 text-emerald-700 border-emerald-200"
                  }`}>
                    {selectedPred.risk_level} Risk
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Model Probability</span>
                    <span>{(selectedPred.probability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${selectedPred.risk_level === "High" ? "bg-red-500" : "bg-emerald-500"}`} 
                      style={{ width: `${selectedPred.probability * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* SHAP Bars */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>SHAP Contribution Weights</span>
                  <div className="flex gap-3 text-[9px]">
                    <span className="text-red-500">+ Increases Churn</span>
                    <span className="text-emerald-500">- Reduces Churn</span>
                  </div>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {selectedPred.top_features?.map((feat, i) => {
                    const isPositive = feat.impact > 0;
                    const maxScale = Math.max(...selectedPred.top_features.map(f => Math.abs(f.impact)), 0.1);
                    const widthPct = `${(Math.abs(feat.impact) / maxScale) * 100}%`;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">{feat.feature}</span>
                          <span className={`font-bold ${isPositive ? "text-red-500" : "text-emerald-500"}`}>
                            {isPositive ? "+" : ""}{feat.impact.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full flex items-center overflow-hidden">
                          <div className={`h-full rounded-full ${isPositive ? "bg-red-500/80 ml-auto" : "bg-emerald-500/80 mr-auto"}`} style={{ width: widthPct }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Natural Language interpretation */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  AI Summary Explanation
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                  {selectedPred.business_summary}
                </p>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Action Recommendations</h4>
                <ul className="space-y-2">
                  {selectedPred.recommendations?.map((rec, i) => (
                    <li key={i} className="flex gap-2.5 items-start text-xs font-semibold">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 leading-normal">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
