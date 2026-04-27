import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const ConfirmContext = createContext();

export const useConfirm = () => {
    return useContext(ConfirmContext);
};

export const ConfirmProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Xác nhận',
        cancelText: 'Hủy'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const modalRef = useRef(null);

    const showConfirm = (title, message, onConfirm, confirmText = 'Xác nhận', cancelText = 'Hủy') => {
        setConfig({ title, message, onConfirm, confirmText, cancelText });
        setIsOpen(true);
        setIsSubmitting(false);
    };

    const handleConfirm = async () => {
        if (config.onConfirm) {
            setIsSubmitting(true);
            try {
                await config.onConfirm();
            } finally {
                setIsSubmitting(false);
                setIsOpen(false);
            }
        } else {
            setIsOpen(false);
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') handleCancel();
            // Optional: Enter to confirm could be dangerous for destructive actions
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const modalContent = isOpen ? (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
        }}>
            <div 
                ref={modalRef}
                style={{
                    background: 'white',
                    width: '100%',
                    maxWidth: '400px',
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden',
                    animation: 'scaleIn 0.2s ease-out'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'flex-start', gap: '16px'
                }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: '#fee2e2', color: '#ef4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div style={{ flex: 1, paddingRight: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 600 }}>
                            {config.title}
                        </h3>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {config.message}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    background: '#f8fafc',
                    display: 'flex', justifyContent: 'flex-end', gap: '12px'
                }}>
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        style={{
                            padding: '10px 16px', borderRadius: '8px',
                            background: 'white', color: '#475569',
                            border: '1px solid #cbd5e1', fontWeight: 500,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.6 : 1
                        }}
                    >
                        {config.cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        style={{
                            padding: '10px 16px', borderRadius: '8px',
                            background: '#ef4444', color: 'white',
                            border: 'none', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1,
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        {isSubmitting ? (
                            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                        ) : (
                            <Trash2 size={18} />
                        )}
                        {isSubmitting ? 'Đang xử lý...' : config.confirmText}
                    </button>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    ) : null;

    return (
        <ConfirmContext.Provider value={{ showConfirm }}>
            {children}
            {isOpen && createPortal(modalContent, document.body)}
        </ConfirmContext.Provider>
    );
};
