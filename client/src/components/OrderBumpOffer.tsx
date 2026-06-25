import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, ArrowRight } from "lucide-react";
import { renderBlockPreview } from "@/components/PageBuilder";

interface OrderBumpOfferProps {
  bump: {
    id: number;
    name: string;
    headline?: string | null;
    description?: string | null;
    discountPercent?: number | null;
    discountedPrice?: string | null;
    buttonText?: string | null;
    declineText?: string | null;
    imageUrl?: string | null;
    landingPageJson?: any;
    bumpProductType: string;
    bumpProductId: number;
  };
  orgId: number;
  onAccept: (bumpId: number) => void;
  onDecline: (bumpId: number) => void;
  loading?: boolean;
  variant?: "interstitial" | "inline" | "card";
}

export function OrderBumpOffer({ bump, orgId, onAccept, onDecline, loading, variant = "card" }: OrderBumpOfferProps) {
  const handleAccept = () => {
    onAccept(bump.id);
  };

  const handleDecline = () => {
    onDecline(bump.id);
  };

  // If there's a custom landing page, render it
  const hasLandingPage = bump.landingPageJson && Array.isArray(bump.landingPageJson) && bump.landingPageJson.length > 0;

  if (variant === "interstitial") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          {hasLandingPage ? (
            <div className="space-y-4">
              {bump.landingPageJson.map((block: any, i: number) => (
                <div key={i}>{renderBlockPreview(block)}</div>
              ))}
            </div>
          ) : (
            <>
              <div className="text-center space-y-3">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  <Zap className="w-3 h-3 mr-1" /> Special Offer
                </Badge>
                <h1 className="text-3xl font-bold">
                  {bump.headline || "Wait! We have a special offer for you"}
                </h1>
                {bump.description && (
                  <p className="text-lg text-muted-foreground">{bump.description}</p>
                )}
              </div>

              {bump.imageUrl && (
                <div className="flex justify-center">
                  <img src={bump.imageUrl} alt="" className="max-w-md rounded-lg shadow-md" />
                </div>
              )}

              {bump.discountPercent && bump.discountPercent > 0 && (
                <div className="text-center">
                  <Badge className="text-lg px-4 py-2 bg-green-600">
                    {bump.discountPercent}% OFF
                  </Badge>
                </div>
              )}

              {bump.discountedPrice && (
                <p className="text-center text-2xl font-bold text-green-600">
                  Only {bump.discountedPrice}
                </p>
              )}
            </>
          )}

          <div className="flex flex-col items-center gap-3 pt-4">
            <Button
              size="lg"
              className="w-full max-w-md text-lg py-6"
              onClick={handleAccept}
              disabled={loading}
            >
              <Check className="w-5 h-5 mr-2" />
              {bump.buttonText || "Yes, add to my order!"}
            </Button>
            <button
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              onClick={handleDecline}
              disabled={loading}
            >
              {bump.declineText || "No thanks, I'll pass on this offer"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="border-2 border-dashed border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 p-2 rounded-full">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">
              {bump.headline || "Add this to your order"}
            </h4>
            {bump.description && (
              <p className="text-xs text-muted-foreground mt-1">{bump.description}</p>
            )}
            {bump.discountPercent && bump.discountPercent > 0 && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {bump.discountPercent}% OFF
              </Badge>
            )}
          </div>
          {bump.discountedPrice && (
            <span className="font-bold text-green-600 text-sm">{bump.discountedPrice}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleAccept} disabled={loading}>
            <Check className="w-3 h-3 mr-1" />
            {bump.buttonText || "Add to Order"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDecline} disabled={loading}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
            Special Offer
          </span>
        </div>
        <h4 className="font-semibold">{bump.headline || "Add this to your order"}</h4>
        {bump.description && (
          <p className="text-sm text-muted-foreground">{bump.description}</p>
        )}
        {bump.imageUrl && (
          <img src={bump.imageUrl} alt="" className="w-full h-32 object-cover rounded" />
        )}
        <div className="flex items-center justify-between">
          {bump.discountedPrice && (
            <span className="font-bold text-green-600">{bump.discountedPrice}</span>
          )}
          {bump.discountPercent && bump.discountPercent > 0 && (
            <Badge variant="secondary">{bump.discountPercent}% OFF</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleAccept} disabled={loading}>
            {bump.buttonText || "Add to Order"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline} disabled={loading}>
            {bump.declineText || "No thanks"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * OrderBumpInterstitial - Full-page component shown before or after checkout
 */
export function OrderBumpInterstitial({
  bumps,
  orgId,
  onComplete,
  onSkipAll,
}: {
  bumps: any[];
  orgId: number;
  onComplete: (acceptedBumpIds: number[]) => void;
  onSkipAll: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);

  if (bumps.length === 0) {
    onSkipAll();
    return null;
  }

  const currentBump = bumps[currentIndex];
  if (!currentBump) {
    onComplete(acceptedIds);
    return null;
  }

  const handleAccept = (bumpId: number) => {
    const newAccepted = [...acceptedIds, bumpId];
    setAcceptedIds(newAccepted);
    if (currentIndex + 1 < bumps.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(newAccepted);
    }
  };

  const handleDecline = () => {
    if (currentIndex + 1 < bumps.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(acceptedIds);
    }
  };

  return (
    <OrderBumpOffer
      bump={currentBump}
      orgId={orgId}
      onAccept={handleAccept}
      onDecline={handleDecline}
      variant="interstitial"
    />
  );
}

export default OrderBumpOffer;
