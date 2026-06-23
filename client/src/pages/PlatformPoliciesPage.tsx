import { useState } from "react";
import { sanitize, sanitizeCss } from "@/lib/sanitize";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, ArrowLeft } from "lucide-react";

/**
 * PlatformPoliciesPage
 * Public page at /policies — serves Teachific's own Terms of Service and Privacy Policy.
 * Content is stored in platform_settings (not linked to any org).
 */
export default function PlatformPoliciesPage() {
  const [, setLocation] = useLocation();
  const { data: policies, isLoading } = trpc.platformAdmin.getPolicies.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Teachific
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-sm">Legal Policies</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Legal Policies</h1>
          </div>
          <p className="text-muted-foreground">
            Teachific™ Platform — these policies govern your use of the Teachific platform and services.
          </p>
        </div>

        <Tabs defaultValue="terms">
          <TabsList className="mb-6">
            <TabsTrigger value="terms" className="gap-2">
              <FileText className="w-4 h-4" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terms">
            <div className="rounded-xl border border-border bg-card p-8">
              {policies?.termsOfService ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitize(policies.termsOfService) }}
                />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-base">Terms of Service not yet published.</p>
                  <p className="text-sm mt-1">
                    Please check back soon or contact{" "}
                    <a href="mailto:support@teachific.app" className="text-teal-600 hover:underline">
                      support@teachific.app
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="privacy">
            <div className="rounded-xl border border-border bg-card p-8">
              {policies?.privacyPolicy ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitize(policies.privacyPolicy) }}
                />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-base">Privacy Policy not yet published.</p>
                  <p className="text-sm mt-1">
                    Please check back soon or contact{" "}
                    <a href="mailto:support@teachific.app" className="text-teal-600 hover:underline">
                      support@teachific.app
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-10">
          © {new Date().getFullYear()} Teachific™. All rights reserved.
        </p>
      </div>
    </div>
  );
}
