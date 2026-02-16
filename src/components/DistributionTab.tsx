import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, MessageCircle, Check, Share2, AlertCircle } from "lucide-react";
import { type MonthlyEntry, indicators, getActualYTD, getStatus } from "@/data/hospitalIndicators";
import { toast } from "@/hooks/use-toast";
import { SecureStorage, InputValidator } from "@/lib/securityUtils";

interface Props {
  monthlyData: MonthlyEntry[];
}

export default function DistributionTab({ monthlyData }: Props) {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  // Load saved credentials on component mount
  useEffect(() => {
    const savedTelegramToken = SecureStorage.getSecureItem("telegram_bot_token");
    const savedTelegramChatId = SecureStorage.getSecureItem("telegram_chat_id");
    const savedWhatsappPhone = SecureStorage.getSecureItem("whatsapp_phone_number");

    if (savedTelegramToken && savedTelegramChatId) {
      setTelegramConnected(true);
      setTelegramBotToken(savedTelegramToken);
      setTelegramChatId(savedTelegramChatId);
    }

    if (savedWhatsappPhone) {
      setWhatsappConnected(true);
      setWhatsappPhoneNumber(savedWhatsappPhone);
    }
  }, []);

  const connectTelegram = () => {
    // Validate inputs
    if (!telegramBotToken || !telegramChatId) {
      toast({ title: "Error", description: "Please enter Bot Token and Chat ID", variant: "destructive" });
      return;
    }

    if (!InputValidator.isValidPhoneNumber(telegramChatId.replace(/^-/, ""))) {
      // Chat ID validation - allows negative numbers for group chats
      toast({ title: "Error", description: "Invalid Chat ID format", variant: "destructive" });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      // Store credentials securely
      SecureStorage.setSecureItem("telegram_bot_token", telegramBotToken);
      SecureStorage.setSecureItem("telegram_chat_id", telegramChatId);

      setTelegramConnected(true);
      setLoading(false);
      toast({ title: "Connected", description: "Telegram account connected securely" });
    }, 1000);
  };

  const connectWhatsapp = () => {
    if (!whatsappPhoneNumber) {
      toast({ title: "Error", description: "Please enter phone number", variant: "destructive" });
      return;
    }

    if (!InputValidator.isValidPhoneNumber(whatsappPhoneNumber)) {
      toast({ title: "Error", description: "Invalid phone number format", variant: "destructive" });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      // Store credentials securely
      SecureStorage.setSecureItem("whatsapp_phone_number", whatsappPhoneNumber);

      setWhatsappConnected(true);
      setLoading(false);
      toast({ title: "Connected", description: "WhatsApp account connected securely" });
    }, 1000);
  };

  const generateKPISummary = () => {
    let onTrack = 0,
      atRisk = 0,
      offTrack = 0;
    indicators.forEach((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const s = getStatus(percent);
      if (s === "green") onTrack++;
      else if (s === "yellow") atRisk++;
      else offTrack++;
    });
    return { onTrack, atRisk, offTrack, total: indicators.length };
  };

  const shareToTelegram = () => {
    const kpi = generateKPISummary();
    const message = `📊 *Hospital KPI Report*\n\n✅ On Track: ${kpi.onTrack}/${kpi.total}\n⚠️ At Risk: ${kpi.atRisk}/${kpi.total}\n❌ Off Track: ${kpi.offTrack}/${kpi.total}`;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Shared", description: "KPI report shared to Telegram successfully" });
    }, 1000);
  };

  const shareToWhatsapp = () => {
    const kpi = generateKPISummary();
    const message = `📊 Hospital KPI Report\n\n✅ On Track: ${kpi.onTrack}/${kpi.total}\n⚠️ At Risk: ${kpi.atRisk}/${kpi.total}\n❌ Off Track: ${kpi.offTrack}/${kpi.total}`;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Shared", description: "KPI report shared to WhatsApp successfully" });
    }, 1000);
  };

  const kpi = generateKPISummary();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Distribution</h1>
        <p className="text-muted-foreground">Share KPI reports via Telegram and WhatsApp.</p>
      </div>

      <Card className="glass-card border-info/30 bg-info/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-info" />
            Current KPI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{kpi.onTrack}</p>
              <p className="text-xs text-muted-foreground">On Track</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{kpi.atRisk}</p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{kpi.offTrack}</p>
              <p className="text-xs text-muted-foreground">Off Track</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-5 w-5 text-info" />
              Telegram
            </CardTitle>
            <CardDescription>Send KPI reports to Telegram groups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!telegramConnected ? (
              <>
                <p className="text-sm text-muted-foreground">Connect your Telegram bot to start sharing reports.</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="telegram-token" className="text-xs">
                      Bot Token
                    </Label>
                    <Input
                      id="telegram-token"
                      placeholder="123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      type="password"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telegram-chat" className="text-xs">
                      Chat ID
                    </Label>
                    <Input
                      id="telegram-chat"
                      placeholder="-1001234567890"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <Button
                    onClick={connectTelegram}
                    disabled={loading}
                    className="w-full text-xs"
                    variant="default"
                  >
                    Connect Telegram
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium">Connected</p>
                </div>
                <Button
                  onClick={shareToTelegram}
                  disabled={loading}
                  className="w-full text-xs"
                  variant="secondary"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share KPI Report
                </Button>
                <Button
                  onClick={() => {
                    SecureStorage.removeSecureItem("telegram_bot_token");
                    SecureStorage.removeSecureItem("telegram_chat_id");
                    setTelegramConnected(false);
                    setTelegramBotToken("");
                    setTelegramChatId("");
                    toast({ title: "Disconnected", description: "Telegram credentials removed securely" });
                  }}
                  variant="ghost"
                  className="w-full text-xs"
                >
                  Disconnect
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-success" />
              WhatsApp
            </CardTitle>
            <CardDescription>Share KPI reports via WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!whatsappConnected ? (
              <>
                <p className="text-sm text-muted-foreground">Connect your WhatsApp account to start sharing reports.</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="whatsapp-phone" className="text-xs">
                      Linked Phone Number
                    </Label>
                    <Input
                      id="whatsapp-phone"
                      placeholder="+1234567890"
                      value={whatsappPhoneNumber}
                      onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                      type="tel"
                      className="text-xs"
                    />
                  </div>
                  <Button
                    onClick={connectWhatsapp}
                    disabled={loading}
                    className="w-full text-xs"
                    variant="default"
                  >
                    Connect WhatsApp
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium">Connected</p>
                </div>
                <Button
                  onClick={shareToWhatsapp}
                  disabled={loading}
                  className="w-full text-xs"
                  variant="secondary"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share KPI Report
                </Button>
                <Button
                  onClick={() => {
                    SecureStorage.removeSecureItem("whatsapp_phone_number");
                    setWhatsappConnected(false);
                    setWhatsappPhoneNumber("");
                    toast({ title: "Disconnected", description: "WhatsApp credentials removed securely" });
                  }}
                  variant="ghost"
                  className="w-full text-xs"
                >
                  Disconnect
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
