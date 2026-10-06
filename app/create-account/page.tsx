import { Suspense } from "react";
import { CreateAccountForm } from "@/components/auth/CreateAccountForm";

export default function CreateAccountPage() {
  return (
    <Suspense fallback={null}>
      <CreateAccountForm />
    </Suspense>
  );
}
