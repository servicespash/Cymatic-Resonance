import React, { useState, useEffect } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export function UpdateNotificationManager() {
  const { hasUpdate, userDismissed, showModal, dismissUpdate, openUpdateModal, reloadApp } =
    useVersionCheck();

  const [showInitialPrompt, setShowInitialPrompt] = useState(false);

  useEffect(() => {
    if (hasUpdate && !userDismissed) {
      setShowInitialPrompt(true);
    }
  }, [hasUpdate, userDismissed]);

  const handleYes = () => {
    setShowInitialPrompt(false);
    openUpdateModal();
  };

  const handleNo = () => {
    setShowInitialPrompt(false);
    dismissUpdate();
  };

  return (
    <>
      {showInitialPrompt && hasUpdate && !userDismissed && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl bg-card border border-frequency/40 p-5 shadow-2xl backdrop-blur-xl animate-bounce-short">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-frequency/20 text-frequency">
              <Sparkles className="size-5 animate-pulse" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-display font-semibold text-sm text-foreground">
                Platform Update Available
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                There are new updates for this platform. Would you like to fetch the new updates?
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleYes}
                  className="h-8 bg-frequency text-background font-semibold hover:brightness-110 text-xs px-3"
                >
                  Yes, Fetch
                </Button>
                <Button size="sm" variant="outline" onClick={handleNo} className="h-8 text-xs px-3">
                  No
                </Button>
              </div>
            </div>
            <button
              onClick={handleNo}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(open) => !open && dismissUpdate()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="size-5 text-frequency" />
              Fetch Updated Version
            </DialogTitle>
            <DialogDescription>
              A new verified platform build is ready. Click below to refresh and load the latest
              updates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="size-16 rounded-full bg-frequency/10 flex items-center justify-center text-frequency animate-pulse">
              <RefreshCw className="size-8" />
            </div>
            <p className="text-xs text-muted-foreground">
              Your session state will be preserved upon refreshing.
            </p>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            <Button variant="outline" onClick={dismissUpdate} className="text-xs">
              Later
            </Button>
            <Button
              onClick={reloadApp}
              className="bg-frequency text-background font-bold gap-2 hover:brightness-110 text-xs"
            >
              <RefreshCw className="size-3.5 animate-spin-slow" />
              Fetch & Refresh Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
