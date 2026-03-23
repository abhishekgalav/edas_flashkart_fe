import {api} from "./api";

// 🔑 Login function
export const login = async (email: string, password: string) => {
  try {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || "Login failed",
    };
  }
};

export const logout = async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
};

export const getFlashSalesEvent = async () => {
  try {
    const response = await api.get("/flash-sale-events/active");
    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to fetch flash sale");
    }
    return response.data.data;
  } catch (err: any) {
    console.error(err);
    return null;
  }
};
