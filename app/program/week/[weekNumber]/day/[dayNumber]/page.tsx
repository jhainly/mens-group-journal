import { notFound } from "next/navigation";
import { DayJournal } from "@/components/DayJournal";
import { sampleProgram } from "@/data/sampleProgram";

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
  const week = sampleProgram.weeks.find((candidate) => candidate.weekNumber === weekNumber);
  const day = week?.days.find((candidate) => candidate.dayNumber === dayNumber);

  if (!week || !day) {
    notFound();
  }

  return <DayJournal weekNumber={week.weekNumber} day={day} program={sampleProgram} groupId="demo-group" />;
}
