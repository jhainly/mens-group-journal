import { JoinGroupForm } from "@/components/groups/JoinGroupForm";

type JoinGroupPageProps = {
  searchParams: Promise<{
    account?: string;
  }>;
};

export default async function JoinGroupPage({ searchParams }: JoinGroupPageProps) {
  const params = await searchParams;
  return <JoinGroupForm accountConfirmed={params.account === "confirmed"} />;
}
