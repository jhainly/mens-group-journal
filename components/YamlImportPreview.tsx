"use client";

import yaml from "js-yaml";
import { useState } from "react";
import { sampleProgram } from "@/data/sampleProgram";
import { formatPoints } from "@/lib/format";
import { getProgramDayLabel } from "@/lib/programDays";
import { validateProgramYaml } from "@/lib/programValidation";
import { publishProgram } from "@/lib/services/dataClient";
import type { ProgramDay, ProgramImportPreview, ProgramSection, ProgramWeek } from "@/types/program";

const exampleYaml = yaml.dump(
  {
    program: sampleProgram.program,
    weeks: [sampleProgram.weeks[0]]
  },
  {
    lineWidth: 100,
    noRefs: true
  }
);

export function YamlImportPreview() {
  const [source, setSource] = useState(exampleYaml);
  const [groupId, setGroupId] = useState("");
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function validate() {
    const result = await validateProgramYaml(source);
    if (result.ok) {
      const firstWeek = result.preview.program.weeks[0];
      const firstDay = firstWeek?.days[0];

      setPreview(result.preview);
      setSelectedWeekNumber(firstWeek?.weekNumber ?? 1);
      setSelectedDayNumber(firstDay?.dayNumber ?? 1);
      setErrors([]);
      return;
    }
    setPreview(null);
    setErrors(result.errors);
  }

  async function publish() {
    if (!preview || !groupId.trim()) {
      setMessage("Enter a group id before publishing.");
      return;
    }

    const result = await publishProgram(groupId, preview);
    setMessage(result.ok ? "Program published." : result.error);
  }

  function selectWeek(weekNumber: number) {
    const week = preview?.program.weeks.find((candidate) => candidate.weekNumber === weekNumber);

    setSelectedWeekNumber(weekNumber);
    setSelectedDayNumber(week?.days[0]?.dayNumber ?? 1);
  }

  return (
    <div className="grid two import-preview-grid">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Import</p>
          <h1>Program preview</h1>
          <p>Review the program before making it available to the group.</p>
        </div>
        <label className="field">
          <span>Program content</span>
          <textarea value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <label className="field">
          <span>Group id</span>
          <input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Group to publish into" />
        </label>
        <button className="button" type="button" onClick={validate}>
          Preview program
        </button>
      </section>

      <section className="panel stack">
        <p className="eyebrow">Preview</p>
        {errors.length > 0 ? (
          <ul>
            {errors.map((error) => (
              <li className="warning" key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {preview ? (
          <>
            <div>
              <h2>{preview.program.program.title}</h2>
              <p>
                {preview.program.weeks.length} weeks,{" "}
                {preview.program.weeks.reduce((total, week) => total + week.days.length, 0)} days
              </p>
            </div>
            {preview.warnings.length > 0 ? (
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No semantic warnings.</p>
            )}
            <RenderedProgramPreview
              dayNumber={selectedDayNumber}
              onDayChange={setSelectedDayNumber}
              onWeekChange={selectWeek}
              weekNumber={selectedWeekNumber}
              weeks={preview.program.weeks}
            />
            <button className="button secondary" type="button" onClick={publish}>
              Publish program
            </button>
          </>
        ) : (
          <p>No valid preview yet.</p>
        )}
        {message ? <p>{message}</p> : null}
      </section>
    </div>
  );
}

function RenderedProgramPreview({
  dayNumber,
  onDayChange,
  onWeekChange,
  weekNumber,
  weeks
}: {
  dayNumber: number;
  onDayChange: (dayNumber: number) => void;
  onWeekChange: (weekNumber: number) => void;
  weekNumber: number;
  weeks: ProgramWeek[];
}) {
  const week = weeks.find((candidate) => candidate.weekNumber === weekNumber) ?? weeks[0];
  const day = week?.days.find((candidate) => candidate.dayNumber === dayNumber) ?? week?.days[0];

  if (!week || !day) {
    return <p>No renderable content.</p>;
  }

  return (
    <div className="render-preview stack">
      <div className="grid two">
        <label className="field">
          <span>Week</span>
          <select value={week.weekNumber} onChange={(event) => onWeekChange(Number(event.target.value))}>
            {weeks.map((candidate) => (
              <option key={candidate.weekNumber} value={candidate.weekNumber}>
                Week {candidate.weekNumber}: {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Day</span>
          <select value={day.dayNumber} onChange={(event) => onDayChange(Number(event.target.value))}>
            {week.days.map((candidate) => (
              <option key={candidate.dayNumber} value={candidate.dayNumber}>
                {getProgramDayLabel(candidate.dayNumber)}: {candidate.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="render-preview-header stack">
        <div>
          <p className="eyebrow">Week {week.weekNumber}</p>
          <h2>
            {getProgramDayLabel(day.dayNumber)}: {day.title}
          </h2>
          {week.summary ? <p>{week.summary}</p> : null}
        </div>
      </section>

      <div className="stack">
        {day.sections.map((section) => (
          <RenderedSectionPreview key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

function RenderedSectionPreview({ section }: { section: ProgramSection }) {
  return (
    <section className="render-preview-section">
      <div className="section-layout">
        <label className="section-check" aria-label={`Preview ${section.title} checkbox`}>
          <input disabled type="checkbox" />
        </label>

        <div className="section-content">
          <div>
            <p className="eyebrow">{formatPoints(section.points)}</p>
            <h3>{section.title}</h3>
          </div>
          {section.body ? <p>{section.body}</p> : null}
          {section.scripture?.map((scripture) => (
            <blockquote className="scripture" key={scripture.reference}>
              <strong>{scripture.reference}</strong>
              <p>{scripture.text}</p>
            </blockquote>
          ))}
          {section.prompts?.map((prompt) => (
            <label className="field" key={prompt.id}>
              <span>{prompt.label}</span>
              <textarea className="journal-textarea" disabled placeholder="Optional reflection" />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
