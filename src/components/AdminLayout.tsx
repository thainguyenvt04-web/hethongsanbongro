import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  Video,
  Settings2,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';

export const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => sessionStorage.getItem('adminAuth') === 'true');
  const [adminPin, setAdminPin] = useState(() => localStorage.getItem('adminPin') || '8888');

  useEffect(() => {
    const handleStorageChange = () => {
      const updatedPin = localStorage.getItem('adminPin');
      if (updatedPin) setAdminPin(updatedPin);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === adminPin) {
      setIsAuthorized(true);
      sessionStorage.setItem('adminAuth', 'true');
      toast.success('Xác thực thành công');
    } else {
      toast.error('Mật khẩu không chính xác');
      setPin('');
    }
  };

  const navItems = [
    { path: '/admin', label: 'Quản trị viên', icon: ShieldCheck },
    { path: '/camera', label: 'Camera', icon: Video },
    { path: '/controls', label: 'Điều khiển', icon: Settings2 },
  ];

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="p-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> Về trang người dùng
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-2 border-slate-200 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="text-orange-600" size={32} />
              </div>
              <CardTitle className="text-2xl">Quản trị cấp cao</CardTitle>
              <p className="text-sm text-slate-500 mt-2">Vui lòng nhập mật khẩu Master để truy cập hệ thống quản lý chuyên sâu</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePinSubmit} className="space-y-6">
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu..."
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-2xl tracking-[0.5em] h-14"
                  autoFocus
                />
                <Button type="submit" className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700">
                  Xác nhận
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden overscroll-none bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-950 text-white p-4 flex justify-between items-center">
        <div className="font-bold text-xl flex items-center gap-2">
          <ShieldCheck className="text-orange-500" /> Master Admin
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        ${isMobileMenuOpen ? 'flex' : 'hidden'} 
        flex-col md:flex w-full md:w-64 bg-slate-950 text-white flex-shrink-0 overflow-y-auto border-r border-slate-800
      `}>
        <div className="p-6 hidden md:block flex-shrink-0 border-b border-slate-800">
          <div className="font-bold text-2xl flex items-center gap-2">
            <ShieldCheck className="text-orange-500" size={28} /> Admin
          </div>
          <div className="text-xs text-slate-400 mt-1">Hệ thống quản trị</div>
        </div>
        
        <nav className="p-4 space-y-2 flex-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto flex-shrink-0 border-t border-slate-800 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Về trang User
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div id="admin-main-scroll-container" className="flex-1 overflow-y-auto overscroll-y-none bg-slate-100 relative">
        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
