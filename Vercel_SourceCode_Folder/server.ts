import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PayOS } from "@payos/node";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
