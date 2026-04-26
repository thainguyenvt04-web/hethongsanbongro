import React, { useState, useEffect } from 'react';
import { supabase, Court } from '../lib/supabase';
import { getBookings, markBookingPaid, markBookingUnpaid, deleteBooking, SavedBooking } from '../lib/bookingStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Lock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';



export const Admin = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [newCourtName, setNewCourtName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminPin, setAdminPin] = useState(() => localStorage.getItem('adminPin') || '8888');
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [editPriceMorning, setEditPriceMorning] = useState<string>('');
  const [editPriceAfternoon, setEditPriceAfternoon] = useState<string>('');
  const [editPriceEvening, setEditPriceEvening] = useState<string>('');
  
  const [services, setServices] = useState(() => {
    const stored = localStorage.getItem('courtServices');
    return stored ? JSON.parse(stored) : [
      { id: 'water', icon: '💧', name: 'Nước Suối', desc: '500ml ướp lạnh', price: '10.000đ' },
      { id: 'revive', icon: '⚡', name: 'Revive / Pocari', desc: 'Bù khoáng', price: '15.000đ' },
      { id: 'ball', icon: '🏀', name: 'Thuê bóng Spalding', desc: 'Size 7 FIBA', price: '30.000đ/ca' },
      { id: 'ice', icon: '🧊', name: 'Đá viên', desc: 'Ly/xô nhỏ', price: 'Miễn phí', free: true },
    ];
  });
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  useEffect(() => {
    fetchCourts();
    fetchAllBookings();
  }, []);

  const fetchAllBookings = async () => {
    try {
      const data = await getBookings();
      // Sort to show pending first, then by date newer
      data.sort((a, b) => {
        if (a.paid === b.paid) {
           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.paid ? 1 : -1;
      });
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await markBookingPaid(id);
      toast.success('✅ Đã duyệt - Khách có thể Check-in!');
      fetchAllBookings();
    } catch (err) {
      toast.error('Lỗi khi duyệt đơn!');
    }
  };

  const handleUnapprove = async (id: string) => {
    try {
      await markBookingUnpaid(id);
      toast.warning('↩️ Đã hủy duyệt - Đơn trở về trạng thái chờ thanh toán.');
      fetchAllBookings();
    } catch (err) {
      toast.error('Lỗi khi hủy duyệt!');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Xóa vĩnh viễn đơn này? Hành động không thể hoàn tác!")) {
      try {
        await deleteBooking(id);
        toast.success('🗑️ Đã xóa đơn!');
        fetchAllBookings();
      } catch (err: any) {
        toast.error('Lỗi khi xóa. Hãy kiểm tra RLS Policy trên Supabase.');
      }
    }
  };

  const handleChangePassword = () => {
    if (newPasswordInput && newPasswordInput.trim() !== '') {
      localStorage.setItem('adminPin', newPasswordInput.trim());
      setAdminPin(newPasswordInput.trim());
      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu này.');
      setIsPasswordModalOpen(false);
      setNewPasswordInput('');
    } else {
      toast.error('Vui lòng nhập mật khẩu hợp lệ!');
    }
  };

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      setCourts(data || []);
    } catch (error) {
      // Mock data
      setCourts([
        { id: '1', name: 'Sân A - Trong nhà', status: 'available' },
        { id: '2', name: 'Sân B - Ngoài trời', status: 'in_use' },
      ]);
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourtName) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('courts')
        .insert([{ name: newCourtName, status: 'available' }]);
      
      if (error) throw error;
      
      toast.success('Tạo sân thành công');
      setNewCourtName('');
      fetchCourts();
    } catch (error: any) {
      toast.error('Không thể tạo sân (Chế độ mô phỏng)');
      // Mock update
      setCourts([...courts, { id: Date.now().toString(), name: newCourtName, status: 'available' }]);
      setNewCourtName('');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditPrice = (court: Court) => {
    setEditingCourtId(court.id);
    setEditPriceMorning((court.price_morning || 100000).toString());
    setEditPriceAfternoon((court.price_afternoon || 80000).toString());
    setEditPriceEvening((court.price_evening || 150000).toString());
  };

  const handleCancelEdit = () => {
    setEditingCourtId(null);
  };

  const handleSavePrice = async (courtId: string) => {
    const morning = parseInt(editPriceMorning);
    const afternoon = parseInt(editPriceAfternoon);
    const evening = parseInt(editPriceEvening);

    if (isNaN(morning) || isNaN(afternoon) || isNaN(evening)) {
      toast.error("Vui lòng nhập giá hợp lệ!");
      return;
    }

    try {
      const { error } = await supabase.from('courts').update({
        price_morning: morning,
        price_afternoon: afternoon,
        price_evening: evening
      }).eq('id', courtId);
      
      if (error) throw error;
      
      toast.success("Cập nhật giá thành công!");
      setEditingCourtId(null);
      fetchCourts();
    } catch (e) {
      toast.error("Lỗi khi cập nhật giá!");
    }
  };

  const handleSaveServicePrice = (id: string, newPrice: string) => {
    const updated = services.map((s: any) => s.id === id ? { ...s, price: newPrice } : s);
    setServices(updated);
    localStorage.setItem('courtServices', JSON.stringify(updated));
    toast.success('Đã lưu giá dịch vụ!');
  };

  const handlePriceInputChange = (svc: any, inputValue: string) => {
    let digits = inputValue.replace(/\D/g, '');
    
    const oldDigits = svc.price.replace(/\D/g, '');
    if (inputValue.length < svc.price.length && digits === oldDigits && digits.length > 0) {
      digits = digits.slice(0, -1);
    }
    
    let newPriceStr = inputValue;
    if (digits) {
      const formattedNum = parseInt(digits, 10).toLocaleString('vi-VN');
      if (svc.id === 'ball') {
        newPriceStr = `${formattedNum} VND/ca`;
      } else if (svc.id === 'water' || svc.id === 'revive') {
        newPriceStr = `${formattedNum} VND`;
      } else {
        newPriceStr = formattedNum;
      }
    } else {
      if (svc.id === 'ice') {
        newPriceStr = 'Miễn phí';
      } else {
        newPriceStr = '';
      }
    }

    const updated = services.map((s: any) => s.id === svc.id ? { ...s, price: newPriceStr } : s);
    setServices(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bảng Quản trị</h1>
          <p className="text-slate-500">Quản lý sân và xem nhật ký hệ thống.</p>
        </div>
        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="shrink-0 gap-2">
              <Lock className="w-4 h-4" />
              Đổi Mật Khẩu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Đổi Mật Khẩu Quản Trị Viên</DialogTitle>
              <DialogDescription>
                Nhập mật khẩu mới bên dưới. Vui lòng ghi nhớ mật khẩu này để truy cập vào lần sau.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="text"
                placeholder="Nhập mật khẩu mới..."
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleChangePassword();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)}>Hủy</Button>
              <Button onClick={handleChangePassword} className="bg-orange-600 hover:bg-orange-700 text-white">Xác nhận đổi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Thêm sân mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCourt} className="space-y-4">
              <div className="space-y-2">
                <Input 
                  placeholder="Tên sân" 
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Tạo sân
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quản lý danh sách sân</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Giá (Sáng/Chiều/Tối)</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courts.map((court) => (
                  <TableRow key={court.id}>
                    <TableCell className="font-medium">{court.id.slice(0, 8)}</TableCell>
                    <TableCell>{court.name}</TableCell>
                    <TableCell className="text-xs text-slate-500 font-mono">
                      {editingCourtId === court.id ? (
                        <div className="flex gap-1 items-center justify-start min-w-[200px]">
                          <Input className="w-[70px] h-8 text-xs px-2" value={editPriceMorning} onChange={(e) => setEditPriceMorning(e.target.value)} type="number" placeholder="Sáng" />
                          <span className="text-slate-400">/</span>
                          <Input className="w-[70px] h-8 text-xs px-2" value={editPriceAfternoon} onChange={(e) => setEditPriceAfternoon(e.target.value)} type="number" placeholder="Chiều" />
                          <span className="text-slate-400">/</span>
                          <Input className="w-[70px] h-8 text-xs px-2" value={editPriceEvening} onChange={(e) => setEditPriceEvening(e.target.value)} type="number" placeholder="Tối" />
                        </div>
                      ) : (
                        <>{((court.price_morning||100000)/1000).toFixed(0)}k / {((court.price_afternoon||80000)/1000).toFixed(0)}k / {((court.price_evening||150000)/1000).toFixed(0)}k</>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={court.status === 'available' ? 'default' : 'secondary'}>
                        {court.status === 'available' ? 'Trống' : court.status === 'in_use' ? 'Đang sử dụng' : 'Bảo trì'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingCourtId === court.id ? (
                        <div className="flex gap-2 justify-end">
                          <Button variant="default" size="sm" onClick={() => handleSavePrice(court.id)} className="bg-emerald-600 hover:bg-emerald-700">Lưu</Button>
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>Hủy</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleStartEditPrice(court)}>Sửa giá</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Điều chỉnh giá Dịch Vụ & Tiếp Sức</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dịch vụ</TableHead>
                  <TableHead>Giá hiện tại</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((svc: any) => (
                  <TableRow key={svc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{svc.icon}</span>
                        {svc.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={svc.price} 
                        onChange={(e) => handlePriceInputChange(svc, e.target.value)} 
                        className="w-[150px] h-9" 
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveServicePrice(svc.id, svc.price)}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        Lưu
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quản lý Đơn Đặt Sân</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sân & Giờ</TableHead>
                  <TableHead>Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString('vi-VN')} <br/>
                      <span className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleTimeString('vi-VN')}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800 text-base">{b.customerName || 'Tên: (Chưa cập nhật)'}</div>
                      <div className="text-sm font-semibold text-slate-600 mt-0.5">SĐT: {b.customerPhone || '(Trống)'}</div>
                      <div className="text-xs text-blue-600 mt-1">Email: {b.userEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.courtName}</div>
                      <div className="text-sm text-slate-500">
                        Ngày: {b.date} <br/>
                        Giờ: {b.ranges.map(r => `${r.start}:00 - ${r.end}:00`).join(', ')}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-orange-600">
                      {b.total.toLocaleString()}đ
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={b.paid
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'}
                      >
                        {b.paid ? '✅ Đã duyệt' : '⏳ Chờ thanh toán'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {/* Nút DUYỆT - chỉ hiện khi chưa paid */}
                        {!b.paid && (
                          <Button
                            onClick={() => handleApprove(b.id)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Duyệt
                          </Button>
                        )}
                        {/* Nút HỦY DUYỆT - chỉ hiện khi đã paid */}
                        {b.paid && (
                          <Button
                            onClick={() => handleUnapprove(b.id)}
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-600 hover:bg-orange-50 gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Hủy Duyệt
                          </Button>
                        )}
                        {/* Nút XÓA - luôn hiển thị */}
                        <Button
                          onClick={() => handleDelete(b.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-500 hover:bg-red-50 gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-slate-500 py-8">Chưa có đơn đặt sân nào</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
