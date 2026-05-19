import React, { useState, useEffect } from 'react';

const CustomerDisplay = () => {
    const [status, setStatus] = useState('IDLE'); // IDLE | PAYING | SUCCESS
    const [data, setData] = useState({
        total: 0,
        customerName: '',
        qrUrl: '',
        memo: ''
    });

    useEffect(() => {
        const handleStorage = () => {
            const current = localStorage.getItem('vetcare_customer_display');
            if (current) {
                const parsed = JSON.parse(current);
                setData(parsed);
                setStatus(parsed.status || 'PAYING');
            } else {
                setStatus('IDLE');
            }
        };

        // Listen for storage changes from main window
        window.addEventListener('storage', handleStorage);
        // Initial check
        handleStorage();

        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const fmt = (v) => new Intl.NumberFormat('vi-VN').format(v || 0);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: status === 'IDLE' ? '#0f172a' : status === 'SUCCESS' ? '#065f46' : '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'background 0.5s ease',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            {status === 'IDLE' ? (
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 900, marginBottom: '20px', letterSpacing: '-0.02em' }}>VETCARE</div>
                    <div style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', opacity: 0.6 }}>Chào mừng bạn đến với trung tâm thú cưng</div>
                </div>
            ) : status === 'SUCCESS' ? (
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 900, marginBottom: '20px', color: '#fff', border: '5px solid #fff', borderRadius: '50%', width: 'clamp(80px, 20vw, 120px)', height: 'clamp(80px, 20vw, 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>OK</div>
                    <div style={{ fontSize: 'clamp(1.5rem, 6vw, 3.5rem)', fontWeight: 900, marginBottom: '10px' }}>THANH TOÁN THÀNH CÔNG</div>
                    <div style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)', opacity: 0.8 }}>Cảm ơn {data.customerName}! Chúc bạn và bé một ngày tốt lành.</div>
                </div>
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', overflow: 'auto' }} className="customer-display-container">
                    {/* Left Panel: Info */}
                    <div style={{ flex: '1 1 300px', background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(20px, 5vw, 100px)' }}>
                        <div style={{ fontSize: 'clamp(0.9rem, 2vw, 1.2rem)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '20px' }}>Tổng số tiền thanh toán</div>
                        <div style={{ fontSize: 'clamp(3rem, 10vw, 8rem)', fontWeight: 900, color: '#10b981', lineHeight: 1, marginBottom: '20px', wordBreak: 'break-word' }}>
                            {fmt(data.total)}<span style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', marginLeft: '10px' }}>đ</span>
                        </div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.1)', width: '100%', marginBottom: '40px' }}></div>
                        <div style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', marginBottom: '8px' }}>Khách hàng: <strong style={{ color: '#fff' }}>{data.customerName || 'Quý khách'}</strong></div>
                        <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8' }}>Nội dung: <span style={{ color: '#fbbf24' }}>{data.memo}</span></div>
                    </div>

                    {/* Right Panel: QR */}
                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: 'clamp(20px, 5vw, 40px)', background: '#fff' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 800, color: '#1e293b' }}>Quét mã QR để trả tiền</div>
                            <div style={{ fontSize: 'clamp(1rem, 3vw, 1.3rem)', color: '#64748b', marginTop: '10px' }}>Sử dụng Mobile Banking bất kỳ</div>
                        </div>

                        <div style={{ padding: 'clamp(10px, 3vw, 20px)', border: 'clamp(4px, 1vw, 8px) solid #6366f1', borderRadius: 'clamp(20px, 5vw, 40px)', background: '#f8fafc', width: 'fit-content' }}>
                            <img
                                src={data.qrUrl}
                                alt="QR Payment"
                                style={{ width: '100%', maxWidth: '450px', height: 'auto', aspectRatio: '1/1', display: 'block', borderRadius: 'clamp(10px, 3vw, 20px)' }}
                            />
                        </div>

                        <div style={{ padding: 'clamp(10px, 3vw, 20px) clamp(20px, 5vw, 40px)', background: '#f0fdf4', border: '3px solid #34d399', borderRadius: '20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 'clamp(0.9rem, 2vw, 1.2rem)', color: '#065f46', marginBottom: '4px' }}>Số tiền cần chuyển</div>
                            <div style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, color: '#059669' }}>{fmt(data.total)} đ</div>
                        </div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 768px) {
                    .customer-display-container {
                        flex-direction: column !important;
                    }
                }
            `}} />
        </div>
    );
};

export default CustomerDisplay;
