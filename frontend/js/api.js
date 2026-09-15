// Обертка над fetch: добавляет токен авторизации, обрабатывает ошибки 401.

const Auth = {
  getToken() {
    return localStorage.getItem("ft_token");
  },
  getUser() {
    const raw = localStorage.getItem("ft_user");
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem("ft_token", token);
    localStorage.setItem("ft_user", JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem("ft_token");
    localStorage.removeItem("ft_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  logout() {
    this.clearSession();
    window.location.href = "index.html";
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "index.html";
    }
  },
};

const Api = {
  async request(path, { method = "GET", body = null, isBlob = false } = {}) {
    const headers = {};
    const token = Auth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });

    if (response.status === 401) {
      Auth.clearSession();
      window.location.href = "index.html";
      throw new Error("Не авторизован");
    }

    if (!response.ok) {
      let detail = "Произошла ошибка";
      try {
        const data = await response.json();
        detail = data.detail
          ? Array.isArray(data.detail)
            ? data.detail.map((d) => d.msg).join(", ")
            : data.detail
          : detail;
      } catch (e) {
        /* ignore parse errors */
      }
      throw new Error(detail);
    }

    if (response.status === 204) return null;
    if (isBlob) return response.blob();
    return response.json();
  },

  // ---- Auth ----
  register(payload) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: payload,
    });
  },
  login(payload) {
    return this.request("/api/auth/login", { method: "POST", body: payload });
  },
  verifyCode(payload) {
    return this.request("/api/auth/verify", { method: "POST", body: payload });
  },
  forgotPassword(payload) {
    return this.request("/api/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },
  resetPassword(payload) {
    return this.request("/api/auth/reset-password", {
      method: "POST",
      body: payload,
    });
  },

  // ---- Profile ----
  getProfile() {
    return this.request("/api/profile");
  },
  updateProfile(payload) {
    return this.request("/api/profile", { method: "PUT", body: payload });
  },

  // ---- Reference data ----
  getCategories() {
    return this.request("/api/categories");
  },

  // ---- Dashboard ----
  getDashboard() {
    return this.request("/api/dashboard");
  },

  // ---- Transactions ----
  listTransactions(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== undefined && v !== "",
        ),
      ),
    ).toString();
    return this.request(`/api/transactions${qs ? "?" + qs : ""}`);
  },
  createTransaction(payload) {
    return this.request("/api/transactions", { method: "POST", body: payload });
  },
  updateTransaction(id, payload) {
    return this.request(`/api/transactions/${id}`, {
      method: "PUT",
      body: payload,
    });
  },
  deleteTransaction(id) {
    return this.request(`/api/transactions/${id}`, { method: "DELETE" });
  },

  // ---- Plans ----
  listPlans(month) {
    const qs = month ? `?month=${month}` : "";
    return this.request(`/api/plans${qs}`);
  },
  savePlan(payload) {
    return this.request("/api/plans", { method: "POST", body: payload });
  },

  // ---- Export ----
  async exportReport({ start, end, expensesOnly }) {
    const params = new URLSearchParams();
    if (start) params.append("start", start);
    if (end) params.append("end", end);
    if (expensesOnly) params.append("expenses_only", "true");
    const blob = await this.request(`/api/export?${params.toString()}`, {
      isBlob: true,
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_report_${start || "all"}_${end || "all"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

function formatMoney(value) {
  const n = Number(value);
  const user = Auth.getUser();
  const currency = user?.currency || "RUB";

  const symbols = {
    RUB: "₽",
    USD: "$",
    EUR: "€",
    KZT: "₸",
    BYN: "Br",
    UAH: "₴",
  };

  const symbol = symbols[currency] || "₽";
  return (
    n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    " " +
    symbol
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
