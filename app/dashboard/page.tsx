import { Dashboard } from "@/components/Dashboard";

type DashboardPageProps = {
  searchParams: Promise<{
    week?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { week } = await searchParams;
  const requestedWeekNumber = Number(week);
  const initialWeekNumber = Number.isInteger(requestedWeekNumber) && requestedWeekNumber > 0 ? requestedWeekNumber : null;

  return <Dashboard initialWeekNumber={initialWeekNumber} />;
}
