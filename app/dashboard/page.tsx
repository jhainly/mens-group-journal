import { Dashboard } from "@/components/Dashboard";
import { sampleProgram } from "@/data/sampleProgram";

type DashboardPageProps = {
  searchParams: Promise<{
    week?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { week } = await searchParams;
  const requestedWeekNumber = Number(week);
  const initialWeekNumber = sampleProgram.weeks.some((candidate) => candidate.weekNumber === requestedWeekNumber)
    ? requestedWeekNumber
    : 1;

  return <Dashboard groupId="demo-group" initialWeekNumber={initialWeekNumber} program={sampleProgram} />;
}
