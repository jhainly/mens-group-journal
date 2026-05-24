"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { clearJournalEncryptionSecret } from "@/lib/journalKey";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await configureAmplify();
      await signOut();
    } finally {
      clearJournalEncryptionSecret();
      router.push("/");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <button className="nav-button" disabled={isLoggingOut} onClick={handleLogout} type="button">
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
