/**
 * PromoCodeInput.tsx
 * Reusable promo code entry widget for checkout forms.
 * Sends the code to the selected checkout. Eligibility is verified only after
 * the server resolves the exact organization-owned product.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface PromoCodeInputProps {
  /** Called when a valid code is applied; pass null to clear */
  onApply: (code: string | null, discountText: string | null) => void;
  /** Optional CSS class for the wrapper */
  className?: string;
}

export default function PromoCodeInput({ onApply, className }: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountText, setDiscountText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError(null);
    setAppliedCode(trimmed);
    setDiscountText("Eligibility will be confirmed when checkout begins");
    onApply(trimmed, "Eligibility will be confirmed when checkout begins");
    setCode("");
  };

  const handleClear = () => {
    setAppliedCode(null);
    setDiscountText(null);
    setError(null);
    setCode("");
    onApply(null, null);
  };

  if (appliedCode) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <Badge variant="secondary" className="bg-amber-50 text-amber-800 border-amber-200 font-mono text-xs px-2 py-0.5">
          {appliedCode}
        </Badge>
        <span className="text-sm text-amber-800 font-medium">{discountText}</span>
        <button
          onClick={handleClear}
          className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
          title="Remove promo code"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
            placeholder="Promo code"
            className="pl-9 font-mono text-sm uppercase tracking-wider"
            disabled={checking}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={!code.trim() || checking}
          className="shrink-0 px-4"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
