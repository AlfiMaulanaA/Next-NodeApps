// lib/api-service.ts

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export type LoginResponse = {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
};

export const api = {
  async post<T = any>(endpoint: string, body: Record<string, any>): Promise<T> {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Something went wrong");
    }

    return response.json();
  },

  async loginUser(username: string, password: string): Promise<LoginResponse> {
    try {
      const data = await this.post<LoginResponse>("/users/login", { username, password });
      return {
        ...data,
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Something went wrong",
      };
    }
  }  
};

export default api;
