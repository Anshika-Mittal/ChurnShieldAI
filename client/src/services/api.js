const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("auth_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };

  // If body is FormData (used for file upload), do not set Content-Type header
  if (options.body instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, config);
  
  // Handle file downloads
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/csv")) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const errorMsg = data.message || "An unexpected error occurred.";
    // If unauthorized, auto-logout client-side
    if (response.status === 401 && !endpoint.includes("/login") && !endpoint.includes("/signup")) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_profile");
      window.dispatchEvent(new Event("auth-changed"));
    }
    throw new Error(errorMsg);
  }
  
  return data;
}

export const authAPI = {
  getCaptcha: () => request("/auth/captcha"),
  signup: (name, email, password) => 
    request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  verifyOtp: (email, otp) => 
    request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),
  resendOtp: (email) => 
    request("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  login: (email, password, captcha_token, captcha_ans) => 
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, captcha_token, captcha_ans }),
    }),
  googleLogin: (id_token) => 
    request("/auth/google-login", {
      method: "POST",
      body: JSON.stringify({ id_token }),
    }),
  getProfile: () => request("/auth/profile"),
  updateProfile: (name, profile_image) => 
    request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ name, profile_image }),
    }),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/auth/profile/image", {
      method: "POST",
      body: formData,
    });
  },
  removeProfileImage: () => request("/auth/profile/image", { method: "DELETE" }),
  logout: () => request("/auth/logout", { method: "POST" }),
};

export const predictAPI = {
  predictSingle: (customer_data) => 
    request("/prediction/predict", {
      method: "POST",
      body: JSON.stringify({ customer_data }),
    }),
  predictBatch: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/prediction/predict-batch", {
      method: "POST",
      body: formData,
    });
  },
  getHistory: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return request(`/prediction/history${queryString ? "?" + queryString : ""}`);
  },
  getDetails: (id) => request(`/prediction/prediction/${id}`),
  deletePrediction: (id) => request(`/prediction/prediction/${id}`, { method: "DELETE" }),
  clearHistory: () => request("/prediction/predictions", { method: "DELETE" }),
  getBatchDetails: (batchId) => request(`/prediction/batch/${batchId}`),
  deleteBatch: (batchId) => request(`/prediction/batch/${batchId}`, { method: "DELETE" }),
  getStats: () => request("/prediction/stats"),
  downloadResultsUrl: (batchId) => `${API_URL}/api/prediction/download-results/${batchId}`,
};
