import React, { useState } from "react";
import { predictAPI } from "../services/api";
import { TableSkeleton, ChartSkeleton } from "../components/Skeletons";
import { 
  FileSpreadsheet, Upload, Download, Search, AlertCircle, 
  CheckCircle2, Loader2, ArrowRight, BarChart3, PieChartIcon 
} from "lucide-react";
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from "recharts";

export default function BatchPrediction() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [error, setError] = useState("");
  const [missingCols, setMissingCols] = useState([]);
  const [success, setSuccess] = useState(false);

  // Result dataset states
  const [batchId, setBatchId] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [results, setResults] = useState([]);
  
  // Table search & pagination states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("customer_number");
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setError("");
        setMissingCols([]);
      } else {
        setError("Invalid file format. Please drop a valid CSV spreadsheet.");
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setMissingCols([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setError("");
    setMissingCols([]);
    setLoading(true);
    setProgress(10);
    setSuccess(false);

    // Mock progress bar intervals
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 200);

    try {
      const res = await predictAPI.predictBatch(file);
      setProgress(100);
      clearInterval(progressInterval);

      // Fetch full details of the created batch in order to get input data details for charting
      const batchData = await predictAPI.getBatchDetails(res.batch_id);
      
      setBatchId(res.batch_id);
      setTotalRecords(res.total_records);
      setResults(batchData.results);
      setSuccess(true);
    } catch (err) {
      clearInterval(progressInterval);
      if (err.message && err.message.includes("Missing required columns")) {
        // Parse missing columns from response error if possible
        setError("CSV format error: Missing required column headers.");
      } else {
        setError(err.message || "Failed to execute batch prediction.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Local calculations for charting
  const getChurnDistribution = () => {
    const churn = results.filter(r => r.prediction === "Customer Will Churn").length;
    const stay = results.length - churn;
    return [
      { name: "Will Churn", value: churn, color: "#ef4444" },
      { name: "Will Stay", value: stay, color: "#10b981" }
    ].filter(item => item.value > 0);
  };

  const getRiskSeverity = () => {
    const high = results.filter(r => r.risk_level === "High").length;
    const medium = results.filter(r => r.risk_level === "Medium").length;
    const low = results.filter(r => r.risk_level === "Low").length;
    return [
      { name: "High", count: high, color: "#ef4444" },
      { name: "Medium", count: medium, color: "#f59e0b" },
      { name: "Low", count: low, color: "#10b981" }
    ];
  };

  const getContractDistribution = () => {
    const counts = { "Month-to-month": 0, "One year": 0, "Two year": 0 };
    results.forEach(r => {
      const type = r.input_data?.contract || "Month-to-month";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  };

  const getTenureDistribution = () => {
    const counts = { "0-12m": 0, "12-24m": 0, "24-48m": 0, "48m+": 0 };
    results.forEach(r => {
      const months = parseInt(r.input_data?.tenure_months || 0, 10);
      if (months <= 12) counts["0-12m"]++;
      else if (months <= 24) counts["12-24m"]++;
      else if (months <= 48) counts["24-48m"]++;
      else counts["48m+"]++;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  };

  // Table sorting and filtering logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredResults = results.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.customer_number.toLowerCase().includes(term) ||
      r.prediction.toLowerCase().includes(term) ||
      r.risk_level.toLowerCase().includes(term)
    );
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    // Sort logic fallbacks
    if (sortField === "contract") {
      valA = a.input_data?.contract || "";
      valB = b.input_data?.contract || "";
    }
    
    if (typeof valA === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortAsc ? valA - valB : valB - valA;
    }
  });

  const pageIndexStart = (currentPage - 1) * itemsPerPage;
  const paginatedResults = sortedResults.slice(pageIndexStart, pageIndexStart + itemsPerPage);
  const totalPages = Math.ceil(sortedResults.length / itemsPerPage) || 1;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Batch Prediction</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Upload spreadsheets containing up to 10000 customer rows to process bulk churn risks
        </p>
      </div>

      {/* File Upload card */}
      {!success && (
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all relative ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-500/5" 
                  : "border-slate-300 dark:border-slate-800 hover:border-slate-400"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading}
              />
              
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 mx-auto">
                  <Upload className="h-6 w-6" />
                </div>
                
                {file ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Selected file:</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      <FileSpreadsheet className="h-4.5 w-4.5" />
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  </div>
                ) : (
                  <div>
                    <label 
                      htmlFor="file-upload" 
                      className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-sm cursor-pointer"
                    >
                      Click to choose a file
                    </label>
                    <span className="text-sm text-slate-500"> or drag and drop spreadsheet here</span>
                    <p className="text-xs text-slate-400 mt-2">Only CSV formatted files up to 10000 rows are supported</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">{error}</p>
                  {missingCols.length > 0 && (
                    <p className="text-xs mt-1">Please ensure columns exist for: {missingCols.join(", ")}</p>
                  )}
                </div>
              </div>
            )}

            {/* Progress loading bar */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Uploading and executing prediction calculations...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Running Model Predictions...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-5 w-5" />
                  Analyze Spreadsheet
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Success preview results state */}
      {success && results.length > 0 && (
        <div className="space-y-8 animate-fade-in">
          {/* Notification Header */}
          <div className="glass p-6 rounded-3xl border border-emerald-200/50 dark:border-emerald-950/20 bg-emerald-50/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Analysis Complete</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Successfully predicted churn risk for {totalRecords} customers.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={predictAPI.downloadResultsUrl(batchId)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors shadow flex items-center gap-2 cursor-pointer"
              >
                <Download className="h-4.5 w-4.5" />
                Download Results CSV
              </a>
              <button
                onClick={() => {
                  setFile(null);
                  setSuccess(false);
                  setResults([]);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Upload New File
              </button>
            </div>
          </div>

          {/* Visual Recharts Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Retention Pie */}
            <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
              <h3 className="font-bold text-sm mb-4">Retention Breakdown</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getChurnDistribution()}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {getChurnDistribution().map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Risk bar */}
            <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
              <h3 className="font-bold text-sm mb-4">Risk Severity distribution</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getRiskSeverity()}>
                    <XAxis dataKey="name" fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {getRiskSeverity().map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Contract breakdown */}
            <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
              <h3 className="font-bold text-sm mb-4">Contract Subscriptions</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getContractDistribution()}>
                    <XAxis dataKey="name" fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Tenure breakdown */}
            <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
              <h3 className="font-bold text-sm mb-4">Tenure Cohorts</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getTenureDistribution()}>
                    <XAxis dataKey="name" fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} stroke="#888888" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table Details */}
          <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow overflow-hidden">
            {/* Table Header controls */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row justify-between gap-4">
              <h3 className="font-bold text-base">Prediction Details Table</h3>
              
              <div className="flex gap-4">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by ID or risk..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56"
                  />
                </div>
              </div>
            </div>

            {/* Table Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 uppercase border-b border-slate-200/50 dark:border-slate-800/50">
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("customer_number")}>Customer ID</th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("prediction")}>Prediction</th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("probability")}>Probability</th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("risk_level")}>Risk Level</th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("contract")}>Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50 text-sm">
                  {paginatedResults.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <td className="px-6 py-3.5 font-bold">{row.customer_number}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          row.prediction.includes("Churn") 
                            ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900" 
                            : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900"
                        }`}>
                          {row.prediction}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold">{(row.probability * 100).toFixed(0)}%</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.risk_level === "High" 
                            ? "text-red-600 dark:text-red-400" 
                            : row.risk_level === "Medium"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {row.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-500 dark:text-slate-400">
                        {row.input_data?.contract || "Month-to-month"}
                      </td>
                    </tr>
                  ))}
                  {paginatedResults.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                        No customer matches search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {sortedResults.length > itemsPerPage && (
              <div className="px-6 py-4 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-500">
                  Showing {pageIndexStart + 1} to {Math.min(pageIndexStart + itemsPerPage, sortedResults.length)} of {sortedResults.length} records
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
