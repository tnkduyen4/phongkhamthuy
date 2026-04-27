import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageSquare, X, Send, User, ChevronLeft, CheckCircle } from 'lucide-react';

const QUICK_REPLIES = [
    "Dạ phòng khám chuyên khoa thú y xin chào! Lễ tân có thể hỗ trợ gì cho bé ạ?",
    "Dạ bạn đợi xíu, để Lễ tân kiểm tra lịch trống của Bác sĩ nhé.",
    "Dạ bạn cho Lễ tân xin tên bé và số điện thoại đặt lịch nha.",
    "Dạ hình như bạn đang bận? Lễ tân vẫn đang chờ hỗ trợ bạn ạ.",
    "Dạ thông tin đã được ghi nhận. Cảm ơn bạn và chúc bé nhiều sức khỏe!"
];

const AdminChatPanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const pollingRef = useRef(null);

    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchSessions = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/sessions`, { headers });
            if (res.data.success) {
                setSessions(res.data.data);
            }
        } catch (error) {
            console.error("Lỗi lấy danh sách chat", error);
        }
    };

    const fetchMessages = async (sid) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/history?sessionId=${sid}`, { headers });
            setMessages(res.data);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } catch (error) {
            console.error("Lỗi lấy tin nhắn", error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
            pollingRef.current = setInterval(() => {
                fetchSessions();
                if (selectedSessionId) {
                    fetchMessages(selectedSessionId);
                }
            }, 3000); 
        } else {
            clearInterval(pollingRef.current);
            const slowPoll = setInterval(fetchSessions, 10000);
            return () => clearInterval(slowPoll);
        }

        return () => clearInterval(pollingRef.current);
    }, [isOpen, selectedSessionId]);

    const handleSelectSession = (sid) => {
        setSelectedSessionId(sid);
        fetchMessages(sid);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedSessionId) return;

        const tempMsg = { content: input, sender: 'staff', _id: Date.now() };
        setMessages(prev => [...prev, tempMsg]);
        setInput('');
        setIsLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/reply`, {
                sessionId: selectedSessionId,
                message: tempMsg.content
            }, { headers });
            fetchMessages(selectedSessionId);
            fetchSessions();
        } catch (error) {
            console.error("Lỗi gửi tin", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedSessionId) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/chat/resolve`, {
                sessionId: selectedSessionId
            }, { headers });
            setSelectedSessionId(null);
            fetchSessions();
        } catch (error) {
            console.error("Lỗi kết thúc", error);
        }
    };

    const urgentCount = sessions.filter(s => s.status === 'human_intervention').length;

    return (
        <div style={{ position: 'relative', fontFamily: 'var(--font-family, "Inter", system-ui, sans-serif)' }}>
            {/* Icon chuông tin nhắn */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    width: '42px', height: '42px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: isOpen ? 'var(--primary)' : 'white',
                    color: isOpen ? 'white' : '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s',
                }}
                title="Hỗ trợ Khách hàng"
            >
                <MessageSquare size={20} />
                {urgentCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px',
                        background: '#f43f5e', borderRadius: '50%', color: 'white', display: 'flex',
                        justifyContent: 'center', alignItems: 'center', fontSize: '10px', fontWeight: 'bold',
                        border: '2px solid white'
                    }}>
                        {urgentCount}
                    </span>
                )}
            </button>

            {/* Popup Panel */}
            {isOpen && (
                <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: '380px', background: 'white',
                    borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999,
                    height: '550px', maxHeight: '85vh',
                    animation: 'slideDown 0.2s ease-out'
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'white' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedSessionId && (
                                <button onClick={() => setSelectedSessionId(null)} style={{
                                    background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
                                }}>
                                    <ChevronLeft size={18} />
                                </button>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: '#ccfbfb', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                    <MessageSquare size={16} color="#0fa9ac" /> 
                                </div>
                                {selectedSessionId ? 'Tư vấn trực tiếp' : 'Danh sách hỗ trợ'}
                            </span>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                            <X size={18} />
                        </button>
                    </div>

                    {!selectedSessionId ? (
                        /* Danh sách Sessions */
                        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '12px' }}>
                            {sessions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                        <CheckCircle size={28} color="#cbd5e1" />
                                    </div>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Hộp thư đang trống</p>
                                    <p style={{ margin: 0, fontSize: '12px', marginTop: '4px' }}>AI đang tự động xử lý tốt mọi yêu cầu.</p>
                                </div>
                            ) : (
                                sessions.map(s => {
                                    const isUrgent = s.status === 'human_intervention';
                                    return (
                                    <div 
                                        key={s._id} 
                                        onClick={() => handleSelectSession(s._id)}
                                        style={{
                                            padding: '12px 16px', background: isUrgent ? '#fff7ed' : 'white',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                                            border: isUrgent ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                            borderRadius: '12px', marginBottom: '8px', transition: 'all 0.2s',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                        }}
                                        onMouseEnter={(e)=>e.currentTarget.style.transform='translateY(-1px)'}
                                        onMouseLeave={(e)=>e.currentTarget.style.transform='translateY(0)'}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            color: '#64748b', overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {s.userId?.avatar ? <img src={s.userId.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/> : <User size={18} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {s.userId?.fullName || 'Khách vãng lai'}
                                                </div>
                                                <div style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8', flexShrink: 0 }}>
                                                    {new Date(s.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {isUrgent ? (
                                                    <span style={{ color: '#e11d48', fontWeight: 600, background: '#ffe4e6', padding: '2px 6px', borderRadius: '4px' }}>Cần Lễ tân hỗ trợ</span>
                                                ) : (
                                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                                                        AI đang tự động xử lý
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )})
                            )}
                        </div>
                    ) : (
                        /* Chi tiết Chat */
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#f8fafc' }}>
                            {/* Nút Resolve */}
                            <div style={{
                                background: '#fffbeb', padding: '8px 16px', fontSize: '11px', color: '#92400e', 
                                borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', 
                                alignItems: 'center', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10
                            }}>
                                <span style={{ fontWeight: 500 }}>Lễ tân tiếp quản (Đã ngắt kết nối AI)</span>
                                <button onClick={handleResolve} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', background: '#0fa9ac', color: 'white', 
                                    padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', 
                                    fontWeight: 600, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px', transition: 'background 0.2s'
                                }}>
                                    <CheckCircle size={12} strokeWidth={2.5} /> Bàn giao lại cho AI
                                </button>
                            </div>

                            {/* Khung tin nhắn */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {messages.map((msg, i) => {
                                    const isCustomer = msg.sender === 'user';
                                    const isStaff = msg.sender === 'staff';
                                    const isAI = msg.sender === 'ai';
                                    
                                    return (
                                        <div key={msg._id || i} style={{ display: 'flex', justifyContent: isCustomer ? 'flex-start' : 'flex-end' }}>
                                            <div style={{
                                                maxWidth: '85%', padding: '12px 14px', fontSize: '13px', lineHeight: '1.4',
                                                position: 'relative',
                                                borderRadius: isCustomer ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                                                background: isCustomer ? 'white' : isStaff ? '#0fa9ac' : '#f1f5f9',
                                                color: isCustomer ? '#1e293b' : isStaff ? 'white' : '#1e293b',
                                                border: isCustomer ? '1px solid #e2e8f0' : (isStaff ? 'none' : '1px solid #e2e8f0'),
                                                boxShadow: isCustomer ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                            }}>
                                                {!isCustomer && (
                                                    <div style={{ 
                                                        fontSize: '10px', fontWeight: 600, marginBottom: '6px', opacity: 0.9,
                                                        color: isStaff ? '#ccfbfb' : '#64748b'
                                                    }}>
                                                        {isStaff ? 'Lễ tân' : 'VetCare AI'}
                                                    </div>
                                                )}
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Cụm gửi tin */}
                            <form onSubmit={handleSend} style={{ 
                                padding: '12px', background: 'white', borderTop: '1px solid #e2e8f0', 
                                flexShrink: 0, zIndex: 10, boxShadow: '0 -4px 10px rgba(0,0,0,0.02)'
                            }}>
                                {/* Tin nhắn mẫu nhanh */}
                                <div style={{ 
                                    display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '4px',
                                    scrollbarWidth: 'none'
                                }}>
                                    {QUICK_REPLIES.map((qr, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => { setInput(qr); }}
                                            type="button"
                                            style={{
                                                whiteSpace: 'nowrap', background: '#f0fdfa', color: '#0d9488', 
                                                border: '1px solid #ccfbfb', padding: '6px 14px', borderRadius: '16px', 
                                                fontSize: '11px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e)=>e.currentTarget.style.background='#ccfbfb'}
                                            onMouseLeave={(e)=>e.currentTarget.style.background='#f0fdfa'}
                                        >
                                            {qr}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ 
                                    display: 'flex', alignItems: 'flex-end', gap: '8px', background: '#f8fafc', 
                                    border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px'
                                }}>
                                    <textarea 
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                                        }}
                                        placeholder="Nhập phản hồi cho khách..."
                                        style={{
                                            flex: 1, background: 'transparent', border: 'none', padding: '8px 12px', 
                                            fontSize: '14px', resize: 'none', outline: 'none', minHeight: '40px', maxHeight: '96px', fontFamily: 'inherit'
                                        }}
                                        rows={1}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!input.trim() || isLoading}
                                        style={{
                                            background: (!input.trim() || isLoading) ? '#94a3b8' : '#0fa9ac', 
                                            color: 'white', padding: '10px', borderRadius: '8px', border: 'none', 
                                            cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer', flexShrink: 0, marginBottom: '2px', marginRight: '2px', transition: 'background 0.2s'
                                        }}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', mt: '8px', fontWeight: 500, marginTop: '8px' }}>Ấn Enter để gửi</div>
                            </form>
                        </div>
                    )}
                </div>
            )}
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default AdminChatPanel;
