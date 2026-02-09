export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export const TOKEN_STORAGE_KEY = "safety_platform_access_token";

export function saveAccessToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function loginWithPassword(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({} as any));
    const msg = (data && (data.detail || data.message)) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  return resp.json();
}

export async function getCurrentUser() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("No token found");
  }

  const resp = await fetch("/api/auth/users/me", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      clearAccessToken();
    }
    const data = await resp.json().catch(() => ({} as any));
    const msg = (data && (data.detail || data.message)) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  return resp.json();
}
