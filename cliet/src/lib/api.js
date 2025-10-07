const API_BASE = import.meta.env.VITE_API_BASE || "";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export async function apiFetch(path, opts = {}) {
  const { method = "GET", headers = {}, body, isForm = false } = opts;
  const init = { method, headers: { ...headers, ...authHeader() } };
  if (body !== undefined) {
    if (isForm) {
      init.body = body; // FormData
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  let data;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text().catch(() => null);
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || res.statusText || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const get = (path, headers) => apiFetch(path, { method: "GET", headers });
export const post = (path, body, headers) => apiFetch(path, { method: "POST", body, headers });
export const postForm = (path, formData, headers) => apiFetch(path, { method: "POST", body: formData, headers, isForm: true });
