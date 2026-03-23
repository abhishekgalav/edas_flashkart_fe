import axios from "axios";

export const api = axios.create({
    baseURL: "http://localhost:4500",
});

// 🔐 Automatically attach token
api.interceptors.request.use((config) => {
    const access_token = localStorage.getItem("access_token");

    if (access_token) {
        config.headers.Authorization = `Bearer ${access_token}`;
    }

    if (!(config.data instanceof FormData)) {
        config.headers["Content-Type"] = "application/json";
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);