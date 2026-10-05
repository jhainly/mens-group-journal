import { Suspense } from "react";
import { PlanningCenterCompleteSignIn } from "@/components/auth/PlanningCenterCompleteSignIn";

export default function PlanningCenterCompletePage() {
  return (
    <Suspense fallback={null}>
      <PlanningCenterCompleteSignIn />
    </Suspense>
  );
}
