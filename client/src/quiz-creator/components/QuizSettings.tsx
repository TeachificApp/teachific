import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { X, Upload, Trash2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

type Tab = "general" | "scoring" | "branding" | "navigation" | "intro" | "results";

export function QuizSettings({ onClose }: Props) {
  const { quiz, updateMeta } = useQuizStore();
  const m = quiz.meta;
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "scoring", label: "Scoring & Rules" },
    { id: "branding", label: "Branding" },
    { id: "navigation", label: "Navigation" },
    { id: "intro", label: "Intro Slide" },
    { id: "results", label: "Result Slide" },
  ];

  const uploadImage = (callback: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Quiz Settings</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-100 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "text-teal-700 bg-teal-50 border-b-2 border-teal-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "general" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => updateMeta({ title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={m.description}
                  onChange={(e) => updateMeta({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Author Name</label>
                  <input
                    type="text"
                    value={m.author}
                    onChange={(e) => updateMeta({ author: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Author Email</label>
                  <input
                    type="email"
                    value={m.authorEmail}
                    onChange={(e) => updateMeta({ authorEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={m.tags.join(", ")}
                  onChange={(e) => updateMeta({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="anatomy, cardiology, beginner"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
              </div>
            </div>
          )}

          {tab === "scoring" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={m.passingScore}
                    onChange={(e) => updateMeta({ passingScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={m.timeLimit ?? ""}
                    onChange={(e) => updateMeta({ timeLimit: e.target.value ? Number(e.target.value) : null })}
                    placeholder="No limit"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={m.maxAttempts}
                    onChange={(e) => updateMeta({ maxAttempts: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Show Feedback</label>
                  <select
                    value={m.showFeedback}
                    onChange={(e) => updateMeta({ showFeedback: e.target.value as "immediate" | "deferred" | "never" })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  >
                    <option value="immediate">Immediately after each question</option>
                    <option value="deferred">After quiz submission</option>
                    <option value="never">Never show feedback</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                {[
                  { key: "shuffleQuestions", label: "Shuffle question order" },
                  { key: "shuffleAnswers", label: "Shuffle answer choices" },
                  { key: "allowRetry", label: "Allow retry after failure" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m[key as keyof typeof m] as boolean}
                      onChange={(e) => updateMeta({ [key]: e.target.checked })}
                      className="accent-teal-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "branding" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">Customize the look and feel of your quiz player.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.primaryColor || "#24abbc"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, primaryColor: e.target.value, backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.primaryColor || "#24abbc"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, primaryColor: e.target.value, backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.backgroundColor || "#ffffff"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, backgroundColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.backgroundColor || "#ffffff"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, backgroundColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.textColor || "#1a1a1a"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, textColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.textColor || "#1a1a1a"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, textColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Font Family</label>
                  <select
                    value={m.branding?.fontFamily || ""}
                    onChange={(e) => updateMeta({ branding: { ...m.branding, fontFamily: e.target.value || undefined, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  >
                    <option value="">Default (Inter)</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Logo</label>
                {m.branding?.logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={m.branding.logoUrl} alt="Logo" className="h-10 rounded border border-gray-200" />
                    <button
                      onClick={() => updateMeta({ branding: { ...m.branding!, logoUrl: undefined } })}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => uploadImage((url) => updateMeta({ branding: { ...m.branding, logoUrl: url, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } }))}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                  >
                    <Upload className="w-4 h-4" /> Upload logo
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Background Image</label>
                {m.branding?.backgroundImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img src={m.branding.backgroundImageUrl} alt="Background" className="w-full max-h-32 object-cover" />
                    <button
                      onClick={() => updateMeta({ branding: { ...m.branding!, backgroundImageUrl: undefined } })}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1 shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => uploadImage((url) => updateMeta({ branding: { ...m.branding, backgroundImageUrl: url, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } }))}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                  >
                    <Upload className="w-4 h-4" /> Upload background image
                  </button>
                )}
                {m.branding?.backgroundImageUrl && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Overlay Opacity</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={(m.branding?.backgroundOverlay ?? 0.3) * 100}
                      onChange={(e) => updateMeta({ branding: { ...m.branding!, backgroundOverlay: Number(e.target.value) / 100 } })}
                      className="w-full accent-teal-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "navigation" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">Control how learners navigate through the quiz.</p>
              <div className="space-y-3">
                {[
                  { key: "allowBackNavigation", label: "Allow going back to previous questions" },
                  { key: "showProgressBar", label: "Show progress bar" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(m as any)[key] ?? true}
                      onChange={(e) => updateMeta({ [key]: e.target.checked })}
                      className="accent-teal-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Questions Per Page</label>
                <select
                  value={m.questionsPerPage ?? ""}
                  onChange={(e) => updateMeta({ questionsPerPage: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                >
                  <option value="">One at a time</option>
                  <option value="5">5 per page</option>
                  <option value="10">10 per page</option>
                  <option value="999">All on one page</option>
                </select>
              </div>
            </div>
          )}

          {tab === "intro" && (
            <div className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.introSlide?.enabled ?? false}
                  onChange={(e) => updateMeta({ introSlide: { ...m.introSlide, enabled: e.target.checked } })}
                  className="accent-teal-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Show intro slide before quiz starts</span>
              </label>
              {m.introSlide?.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Intro Title</label>
                    <input
                      type="text"
                      value={m.introSlide?.title || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, title: e.target.value } })}
                      placeholder={m.title}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Intro Description</label>
                    <textarea
                      value={m.introSlide?.description || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, description: e.target.value } })}
                      rows={3}
                      placeholder="Welcome to this quiz..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Button Text</label>
                    <input
                      type="text"
                      value={m.introSlide?.buttonText || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, buttonText: e.target.value } })}
                      placeholder="Start Quiz"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Intro Image</label>
                    {m.introSlide?.imageUrl ? (
                      <div className="relative rounded-lg overflow-hidden border border-gray-200 inline-block">
                        <img src={m.introSlide.imageUrl} alt="Intro" className="max-h-32 object-cover" />
                        <button
                          onClick={() => updateMeta({ introSlide: { ...m.introSlide!, imageUrl: undefined } })}
                          className="absolute top-1 right-1 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1 shadow"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => uploadImage((url) => updateMeta({ introSlide: { ...m.introSlide!, imageUrl: url } }))}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                      >
                        <Upload className="w-4 h-4" /> Upload image
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "results" && (
            <div className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.resultSlide?.enabled ?? true}
                  onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide, enabled: e.target.checked } })}
                  className="accent-teal-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Show result slide after quiz completion</span>
              </label>
              {(m.resultSlide?.enabled ?? true) && (
                <>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <h4 className="text-sm font-semibold text-green-700 mb-3">Pass Result</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={m.resultSlide?.passTitle || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, passTitle: e.target.value } })}
                          placeholder="Congratulations!"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Message</label>
                        <textarea
                          value={m.resultSlide?.passMessage || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, passMessage: e.target.value } })}
                          rows={2}
                          placeholder="You passed the quiz!"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <h4 className="text-sm font-semibold text-red-700 mb-3">Fail Result</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={m.resultSlide?.failTitle || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, failTitle: e.target.value } })}
                          placeholder="Not quite..."
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Message</label>
                        <textarea
                          value={m.resultSlide?.failMessage || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, failMessage: e.target.value } })}
                          rows={2}
                          placeholder="Review the material and try again."
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: "showScore", label: "Show score on result slide" },
                      { key: "showPassFail", label: "Show pass/fail status" },
                      { key: "showReviewButton", label: "Show 'Review Answers' button" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(m.resultSlide as any)?.[key] ?? true}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, [key]: e.target.checked } })}
                          className="accent-teal-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
