import { notFound } from "next/navigation";
import { DayJournal } from "@/components/DayJournal";

type DayPageProps = {
  params: Promise<{
    weekNumber: string;
    dayNumber: string;
  }>;
};

export default async function DayPage({ params }: DayPageProps) {
  const { weekNumber: weekParam, dayNumber: dayParam } = await params;
  const weekNumber = Number(weekParam);
  const dayNumber = Number(dayParam);

  if (!Number.isInteger(weekNumber) || !Number.isInteger(dayNumber) || weekNumber < 1 || dayNumber < 1) {
    notFound();
  }

  return <DayJournal weekNumber={weekNumber} dayNumber={dayNumber} />;
}
