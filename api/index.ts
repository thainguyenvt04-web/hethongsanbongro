import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PayOS } from "@payos/node";
import { createClient } from "@supabase/supabase-js";
import mqtt from "mqtt";

const mqttBroker = process.env.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8084/mqtt';
const mqttClient = mqtt.connect(mqttBroker, {
  keepalive: 60,
  clientId: `serverless_admin_${Math.random().toString(16).slice(3)}`,
  protocolId: 'MQTT',
  protocolVersion: 4,
  clean: true,
});

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
// Sử dụng SERVICE_ROLE_KEY để webhook có quyền admin cập nhật CSDL (bỏ qua RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
// BẢO MẬT: Chỉ cho phép Web của bạn gọi API, chặn các trang web giả mạo
const allowedOrigins = ['http://localhost:5173', 'https://sanbongronbt.vercel.app'];
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  }
}));

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID || "YOUR_CLIENT_ID",
  apiKey: process.env.PAYOS_API_KEY || "YOUR_API_KEY",
  checksumKey: process.env.PAYOS_CHECKSUM_KEY || "YOUR_CHECKSUM_KEY"
});

app.post("/api/create-payment-link", async (req, res) => {
  const { amount, description, orderCode, returnUrl, cancelUrl } = req.body;

  try {
    const body = {
      orderCode: orderCode || Number(String(Date.now()).slice(-6)),
      amount: amount || 10000,
      description: description || "Thanh toan don hang",
      returnUrl: returnUrl || `http://localhost:5173/`,
      cancelUrl: cancelUrl || `http://localhost:5173/`,
    };

    const paymentLinkRes = await payos.paymentRequests.create(body);

    return res.json({
      error: 0,
      message: "Success",
      data: {
        bin: paymentLinkRes.bin,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        accountNumber: paymentLinkRes.accountNumber,
        accountName: paymentLinkRes.accountName,
        amount: paymentLinkRes.amount,
        description: paymentLinkRes.description,
        orderCode: paymentLinkRes.orderCode,
        qrCode: paymentLinkRes.qrCode,
      },
    });
  } catch (error: any) {
    console.error('PayOS API error in server:', error);
    return res.json({
      error: -1,
      message: error.message || "fail",
      data: null,
    });
  }
});

app.post("/api/recreate-payment-link", async (req, res) => {
  const { oldOrderCode, amount, description, returnUrl, cancelUrl } = req.body;
  const newOrderCode = Number(String(Date.now()).slice(-9) + Math.floor(Math.random() * 10));

  try {
    const body = {
      orderCode: newOrderCode,
      amount: amount || 10000,
      description: description || "Thanh toan don hang",
      returnUrl: returnUrl || `http://localhost:5173/`,
      cancelUrl: cancelUrl || `http://localhost:5173/`,
    };

    const paymentLinkRes = await payos.paymentRequests.create(body);

    // Update ID trong CSDL
    const { error } = await supabase
      .from('bookings')
      .update({ id: newOrderCode.toString() })
      .eq('id', oldOrderCode.toString());

    if (error) {
       console.error("Lỗi khi cập nhật ID đơn hàng:", error);
    }

    return res.json({
      error: 0,
      message: "Success",
      data: {
        newOrderCode,
        bin: paymentLinkRes.bin,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        qrCode: paymentLinkRes.qrCode,
      },
    });
  } catch (error: any) {
    console.error('PayOS recreate error:', error);
    return res.json({
      error: -1,
      message: error.message || "fail",
      data: null,
    });
  }
});

app.post("/api/payos-webhook", async (req, res) => {
  try {
    const webhookData = await payos.webhooks.verify(req.body);

    if (webhookData.code === "00") {
      // Payment success!
      console.log("Thanh toán thành công cho đơn hàng: ", webhookData.orderCode);
      
      // Tự động duyệt đơn đặt sân
      try {
        const { error } = await supabase
          .from('bookings')
          .update({ paid: true })
          .eq('id', webhookData.orderCode.toString());
        
        if (error) {
          console.error("Lỗi khi update Supabase:", error);
        } else {
          console.log(`Đã tự động duyệt đơn ${webhookData.orderCode} thành công!`);
        }
      } catch (err) {
        console.error("Supabase update exception:", err);
      }
    }

    return res.json({
      error: 0,
      message: "Ok",
      data: webhookData,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      error: -1,
      message: "failed",
      data: null,
    });
  }
});

app.get("/api/admin/bookings", async (req, res) => {
  try {
    const { data, error } = await supabase.from('bookings').select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ bookings: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/bookings/:id", async (req, res) => {
  try {
    const { error } = await supabase.from('bookings').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ error: 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/bookings/:id/paid", async (req, res) => {
  try {
    const { paid } = req.body;
    const { error } = await supabase.from('bookings').update({ paid }).eq('id', req.params.id);
    if (error) throw error;
    return res.json({ error: 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/check-payment/:orderCode", async (req, res) => {
  try {
    const orderCode = Number(req.params.orderCode);
    const paymentInfo = await payos.paymentRequests.get(orderCode);
    
    if (paymentInfo && paymentInfo.status === "PAID") {
      // Update Supabase
      const { error } = await supabase
        .from('bookings')
        .update({ paid: true })
        .eq('id', orderCode.toString());
        
      if (error) {
        console.error("Lỗi cập nhật CSDL khi check:", error);
      }
      return res.json({ paid: true });
    }
    return res.json({ paid: false, status: paymentInfo?.status });
  } catch (err: any) {
    console.error("Lỗi khi gọi API check PayOS:", err.message);
    return res.json({ paid: false });
  }
});

// ==========================================
// API BẢO MẬT ĐIỀU KHIỂN IOT (BACKEND PROXY)
// ==========================================
app.post("/api/control", async (req, res) => {
  const { courtId, device, action, userId, email } = req.body;

  if (!courtId || !device || !action || (!userId && !email)) {
    return res.status(400).json({ error: "Thiếu thông tin điều khiển" });
  }

  // 1. Kiểm tra quyền của Admin
  const isAdmin = email && (email.toLowerCase().includes('admin') || email === 'banhaomangcut@gmail.com');

  if (!isAdmin) {
    // 2. Nếu không phải Admin, kiểm tra xem User có đơn đặt sân nào đã thanh toán không
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .eq('paid', true)
      .limit(1);

    if (error || !data || data.length === 0) {
      console.warn(`[SECURITY WARN] User ${email} cố gắng điều khiển IoT trái phép!`);
      return res.status(403).json({ error: "Access Denied: Bạn chưa đặt sân hoặc chưa thanh toán!" });
    }
  }

  // 3. Nếu hợp lệ, Backend sẽ đại diện gửi lệnh MQTT
  const topic = `court/${courtId}/${device}`;
  if (mqttClient.connected) {
    mqttClient.publish(topic, action);
    console.log(`[IoT CONTROL] Đã gửi lệnh hợp lệ tới: ${topic} -> ${action}`);
    return res.json({ success: true, message: `Đã gửi lệnh ${action} thành công!` });
  } else {
    // If not connected, try to publish anyway (it might be queued or connect in time)
    mqttClient.publish(topic, action);
    return res.json({ success: true, message: `Đã gửi lệnh ${action} thành công (với độ trễ)!` });
  }
});

export default app;
