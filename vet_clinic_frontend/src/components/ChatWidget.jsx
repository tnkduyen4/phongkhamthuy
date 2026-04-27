import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BotMessageSquare, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
    "Tôi muốn đặt lịch khám",
    "Tư vấn tiêm vắc-xin",
    "Lịch làm việc của phòng khám",
    "Bảng giá dịch vụ"
];

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();
    
    // Manage sessionId
    const [sessionId, setSessionId] = useState(localStorage.getItem('chatSessionId'));

    useEffect(() => {
        if (isOpen && sessionId && messages.length === 0) {
            fetchHistory();
        }
    }, [isOpen, sessionId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/history?sessionId=${sessionId}`);
            if (res.data && Array.isArray(res.data)) {
                setMessages(res.data);
            }
        } catch (error) {
            console.error("Lỗi tải lịch sử chat", error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { content: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const token = sessionStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/send`, {
                sessionId,
                message: userMsg.content
            }, { headers });

            if (res.data.sessionId && res.data.sessionId !== sessionId) {
                setSessionId(res.data.sessionId);
                localStorage.setItem('chatSessionId', res.data.sessionId);
            }

            setMessages(prev => [...prev, { content: res.data.response, sender: 'ai' }]);
        } catch (error) {
            console.error("Lỗi gửi tin nhắn", error);
            setMessages(prev => [...prev, { content: "Lỗi kết nối mạng, vui lòng thử lại.", sender: 'ai' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // render logic for text and links
    const renderMessageContent = (content) => {
        if (!content) return null;
        
        // Cập nhật hồi tố (backward compat) cho các lịch hẹn cũ trước khi tính năng này ra mắt
        let processedContent = content;
        if (processedContent.includes('Thành công! Mình đã chốt lịch') && !processedContent.includes('[LINK_APPOINTMENT]')) {
            processedContent += '\n\n[LINK_APPOINTMENT]';
        }
        
        const parts = processedContent.split('[LINK_APPOINTMENT]');
        return (
            <div style={{ whiteSpace: 'pre-wrap' }}>
                {parts.map((part, index) => {
                    // simple bold parser
                    const boldParts = part.split(/(\*\*.*?\*\*)/g);
                    const formattedText = boldParts.map((bp, i) => {
                        if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={i}>{bp.slice(2, -2)}</strong>;
                        return bp;
                    });
                    
                    return (
                        <React.Fragment key={index}>
                            {formattedText}
                            {index < parts.length - 1 && (
                                <div style={{ marginTop: '10px' }}>
                                    <button 
                                        onClick={() => { setIsOpen(false); navigate('/?tab=appointments'); }}
                                        style={{
                                            background: '#f8fafc', color: '#0ea5e9', border: '1px solid #e0f2fe',
                                            padding: '8px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s', width: '100%', justifyContent: 'center'
                                        }}
                                        onMouseEnter={(e)=>e.currentTarget.style.background='#f1f5f9'}
                                        onMouseLeave={(e)=>e.currentTarget.style.background='#f8fafc'}
                                    >
                                        📅 Xem chi tiết lịch hẹn
                                    </button>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: 'var(--font-family, "Inter", system-ui, sans-serif)' }}>
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    background: 'white', width: '360px', borderRadius: '20px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
                    border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '540px', maxHeight: '75vh',
                    marginBottom: '20px', overflow: 'hidden', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Header */}
                    <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#ccfbfb', padding: '8px', borderRadius: '12px' }}>
                                <BotMessageSquare size={24} color="#0fa9ac" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                                    VetCare AI <Sparkles size={14} color="#f59e0b" />
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>Sẵn sàng hỗ trợ 24/7</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.color='#64748b'} onMouseLeave={(e)=>e.currentTarget.style.color='#94a3b8'}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '20px', marginBottom: '10px' }}>
                                <div style={{ width: '48px', height: '48px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <BotMessageSquare size={24} color="#0fa9ac" />
                                </div>
                                <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#0f172a' }}>Xin chào! 👋</p>
                                <p style={{ margin: 0 }}>Mình có thể tư vấn sức khỏe hoặc hỗ trợ đặt lịch hẹn.</p>
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%', padding: '12px 16px', fontSize: '0.9rem', lineHeight: '1.5',
                                    borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.sender === 'user' ? '#0fa9ac' : 'white',
                                    color: msg.sender === 'user' ? 'white' : '#1e293b',
                                    border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                                    boxShadow: msg.sender === 'user' ? '0 2px 6px rgba(15, 169, 172, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                   {renderMessageContent(msg.content)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '16px 16px 16px 0', display: 'flex', gap: '4px' }}>
                                    <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                                    <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}></div>
                                    <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Gợi ý & Input Area */}
                    <div style={{ padding: '14px', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                        {/* Quick Replies */}
                        {!input && (
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '2px', scrollbarWidth: 'none' }}>
                                {SUGGESTIONS.map((sug, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setInput(sug)}
                                        type="button"
                                        style={{
                                            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                                            padding: '8px 14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 600,
                                            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#dcfce7'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Nhắn tin cho VetCare AI..."
                                style={{ 
                                    flex: 1, border: '1px solid #e2e8f0', borderRadius: '24px', padding: '12px 16px', 
                                    fontSize: '0.95rem', outline: 'none', background: '#f8fafc',
                                    fontFamily: 'inherit', transition: 'border 0.2s',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#0fa9ac'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                            <button 
                                type="submit" 
                                disabled={!input.trim() || isLoading}
                                style={{
                                            background: (!input.trim() || isLoading) ? '#cbd5e1' : '#0fa9ac', 
                                            color: 'white', border: 'none',
                                            borderRadius: '24px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                            boxShadow: (!input.trim() || isLoading) ? 'none' : '0 2px 8px rgba(15, 169, 172, 0.3)', flexShrink: 0
                                        }}                       >
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Bubble Button */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    style={{
                        background: '#0fa9ac', color: 'white', border: 'none', borderRadius: '50%', width: '60px', height: '60px',
                        boxShadow: '0 4px 14px rgba(15, 169, 172, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                    </svg>
                </button>
            )}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(0.8); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ChatWidget;
