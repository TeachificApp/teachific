import { useEffect, useState } from "react";
import { BookOpen, Layers, Video, Library } from "lucide-react";
import FilesPage from "./FilesPage";
import QuizzesPage from "./QuizzesPage";
import FlashcardsPage from "./FlashcardsPage";
import RecordEditPage from "./RecordEditPage";
import { getCourse360MediaLibraryHref } from "@/lib/course360MediaLibrary";

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
  { id: "record-edit", label: "Course360 Studio™", icon: Video },
  { id: "quizzes", label: "Quizzes", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: Layers },
];

export default function MediaLibraryPage() {
  const [activeTab, setActiveTab] = useState<TabId>(getDefaultTab);
  const libraryHref = getCourse360MediaLibraryHref(activeTab);
  const needsMainDomain = libraryHref.startsWith("https://");

  useEffect(() => {
    if (needsMainDomain) window.location.replace(libraryHref);
  }, [libraryHref, needsMainDomain]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  if (needsMainDomain) {
    return <p className="p-6 text-sm text-muted-foreground">Opening your main Course360 account's media library. <a className="text-primary underline" href={libraryHref}>Continue to Media Library</a></p>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-3 border-b border-border bg-primary/5 shrink-0">
        <h1 className="text-sm font-semibold">Your organization's Course360 Media Library</h1>
        <p className="text-xs text-muted-foreground mt-1">Included with your main Course360 account. Studio, Creator, and Quiz Creator can save here; storage follows your organization's Course360 plan, not a Studio subscription.</p>
      </div>
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
