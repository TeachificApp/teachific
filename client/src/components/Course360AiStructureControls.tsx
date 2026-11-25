import React from "react";

export function Course360AiStructureControls({ mode, moduleCount, lessonsPerModule, onModeChange, onModuleCountChange, onLessonsPerModuleChange, disabled = false }: {
  mode: "manual" | "ai";
  moduleCount: number;
  lessonsPerModule: number;
  onModeChange: (mode: "manual" | "ai") => void;
  onModuleCountChange: (count: number) => void;
  onLessonsPerModuleChange: (count: number) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-sm font-medium">Curriculum structure</legend>
    <div className="flex flex-wrap gap-3 text-sm">
      <label><input type="radio" name="course360-ai-structure" checked={mode === "manual"} onChange={() => onModeChange("manual")} className="mr-1.5 accent-[var(--org-primary)]" />Manual counts</label>
      <label><input type="radio" name="course360-ai-structure" checked={mode === "ai"} onChange={() => onModeChange("ai")} className="mr-1.5 accent-[var(--org-primary)]" />AI-planned structure</label>
    </div>
    {mode === "manual" ? <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Number of modules: <strong>{moduleCount}</strong><input aria-label="Number of modules" type="range" min={1} max={20} step={1} value={moduleCount} onChange={event => onModuleCountChange(Number(event.target.value))} className="mt-2 w-full accent-[var(--org-primary)]" /><span className="flex justify-between text-xs text-gray-500"><span>1</span><span>20</span></span></label>
      <label className="text-sm">Lessons per module: <strong>{lessonsPerModule}</strong><input aria-label="Lessons per module" type="range" min={1} max={10} step={1} value={lessonsPerModule} onChange={event => onLessonsPerModuleChange(Number(event.target.value))} className="mt-2 w-full accent-[var(--org-primary)]" /><span className="flex justify-between text-xs text-gray-500"><span>1</span><span>10</span></span></label>
    </div> : <p className="text-xs text-gray-500">AI plans modules and lessons from your subject, outline and sources. Each module can contain as few as 1 lesson, and lesson counts can differ between modules. Review the complete preview before creating the course.</p>}
  </fieldset>;
}
