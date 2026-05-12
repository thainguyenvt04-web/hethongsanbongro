import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

export const Camera = () => {
  const [isLive, setIsLive] = useState(true);
  
  // Trỏ thẳng về API proxy của Backend (server.ts) để giải quyết lỗi Mixed Content
  // Backend sẽ tự động lấy IP nội bộ của ESP32 thông qua MQTT và proxy nó lên.
  const [streamUrl, setStreamUrl] = useState("/api/camera-stream");

  // Ta thêm timestamp vào cuối URL để force browser tải lại luồng khi người dùng nhấn 'Tiếp tục phát'
  const currentStreamUrl = `${streamUrl}?t=${Date.now()}`;

  useEffect(() => {
    // Nhận trực tiếp URL (IP nội bộ hoặc ngrok) từ ESP32 qua MQTT
    const topic = 'camera/stream/url';
    let mqttClientInstance: any = null;
    let handleMsg: any = null;

    import('../lib/mqtt').then(({ mqttClient }) => {
      mqttClientInstance = mqttClient;
      mqttClient.subscribe(topic);
      
      handleMsg = (t: string, msg: Buffer) => {
        if (t === topic) {
          const url = msg.toString();
          console.log("MQTT nhận IP Camera từ ESP32:", url);
          // Cập nhật URL trực tiếp ở frontend
          // Nếu ESP32 dùng ngrok (https) thì Vercel sẽ xem được ở bất kỳ đâu
          // Nếu ESP32 dùng IP nội bộ (http://192...) thì điện thoại cần chung WiFi & dùng localhost/HTTP
          setStreamUrl(url);
        }
      };

      mqttClient.on('message', handleMsg);
    }).catch(err => console.error("Lỗi import mqtt:", err));

    return () => {
      if (mqttClientInstance && handleMsg) {
        mqttClientInstance.unsubscribe(topic);
        mqttClientInstance.off('message', handleMsg);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 drop-shadow-sm">
            Camera Sân
          </h1>
          <p className="text-slate-500 mt-1">Xem trực tiếp từ ESP32-CAM.</p>
        </div>
        <Button variant="outline" onClick={() => setIsLive(!isLive)}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLive ? 'animate-spin' : ''}`} />
          {isLive ? 'Tạm dừng' : 'Tiếp tục phát'}
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CameraIcon className="h-5 w-5 text-slate-500" />
              Sân A - Camera Chính
            </CardTitle>
            <Badge variant={isLive ? "default" : "secondary"} className={isLive ? "bg-red-500 hover:bg-red-600" : ""}>
              {isLive ? 'TRỰC TIẾP' : 'TẠM DỪNG'}
            </Badge>
          </div>
          <CardDescription>Luồng phát ESP32-CAM</CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-black aspect-video relative flex items-center justify-center">
          {isLive ? (
            <div className="relative w-full h-full">
              {/* Fallback image since we don't have a real ESP32-CAM stream */}
              <img 
                src={currentStreamUrl} 
                alt="Live Stream" 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              </div>
              <div className="absolute bottom-4 left-4 text-white text-sm font-mono bg-black/50 px-2 py-1 rounded">
                {new Date().toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center">
              <CameraIcon className="h-12 w-12 mb-2 opacity-50" />
              <p>Đã tạm dừng phát</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
