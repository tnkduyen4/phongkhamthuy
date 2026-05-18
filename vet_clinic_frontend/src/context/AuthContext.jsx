import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API } from '../constants';

// Tạo Context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkLoggedIn = async () => {
            const token = sessionStorage.getItem('token');
            if (token) {
                try {
                    const res = await axios.get(`${API}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUser(res.data.data);
                } catch (error) {
                    console.error("Token hết hạn hoặc không hợp lệ", error);
                    sessionStorage.removeItem('token');
                }
            }
            setLoading(false);
        };
        checkLoggedIn();
    }, []);

    const login = async (phoneNumber, password) => {
        const res = await axios.post(`${API}/auth/login`, { phoneNumber, password });
        if (res.data.success) {
            const token = res.data.data.token;
            sessionStorage.setItem('token', token);

            // Lấy thông tin user sau khi có token
            const meRes = await axios.get('https://vet-clinic-backend-tgtd.onrender.com/api/v1/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(meRes.data.data);
            return { 
                success: true, 
                user: meRes.data.data, 
                requiresPasswordChange: res.data.data.requiresPasswordChange,
                requiresFaceRegistration: res.data.data.requiresFaceRegistration
            };
        }
        return { success: false };
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        setUser(null);
    };

    // Patch cục bộ user trong context (không cần re-fetch)
    const updateUser = (patch) => setUser(prev => prev ? { ...prev, ...patch } : prev);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
