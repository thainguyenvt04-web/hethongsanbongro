import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getBookingsByUser, SavedBooking } from '../lib/bookingStore';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { format } from 'date-fns';
import { Receipt, QrCode, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';

export const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);
  const [payosData, setPayosData] = useState<{checkoutUrl: string, qrCode: string} | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await getBookingsByUser(user!.id);
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  const fallbackToStaticQR = (b: SavedBooking) => {
     const url = `https://img.vietqr.io/image/970418-7660290201-compact2.png?amount=${b.total}&addInfo=${b.id}&accountName=NGUYEN%20HUY%20THAI%20NGUYEN`;
     setFallbackUrl(url);
     setPayosData(null);
     setShowPaymentModal(true);
  };

  const openPayment = async (b: SavedBooking) => {
    setSelectedBooking(b);
    setPayosData(null);
    setFallbackUrl(null);
    
    // Kiểm tra trong localStorage trước
    const saved = localStorage.getItem(`payos_${b.id}`);
    if (saved) {
      setPayosData(JSON.parse(saved));
      setShowPaymentModal(true);
      return;
    }

    // Nếu không có, gọi API tạo lại QR
    let orderCode = Number(b.id);
    if (isNaN(orderCode)) {
      // Fallback ngay với đơn cũ
      fallbackToStaticQR(b);
      return;
    }

    setLoadingPayment(true);
    try {
      const res = await fetch('/api/recreate-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldOrderCode: orderCode,
          amount: b.total,
          description: 'Thanh toan san',
          returnUrl: `${window.location.origin}/#/my-bookings`,
          cancelUrl: `${window.location.origin}/#/my-bookings`
        })
      });
      const data = await res.json();
      if (data.error === 0 && data.data) {
         setPayosData(data.data);
         localStorage.setItem(`payos_${data.data.newOrderCode}`, JSON.stringify({
           checkoutUrl: data.data.checkoutUrl,
           qrCode: data.data.qrCode
         }));
         // Refresh list để lấy ID mới nhất
         fetchBookings();
         setShowPaymentModal(true);
      } else {
         // Lỗi logic từ PayOS, fallback
         fallbackToStaticQR(b);
      }
    } catch (e) {
      // Lỗi mạng hoặc server sập, fallback
      fallbackToStaticQR(b);
    } finally {
      setLoadingPayment(false);
    }
  };

  const getStatusInfo = (b: SavedBooking) => {
    if (b.paid) return {
      label: 'Đã thanh toán',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    };
    return {
      label: 'Chờ xác nhận',
      icon: <Clock className="w-3.5 h-3.5" />,
      className: 'bg-orange-500 hover:bg-orange-600 text-white',
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center p-16 text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Đang tải...
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-2 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Đơn Hàng Của Tôi</h1>
          <p className="text-slate-500">Lịch sử đặt sân và trạng thái thanh toán.</p>
        </div>
        <Button onClick={fetchBookings} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Làm mới
        </Button>
      </div>

      {bookings.length === 0 ? (
        <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Receipt className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium">Bạn chưa có đơn đặt sân nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bookings.map((b) => {
            const status = getStatusInfo(b);
            return (
              <Card key={b.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row">
                  {/* Thông tin chính */}
                  <div className="flex-1 p-5 lg:p-6">
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{b.courtName}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{b.id}</p>
                      </div>
                      <Badge className={status.className + ' flex items-center gap-1 shrink-0'}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Ngày chơi</p>
                        <p className="font-semibold">{format(new Date(b.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Khung giờ</p>
                        <p className="font-semibold text-blue-600">
                          {b.ranges.map(r => `${r.start}:00–${r.end}:00`).join(', ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Người đặt</p>
                        <p className="font-semibold">{b.customerName} · {b.customerPhone}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Đặt lúc</p>
                        <p className="font-semibold text-slate-500">{new Date(b.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>

                    {/* Hướng dẫn trạng thái */}
                    {!b.paid && (
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-700 leading-relaxed">
                        ⏳ <strong>Đơn của bạn đang chờ thanh toán.</strong> Bấm "Thanh toán PayOS" để quét mã thanh toán tự động duyệt.
                      </div>
                    )}
                    {b.paid && (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                        ✅ <strong>Đã được xác nhận!</strong> Đến sân đúng giờ, vào tab <strong>Quét Mã Mở Cửa</strong> để check-in.
                      </div>
                    )}
                  </div>

                  {/* Phần thanh toán */}
                  <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 p-5 md:w-56 flex flex-col justify-center items-center text-center gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Tổng cộng</p>
                      <p className="text-2xl font-bold text-orange-500">{b.total.toLocaleString('vi-VN')}đ</p>
                    </div>

                    {!b.paid ? (
                      <Button
                        onClick={() => openPayment(b)}
                        disabled={loadingPayment}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow gap-1.5"
                      >
                        <QrCode className="w-4 h-4" /> {loadingPayment && selectedBooking?.id === b.id ? 'Đang tạo QR...' : 'Thanh toán PayOS'}
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-8 h-8" />
                        <p className="text-xs font-semibold">Sẵn sàng Check-in</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal QR PayOS */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Thanh toán qua PayOS</DialogTitle>
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white text-center">
            <h2 className="text-xl font-bold">Thanh toán tự động</h2>
            <p className="text-white/80 text-sm mt-1">Quét bằng app ngân hàng của bạn</p>
          </div>

          <div className="p-5 space-y-4 flex flex-col items-center">
            {payosData?.qrCode && (
              <div className="border-4 border-slate-100 rounded-2xl p-2 shadow-inner bg-white">
                 <QRCodeCanvas value={payosData.qrCode} size={200} />
              </div>
            )}

            {fallbackUrl && (
              <div className="border-4 border-slate-100 rounded-2xl p-2 shadow-inner bg-white">
                 <img src={fallbackUrl} alt="QR Thanh toán" className="w-[200px] h-auto" onError={(e) => { (e.target as HTMLImageElement).src = '/qrthanhtoan_bidv.png'; }} />
              </div>
            )}

            {/* Thông tin thanh toán */}
            <div className="w-full bg-slate-50 rounded-xl p-4 text-sm space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Số tiền</span>
                <span className="font-bold text-orange-600 text-base">
                  {selectedBooking?.total.toLocaleString('vi-VN')} VND
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 text-center mt-2">
                 <p className="text-xs text-slate-400">
                    {payosData?.checkoutUrl 
                      ? "Đơn hàng sẽ tự động duyệt sau khi thanh toán thành công." 
                      : "Vui lòng quét mã trên. Admin sẽ duyệt đơn thủ công sau khi nhận được tiền."}
                 </p>
                 {fallbackUrl && (
                    <div className="mt-2 text-left bg-slate-900 text-slate-300 p-2 rounded text-xs font-mono">
                      Nội dung DK (BẮT BUỘC): <span className="text-white">{selectedBooking?.id}</span>
                    </div>
                 )}
              </div>
            </div>

            {payosData?.checkoutUrl && (
               <Button onClick={() => window.location.href = payosData.checkoutUrl} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-md font-bold py-6 shadow-lg">
                 Mở cổng thanh toán (Trình duyệt)
               </Button>
            )}

            <Button onClick={() => setShowPaymentModal(false)} variant="ghost" className="w-full text-slate-500 hover:text-slate-700">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
