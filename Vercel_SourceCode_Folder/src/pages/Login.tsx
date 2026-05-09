import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { mockSignIn } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Check if Supabase is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseUrl.includes('placeholder')) {
      const isAdmin = email.toLowerCase().includes('admin') || email.toLowerCase() === 'banhaomangcut@gmail.com';
      toast.success(isAdmin ? 'Đăng nhập Quản Trị Viên (Mock Mode)' : 'Đăng nhập Khách (Mock Mode)');
      mockSignIn(isAdmin);
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          toast.error('Mật khẩu nhập lại không khớp!');
          setLoading(false);
          return;
        }
        if (!phone || phone.length < 9) {
          toast.error('Vui lòng nhập số điện thoại hợp lệ!');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              phone: phone,
            }
          }
        });
        if (error) throw error;
        toast.success('Vui lòng kiểm tra email để xác nhận!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: any) {
      let msg = error.message || 'Đã xảy ra lỗi';
      
      // Dịch các lỗi phổ biến của Supabase sang Tiếng Việt
      if (msg.includes('rate limit exceeded') || msg.includes('Too many requests')) {
        msg = 'Bạn đã thử quá nhiều lần (Vượt giới hạn email). Vui lòng đợi một lát rồi hãy thao tác lại hoặc tắt Xác nhận Email trong Supabase.';
      } else if (msg.includes('Invalid login credentials')) {
        msg = 'Tài khoản hoặc Mật khẩu không chính xác.';
      } else if (msg.includes('User already registered')) {
        msg = 'Email này đã được đăng ký rồi.';
      } else if (msg.includes('Password should be at least 6 characters')) {
        msg = 'Mật khẩu phải dài ít nhất 6 ký tự.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Bạn chưa xác nhận Email. Vui lòng kiểm tra hòm thư của bạn.';
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <span className="text-6xl">🏀</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
            CourtKings
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Tạo tài khoản để đặt sân' : 'Nhập email và mật khẩu để đăng nhập'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <Button className="w-full bg-orange-500 hover:bg-orange-600" type="submit" disabled={loading}>
              {loading ? 'Đang xử lý...' : (isSignUp ? 'Đăng ký' : 'Đăng nhập')}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-orange-600 hover:underline"
            >
              {isSignUp ? 'Đã có tài khoản? Đăng nhập' : "Chưa có tài khoản? Đăng ký"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
