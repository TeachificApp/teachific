import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Layers, Plus, Trash2, Edit2, Download, Upload, Sparkles,
  ChevronLeft, ChevronRight, RotateCcw, BookOpen, X, GripVertical,
  CheckCircle2, AlertCircle, FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlashCard {
  id?: number;
  front: string;
  back: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  sortOrder: number;
}

interface FlashDeck {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  isPublic?: boolean;
  createdAt?: Date;
}

// ─── Study Mode ───────────────────────────────────────────────────────────────
function StudyMode({ deck, cards, onClose }: { deck: FlashDeck; cards: FlashCard[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [unknown, setUnknown] = useState<Set<number>>(new Set());

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">No cards in this deck</p>
        <Button variant="outline" onClick={onClose}>Back to Decks</Button>
      </div>
    );
  }

  const card = cards[index];
  const progress = Math.round(((known.size + unknown.size) / cards.length) * 100);

  const markKnown = () => {
    setKnown(prev => new Set(Array.from(prev).concat(index)));
    setUnknown(prev => { const s = new Set(prev); s.delete(index); return s; });
    if (index < cards.length - 1) { setIndex(i => i + 1); setFlipped(false); }
  };

  const markUnknown = () => {
    setUnknown(prev => new Set(Array.from(prev).concat(index)));
    setKnown(prev => { const s = new Set(prev); s.delete(index); return s; });
    if (index < cards.length - 1) { setIndex(i => i + 1); setFlipped(false); }
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="text-center">
          <p className="font-semibold text-sm">{deck.title}</p>
          <p className="text-xs text-muted-foreground">{index + 1} / {cards.length}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-green-600 font-medium">{known.size} ✓</span>
          <span className="text-red-500 font-medium">{unknown.size} ✗</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer"
        onClick={() => setFlipped(f => !f)}
      >
        <div className="w-full max-w-lg">
          <Card className={`min-h-[280px] flex flex-col items-center justify-center text-center p-8 shadow-lg border-2 transition-all ${
            flipped ? "border-primary/40 bg-primary/5" : "border-border"
          }`}>
            <Badge variant={flipped ? "default" : "secondary"} className="mb-4 text-xs">
              {flipped ? "Answer" : "Question"}
            </Badge>
            {flipped ? (
              card.backImageUrl ? (
                <div className="space-y-3">
                  <img src={card.backImageUrl} alt="Answer" className="max-h-32 mx-auto rounded" />
                  <p className="text-lg font-medium">{card.back}</p>
                </div>
              ) : (
                <p className="text-lg font-medium">{card.back}</p>
              )
            ) : (
              card.frontImageUrl ? (
                <div className="space-y-3">
                  <img src={card.frontImageUrl} alt="Question" className="max-h-32 mx-auto rounded" />
                  <p className="text-lg font-medium">{card.front}</p>
                </div>
              ) : (
                <p className="text-lg font-medium">{card.front}</p>
              )
            )}
            <p className="text-xs text-muted-foreground mt-4">Click to flip</p>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-3 flex-1 justify-center">
          <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50" onClick={markUnknown}>
            <AlertCircle className="h-4 w-4" /> Still Learning
          </Button>
          <Button variant="outline" className="gap-2 border-green-200 text-green-600 hover:bg-green-50" onClick={markKnown}>
            <CheckCircle2 className="h-4 w-4" /> Got It
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }} disabled={index === cards.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {progress === 100 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-3 text-center text-sm text-green-700">
            🎉 Deck complete! {known.size} known, {unknown.size} still learning.
            <Button variant="link" size="sm" className="text-green-700 ml-2" onClick={() => { setIndex(0); setFlipped(false); setKnown(new Set()); setUnknown(new Set()); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restart
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Deck Editor ──────────────────────────────────────────────────────────────
function DeckEditor({ deck, orgId, onBack }: { deck: FlashDeck; orgId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: cards = [], isLoading, refetch } = trpc.lms.flashcards.getCards.useQuery({ deckId: deck.id });
  const saveCards = trpc.lms.flashcards.saveCards.useMutation({
    onSuccess: () => { toast.success("Cards saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const generateAI = trpc.lms.flashcards.generateAI.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [localCards, setLocalCards] = useState<FlashCard[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiCount, setAiCount] = useState(15);
  const [studyMode, setStudyMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  if (!initialized && !isLoading) {
    setLocalCards((cards as unknown as FlashCard[]).map((c, i) => ({ ...c, sortOrder: i })));
    setInitialized(true);
  }

  const addCard = () => {
    setLocalCards(prev => [...prev, { front: "", back: "", sortOrder: prev.length }]);
    setDirty(true);
  };

  const updateCard = (idx: number, field: keyof FlashCard, value: string) => {
    setLocalCards(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    setDirty(true);
  };

  const removeCard = (idx: number) => {
    setLocalCards(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sortOrder: i })));
    setDirty(true);
  };

  const handleSave = () => {
    saveCards.mutate({ deckId: deck.id, cards: localCards.map((c, i) => ({ ...c, sortOrder: i })) });
    setDirty(false);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) return;
    const result = await generateAI.mutateAsync({ orgId, topic: aiTopic, numCards: aiCount, context: aiContext || undefined });
    if (result.cards.length > 0) {
      const newCards = result.cards.map((c, i) => ({ front: c.front, back: c.back, sortOrder: localCards.length + i }));
      setLocalCards(prev => [...prev, ...newCards]);
      setDirty(true);
      setAiOpen(false);
      setAiTopic("");
      setAiContext("");
      toast.success(`Generated ${result.cards.length} cards`);
    } else {
      toast.error("No cards generated. Try a different topic.");
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<{ Front: string; Back: string }>(ws);
        const imported = rows.filter(r => r.Front && r.Back).map((r, i) => ({
          front: String(r.Front),
          back: String(r.Back),
          sortOrder: localCards.length + i,
        }));
        setLocalCards(prev => [...prev, ...imported]);
        setDirty(true);
        toast.success(`Imported ${imported.length} cards`);
      } catch {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleExcelExport = () => {
    const rows = localCards.map(c => ({ Front: c.front, Back: c.back }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flashcards");
    XLSX.writeFile(wb, `${deck.title.replace(/\s+/g, "_")}_flashcards.xlsx`);
  };

  if (studyMode) {
    return <StudyMode deck={deck} cards={localCards} onClose={() => setStudyMode(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Decks
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h2 className="font-semibold text-sm">{deck.title}</h2>
            <p className="text-xs text-muted-foreground">{localCards.length} cards</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStudyMode(true)} className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Study
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI Generate
          </Button>
          <label>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <span><Upload className="h-3.5 w-3.5" /> Import Excel</span>
            </Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
          </label>
          <Button variant="outline" size="sm" onClick={handleExcelExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saveCards.isPending} className="gap-1.5">
            {saveCards.isPending ? "Saving..." : "Save Cards"}
          </Button>
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : localCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Layers className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No cards yet. Add cards manually, use AI generation, or import from Excel.</p>
            <div className="flex gap-2">
              <Button onClick={addCard} className="gap-2"><Plus className="h-4 w-4" /> Add Card</Button>
              <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-2"><Sparkles className="h-4 w-4" /> AI Generate</Button>
            </div>
          </div>
        ) : (
          <>
            {localCards.map((card, idx) => (
              <Card key={idx} className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Front (Question)</Label>
                        <Textarea
                          value={card.front}
                          onChange={(e) => updateCard(idx, "front", e.target.value)}
                          placeholder="Enter question or term..."
                          className="resize-none text-sm min-h-[72px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Back (Answer)</Label>
                        <Textarea
                          value={card.back}
                          onChange={(e) => updateCard(idx, "back", e.target.value)}
                          placeholder="Enter answer or definition..."
                          className="resize-none text-sm min-h-[72px]"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-1" onClick={() => removeCard(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addCard} className="w-full gap-2 border-dashed">
              <Plus className="h-4 w-4" /> Add Card
            </Button>
          </>
        )}
      </div>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Flashcard Generator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Topic <span className="text-destructive">*</span></Label>
              <Input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="e.g. World History, Python programming..." />
            </div>
            <div className="space-y-1.5">
              <Label>Number of cards</Label>
              <Input type="number" min={5} max={50} value={aiCount} onChange={e => setAiCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Additional context <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={aiContext} onChange={e => setAiContext(e.target.value)} placeholder="Paste notes, a chapter summary, or specific terms to focus on..." className="resize-none min-h-[80px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={handleAIGenerate} disabled={!aiTopic.trim() || generateAI.isPending} className="gap-2">
              {generateAI.isPending ? <><span className="animate-spin">⟳</span> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main FlashcardsPage ──────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const { orgId } = useOrgScope();

  const { data: decks = [], isLoading, refetch } = trpc.lms.flashcards.listDecks.useQuery(
    { orgId },
    { enabled: !!orgId }
  );
  const createDeck = trpc.lms.flashcards.createDeck.useMutation({
    onSuccess: () => { toast.success("Deck created"); refetch(); setCreateOpen(false); setNewTitle(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDeck = trpc.lms.flashcards.deleteDeck.useMutation({
    onSuccess: () => { toast.success("Deck deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [selectedDeck, setSelectedDeck] = useState<FlashDeck | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");

  if (selectedDeck) {
    return <DeckEditor deck={selectedDeck} orgId={orgId} onBack={() => setSelectedDeck(null)} />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcard Decks</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{decks.length} deck{decks.length !== 1 ? "s" : ""} total</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Deck
        </Button>
      </div>

      {/* Excel template download hint */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="py-3 px-4 flex items-center gap-3 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4 shrink-0" />
          <span>Import flashcards from Excel. Your spreadsheet should have <strong>Front</strong> and <strong>Back</strong> columns. Open a deck to import.</span>
        </CardContent>
      </Card>

      {/* Deck grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : decks.length === 0 ? (
        <Card className="shadow-sm border-border/60">
          <CardContent className="py-16 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No flashcard decks yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create a deck and add cards manually, use AI generation, or import from Excel</p>
            <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create First Deck
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <Card key={deck.id} className="hover:shadow-md transition-shadow cursor-pointer border-border/60 group" onClick={() => setSelectedDeck(deck)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">{deck.title}</CardTitle>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteDeck.mutate({ id: deck.id }); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {deck.category && <Badge variant="secondary" className="text-xs w-fit">{deck.category}</Badge>}
              </CardHeader>
              <CardContent className="pt-0">
                {deck.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{deck.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Click to edit cards</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Deck Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Flashcard Deck</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Deck Title <span className="text-destructive">*</span></Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Biology Vocabulary Terms" />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of this deck..." className="resize-none min-h-[72px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Anatomy, Pharmacology..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createDeck.mutate({ orgId, title: newTitle, description: newDesc || undefined, category: newCategory || undefined })}
              disabled={!newTitle.trim() || createDeck.isPending}
            >
              {createDeck.isPending ? "Creating..." : "Create Deck"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
