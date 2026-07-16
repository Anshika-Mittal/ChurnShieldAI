import React, { useState } from "react";
import { predictAPI } from "../services/api";
import { 
  Activity, Info, Brain, ChevronRight, CheckCircle2, AlertTriangle, 
  HelpCircle, Sparkles, AlertCircle, Loader2 
} from "lucide-react";

export default function SinglePrediction() {
  const [formData, setFormData] = useState({
    gender: "Male",
    senior_citizen: "No",
    partner: "No",
    dependents: "No",
    tenure_months: 1,
    phone_service: "Yes",
    multiple_lines: "No",
    internet_service: "DSL",
    online_security: "No",
    online_backup: "No",
    device_protection: "No",
    tech_support: "No",
    streaming_tv: "No",
    streaming_movies: "No",
    contract: "Month-to-month",
    paperless_billing: "No",
    payment_method: "Electronic check",
    monthly_charges: 29.9,
    total_charges: 29.9
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextData = { ...prev, [name]: value };
      
      // Auto-update Total Charges estimate if Tenure Months changes
      if (name === "tenure_months" || name === "monthly_charges") {
        const tenure = name === "tenure_months" ? intVal(value) : intVal(prev.tenure_months);
        const monthly = name === "monthly_charges" ? floatVal(value) : floatVal(prev.monthly_charges);
        nextData.total_charges = parseFloat((tenure * monthly).toFixed(2));
      }
      return nextData;
    });
  };

  const intVal = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const floatVal = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.0 : parsed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      // Basic casting
      const payload = {
        ...formData,
        tenure_months: parseInt(formData.tenure_months, 10) || 0,
        monthly_charges: parseFloat(formData.monthly_charges) || 0.0,
        total_charges: parseFloat(formData.total_charges) || 0.0
      };
      
      const res = await predictAPI.predictSingle(payload);
      setResult(res.result);
      // Scroll down to results on mobile
      setTimeout(() => {
        document.getElementById("prediction-results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err.message || "Model execution failed.");
    } finally {
      setLoading(false);
    }
  };

  const highlightBorderClass = "border-purple-400 dark:border-purple-600 focus:ring-purple-500/20 focus:border-purple-500 relative";
  const normalBorderClass = "border-slate-200 dark:border-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500";

  const Badge = () => (
    <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[9px] font-extrabold uppercase tracking-wider border border-purple-200 dark:border-purple-800">
      Key Predictor
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Churn Risk Analysis</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Simulate a single customer profile to test model risk thresholds and SHAP metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer details */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <span className="w-1.5 h-4 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              Customer Demographics
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Senior Citizen Status</label>
                <select
                  name="senior_citizen"
                  value={formData.senior_citizen}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Has Partner</label>
                <select
                  name="partner"
                  value={formData.partner}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {/* IMPORTANT FEATURE: Dependents */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500">Has Dependents</label>
                <select
                  name="dependents"
                  value={formData.dependents}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${highlightBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
                <Badge />
              </div>
            </div>
          </div>

          {/* Section 2: Services */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <span className="w-1.5 h-4 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              Service Settings
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Phone Service</label>
                <select
                  name="phone_service"
                  value={formData.phone_service}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Multiple Phone Lines</label>
                <select
                  name="multiple_lines"
                  value={formData.multiple_lines}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No phone service">No phone service</option>
                </select>
              </div>

              {/* IMPORTANT FEATURE: Internet Service */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500">Internet Connection Type</label>
                <select
                  name="internet_service"
                  value={formData.internet_service}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${highlightBorderClass}`}
                >
                  <option value="DSL">DSL</option>
                  <option value="Fiber optic">Fiber optic</option>
                  <option value="No">No Connection</option>
                </select>
                <Badge />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Online Security Add-on</label>
                <select
                  name="online_security"
                  value={formData.online_security}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Online Backup Storage</label>
                <select
                  name="online_backup"
                  value={formData.online_backup}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Device Protection Plan</label>
                <select
                  name="device_protection"
                  value={formData.device_protection}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Tech Support Helpdesk</label>
                <select
                  name="tech_support"
                  value={formData.tech_support}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Streaming TV Package</label>
                <select
                  name="streaming_tv"
                  value={formData.streaming_tv}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Streaming Movies Package</label>
                <select
                  name="streaming_movies"
                  value={formData.streaming_movies}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="No internet service">No internet service</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Billing & Contract */}
          <div className="glass p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <span className="w-1.5 h-4 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              Financial & Billing Contracts
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IMPORTANT FEATURE: Contract */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500">Contract Subscription Term</label>
                <select
                  name="contract"
                  value={formData.contract}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${highlightBorderClass}`}
                >
                  <option value="Month-to-month">Month-to-month</option>
                  <option value="One year">One year</option>
                  <option value="Two year">Two year</option>
                </select>
                <Badge />
              </div>

              {/* IMPORTANT FEATURE: Tenure Months */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500">Tenure Duration (Months)</label>
                <input
                  type="number"
                  name="tenure_months"
                  min="0"
                  max="72"
                  value={formData.tenure_months}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${highlightBorderClass}`}
                  required
                />
                <Badge />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Paperless Invoices</label>
                <select
                  name="paperless_billing"
                  value={formData.paperless_billing}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Payment Processor Method</label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                >
                  <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
                  <option value="Credit card (automatic)">Credit card (automatic)</option>
                  <option value="Electronic check">Electronic check</option>
                  <option value="Mailed check">Mailed check</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Monthly Spending Charges ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="monthly_charges"
                  value={formData.monthly_charges}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${normalBorderClass}`}
                  required
                />
              </div>

              {/* IMPORTANT FEATURE: Total Charges */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-500">Accumulated Total Charges ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="total_charges"
                  value={formData.total_charges}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${highlightBorderClass}`}
                  required
                />
                <Badge />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-base"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Calculating Churn Risk...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                Execute Prediction
              </>
            )}
          </button>
        </form>

        {/* Prediction Results Column */}
        <div id="prediction-results" className="lg:col-span-5 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-6 animate-fade-in">
              {/* Card 1: Prediction Risk Summary */}
              <div className={`p-8 rounded-3xl border shadow-lg relative overflow-hidden ${
                result.risk_level === "High" 
                  ? "bg-red-50/55 dark:bg-red-950/15 border-red-200 dark:border-red-900/60" 
                  : result.risk_level === "Medium"
                  ? "bg-amber-50/55 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/60"
                  : "bg-emerald-50/55 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/60"
              }`}>
                {/* Glow ring in background */}
                <div className={`absolute -right-10 -bottom-10 h-32 w-32 rounded-full opacity-10 blur-xl ${
                  result.risk_level === "High" ? "bg-red-500" : "bg-emerald-500"
                }`} />

                <div className="space-y-4">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500 dark:text-slate-400">Analysis Output</span>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black">{result.prediction}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                      result.risk_level === "High" 
                        ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" 
                        : result.risk_level === "Medium"
                        ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    }`}>
                      {result.risk_level} Risk
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Estimated Churn Probability</span>
                      <span className="font-extrabold">{(result.probability * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-200/50 dark:bg-slate-800/50 h-3.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          result.risk_level === "High" ? "bg-red-500" : result.risk_level === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${result.probability * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: SHAP Feature Contributions */}
              <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base">SHAP Local Feature Weights</h3>
                  <div className="flex gap-4 text-[10px] font-bold">
                    <span className="text-red-500 font-extrabold">+ Increases Risk</span>
                    <span className="text-emerald-500 font-extrabold">- Reduces Risk</span>
                  </div>
                </div>

                <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                  {result.top_features.map((feat, idx) => {
                    const absVal = Math.abs(feat.impact);
                    const isPositive = feat.impact > 0;
                    
                    // Simple scaling width factor for horizontal chart display (cap at max contribution scale)
                    const maxScale = Math.max(...result.top_features.map(f => Math.abs(f.impact)), 0.1);
                    const widthPct = `${(absVal / maxScale) * 100}%`;
                    
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{feat.feature}</span>
                          <span className={`font-bold ${isPositive ? "text-red-500" : "text-emerald-500"}`}>
                            {isPositive ? "+" : ""}{feat.impact.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full flex items-center bg-slate-100 dark:bg-slate-900/50 h-3 rounded-full overflow-hidden">
                          {/* Indent side alignment depending on SHAP sign */}
                          <div className={`h-full rounded-full ${isPositive ? "bg-red-500/80 ml-auto" : "bg-emerald-500/80 mr-auto"}`} style={{ width: widthPct }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Business Summaries */}
              <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow space-y-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Natural Language Interpretation
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {result.business_summary}
                </p>

                {/* Recommendations */}
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Actionable Recommendations</h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2.5 items-start text-xs font-semibold">
                        <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 leading-normal">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass p-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4 h-full flex flex-col items-center justify-center min-h-[300px]">
              <HelpCircle className="h-10 w-10 text-slate-400 opacity-60 animate-bounce" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-base">Prediction Pending</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Fill in the customer demographic and contract fields, then press **Execute Prediction** to see churn probability ratings and SHAP charts here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
