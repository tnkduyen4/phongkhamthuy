import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

let _id = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = ++_id;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast, showToast: addToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

const STYLES = {
    success: { bg: '#d1fae5', border: '#34d399', icon: '✓', color: '#065f46' },
    error: { bg: '#fee2e2', border: '#f87171', icon: '✕', color: '#991b1b' },
    warning: { bg: '#fef3c7', border: '#fbbf24', icon: '⚠', color: '#92400e' },
    info: { bg: '#e0f2fe', border: '#38bdf8', icon: 'ℹ', color: '#075985' },
};

const ToastContainer = ({ toasts, onRemove }) => (
    <div style={{
        position: 'fixed', top: '20px', right: '20px',
        zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '10px',
        maxWidth: '360px', width: '100%',
    }}>
        {toasts.map(t => {
            const s = STYLES[t.type] || STYLES.success;
            return (
                <div key={t.id} style={{
                    background: s.bg, border: `1px solid ${s.border}`,
                    borderLeft: `4px solid ${s.border}`,
                    color: s.color, borderRadius: '10px',
                    padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    animation: 'toastIn 0.25s ease',
                }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: '0.9rem', lineHeight: 1.5 }}>{t.message}</span>
                    <button
                        onClick={() => onRemove(t.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, opacity: 0.6, fontWeight: 700, fontSize: '1rem', padding: '0 2px', flexShrink: 0 }}
                    >×</button>
                </div>
            );
        })}
        <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }`}</style>
    </div>
);
