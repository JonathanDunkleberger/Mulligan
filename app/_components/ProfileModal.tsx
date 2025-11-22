"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function ProfileModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  // Mock auth state for now. 
  // In a real app, this would come from a provider (e.g. Clerk, NextAuth).
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#18181b] text-white border-[#27272a]">
        <div className="flex flex-col gap-6 py-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Account</h2>
            <p className="text-gray-400 text-sm">Manage your profile and preferences.</p>
          </div>

          {isLoggedIn ? (
             <div className="flex flex-col gap-3">
               <div className="p-4 rounded-md bg-white/5 border border-white/10 mb-2">
                 <p className="font-medium">Logged in as User</p>
                 <p className="text-xs text-gray-400">user@example.com</p>
               </div>
               
               <Button 
                 variant="secondary" 
                 className="w-full justify-start" 
                 onClick={() => setIsLoggedIn(false)}
               >
                 Log Out
               </Button>
               <Button 
                 variant="outline" 
                 className="w-full justify-start text-red-400 border-red-900/50 hover:bg-red-950/30 hover:text-red-300"
                 onClick={() => {
                   // Handle delete account
                   setIsLoggedIn(false);
                 }}
               >
                 Delete Account
               </Button>
             </div>
          ) : (
             <div className="flex flex-col gap-4">
               <div className="p-4 rounded-md bg-purple-500/10 border border-purple-500/20">
                 <p className="text-sm text-purple-200">
                   Sign in to sync your favorites, watch history, and get personalized recommendations.
                 </p>
               </div>
               <Button 
                 className="w-full bg-white text-black hover:bg-gray-200 font-bold" 
                 onClick={() => setIsLoggedIn(true)}
               >
                 Log In / Sign Up
               </Button>
             </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
