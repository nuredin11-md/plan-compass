import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Download,
  Plus,
  Trash2,
  Calendar,
  Users,
  Check,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Clock,
  FileText,
  Import,
  RefreshCw,
  Sliders,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Props {
  monthlyData: any[];
}

interface Message {
  id: string;
  sender: string;
  role: string;
  avatar: string;
  content: string;
  timestamp: string;
  isAi?: boolean;
}

interface SharedTrend {
  id: string;
  title: string;
  type: "chart" | "action-plan";
  author: string;
  content: string;
  data: any;
  chartType?: string;
  createdAt: string;
}

interface ZoomMeeting {
  id: string;
  title: string;
  dateTime: string;
  agenda: string;
  link: string;
}

const CLINICAL_PRACTITIONERS = [
  { name: "Dr. Abebe Seme", role: "Chief of Medicine", avatar: "👨‍⚕️" },
  { name: "Sister Genet", role: "Nursing Informatics Director", avatar: "👩‍⚕️" },
  { name: "Dr. Yared Kassahun", role: "M&E Coordinator", avatar: "👨‍⚕️" },
  { name: "Woizero Kebebush", role: "Hospital Director", avatar: "👩" },
];

export default function MeetingHubTab({ monthlyData }: Props) {
  const [activeSubTab, setActiveSubTab] = useState("discussions");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState("You (Admin)");
  const [sharedTrends, setSharedTrends] = useState<SharedTrend[]>([]);
  const [zoomMeetings, setZoomMeetings] = useState<ZoomMeeting[]>([]);
  
  // Schedule meeting state
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDateTime, setSchedDateTime] = useState("");
  const [schedAgenda, setSchedAgenda] = useState("");

  // Live video conference state
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeCallTitle, setActiveCallTitle] = useState("Direct Review Board Call");
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load templates
  useEffect(() => {
    // 1. Load chat messages
    const localMsgs = localStorage.getItem("hospital_meeting_hub_chat_msgs");
    if (localMsgs) {
      try {
        setChatMessages(JSON.parse(localMsgs));
      } catch (e) {
        setChatMessages(getDefaultChatMsgs());
      }
    } else {
      const def = getDefaultChatMsgs();
      setChatMessages(def);
      localStorage.setItem("hospital_meeting_hub_chat_msgs", JSON.stringify(def));
    }

    // 2. Load scheduled meetings
    const localMeetings = localStorage.getItem("hospital_meeting_hub_zoom_meetings");
    if (localMeetings) {
      try {
        setZoomMeetings(JSON.parse(localMeetings));
      } catch (e) {
        setZoomMeetings(getDefaultMeetings());
      }
    } else {
      const def = getDefaultMeetings();
      setZoomMeetings(def);
      localStorage.setItem("hospital_meeting_hub_zoom_meetings", JSON.stringify(def));
    }

    // 3. Load shared trends and action plans
    const localShares = localStorage.getItem("hospital_meeting_hub_shares");
    if (localShares) {
      try {
        setSharedTrends(JSON.parse(localShares));
      } catch (e) {
        setSharedTrends(getDefaultShares());
      }
    } else {
      const def = getDefaultShares();
      setSharedTrends(def);
      localStorage.setItem("hospital_meeting_hub_shares", JSON.stringify(def));
    }
  }, []);

  // Listen to storage events to keep shares in sync if shared from workspace
  useEffect(() => {
    const handleStorageChange = () => {
      const localShares = localStorage.getItem("hospital_meeting_hub_shares");
      if (localShares) {
        try {
          setSharedTrends(JSON.parse(localShares));
        } catch (e) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Format call duration
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // call timer
  useEffect(() => {
    if (isInCall) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isInCall]);

  const saveChat = (msgs: Message[]) => {
    setChatMessages(msgs);
    localStorage.setItem("hospital_meeting_hub_chat_msgs", JSON.stringify(msgs));
  };

  const handleSendMessage = () => {
    if (!typedMessage.trim()) return;
    const isYou = selectedUser.includes("Admin");
    const senderData = isYou 
      ? { name: "System Administrator", role: "M&E Audit Lead", avatar: "🛡️" }
      : CLINICAL_PRACTITIONERS.find(u => u.name === selectedUser) || { name: "System Administrator", role: "M&E Audit Lead", avatar: "🛡️" };

    const newMsg: Message = {
      id: "msg_" + Date.now(),
      sender: senderData.name,
      role: senderData.role,
      avatar: senderData.avatar,
      content: typedMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...chatMessages, newMsg];
    saveChat(updated);
    setTypedMessage("");

    // Simulate practitioner responses to make chat look alive and real!
    if (isYou) {
      setTimeout(() => {
        const triggers = [
          "I will look into the latest DHIS2 export immediately.",
          "Perfect. Let's schedule a Zoom call to discuss this performance gap.",
          "Our Neonatal health indicator targets are lagging. sister, can you verify our regional support numbers?",
          "Thanks for posting this to the hub. It aligns with our internal audit observations.",
        ];
        const randomPractitioner = CLINICAL_PRACTITIONERS[Math.floor(Math.random() * CLINICAL_PRACTITIONERS.length)];
        const replyMsg: Message = {
          id: "repl_" + Date.now(),
          sender: randomPractitioner.name,
          role: randomPractitioner.role,
          avatar: randomPractitioner.avatar,
          content: triggers[Math.floor(Math.random() * triggers.length)],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveChat([...updated, replyMsg]);
      }, 1500);
    }
  };

  // Generate AI clinical recommendation messaging from data
  const handleComposeAiReview = () => {
    toast.info("Connecting to Gemini M&E Clinical Assistant...");
    setTimeout(() => {
      const generated = `💡 [Gemini AI Observation]: Critical review of recent monthly entries suggests a 12% rise in Neonatal ICU admits. We must sync the Master Plan's target line to match Chefa Robit baseline clinics. Recommend immediately scheduling an EAP-aligned Zoom meeting.`;
      setTypedMessage(generated);
      toast.success("AI generated clinical observation loaded into your composer!");
    }, 1200);
  };

  // Zoom scheduling
  const handleScheduleMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle || !schedDateTime) {
      toast.error("Please provide a title and date/time");
      return;
    }

    const meeting: ZoomMeeting = {
      id: "zoom_" + Date.now(),
      title: schedTitle,
      dateTime: schedDateTime,
      agenda: schedAgenda || "General Hospital KPI Audit",
      link: `https://zoom.us/j/${Math.floor(100000000 + Math.random() * 900000000)}`,
    };

    const updated = [...zoomMeetings, meeting];
    setZoomMeetings(updated);
    localStorage.setItem("hospital_meeting_hub_zoom_meetings", JSON.stringify(updated));

    // Post notification to chat!
    const noticeMsg: Message = {
      id: "notice_" + Date.now(),
      sender: "Zoom Scheduler",
      role: "System Integration",
      avatar: "📅",
      content: `🚨 [Meeting Scheduled]: Dr. Abebe Seme called a virtual review: *" ${meeting.title} "* at ${meeting.dateTime}. Agenda: "${meeting.agenda}". Join link is loaded in Zoom Center.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    saveChat([...chatMessages, noticeMsg]);

    setSchedTitle("");
    setSchedDateTime("");
    setSchedAgenda("");
    toast.success(`Meeting "${meeting.title}" scheduled and shared with reviewers!`);
  };

  const handleDeleteMeeting = (id: string, name: string) => {
    const updated = zoomMeetings.filter(m => m.id !== id);
    setZoomMeetings(updated);
    localStorage.setItem("hospital_meeting_hub_zoom_meetings", JSON.stringify(updated));
    toast.success(`Removed "${name}" from upcoming conference list`);
  };

  // Share post actions
  const handleExportShareCSV = (share: SharedTrend) => {
    if (!share.data) {
      toast.warning("No tabular dataset associated with this share");
      return;
    }
    // Simple CSV formulation
    const headers = Object.keys(share.data[0] || {}).join(",");
    const rows = share.data.map((r: any) => Object.values(r).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${share.title.replace(/\s+/g, "_")}_Share.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Community dataset downloaded successfully as CSV.");
  };

  // Put share context into chat!
  const handleDiscussInChat = (share: SharedTrend) => {
    const chatBubble: Message = {
      id: "msg_share_" + Date.now(),
      sender: "System Administrator",
      role: "M&E Lead",
      avatar: "🛡️",
      content: `📢 [Shared Trend discussion]: I'm sharing the trend *" ${share.title} "* for community review: "${share.content}". Please, let's analyze the performance metrics attached.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updated = [...chatMessages, chatBubble];
    saveChat(updated);
    setActiveSubTab("discussions");
    toast.success("Observation posted to live inter-department discussion board.");
  };

  // Delete shared post
  const handleDeleteShare = (id: string) => {
    const updated = sharedTrends.filter(s => s.id !== id);
    setSharedTrends(updated);
    localStorage.setItem("hospital_meeting_hub_shares", JSON.stringify(updated));
    toast.success("Post removed from community feed");
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 border border-purple-950 rounded-xl p-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500 hover:bg-purple-600 border-none text-xs text-white">v3.2 Collaboration Core</Badge>
            <span className="text-[11px] text-purple-300 font-mono tracking-widest uppercase">Live Platform</span>
          </div>
          <h1 className="text-2xl font-bold font-['Georgia']">M&E Meeting Hub & Review Suite</h1>
          <p className="text-xs text-purple-200/90 leading-relaxed font-sans max-w-xl">
            Streamline communication between departments. Share live analytical charts, discuss trends with core stakeholders, schedule reviews, and host video calls on our integrated conference desk.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setIsInCall(true);
              setActiveCallTitle("Quick Inter-dept M&E Consultation");
              setActiveSubTab("zoom");
            }}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-9 flex items-center gap-1.5 shadow"
          >
            <Video className="w-4 h-4" /> Start Quick Meeting
          </Button>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="bg-slate-100 border p-1 rounded-lg gap-1 grid grid-cols-3 max-w-[500px]">
          <TabsTrigger value="discussions" className="text-xs font-semibold py-1.5 px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            💬 Practitioner Chat
          </TabsTrigger>
          <TabsTrigger value="zoom" className="text-xs font-semibold py-1.5 px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            🎥 Zoom Live Board
          </TabsTrigger>
          <TabsTrigger value="shares" className="text-xs font-semibold py-1.5 px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            👥 Outpost Shares ({sharedTrends.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. DISCUSSIONS TAB */}
        <TabsContent value="discussions" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Active Members Sidebar list */}
            <Card className="lg:col-span-4 bg-white shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-600" /> Clinical Reviewers list
                </CardTitle>
                <CardDescription className="text-[10px]">Active departments represented in current conversation</CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                
                {CLINICAL_PRACTITIONERS.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 p-2 hover:bg-slate-50/70 rounded-lg transition-colors border border-transparent">
                    <span className="text-2xl">{p.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.role}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                ))}

                <div className="pt-3 border-t">
                  <Label className="text-[11px] font-bold text-slate-600 mb-1 block">Speak Representing Role:</Label>
                  <select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 font-semibold bg-slate-50"
                  >
                    <option value="You (Admin)">You (Admin) — M&E Audit Lead</option>
                    {CLINICAL_PRACTITIONERS.map(p => (
                      <option key={p.name} value={p.name}>{p.name} — {p.role}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Chat discussion screen */}
            <Card className="lg:col-span-8 bg-white shadow-sm border-slate-200 flex flex-col h-[500px]">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Inter-Departmental Clinical Board</CardTitle>
                  <CardDescription className="text-[10px]">Messages are securely stored into local audit registers.</CardDescription>
                </div>
                <Button 
                  size="xs" 
                  variant="outline" 
                  onClick={handleComposeAiReview}
                  className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-[#8421d9] font-bold text-[10px] gap-1 h-7 text-[11px]"
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Assist Observation
                </Button>
              </CardHeader>

              {/* Message scroll container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <MessageSquare className="w-8 h-8 opacity-40 mb-2 text-indigo-500" />
                    <p className="text-xs">No entries on the board. Type below to open conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isAdmin = msg.role.includes("M&E");
                    return (
                      <div key={msg.id} className={`flex items-start gap-2.5 max-w-[85%] ${isAdmin ? "ml-auto flex-row-reverse" : ""}`}>
                        <div className="w-8 h-8 rounded-full bg-slate-200 border flex items-center justify-center text-base shrink-0">
                          {msg.avatar}
                        </div>
                        <div>
                          <div className={`rounded-xl p-3 shadow-2xs ${
                            isAdmin ? "bg-purple-700 text-white" : "bg-white border text-slate-800"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1 justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider">{msg.sender} <span className="opacity-80 font-normal">({msg.role})</span></span>
                              <span className="text-[9px] opacity-75">{msg.timestamp}</span>
                            </div>
                            <p className="text-xs leading-relaxed font-medium font-sans whitespace-pre-line">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <div className="p-3 border-t border-slate-100 flex gap-2">
                <Input
                  placeholder={`Speaking as ${selectedUser}... Type clinical query...`}
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="text-xs h-9 bg-slate-50"
                />
                <Button onClick={handleSendMessage} size="sm" className="bg-purple-700 hover:bg-purple-800 text-white font-bold h-9 shrink-0 gap-1">
                  <Send className="w-3.5 h-3.5" /> Post
                </Button>
              </div>

            </Card>
          </div>
        </TabsContent>

        {/* 2. ZOOM LIVE VIDEO TAB */}
        <TabsContent value="zoom" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Scheduler Panel on the left */}
            <Card className="lg:col-span-4 bg-white shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs uppercase tracking-widest text-[#8421d9] font-bold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Schedule Conference
                </CardTitle>
                <CardDescription className="text-[10px]">Create structured Zoom reviews for Hospital boards</CardDescription>
              </CardHeader>
              <CardContent className="p-3 font-sans">
                <form onSubmit={handleScheduleMeeting} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600">Meeting Topic Name *</Label>
                    <Input 
                      placeholder="e.g., Q3 Neonatal Mortality Audit" 
                      value={schedTitle} 
                      onChange={(e) => setSchedTitle(e.target.value)}
                      className="text-xs h-8 bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600">Date & Start Time *</Label>
                    <Input 
                      type="datetime-local" 
                      value={schedDateTime} 
                      onChange={(e) => setSchedDateTime(e.target.value)}
                      className="text-xs h-8 bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600">Review Objectives / Agenda</Label>
                    <Input 
                      placeholder="e.g. Discuss YTD malaria caseload growth" 
                      value={schedAgenda} 
                      onChange={(e) => setSchedAgenda(e.target.value)}
                      className="text-xs h-8 bg-slate-50"
                    />
                  </div>

                  <Button type="submit" size="sm" className="w-full text-xs h-8.5 bg-slate-800 hover:bg-slate-950 font-bold transition">
                    📅 Schedule & Post to Chat
                  </Button>
                </form>

                <div className="mt-5 border-t pt-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Upcoming Scheduled Review</h4>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto">
                    {zoomMeetings.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">No conferences on agenda.</p>
                    ) : (
                      zoomMeetings.map(m => (
                        <div key={m.id} className="p-2 border border-slate-100 bg-slate-50/60 rounded-lg text-[11.5px] space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800 truncate block w-[160px]">{m.title}</span>
                            <button onClick={() => handleDeleteMeeting(m.id, m.title)} className="text-slate-400 hover:text-red-500 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#8421d9]" /> {m.dateTime}
                          </p>
                          <div className="flex gap-1.5 pt-1">
                            <Button 
                              size="xs" 
                              onClick={() => {
                                setIsInCall(true);
                                setActiveCallTitle(m.title);
                              }}
                              className="bg-purple-600 hover:bg-purple-700 h-6 text-[10px] text-white font-bold w-full"
                            >
                              🚀 Boot Conference
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Simulated Live Video Call window or active desktop call dashboard */}
            <Card className="lg:col-span-8 bg-slate-900 border-indigo-950 text-white shadow-xl flex flex-col h-[500px] overflow-hidden">
              {isInCall ? (
                // 1. Zoom Call layout and streams active!
                <div className="flex-1 flex flex-col relative h-full">
                  {/* Top Bar Call */}
                  <div className="bg-slate-950/80 p-3 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></div>
                      <div>
                        <h3 className="text-xs font-bold text-white truncate max-w-[200px]">{activeCallTitle}</h3>
                        <p className="text-[9px] text-slate-400 font-mono">Zoom Stream ID: {Math.floor(200384102 + Math.random()*852304910)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-950/20 text-[10px] font-mono">
                      🔴 Live: {formatTime(callDuration)}
                    </Badge>
                  </div>

                  {/* Main Grid showing streams and screenshare snapshot */}
                  <div className="flex-1 bg-slate-950 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-y-auto">
                    
                    {/* Screenshare snapshot on the left (8 cols) */}
                    <div className="md:col-span-8 bg-slate-900 rounded-lg p-3 border border-slate-800/80 flex flex-col justify-between relative overflow-hidden min-h-[180px]">
                      {isScreenSharing ? (
                        <div className="h-full flex flex-col justify-between">
                          <div className="flex justify-between items-center">
                            <Badge className="bg-blue-600 text-[10px]">🖥️ Active Screen Sharing</Badge>
                            <span className="text-[10px] text-slate-400">Clinicians are viewing current frame</span>
                          </div>
                          
                          <div className="my-auto flex flex-col items-center justify-center text-center p-4">
                            <Laptop className="w-12 h-12 text-blue-400 animate-pulse mb-2" />
                            <h4 className="text-xs font-bold text-white">YTD Clinical Performance Dashboard Shared</h4>
                            <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                              Recharts components and DHIS2 server logs are streamed direct from analytic memory workspace.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col justify-between">
                          <div className="flex justify-between items-center">
                            <Badge className="bg-purple-600 text-[10px]">📁 Shared Hospital Asset Focus</Badge>
                            <span className="text-[10px] text-purple-300 font-medium">Shared Review Asset</span>
                          </div>

                          <div className="my-auto text-center p-4">
                            <p className="text-[10px] text-zinc-400">We are reviewing the shared indicator statistics.</p>
                            <div className="mt-3 bg-slate-950/50 p-3 rounded border border-white/5 inline-block text-left text-[11px] text-zinc-300 font-mono">
                              ⭐ On Track Indicators: {monthlyData.slice(0, 15).length} Mapped <br />
                              ⭐ Current Region Code: BL-892_Black_Lion_Hospital
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] bg-slate-950/85 p-2 rounded text-slate-400">
                        🛡️ SSL secure military-grade healthcare encrypted Zoom tunnel. Direct link pipeline.
                      </div>
                    </div>

                    {/* Camera Feeds on the right (4 cols) */}
                    <div className="md:col-span-4 spacing-y-2 flex flex-col gap-2">
                      <div className="bg-slate-900 rounded-lg p-2 border border-slate-800 flex items-center gap-2 relative">
                        <span className="text-xl">🛡️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold truncate">You (M&E Director)</p>
                          <p className="text-[8px] text-slate-400 truncate">Audio/Video Streaming</p>
                        </div>
                        <Badge className="bg-emerald-600 font-semibold text-[8px] scale-90 px-1 py-0 border-none shrink-0">ME</Badge>
                        {!isVideoOn && (
                          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center rounded-lg text-rose-500 font-bold text-[10px]">
                            Camera Off
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 rounded-lg p-2 border border-slate-800 flex items-center gap-2 relative">
                        <span className="text-xl">👨‍⚕️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold truncate">Dr. Abebe Seme</p>
                          <p className="text-[8px] text-slate-400 truncate">Chief Officer</p>
                        </div>
                        <Badge className="bg-[#8421d9] font-medium text-[8px] scale-90 px-1 py-0 border-none shrink-0">Speaking</Badge>
                      </div>

                      <div className="bg-slate-900 rounded-lg p-2 border border-slate-800 flex items-center gap-2 relative">
                        <span className="text-xl">👩‍⚕️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold truncate">Sister Genet</p>
                          <p className="text-[8px] text-slate-400 truncate">Nursing Lead</p>
                        </div>
                        <div className="w-1.5 h-1.5 bg-[#8421d9] rounded-full animate-ping"></div>
                      </div>
                    </div>

                  </div>

                  {/* Controller Board */}
                  <div className="bg-slate-950 p-4 shrink-0 flex items-center justify-between border-t border-slate-800/50">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsMuted(!isMuted)}
                        variant="outline"
                        size="icon"
                        className={`h-9 w-9 rounded-full border-slate-700 hover:bg-slate-800 hover:text-white ${isMuted ? "bg-rose-950 text-rose-300 hover:bg-rose-900" : "bg-slate-900 text-white"}`}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                      <Button
                        onClick={() => setIsVideoOn(!isVideoOn)}
                        variant="outline"
                        size="icon"
                        className={`h-9 w-9 rounded-full border-slate-700 hover:bg-slate-800 hover:text-white ${!isVideoOn ? "bg-rose-950 text-rose-300 hover:bg-rose-900" : "bg-slate-900 text-white"}`}
                      >
                        {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        variant="outline"
                        size="icon"
                        className={`h-9 w-9 rounded-full border-slate-700 hover:bg-slate-800 hover:text-white ${isScreenSharing ? "bg-blue-900 border-blue-700 text-blue-200" : "bg-slate-900 text-white"}`}
                      >
                        <Laptop className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                      Secure Zoom Call Endpoint. High fidelity diagnostic screen.
                    </p>

                    <Button
                      onClick={() => setIsInCall(false)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 flex items-center gap-1.5 rounded-lg px-4"
                    >
                      <PhoneOff className="w-4 h-4" /> End Call
                    </Button>
                  </div>
                </div>
              ) : (
                // 2. Offline Idle state showing how to initialize zoom
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 bg-slate-800 rounded-full text-indigo-400 animate-pulse shadow-md">
                    <Video className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Zoom Virtual Consultation Center</h2>
                    <p className="text-slate-400 text-xs max-w-sm mt-1 mx-auto leading-relaxed">
                      Launch high fidelity web conference reviewer pipelines. Sync and overlay clinical indicators direct onto streaming assets.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        setIsInCall(true);
                        setActiveCallTitle("Instant Inter-dept Quality Review Call");
                      }} 
                      size="sm" 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 gap-1.5"
                    >
                      🎥 Start Instant Zoom Call
                    </Button>
                    <Button 
                      onClick={() => setActiveSubTab("discussions")} 
                      variant="outline" 
                      size="sm" 
                      className="h-9 hover:bg-slate-800 hover:text-white border-slate-700 text-white gap-1"
                    >
                      💬 Ping Colleagues in Chat
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* 3. COMMUNITY SHARED OUTPOST FEEDS */}
        <TabsContent value="shares" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 border p-3.5 rounded-lg">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Hospital Community Media Feed</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Explore indicator performance metrics, plan corrections, and AI insights exported to the outpost community.</p>
              </div>
              <Button size="xs" variant="outline" className="text-xs font-bold gap-1" onClick={() => {
                setSharedTrends(getDefaultShares());
                localStorage.setItem("hospital_meeting_hub_shares", JSON.stringify(getDefaultShares()));
                toast.success("Community feed defaults loaded.");
              }}>
                <RefreshCw className="h-3.5 w-3.5" /> Reset Feed
              </Button>
            </div>

            {sharedTrends.length === 0 ? (
              <Card className="p-8 text-center bg-white border border-dashed text-slate-400">
                <Share2 className="w-10 h-10 mx-auto opacity-35 text-indigo-400 mb-2 animate-bounce" />
                <h4 className="text-sm font-semibold text-slate-700">Community Outpost Shared Feed is Vacant</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed">
                  Go to <strong>Analytics Workspace</strong> or <strong>Master Plan</strong> and click <strong>"Share to Hub"</strong> on graphs or targets to post directly to clinical practitioner communities!
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedTrends.map((share) => (
                  <Card key={share.id} className="bg-white border text-slate-800 shadow-xs flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b border-indigo-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none px-1.5 py-0 text-[9px] font-bold select-none uppercase">
                            {share.type === 'chart' ? "📊 Performance Visual" : "📋 Action Plan Targets"}
                          </Badge>
                          <h4 className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">{share.title}</h4>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Shared by {share.author} • {new Date(share.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => handleDeleteShare(share.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <p className="text-[11.5px] text-slate-500 italic leading-relaxed whitespace-pre-wrap">"{share.content}"</p>

                      {/* If the shared item has Chart Dataset, let's render a gorgeous mini visualizer chart! */}
                      {share.type === 'chart' && share.data && share.data.length > 0 && (
                        <div className="h-[120px] bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={share.data.slice(0, 5)}>
                              <XAxis dataKey="area" tick={{ fontSize: 8 }} />
                              <YAxis tick={{ fontSize: 8 }} />
                              <Bar dataKey="avgPercent" fill="#8421d9" radius={[2, 2, 0, 0]} />
                              <Bar dataKey="percent" fill="#6366f1" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* If shared action plan data targets, show a mini targets scoreboard */}
                      {share.type === 'action-plan' && share.data && (
                        <div className="grid grid-cols-3 gap-2 py-1.5 bg-slate-50 border border-slate-100/50 rounded-lg text-center font-semibold text-[10px]">
                          <div>
                            <span className="block text-emerald-600 font-bold text-xs">{share.data.onTrack || 5}</span>
                            <span className="text-[8px] uppercase text-zinc-500">On Track</span>
                          </div>
                          <div>
                            <span className="block text-amber-500 font-bold text-xs">{share.data.atRisk || 2}</span>
                            <span className="text-[8px] uppercase text-zinc-500">At Risk</span>
                          </div>
                          <div>
                            <span className="block text-red-500 font-bold text-xs">{share.data.offTrack || 0}</span>
                            <span className="text-[8px] uppercase text-zinc-500">Off Track</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-50 flex gap-1.5 justify-end">
                        <Button 
                          onClick={() => handleDiscussInChat(share)} 
                          size="xs" 
                          variant="outline" 
                          className="h-6.5 text-[10.5px] font-bold border-indigo-100 text-[#8421d9] bg-indigo-50/50 hover:bg-indigo-50"
                        >
                          💬 Discuss in Chat
                        </Button>
                        <Button 
                          onClick={() => handleExportShareCSV(share)} 
                          size="xs" 
                          className="h-6.5 text-[10.5px] font-bold bg-slate-800 hover:bg-slate-900 text-white shrink-0"
                        >
                          <Download className="w-3 h-3 mr-1" /> Export Data
                        </Button>
                      </div>

                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
      
    </div>
  );
}

// ── Default templates data if vacancy ───────────────────────────────────────────

function getDefaultChatMsgs(): Message[] {
  return [
    {
      id: "m1",
      sender: "Dr. Abebe Seme",
      role: "Chief of Medicine",
      avatar: "👨‍⚕️",
      content: "Welcome everyone to our clinical collaboration space. Please make sure to share your latest departmental reviews here so we can analyze before scheduled boards.",
      timestamp: "10:15 AM"
    },
    {
      id: "m2",
      sender: "Sister Genet",
      role: "Nursing Informatics",
      avatar: "👩‍⚕️",
      content: "Thank you. Dr. Yared, have we finished the verification checks for Neonatal resuscitation baseline levels in the DHIS2 import sheet?",
      timestamp: "10:22 AM"
    },
    {
      id: "m3",
      sender: "Dr. Yared Kassahun",
      role: "M&E Coordinator",
      avatar: "👨‍⚕️",
      content: "Sister Genet, yes! I just mapped those using Gemini AI ontology alignments inside the DHIS2 tab. They align perfectly with our Chefa Robit baseline. Pinned the charts to our Outpost shares!",
      timestamp: "10:30 AM"
    }
  ];
}

function getDefaultMeetings(): ZoomMeeting[] {
  return [
    {
      id: "z1",
      title: "Monthly Clinical Indicators Audit Board",
      dateTime: "Thu, May 28 - 2:00 PM (Clinical Lab)",
      agenda: "Review malaria caseload seasonality spikes and corrective vaccine distribution targets.",
      link: "https://zoom.us/j/5012391024"
    },
    {
      id: "z2",
      title: "Chefa Robit M&E Quality Circle Round",
      dateTime: "Mon, June 01 - 10:00 AM (Zoom ID: 8903)",
      agenda: "Formulate Neonatal ICU target line reconciliation. Sister Genet speaker.",
      link: "https://zoom.us/j/1029381048"
    }
  ];
}

function getDefaultShares(): SharedTrend[] {
  return [
    {
      id: "s1",
      title: "Department Performance Summary Trends",
      type: "chart",
      author: "Dr. Yared Kassahun",
      content: "YTD Performance trends across clinical sectors. Major surge noted in Outpatient volumes while surgical baseline requires correction.",
      data: [
        { area: "Outpatient", avgPercent: 94 },
        { area: "Inpatient", avgPercent: 88 },
        { area: "Pediatrics", avgPercent: 72 },
        { area: "Maternity", avgPercent: 65 },
      ],
      createdAt: "2026-05-27T10:30:00Z"
    },
    {
      id: "s2",
      title: "EFY 2017 Corrective Audit Objectives",
      type: "action-plan",
      author: "Dr. Abebe Seme",
      content: "Corrective clinical actions and targets mapping for our regional pediatric health outreach stations. We must focus on areas with off-track achievement ratios.",
      data: {
        total: 10,
        onTrack: 6,
        atRisk: 3,
        offTrack: 1
      },
      createdAt: "2026-05-26T16:45:00Z"
    }
  ];
}
