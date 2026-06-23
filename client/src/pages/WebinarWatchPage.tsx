import { useState, useEffect, useRef, useCallback } from "react";
import { sanitize, sanitizeCss } from "@/lib/sanitize";
import { useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Send,
  ExternalLink,
  CheckCircle,
  X,
  Video,
  Clock,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : "";
}

function extractVimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : "";
}

// ── AI Viewer Count ───────────────────────────────────────────────────────────

function useAiViewerCount(
  enabled: boolean,
  min: number,
  max: number,
  peakAtMinute: number,
  elapsedSeconds: number
) {
  const [count, setCount] = useState(min);

  useEffect(() => {
    if (!enabled) return;
    const elapsedMinutes = elapsedSeconds / 60;
    // Bell-curve: ramp up to peak, then decline
    let ratio: number;
    if (elapsedMinutes <= peakAtMinute) {
      ratio = elapsedMinutes / peakAtMinute;
    } else {
      const declineMinutes = Math.max(peakAtMinute * 2, 60);
      ratio = Math.max(0, 1 - (elapsedMinutes - peakAtMinute) / declineMinutes);
    }
    const base = min + Math.round((max - min) * ratio);
    // ±5% jitter
    const jitter = Math.round(base * 0.05 * (Math.random() * 2 - 1));
    setCount(Math.max(min, base + jitter));
  }, [enabled, min, max, peakAtMinute, elapsedSeconds]);

  return count;
}

// ── Chat Messages ─────────────────────────────────────────────────────────────

const AI_NAMES = [
  "Sarah M.", "John D.", "Emily R.", "Michael T.", "Jessica L.",
  "David W.", "Amanda K.", "Chris P.", "Lauren H.", "Ryan B.",
  "Stephanie C.", "Kevin O.", "Rachel N.", "Brandon S.", "Melissa F.",
];

const AI_MESSAGES = [
  "This is so helpful, thank you!",
  "Great content!",
  "Can you explain that again?",
  "Love this webinar!",
  "Very informative",
  "Taking notes right now 📝",
  "This is exactly what I needed",
  "Amazing presentation!",
  "How do I get access to the resources?",
  "Watching from Canada 🇨🇦",
  "Watching from Australia 🇦🇺",
  "This changed my perspective",
  "Question: how long is this available?",
  "Sharing this with my team",
  "Gold content right here 🔥",
];

function useAiChat(enabled: boolean, elapsedSeconds: number) {
  const [messages, setMessages] = useState<{ name: string; text: string; time: Date }[]>([]);
  const lastMessageRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    // Add a message every 15-45 seconds
    const interval = 15 + Math.floor(Math.random() * 30);
    if (elapsedSeconds - lastMessageRef.current >= interval) {
      lastMessageRef.current = elapsedSeconds;
      const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
      const text = AI_MESSAGES[Math.floor(Math.random() * AI_MESSAGES.length)];
      setMessages((prev) => [...prev.slice(-49), { name, text, time: new Date() }]);
    }
  }, [enabled, elapsedSeconds]);

  return messages;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WebinarWatchPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const registrationId = params.get("rid") ? Number(params.get("rid")) : undefined;

  const { data: webinar, isLoading } = trpc.lms.webinars.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const heartbeatMutation = trpc.lms.webinars.heartbeat.useMutation();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const startSessionMutation = trpc.lms.webinars.startSession.useMutation({
    onSuccess: (data) => setSessionToken(data.sessionToken),
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [userMessages, setUserMessages] = useState<{ name: string; text: string; time: Date }[]>([]);
  const [showOffer, setShowOffer] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Start session when webinar loads
  useEffect(() => {
    if (!webinar) return;
    startSessionMutation.mutate({ webinarId: webinar.id, registrationId });
  }, [webinar?.id]);

  // Track elapsed time
  useEffect(() => {
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Heartbeat every 30 seconds
  useEffect(() => {
    if (!sessionToken || elapsedSeconds === 0 || elapsedSeconds % 30 !== 0) return;
    heartbeatMutation.mutate({
      sessionToken,
      watchedSeconds: elapsedSeconds,
      currentViewerCount: webinar?.aiViewersEnabled ? aiViewerCount : undefined,
    });
  }, [sessionToken, elapsedSeconds]);

  // Show post-webinar offer overlay
  useEffect(() => {
    if (!webinar || offerDismissed) return;
    const delay = webinar.postWebinarDelaySeconds ?? 300;
    if (elapsedSeconds >= delay && !showOffer) {
      setShowOffer(true);
    }
  }, [webinar, elapsedSeconds, offerDismissed, showOffer]);

  const aiViewerCount = useAiViewerCount(
    webinar?.aiViewersEnabled ?? false,
    webinar?.aiViewersMin ?? 50,
    webinar?.aiViewersMax ?? 300,
    webinar?.aiViewersPeakAt ?? 30,
    elapsedSeconds
  );

  const aiMessages = useAiChat(webinar?.aiViewersEnabled ?? false, elapsedSeconds);

  const allMessages = [...aiMessages, ...userMessages].sort(
    (a, b) => a.time.getTime() - b.time.getTime()
  );

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setUserMessages((prev) => [
      ...prev,
      { name: "You", text: chatInput.trim(), time: new Date() },
    ]);
    setChatInput("");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white text-center px-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Webinar Not Found</h1>
          <p className="text-gray-400">This webinar may have been removed or is not yet published.</p>
        </div>
      </div>
    );
  }

  const renderVideo = () => {
    const src = webinar.videoSource;
    const url = webinar.videoUrl || webinar.videoFileUrl || "";

    if (src === "youtube" && url) {
      const id = extractYouTubeId(url);
      return (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
      );
    }
    if (src === "vimeo" && url) {
      const id = extractVimeoId(url);
      return (
        <iframe
          src={`https://player.vimeo.com/video/${id}?autoplay=1`}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
      );
    }
    if (src === "upload" && webinar.videoFileUrl) {
      return (
        <video
          src={webinar.videoFileUrl}
          controls
          autoPlay
          className="w-full h-full"
        />
      );
    }
    if ((src === "zoom" || src === "teams") && webinar.meetingUrl) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white gap-4">
          <Video className="w-12 h-12 opacity-50" />
          <p className="text-lg font-semibold">Live Meeting</p>
          <p className="text-gray-400 text-sm">
            {src === "zoom" ? "Zoom" : "Microsoft Teams"} meeting
          </p>
          <a href={webinar.meetingUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              <ExternalLink className="w-4 h-4 mr-2" />
              Join {src === "zoom" ? "Zoom" : "Teams"} Meeting
            </Button>
          </a>
          {webinar.meetingId && (
            <p className="text-gray-500 text-sm">Meeting ID: {webinar.meetingId}</p>
          )}
        </div>
      );
    }
    if (src === "embed" && url) {
      if (url.startsWith("<")) {
        return (
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: sanitize(url) }}
          />
        );
      }
      return (
        <iframe src={url} className="w-full h-full" allowFullScreen />
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <p>No video configured for this webinar.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Badge className="bg-red-600 text-white text-xs">
            {webinar.type === "live" ? "🔴 LIVE" : "▶ ON DEMAND"}
          </Badge>
          <h1 className="text-sm font-semibold truncate max-w-xs md:max-w-md">
            {webinar.title}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {webinar.aiViewersEnabled && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium text-white tabular-nums">{aiViewerCount.toLocaleString()}</span>
              <span>watching</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span className="tabular-nums">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video */}
        <div className="flex-1 flex flex-col">
          <div className="aspect-video bg-black w-full">
            {renderVideo()}
          </div>
          <div className="p-4 border-t border-gray-800">
            <h2 className="font-semibold text-lg">{webinar.title}</h2>
            {webinar.description && (
              <p className="text-gray-400 text-sm mt-1 line-clamp-2">{webinar.description}</p>
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="w-80 border-l border-gray-800 flex flex-col bg-gray-900 hidden md:flex">
          <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm">
            Live Chat
            {webinar.aiViewersEnabled && (
              <span className="ml-2 text-xs text-gray-500">
                ({aiViewerCount.toLocaleString()} viewers)
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {allMessages.length === 0 && (
              <p className="text-gray-600 text-xs text-center mt-4">
                Chat messages will appear here.
              </p>
            )}
            {allMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span
                  className={`font-semibold ${msg.name === "You" ? "text-primary" : "text-gray-300"}`}
                >
                  {msg.name}:{" "}
                </span>
                <span className="text-gray-400">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Say something..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-sm h-8"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendMessage}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Post-webinar offer overlay */}
      {showOffer && !offerDismissed && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-white text-gray-900 rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              onClick={() => setOfferDismissed(true)}
            >
              <X className="w-5 h-5" />
            </button>
            {webinar.postWebinarAction === "thankyou" && (
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-3">
                  {webinar.postWebinarMessage || "Thank you for attending!"}
                </h2>
                <Button onClick={() => setOfferDismissed(true)} className="mt-4">
                  Close
                </Button>
              </div>
            )}
            {webinar.postWebinarAction === "url" && webinar.postWebinarUrl && (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-3">Special Offer</h2>
                <p className="text-gray-600 mb-6">
                  Thank you for attending! We have a special offer for you.
                </p>
                <a href={webinar.postWebinarUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Claim Your Offer
                  </Button>
                </a>
                <button
                  className="mt-3 text-sm text-gray-400 hover:text-gray-600"
                  onClick={() => setOfferDismissed(true)}
                >
                  No thanks
                </button>
              </div>
            )}
            {webinar.postWebinarAction === "product" && (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-3">Exclusive Attendee Offer</h2>
                <p className="text-gray-600 mb-6">
                  As a webinar attendee, you qualify for a special discount.
                </p>
                <Button size="lg" className="w-full">
                  Get the Offer
                </Button>
                <button
                  className="mt-3 text-sm text-gray-400 hover:text-gray-600"
                  onClick={() => setOfferDismissed(true)}
                >
                  No thanks
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
