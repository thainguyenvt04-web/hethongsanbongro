import React, { useState, useEffect, useMemo } from 'react';
import { supabase, Court, isMockMode } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { addDays, format, isSameDay, startOfToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Edit2 } from 'lucide-react';
import { saveBooking, markBookingPaid, getBookings, SavedBooking } from '../lib/bookingStore';
type BookedSlot = { date: string; hour: number };

export const Booking = () => {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState('1');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [payosCheckoutUrl, setPayosCheckoutUrl] = useState<string | null>(null);
  const [payosQrCode, setPayosQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const getInitialContact = (type: 'name' | 'phone') => {
    const staticVal = localStorage.getItem(`staticCustomer${type === 'name' ? 'Name' : 'Phone'}`);
    const tempVal = localStorage.getItem(`tempCustomer${type === 'name' ? 'Name' : 'Phone'}`);
    const expiry = localStorage.getItem('tempCustomerExpiry');
    
    if (tempVal && expiry && Date.now() < parseInt(expiry, 10)) {
      return tempVal;
    }
    return staticVal || localStorage.getItem(`savedCustomer${type === 'name' ? 'Name' : 'Phone'}`) || '';
  };

  const [customerName, setCustomerName] = useState(() => getInitialContact('name'));
  const [customerPhone, setCustomerPhone] = useState(() => getInitialContact('phone'));
  const [isEditingContact, setIsEditingContact] = useState(() => {
    return !(getInitialContact('name') && getInitialContact('phone'));
  });
  const [receiptData, setReceiptData] = useState<{
    date: Date;
    total: number;
    name: string;
    phone: string;
    ranges: {start: number, end: number}[];
  } | null>(null);

  const nextAvailableDays = useMemo(() => {
    const today = startOfToday();
    // Tăng lên 21 ngày (3 tuần) để cho phép đặt tuần sau và tuần sau nữa
    return Array.from({ length: 21 }).map((_, i) => addDays(today, i));
  }, []);

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [allBookings, setAllBookings] = useState<SavedBooking[]>([]);

  useEffect(() => {
    fetchCourts();
    fetchAllBookings();
  }, []);

  const fetchAllBookings = async () => {
    try {
      const data = await getBookings();
      setAllBookings(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const getSlotStatus = (date: Date, hour: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const currentHour = new Date().getHours();

    // 1. Nếu ngày hôm nay và giờ đã qua -> Đỏ
    if (dateStr === todayStr && hour < currentHour) {
      return 'passed';
    }
    // Hoặc ngày trong quá khứ -> Đỏ
    if (date < startOfToday()) {
      return 'passed';
    }

    // 2. Lấy booking thật từ database
    const booking = allBookings.find(b => 
      b.courtId === selectedCourt && 
      b.date === dateStr && 
      b.ranges.some(r => hour >= r.start && hour < r.end)
    );

    if (booking) {
      return booking.paid ? 'paid' : 'unpaid';
    }

    // 3. Fallback cho bookedSlots local vừa đặt trong session này
    const localBookings = bookedSlots.some(b => b.date === dateStr && b.hour === hour);
    if (localBookings) return 'unpaid';

    return 'available';
  };

  const fetchCourts = async () => {
    try {
      if (isMockMode) throw new Error('Mock mode enabled');
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      setCourts(data || []);
    } catch (error: any) {
      if (error?.message !== 'Mock mode enabled') {
        console.error('Error fetching courts:', error);
      }
      setCourts([
        { id: '1', name: 'Sân A - Trong nhà (VIP)', status: 'available', price_morning: 2000, price_afternoon: 2000, price_evening: 2000 },
        { id: '2', name: 'Sân B - Ngoài trời', status: 'available', price_morning: 2000, price_afternoon: 2000, price_evening: 2000 },
      ]);
    }
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const hasMorning = [6,7,8,9,10,11].some(h => getSlotStatus(date, h) === 'paid' || getSlotStatus(date, h) === 'unpaid');
    const hasAfternoon = [12,13,14,15,16,17].some(h => getSlotStatus(date, h) === 'paid' || getSlotStatus(date, h) === 'unpaid');
    const hasEvening = [18,19,20,21,22,23].some(h => getSlotStatus(date, h) === 'paid' || getSlotStatus(date, h) === 'unpaid');
    
    return { hasMorning, hasAfternoon, hasEvening };
  };

  const handleHourClick = (hour: number) => {
    const status = getSlotStatus(selectedDate, hour);
    if (status === 'passed' || status === 'paid' || status === 'unpaid') return;

    setSelectedHours(prev => {
      // Logic: nếu ấn vào giờ đã chọn thì bỏ chọn, nếu chưa thì thêm vào (cho phép chọn ngắt quãng hoặc liên tục)
      if (prev.includes(hour)) {
        return prev.filter(h => h !== hour);
      }
      return [...prev, hour].sort((a, b) => a - b);
    });
  };

  // Tính giá tuỳ theo giờ và theo sân
  const getPricePerHour = (hour: number) => {
    const defaultMorn = 2000, defaultAft = 2000, defaultEve = 2000;
    const court = courts.find(c => c.id === selectedCourt);
    const pMorn = court?.price_morning || defaultMorn;
    const pAft  = court?.price_afternoon || defaultAft;
    const pEve  = court?.price_evening || defaultEve;

    if (hour < 12) return pMorn; // Sáng (6h-12h)
    if (hour < 17) return pAft;  // Trưa/Chiều (12h-17h)
    return pEve;                 // Tối (17h-23h)
  };

  const calculateTotal = () => {
    return selectedHours.reduce((acc, hour) => acc + getPricePerHour(hour), 0);
  };

  const handleBooking = async () => {
    if (selectedHours.length === 0 || !user) {
      toast.error('Vui lòng chọn ít nhất 1 khung giờ!');
      return;
    }
    
    if (!customerName || customerName.trim().length < 2) {
      toast.error('Vui lòng nhập Tên của bạn để xác nhận!');
      return;
    }
    
    if (!customerPhone || customerPhone.trim().length < 9) {
      toast.error('Vui lòng nhập Số điện thoại hợp lệ để xác nhận!');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Tạo mã QR bao gồm tất cả các giờ
      const ranges = getSelectedRanges();
      const timeStr = ranges.map(r => `T${r.start}to${r.end}`).join('_');
      
      const qrString = `COURT_${selectedCourt}_DATE_${dateStr}_${timeStr}_USER_${user.id}`;
      
      setBookedSlots(prev => [
        ...prev,
        ...selectedHours.map(hour => ({ date: dateStr, hour }))
      ]);

      // Lưu lại thông tin liên hệ tĩnh/động cho lần sau
      const currentStaticName = localStorage.getItem('staticCustomerName') || localStorage.getItem('savedCustomerName');
      const currentStaticPhone = localStorage.getItem('staticCustomerPhone') || localStorage.getItem('savedCustomerPhone');
      const trimmedName = customerName.trim();
      const trimmedPhone = customerPhone.trim();

      if (!currentStaticName || !currentStaticPhone) {
         localStorage.setItem('staticCustomerName', trimmedName);
         localStorage.setItem('staticCustomerPhone', trimmedPhone);
         localStorage.setItem('savedCustomerName', trimmedName); // tương thích ngược
         localStorage.setItem('savedCustomerPhone', trimmedPhone);
         localStorage.removeItem('tempCustomerName');
         localStorage.removeItem('tempCustomerPhone');
         localStorage.removeItem('tempCustomerExpiry');
      } else if (trimmedName !== currentStaticName || trimmedPhone !== currentStaticPhone) {
         localStorage.setItem('tempCustomerName', trimmedName);
         localStorage.setItem('tempCustomerPhone', trimmedPhone);
         localStorage.setItem('tempCustomerExpiry', (Date.now() + 15 * 60 * 1000).toString());
      } else {
         localStorage.removeItem('tempCustomerName');
         localStorage.removeItem('tempCustomerPhone');
         localStorage.removeItem('tempCustomerExpiry');
      }
      setIsEditingContact(false);

      // Tạo Order Code duy nhất cho cả Booking ID và PayOS
      const generatedOrderCode = Number(String(Date.now()).slice(-9) + Math.floor(Math.random() * 10));

      // Lưu booking vào store chung để trang Điều khiển có thể đọc
      const courtName = courts.find(c => c.id === selectedCourt)?.name || `Sân ${selectedCourt}`;
      await saveBooking({
        id: generatedOrderCode.toString(), // Dùng orderCode làm ID
        courtId: selectedCourt,
        courtName,
        userId: user.id,
        userEmail: user.email || '',
        customerName: customerName.trim(),
        customerPhone: customerPhone,
        date: dateStr,
        ranges: getSelectedRanges(),
        total: calculateTotal(),
        paid: false, // Đặt là false (chờ Admin xác nhận thanh toán)
        createdAt: new Date().toISOString(),
      });

      toast.success('Đặt sân thành công! Cảm ơn bạn.');
      setQrCode(qrString);
      setReceiptData({
         date: selectedDate,
         total: calculateTotal(),
         name: customerName,
         phone: customerPhone,
         ranges: getSelectedRanges()
      });

      // Gọi API Node.js/Express để tạo link thanh toán PayOS
      try {
        const payosRes = await fetch('/api/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: calculateTotal(),
            description: `Thanh toan san`,
            orderCode: generatedOrderCode, // Sử dụng Order Code chung
            returnUrl: `${window.location.origin}/#/booking`,
            cancelUrl: `${window.location.origin}/#/booking`
          })
        });
        const payosData = await payosRes.json();
        if (payosData && payosData.error === 0 && payosData.data?.checkoutUrl) {
          setPayosCheckoutUrl(payosData.data.checkoutUrl);
          setPayosQrCode(payosData.data.qrCode);
          // Lưu lại thông tin PayOS vào local storage để MyBookings có thể hiển thị lại
          localStorage.setItem(`payos_${generatedOrderCode}`, JSON.stringify({
            checkoutUrl: payosData.data.checkoutUrl,
            qrCode: payosData.data.qrCode
          }));
        } else {
          console.error('PayOS error response:', payosData);
          setPayosCheckoutUrl(null); 
          setPayosQrCode(null);
        }
      } catch (err) {
        console.error('PayOS API error:', err);
        setPayosCheckoutUrl(null); 
        setPayosQrCode(null);
      }

      setShowQR(true);
      // Giờ đã lưu vào receiptData, có thể xóa selectedHours thoải mái
      setSelectedHours([]);
    } catch (error) {
      toast.error('Lỗi khi đặt sân.');
    } finally {
      setLoading(false);
    }
  };

  // Gộp các giờ liên tục thành khoảng (vd: 6,7,8 -> 6:00 đến 9:00)
  const getSelectedRanges = () => {
    if (selectedHours.length === 0) return [];
    
    let ranges = [];
    let start = selectedHours[0];
    let end = start + 1;

    for (let i = 1; i < selectedHours.length; i++) {
        if (selectedHours[i] === end) {
            // Liên tục
            end++;
        } else {
            // Bị ngắt quãng
            ranges.push({ start, end });
            start = selectedHours[i];
            end = start + 1;
        }
    }
    ranges.push({ start, end });
    return ranges;
  };

  const downloadQR = () => {
    const canvas = document.getElementById("payos-qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR_ThanhToan_${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } else {
      toast.error('Không tìm thấy mã QR để tải!');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-48">
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 drop-shadow-sm">
          Lịch Sân {courts.find(c => c.id === selectedCourt)?.name?.split('-')[0] || ''}
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl">Trải nghiệm đặt sân thế hệ mới. Linh hoạt chọn giờ, tự động tính giá và Check-in tự động 100%.</p>
      </div>

      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              1. Chọn Ngày Chơi
            </h3>
            <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide py-2 px-1">
              {nextAvailableDays.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const { hasMorning, hasAfternoon, hasEvening } = getDayStatus(date);
                
                return (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={date.toString()}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedHours([]);
                    }}
                    className={`flex flex-col items-center justify-between min-w-[80px] h-[110px] rounded-2xl border-2 transition-all duration-300 overflow-hidden relative cursor-pointer shadow-sm
                      ${isSelected ? 'border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/20' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                  >
                    <div className="pt-3 pb-1 text-center w-full z-10 bg-white/50 backdrop-blur-sm">
                      <span className="block text-xs font-medium text-slate-500 capitalize">
                        {format(date, 'EEEE', { locale: vi }).replace('thứ', 'Thứ').replace('chủ nhật', 'Chủ nhật')}
                      </span>
                      <span className={`block text-2xl font-bold mt-1 ${isSelected ? 'text-orange-600' : 'text-slate-800'}`}>
                        {format(date, 'dd')}
                      </span>
                    </div>
                    <div className="flex w-full h-[6px] mt-auto">
                       <div className={`w-1/3 h-full transition-colors ${hasMorning ? 'bg-emerald-500' : 'bg-slate-200'}`} title="Sáng có người"></div>
                       <div className={`w-1/3 h-full transition-colors ${hasAfternoon ? 'bg-amber-400' : 'bg-slate-200'}`} title="Chiều có người"></div>
                       <div className={`w-1/3 h-full transition-colors ${hasEvening ? 'bg-slate-900' : 'bg-slate-200'}`}title="Tối có người"></div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="h-[1px] w-full bg-slate-100"></div>

          <div className="space-y-4">
             <h3 className="text-lg font-semibold flex items-center">
               2. Chọn Sân
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {courts.map(court => (
                   <div 
                      key={court.id}
                      onClick={() => setSelectedCourt(court.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-center min-h-[90px] ${selectedCourt === court.id ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-orange-300'}`}
                   >
                     <div className={`font-bold text-lg ${selectedCourt === court.id ? 'text-orange-700' : 'text-slate-700'}`}>{court.name}</div>
                     <div className="text-sm mt-1 text-slate-500">{(court as any).status === 'maintenance' ? 'Đang bảo trì' : 'Đang hoạt động'}</div>
                   </div>
                ))}
             </div>
          </div>

          <div className="h-[1px] w-full bg-slate-100"></div>

          <div className="space-y-4">
             <div className="flex justify-between items-end mb-4">
               <div>
                  <h3 className="text-lg font-semibold flex items-center">
                    3. Chọn Khoảng Thời Gian
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Info className="w-4 h-4"/> Có thể chọn nhiều khung giờ liên tiếp</p>
               </div>
               {selectedHours.length > 0 && (
                 <span className="text-sm font-medium animate-pulse text-indigo-600 font-mono bg-indigo-50 px-2 py-1 rounded">Đã chọn {selectedHours.length} giờ</span>
               )}
             </div>

             {/* Thêm chú thích cho các khung giờ */}
             <div className="flex flex-wrap gap-3 mb-6 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-600 border border-blue-700"></div> Đang chọn</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-600 border border-green-700"></div> Đã đặt & Thanh toán</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500 border border-yellow-600"></div> Đã đặt (Chờ TT)</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-600 border border-red-700"></div> Đã qua</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-600 border border-purple-700"></div> Hiện tại</span>
             </div>

             <div className="space-y-8">
                {[
                  { name: 'Sáng', hours: [6, 7, 8, 9, 10, 11], priceProp: 'price_morning' as keyof Court, dotColor: 'bg-emerald-500' },
                  { name: 'Chiều', hours: [12, 13, 14, 15, 16], priceProp: 'price_afternoon' as keyof Court, dotColor: 'bg-amber-400' },
                  { name: 'Tối', hours: [17, 18, 19, 20, 21, 22, 23], priceProp: 'price_evening' as keyof Court, dotColor: 'bg-slate-900' }
                ].map((period, pIndex) => (
                   <div key={period.name} className="space-y-4 bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                        <div className={`w-3 h-3 rounded-full ${period.dotColor}`}></div>
                        Buổi {period.name}: <span className="text-orange-500">{((courts.find(c => c.id === selectedCourt) as any)?.[period.priceProp] || 2000).toLocaleString('vi-VN')}đ/h</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        <AnimatePresence mode="popLayout">
                          {period.hours.map((hour, i) => {
                            const slotStatus = getSlotStatus(selectedDate, hour);
                            const isSelected = selectedHours.includes(hour);
                            const isDisabled = slotStatus === 'passed' || slotStatus === 'paid' || slotStatus === 'unpaid';
                            const price = getPricePerHour(hour);

                            let statusClass = "";
                            let priceColor = "";
                            let indicatorText = "";
                            let badgeClass = "";

                            const currentHour = new Date().getHours();
                            const isCurrentSlot = isSameDay(selectedDate, new Date()) && (hour === currentHour || hour === currentHour - 1);

                            if (slotStatus === 'passed') {
                               statusClass = "bg-red-600 border-red-700 text-white cursor-not-allowed opacity-90";
                               priceColor = "text-red-100";
                               indicatorText = "Đã qua";
                               badgeClass = "text-red-700 bg-white px-2 py-0.5 rounded-md shadow-sm";
                            } else if (slotStatus === 'paid') {
                               statusClass = "bg-green-600 border-green-700 text-white cursor-not-allowed opacity-95";
                               priceColor = "text-green-100";
                               indicatorText = "Đã TT";
                               badgeClass = "text-green-700 bg-white px-2 py-0.5 rounded-md shadow-sm";
                            } else if (slotStatus === 'unpaid') {
                               statusClass = "bg-yellow-500 border-yellow-600 text-white cursor-not-allowed opacity-95";
                               priceColor = "text-yellow-50";
                               indicatorText = "Chờ TT";
                               badgeClass = "text-yellow-700 bg-white px-2 py-0.5 rounded-md shadow-sm";
                            } else if (isSelected) {
                               statusClass = "bg-blue-600 border-blue-700 text-white shadow-lg transform scale-105 z-10 ring-2 ring-blue-500/50 ring-offset-1";
                               priceColor = "text-blue-100";
                               indicatorText = "Đang chọn";
                               badgeClass = "text-blue-700 bg-white px-2 py-0.5 rounded-md shadow-sm";
                            } else {
                               if (hour < 12) {
                                 statusClass = "bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 text-slate-800";
                                 priceColor = "text-emerald-700";
                                 badgeClass = "text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md shadow-sm border border-emerald-100";
                               } else if (hour < 17) {
                                 statusClass = "bg-amber-50/40 border-amber-200 hover:border-amber-400 hover:bg-amber-100 text-slate-800";
                                 priceColor = "text-amber-700";
                                 badgeClass = "text-amber-700 bg-white/80 px-2 py-0.5 rounded-md shadow-sm border border-amber-100";
                               } else {
                                 statusClass = "bg-slate-50/60 border-slate-300 hover:border-slate-500 hover:bg-slate-200 text-slate-900";
                                 priceColor = "text-slate-600 font-bold";
                                 badgeClass = "text-slate-700 bg-white/80 px-2 py-0.5 rounded-md shadow-sm border border-slate-200";
                               }
                               indicatorText = "Trống";
                            }

                            if (isCurrentSlot) {
                               statusClass = "bg-purple-600 border-purple-700 text-white " + (isDisabled ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:bg-purple-500");
                               priceColor = "text-purple-100";
                               if (indicatorText === "Trống" || indicatorText === "Đã qua") {
                                  indicatorText = "Hiện tại";
                               }
                               badgeClass = "text-purple-700 bg-white px-2 py-0.5 rounded-md shadow-sm";
                            }

                            return (
                              <motion.button
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.02 }}
                                key={hour}
                                disabled={isDisabled}
                                onClick={() => handleHourClick(hour)}
                                className={`relative h-[70px] rounded-xl border-2 transition-all flex flex-col px-3 justify-center text-left overflow-hidden ${statusClass}`}
                              >
                                 <div className="flex justify-between items-center w-full">
                                   <span className="text-[15px] sm:text-base font-bold whitespace-nowrap tracking-tight">{hour}:00 - {hour + 1}:00</span>
                                 </div>
                                 
                                 <div className="flex justify-between items-center w-full mt-1">
                                    <span className={`text-sm font-medium whitespace-nowrap ${priceColor}`}>{price.toLocaleString('vi-VN')}đ</span>
                                    <span className={`text-[10px] uppercase font-bold whitespace-nowrap shrink-0 ${badgeClass}`}>{indicatorText}</span>
                                 </div>
                              </motion.button>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="h-[1px] w-full bg-slate-100 mt-6 mb-2"></div>

           <div className="space-y-4 pb-4">
             <div className="flex justify-between items-center max-w-sm">
                <h3 className="text-lg font-semibold flex items-center text-slate-800">
                  4. Thông Tin Liên Hệ
                </h3>
                {!isEditingContact && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingContact(true)} className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 gap-1 h-8">
                    <Edit2 className="w-3.5 h-3.5" /> Sửa
                  </Button>
                )}
             </div>
             
             {isEditingContact ? (
               <div className="max-w-sm space-y-3">
                  <Input 
                     placeholder="Nhập tên của bạn (VD: Quốc Cường)" 
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     className="bg-slate-50 border-slate-200 h-12 text-md transition-shadow focus-visible:ring-emerald-500"
                     type="text"
                  />
                  <Input 
                     placeholder="Nhập sđt (VD: 0912345678)" 
                     value={customerPhone}
                     onChange={(e) => setCustomerPhone(e.target.value)}
                     className="bg-slate-50 border-slate-200 h-12 text-md transition-shadow focus-visible:ring-emerald-500"
                     type="tel"
                  />
                  {(localStorage.getItem('staticCustomerName') || localStorage.getItem('savedCustomerName')) && (
                     <Button variant="outline" size="sm" onClick={() => {
                        setCustomerName(getInitialContact('name'));
                        setCustomerPhone(getInitialContact('phone'));
                        setIsEditingContact(false);
                     }} className="w-full">
                       Hủy sửa
                     </Button>
                  )}
               </div>
             ) : (
               <div className="max-w-sm bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-1.5">
                  <p className="text-slate-500 text-sm">Tên: <span className="font-semibold text-slate-800 text-base ml-1">{customerName}</span></p>
                  <p className="text-slate-500 text-sm">SĐT: <span className="font-semibold text-slate-800 text-base ml-1">{customerPhone}</span></p>
               </div>
             )}
          </div>

          <div className="h-[1px] w-full bg-slate-100 mt-6 mb-2"></div>

           <div className="space-y-4 pb-4">
             <h3 className="text-lg font-semibold flex items-center text-slate-800">
               5. Dịch Vụ Tại Sân (Thanh toán sau)
             </h3>
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 max-w-xl">
                {[
                  { icon: '💧', name: 'Nước Suối', desc: '500ml ướp lạnh', price: '10.000đ' },
                  { icon: '⚡', name: 'Revive / Pocari', desc: 'Bù khoáng', price: '15.000đ' },
                  { icon: '🏀', name: 'Thuê bóng Spalding', desc: 'Size 7 FIBA', price: '30.000đ/ca' },
                  { icon: '🧊', name: 'Đá viên', desc: 'Ly/xô nhỏ', price: 'Miễn phí', free: true },
                ].map((item, i) => (
                  <div key={i} className={`flex justify-between items-center py-3.5 ${i < 3 ? 'border-b border-slate-200' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${item.free ? 'text-emerald-500' : 'text-orange-500'}`}>{item.price}</span>
                  </div>
                ))}
              </div>
           </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {selectedHours.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col sm:flex-row"
          >
            <div className="flex-1 p-4 px-6 flex flex-col justify-center">
              <div className="flex justify-between items-baseline mb-1">
                 <p className="text-sm text-slate-400">Tổng thanh toán ({selectedHours.length} giờ)</p>
                 <p className="text-2xl font-bold text-orange-400">{calculateTotal().toLocaleString('vi-VN')}đ</p>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                 {getSelectedRanges().map((r, idx) => (
                    <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">
                      {r.start}:00 - {r.end}:00
                    </span>
                 ))}
              </div>
            </div>
            <div className="p-4 sm:p-2 sm:pr-2 flex items-center justify-center bg-slate-800/50 sm:bg-transparent border-t border-slate-800 sm:border-0">
               <Button 
                onClick={handleBooking} 
                disabled={loading}
                className="w-full sm:w-auto h-12 bg-orange-500 hover:bg-orange-600 text-white shadow-lg px-8 rounded-xl text-md font-semibold transition-all hover:scale-105 active:scale-95"
               >
                {loading ? 'Xử lý...' : 'Xác nhận Đặt sân'}
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQR} onOpenChange={(open) => {
        setShowQR(open);
        if (!open) {
          setReceiptData(null);
        }
      }}>
        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-6 bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-white text-2xl font-bold">Hoàn Tất Đặt Sân</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Vui lòng thanh toán và lưu lại mã QR check-in.
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full space-y-4 mt-2">
            {/* Payment Section */}
            <div className="flex flex-col items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.33-.97-2.39-1.8H7.81c.07 1.64 1.25 2.84 3.09 3.26V19h2.32v-1.7c1.61-.31 2.88-1.38 2.88-3.03 0-2.3-1.83-3.13-3.79-3.63z" /></svg>
               </div>
               
               {payosQrCode ? (
                  <>
                     <h4 className="text-orange-400 font-semibold mb-3 z-10">1. Quét Mã Thanh Toán (PayOS)</h4>
                     <div className="bg-white p-4 rounded-xl border-2 border-orange-500 z-10 flex flex-col items-center">
                       <QRCodeCanvas id="payos-qr-canvas" value={payosQrCode} size={200} />
                     </div>
                     <button 
                       onClick={downloadQR}
                       className="mt-3 text-xs flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md font-medium transition-colors w-[200px] z-10"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                       Tải ảnh QR xuống
                     </button>
                     <p className="text-sm text-slate-300 text-center mt-3 z-10">
                        Quét mã QR bằng ứng dụng ngân hàng của bạn.
                     </p>
                     {payosCheckoutUrl && (
                       <Button 
                         onClick={() => window.location.href = payosCheckoutUrl} 
                         className="mt-3 bg-orange-500 hover:bg-orange-600 text-white w-full rounded-xl z-10 shadow-lg text-md py-5 font-bold"
                       >
                         Hoặc Mở Cổng Thanh Toán
                       </Button>
                     )}
                  </>
               ) : payosCheckoutUrl ? (
                  <>
                     <h4 className="text-orange-400 font-semibold mb-3 z-10">1. Thanh Toán Qua PayOS</h4>
                     <p className="text-sm text-slate-300 text-center mb-4 z-10">
                        Đơn đặt sân của bạn đã được tạo cổng thanh toán tự động qua PayOS.
                     </p>
                     <Button 
                       onClick={() => window.location.href = payosCheckoutUrl} 
                       className="bg-orange-500 hover:bg-orange-600 text-white w-full rounded-xl z-10 shadow-lg text-md py-6 mb-4 font-bold"
                     >
                       Thanh Toán Ngay ({receiptData?.total.toLocaleString('vi-VN')}đ)
                     </Button>
                  </>
               ) : (
                  <>
                     <h4 className="text-orange-400 font-semibold mb-3 z-10">1. Quét Mã Thanh Toán (BIDV)</h4>
                     <div className="bg-white p-2 rounded-xl border-2 border-slate-600 z-10 flex flex-col items-center">
                       <img 
                         src={`https://img.vietqr.io/image/970418-7660290201-compact2.png?amount=${receiptData?.total || 0}&addInfo=${receiptData?.id || ''}&accountName=NGUYEN%20HUY%20THAI%20NGUYEN`} 
                         alt="QR Thanh Toán BIDV" 
                         className="w-[200px] h-auto rounded-lg" 
                         onError={(e) => {
                           (e.target as HTMLImageElement).src = '/qrthanhtoan_bidv.png';
                         }}
                       />
                       <a 
                         href="/qrthanhtoan_bidv.png" 
                         download="QR_ThanhToan_CourtKings.png" 
                         className="mt-2 text-xs flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md font-medium transition-colors w-full"
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                          Tải ảnh xuống
                       </a>
                     </div>
                     <div className="mt-4 w-full text-center z-10 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                       <p className="text-sm text-slate-300 flex justify-between items-center mb-2">Số tiền: <span className="font-bold text-orange-400 text-xl ml-1">{receiptData?.total.toLocaleString('vi-VN')}đ</span></p>
                       <div className="w-full h-px bg-slate-700/50 mb-2"></div>
                       <p className="text-xs text-slate-400 flex flex-col items-start gap-1">
                          <span className="mb-0.5">Vui lòng nhập chính xác Nội dung DK (BẮT BUỘC):</span>
                          <span className="text-white font-mono bg-slate-800 px-3 py-1.5 rounded w-full text-left tracking-wider">
                            {receiptData?.id}
                          </span>
                       </p>
                     </div>
                  </>
               )}
            </div>

            {/* Check-in Instructions Section */}
            <div className="flex flex-col items-center bg-emerald-900/30 p-4 rounded-2xl border border-emerald-800/50">
              <h4 className="text-emerald-400 font-semibold mb-2">2. Hướng dẫn Mở Cửa</h4>
              <p className="text-sm text-slate-300 text-center mb-4">Khi đến sân, nhấn nút tại cửa để lấy mã, sau đó dùng tính năng Quét Mã của App để mở cửa điện.</p>
              <Button 
                onClick={() => {
                  setShowQR(false);
                  window.location.hash = '#/checkin';
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl"
              >
                Mở Camera Quét Mã Tại Sân
              </Button>
            </div>
          </div>
          
          <div className="mt-4 w-full space-y-2 text-center text-sm font-medium text-slate-300 bg-slate-800/50 p-4 rounded-xl">
             <p className="flex justify-between border-b border-slate-700 pb-2"><span>Ngày đặt:</span> <span className="text-white">{receiptData?.date ? format(receiptData.date, 'dd/MM/yyyy') : ''}</span></p>
             <div className="flex justify-between text-left"><span>Giờ chơi:</span> <span className="text-orange-400 font-bold text-right flex flex-col items-end">
               {receiptData?.ranges.map((r, idx) => (
                 <span key={idx}>{r.start}:00 - {r.end}:00</span>
               ))}
             </span></div>
          </div>
          <Button onClick={() => setShowQR(false)} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white">Đóng Biên Lai</Button>
        </DialogContent>
      </Dialog>
      
      <style>{`
        .striped-bg {
          background-image: repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0) 10px, rgba(0, 0, 0, 0) 20px);
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
