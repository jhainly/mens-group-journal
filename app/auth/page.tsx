import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getServerAuthState } from "@/lib/amplifyServer";

export default async function AuthPage() {
  const { authenticated } = await getServerAuthState();

  if (authenticated) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
