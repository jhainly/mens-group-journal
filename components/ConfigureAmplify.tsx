"use client";

import { useEffect } from "react";
import { configureAmplify } from "@/lib/amplifyClient";

export function ConfigureAmplify() {
  useEffect(() => {
    void configureAmplify();
  }, []);

  return null;
}
