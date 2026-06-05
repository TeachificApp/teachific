import { useState } from "react";
import { BookOpen, Layers, Video, Library } from "lucide-react";
import FilesPage from "./FilesPage";
import QuizzesPage from "./QuizzesPage";
import FlashcardsPage from "./FlashcardsPage";
import RecordEditPage from "./RecordEditPage";

type TabId = "library" | "record-edit" | "quizzes" | "flashcards";

function getDefaultTab(): TabId {
  const hash = window.location.hash.replace("#", "");
  // Legacy hash redirects
  if (hash === "files" || hash === "upload" || hash === "media-files") return "library";
  const validTabs: TabId[] = ["library", "record-edit", "quizzes", "flashcards"];
  return validTabs.includes(hash as TabId) ? (hash as TabId) : "library";
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "library", label: "Content Library", icon: Library },
  { id: "record-edit", label: "Teachific Studio™", icon: Video },
  { id: "quizzes", label: "Quizzes", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: Layers },
];

export default function MediaLibraryPage() {
  const [activeTab, setActiveTab] = useState<TabId>(getDefaultTab);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-border bg-background shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "library" && <FilesPage />}
        {activeTab === "record-edit" && <RecordEditPage />}
        {activeTab === "quizzes" && <QuizzesPage />}
        {activeTab === "flashcards" && <FlashcardsPage />}
      </div>
    </div>
  );
}
