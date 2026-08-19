import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { getSubdomain } from "@/hooks/useSubdomain";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Heart, Reply, Send, Users, Hash,
  MessageCircle, Home, ThumbsUp, MoreHorizontal, X,
  ArrowLeft, Loader2, Search, Smile,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Constants ───────────────────────────────────────────────────────────────
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({
  post,
  orgId,
  currentUserId,
  onReply,
  primaryColor,
}: {
  post: any;
  orgId: number;
  currentUserId?: number;
  onReply?: (postId: number) => void;
  primaryColor: string;
}) {
  const utils = trpc.useUtils();
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [reacting, setReacting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { data: replies } = trpc.community.listReplies.useQuery(
    { postId: post.id },
    { enabled: showReplies }
  );

  const createReply = trpc.community.createReply.useMutation({
    onSuccess: () => {
      utils.community.listReplies.invalidate({ postId: post.id });
      setReplyText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleReaction = trpc.community.toggleReaction.useMutation({
    onMutate: () => setReacting(true),
    onSettled: () => { setReacting(false); setShowEmojiPicker(false); },
    onSuccess: () => utils.community.listPosts.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deletePost = trpc.community.deletePost.useMutation({
    onSuccess: () => utils.community.listPosts.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      {/* Author row */}
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: primaryColor + "30", color: primaryColor }}>
            {initials(post.authorName || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-sm">{post.authorName}</span>
              {post.isPinned && <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Pinned</Badge>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
              {currentUserId === post.authorId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => deletePost.mutate({ postId: post.id })}>
                      Delete post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="mt-2 rounded-lg max-h-64 object-cover w-full" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pl-12 relative">
        {/* Emoji reaction picker */}
        <div className="relative">
          <button
            className={cn("flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors", reacting && "opacity-50")}
            onClick={() => setShowEmojiPicker((s) => !s)}
            disabled={reacting}
          >
            <Smile className="h-3.5 w-3.5" />
            {post.reactionCount > 0 && <span>{post.reactionCount}</span>}
            React
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-7 left-0 z-50 bg-popover border border-border rounded-xl shadow-lg p-2 flex gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="text-lg hover:scale-125 transition-transform px-1 py-0.5 rounded hover:bg-muted"
                  onClick={() => toggleReaction.mutate({ postId: post.id, emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowReplies((s) => !s)}
        >
          <Reply className="h-3.5 w-3.5" />
          {post.replyCount > 0 && <span>{post.replyCount}</span>}
          Reply
        </button>
      </div>

      {/* Replies */}
      {showReplies && (
        <div className="pl-12 flex flex-col gap-3">
          {replies?.map((r: any) => (
            <div key={r.id} className="flex items-start gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">{initials(r.authorName || "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{r.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="text-xs mt-0.5 leading-relaxed">{r.content}</p>
              </div>
            </div>
          ))}
          {/* Reply input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                  e.preventDefault();
                  createReply.mutate({ postId: post.id, content: replyText.trim() });
                }
              }}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              style={{ backgroundColor: primaryColor }}
              disabled={!replyText.trim() || createReply.isPending}
              onClick={() => createReply.mutate({ postId: post.id, content: replyText.trim() })}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DM Panel ─────────────────────────────────────────────────────────────────
function DmPanel({
  orgId,
  currentUserId,
  primaryColor,
  onClose,
}: {
  orgId: number;
  currentUserId: number;
  primaryColor: string;
  onClose: () => void;
}) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [dmText, setDmText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: conversations } = trpc.community.listDmConversations.useQuery({ orgId });
  const { data: messages } = trpc.community.listDmMessages.useQuery(
    { orgId, partnerId: selectedPartnerId! },
    { enabled: !!selectedPartnerId, refetchInterval: 5000 }
  );

  const sendDm = trpc.community.sendDm.useMutation({
    onSuccess: () => {
      utils.community.listDmMessages.invalidate({ orgId, partnerId: selectedPartnerId! });
      utils.community.listDmConversations.invalidate({ orgId });
      setDmText("");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          {selectedPartnerId && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPartnerId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="font-semibold text-sm">
            {selectedPartnerId ? "Direct Message" : "Messages"}
          </h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!selectedPartnerId ? (
        <div className="flex-1 overflow-y-auto">
          {!conversations?.length ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <MessageCircle className="h-8 w-8 mb-2 opacity-40" />
              No conversations yet
            </div>
          ) : (
            conversations.map((conv: any) => (
              <button
                key={conv.partnerId}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => setSelectedPartnerId(conv.partnerId)}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">?</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">User #{conv.partnerId}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage?.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.lastMessage?.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages?.map((msg: any) => {
              const isMe = msg.fromUserId === currentUserId;
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                    isMe ? "text-white rounded-br-sm" : "bg-muted rounded-bl-sm"
                  )} style={isMe ? { backgroundColor: primaryColor } : {}}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              placeholder="Type a message..."
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && dmText.trim()) {
                  e.preventDefault();
                  sendDm.mutate({ orgId, toUserId: selectedPartnerId, content: dmText.trim() });
                }
              }}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              style={{ backgroundColor: primaryColor }}
              disabled={!dmText.trim() || sendDm.isPending}
              onClick={() => sendDm.mutate({ orgId, toUserId: selectedPartnerId, content: dmText.trim() })}
            >
              {sendDm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunityLearnerPage() {
  const params = useParams<{ hubId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const hubId = parseInt(params.hubId);

  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [postText, setPostText] = useState("");
  const [showDms, setShowDms] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [postSearch, setPostSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: hub, isLoading: hubLoading } = trpc.community.getHubById.useQuery({ hubId });
  const { data: spaces, isLoading: spacesLoading } = trpc.community.listSpacesByHubId.useQuery({ hubId });

  // Auto-select first space
  useEffect(() => {
    if (!selectedSpaceId && spaces?.length) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces?.length]);

  const { data: posts, isLoading: postsLoading } = trpc.community.listPosts.useQuery(
    { spaceId: selectedSpaceId! },
    { enabled: !!selectedSpaceId }
  );

  const { data: members } = trpc.community.listMembers.useQuery(
    { spaceId: selectedSpaceId! },
    { enabled: !!selectedSpaceId }
  );

  const joinSpace = trpc.community.joinSpace.useMutation({
    onSuccess: () => {
      utils.community.listMembers.invalidate({ spaceId: selectedSpaceId! });
      toast.success("Joined space!");
    },
    onError: (e) => toast.error(e.message),
  });

  const createPost = trpc.community.createPost.useMutation({
    onSuccess: () => {
      utils.community.listPosts.invalidate({ spaceId: selectedSpaceId! });
      setPostText("");
      toast.success("Post shared!");
    },
    onError: (e) => toast.error(e.message),
  });

  const primaryColor = hub?.primaryColor || "#24abbc";
  const selectedSpace = spaces?.find((s: any) => s.id === selectedSpaceId);
  const isMember = members?.some((m: any) => m.userId === user?.id);
  const filteredPosts = postSearch.trim()
    ? posts?.filter((p: any) => p.content?.toLowerCase().includes(postSearch.toLowerCase()) || p.authorName?.toLowerCase().includes(postSearch.toLowerCase()))
    : posts;

  if (hubLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-14 border-b border-border flex items-center px-4 gap-3">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-1">
          <div className="w-64 border-r border-border p-4 flex flex-col gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
          <div className="flex-1 p-6 flex flex-col gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Community not found</h2>
          <Button variant="outline" onClick={() => { const sub = getSubdomain(); window.location.href = sub ? getOrgBaseUrl(sub) : "/school"; }}>
            <Home className="h-4 w-4 mr-2" /> Back to School
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ "--community-color": primaryColor } as React.CSSProperties}>
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <Hash className="h-4 w-4" />
          </button>
          <button
            onClick={() => { const sub = getSubdomain(); window.location.href = sub ? getOrgBaseUrl(sub) : "/school"; }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">School</span>
          </button>
          <span className="text-muted-foreground">/</span>
          {hub.logoUrl && <img src={hub.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />}
          <span className="text-sm font-semibold truncate max-w-[200px]">{hub.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", showMembers && "bg-muted")}
            onClick={() => { setShowMembers((s) => !s); setShowDms(false); }}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", showDms && "bg-muted")}
            onClick={() => { setShowDms((s) => !s); setShowMembers(false); }}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Spaces sidebar */}
        <aside
          className={cn(
            "border-r border-border bg-background flex flex-col shrink-0 overflow-y-auto transition-all duration-300",
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          )}
        >
          {/* Hub info */}
          {hub.coverImageUrl && (
            <div className="h-20 overflow-hidden shrink-0">
              <img src={hub.coverImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4 border-b border-border">
            <p className="font-semibold text-sm">{hub.name}</p>
            {hub.tagline && <p className="text-xs text-muted-foreground mt-0.5">{hub.tagline}</p>}
          </div>

          {/* Spaces list */}
          <div className="flex-1 overflow-y-auto py-2">
            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spaces</p>
            {spacesLoading ? (
              <div className="px-4 flex flex-col gap-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
              </div>
            ) : spaces?.map((space: any) => (
              <button
                key={space.id}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors border-l-2",
                  selectedSpaceId === space.id
                    ? "border-l-primary bg-primary/10"
                    : "border-l-transparent hover:bg-muted/40"
                )}
                style={selectedSpaceId === space.id ? { borderLeftColor: primaryColor, backgroundColor: primaryColor + "15" } : {}}
                onClick={() => setSelectedSpaceId(space.id)}
              >
                <span className="text-base shrink-0">{space.emoji || "#"}</span>
                <span className={cn("text-sm flex-1 truncate", selectedSpaceId === space.id ? "font-medium" : "text-muted-foreground")}>
                  {space.name}
                </span>
                {space.accessType && space.accessType !== "open" && (
                  <span
                    className="text-[10px] text-muted-foreground"
                    title={space.accessType === "invite_only" ? "Invite only" : space.accessType === "course_enrollment" ? "Course enrollment required" : space.accessType === "purchase" ? "Purchase required" : ""}
                  >
                    🔒
                  </span>
                )}
                {space.postCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{space.postCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Members count */}
          {selectedSpace && (
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {selectedSpace.memberCount ?? 0} members
              </div>
            </div>
          )}
        </aside>

        {/* Main feed */}
        <main className="flex-1 overflow-y-auto">
          {!selectedSpace ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a space to view posts.
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={postSearch}
                  onChange={(e) => setPostSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Space header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <span>{selectedSpace.emoji || "#"}</span>
                    {selectedSpace.name}
                  </h2>
                  {selectedSpace.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedSpace.description}</p>
                  )}
                </div>
                {!isMember && (
                  <Button
                    size="sm"
                    style={{ backgroundColor: primaryColor }}
                    className="text-white"
                    onClick={() => joinSpace.mutate({ spaceId: selectedSpaceId! })}
                    disabled={joinSpace.isPending}
                  >
                    {joinSpace.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Space"}
                  </Button>
                )}
              </div>

              {/* Post composer */}
              {isMember && (
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: primaryColor + "30", color: primaryColor }}>
                        {initials(user?.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <Textarea
                      placeholder={`Share something with ${selectedSpace.name}...`}
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      className="flex-1 resize-none min-h-[80px] text-sm"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      style={{ backgroundColor: primaryColor }}
                      className="text-white gap-2"
                      disabled={!postText.trim() || createPost.isPending || !orgId}
                      onClick={() => {
                        if (!orgId) return;
                        createPost.mutate({
                          spaceId: selectedSpaceId!,
                          hubId,
                          orgId,
                          content: postText.trim(),
                        });
                      }}
                    >
                      {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Post
                    </Button>
                  </div>
                </div>
              )}

              {/* Posts feed */}
              {postsLoading ? (
                <div className="flex flex-col gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              ) : filteredPosts?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-muted-foreground">{postSearch ? "No posts match your search" : "No posts yet"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{postSearch ? "Try a different search term" : "Be the first to start a conversation!"}</p>
                </div>
              ) : (
                filteredPosts?.map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    orgId={orgId!}
                    currentUserId={user?.id}
                    primaryColor={primaryColor}
                  />
                ))
              )}
            </div>
          )}
        </main>

        {/* Members Panel */}
        {showMembers && (
          <aside className="w-72 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Members
                {members && <span className="text-muted-foreground font-normal">({members.length})</span>}
              </h3>
              <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" onClick={() => setShowMembers(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!members?.length ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mb-2 opacity-40" />
                  No members yet
                </div>
              ) : (
                members.map((m: any) => (
                  <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: primaryColor + "30", color: primaryColor }}>
                        {initials(m.displayName || m.userName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.displayName || m.userName || `User #${m.userId}`}</p>
                      {m.role && m.role !== "member" && (
                        <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                      )}
                    </div>
                    {m.userId !== user?.id && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setShowMembers(false); setShowDms(true); }}
                        title="Send message"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* DM Panel */}
        {showDms && user && orgId && (
          <aside className="w-80 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
            <DmPanel
              orgId={orgId}
              currentUserId={user.id}
              primaryColor={primaryColor}
              onClose={() => setShowDms(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
