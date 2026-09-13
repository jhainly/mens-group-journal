"use client";

import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { sampleProgram } from "@/data/sampleProgram";
import { formatPoints } from "@/lib/format";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import { getProgramDayDisplayName, getProgramWeekDisplayName } from "@/lib/programDays";
import { validateProgramYaml } from "@/lib/programValidation";
import {
  listAdminGroups,
  previewWeekReplacementImpacts,
  publishProgramWeeksToGroups,
  type AdminGroupSummary,
  type WeekReplacementImpact
} from "@/lib/services/dataClient";
import type { ProgramImportPreview, ProgramSection, ProgramWeek } from "@/types/program";

const exampleYaml = yaml.dump(sampleProgram, {
  lineWidth: 100,
  noRefs: true
});

type YamlImportPreviewProps = {
  groups?: AdminGroupSummary[];
  onPublished?: () => void;
};

export function YamlImportPreview({ groups: providedGroups, onPublished }: YamlImportPreviewProps = {}) {
  const [source, setSource] = useState(exampleYaml);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<AdminGroupSummary[]>(providedGroups ?? []);
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [replacementImpacts, setReplacementImpacts] = useState<WeekReplacementImpact[]>([]);
  const [isVisibleOnImport, setIsVisibleOnImport] = useState(true);

  useEffect(() => {
    if (providedGroups) {
      const selectedGroup = resolveSelectedGroup(providedGroups);
      setGroups(providedGroups);

      if (selectedGroup) {
        setSelectedGroupIds((current) => keepValidGroupSelection(current, providedGroups, selectedGroup.groupId));
        setSelectedGroupId(selectedGroup.groupId);
      } else if (providedGroups[0]) {
        setSelectedGroupIds((current) => keepValidGroupSelection(current, providedGroups, providedGroups[0].groupId));
        setSelectedGroupId(providedGroups[0].groupId);
      } else {
        setSelectedGroupIds([]);
      }
      return;
    }

    let cancelled = false;

    void listAdminGroups().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      const selectedGroup = resolveSelectedGroup(result.data);
      setGroups(result.data);

      if (selectedGroup) {
        setSelectedGroupIds([selectedGroup.groupId]);
        setSelectedGroupId(selectedGroup.groupId);
      } else if (result.data[0]) {
        setSelectedGroupIds([result.data[0].groupId]);
        setSelectedGroupId(result.data[0].groupId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [providedGroups]);

  async function validate() {
    const result = await validateProgramYaml(source);
    if (result.ok) {
      const firstWeek = result.preview.program.weeks[0];
      const firstDay = firstWeek?.days[0];

      setPreview(result.preview);
      setSelectedWeekNumber(firstWeek?.weekNumber ?? 1);
      setSelectedDayNumber(firstDay?.dayNumber ?? 1);
      setErrors([]);
      setReplacementImpacts([]);
      return;
    }
    setPreview(null);
    setErrors(result.errors);
    setReplacementImpacts([]);
  }

  async function publish() {
    if (!preview || selectedGroupIds.length === 0) {
      setMessage("Choose at least one group before importing.");
      return;
    }

    const impacts = await previewWeekReplacementImpacts({
      groupIds: selectedGroupIds,
      weeks: preview.program.weeks
    });

    if (!impacts.ok) {
      setMessage(impacts.error);
      return;
    }

    setReplacementImpacts(impacts.data);

    if (impacts.data.length > 0 && !window.confirm(getReplacementConfirmationText(impacts.data))) {
      setMessage("Import cancelled.");
      return;
    }

    setSelectedGroupId(selectedGroupIds[0]);
    const result = await publishProgramWeeksToGroups(selectedGroupIds, preview, { isVisible: isVisibleOnImport });
    setMessage(result.ok ? result.data : result.error);

    if (result.ok) {
      onPublished?.();
    }
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, groupId]));
      }
      return current.filter((candidate) => candidate !== groupId);
    });
  }

  function selectWeek(weekNumber: number) {
    const week = preview?.program.weeks.find((candidate) => candidate.weekNumber === weekNumber);

    setSelectedWeekNumber(weekNumber);
    setSelectedDayNumber(week?.days[0]?.dayNumber ?? 1);
  }

  return (
    <div className="grid two import-preview-grid">
      <div className="stack">
        <section className="panel stack import-program-panel">
          <h2>YAML source</h2>
          <label className="field">
            <span>Program content</span>
            <textarea value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
          {groups.length > 0 ? (
            <fieldset className="field">
              <span>Groups</span>
              <div className="stack compact-stack">
                {groups.map((group) => (
                  <label className="checkbox-row" key={group.groupId}>
                    <input
                      checked={selectedGroupIds.includes(group.groupId)}
                      onChange={(event) => toggleGroup(group.groupId, event.target.checked)}
                      type="checkbox"
                    />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="muted">Create a Lifepoint Church group before importing a program.</p>
          )}
          <label className="checkbox-row">
            <input
              checked={isVisibleOnImport}
              onChange={(event) => setIsVisibleOnImport(event.target.checked)}
              type="checkbox"
            />
            <span>Make imported weeks visible to group members immediately</span>
          </label>
          <button className="button" type="button" onClick={validate}>
            Preview program
          </button>
        </section>
      </div>

      <section className="panel stack">
        <h2>Preview</h2>
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
              <p>No import warnings.</p>
            )}
            {replacementImpacts.length > 0 ? (
              <section className="warning-box stack">
                <h3>Existing imported weeks will be replaced</h3>
                <ul>
                  {replacementImpacts.map((impact) => (
                    <li key={`${impact.groupId}:${impact.weekNumber}`}>
                      {impact.groupName}: Week {impact.weekNumber} <strong>{impact.existingTitle}</strong> will be
                      replaced by <strong>{impact.importedTitle}</strong>.
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <RenderedProgramPreview
              dayNumber={selectedDayNumber}
              onDayChange={setSelectedDayNumber}
              onWeekChange={selectWeek}
              weekNumber={selectedWeekNumber}
              weeks={preview.program.weeks}
            />
            <button className="button secondary" type="button" onClick={publish}>
              Import weeks
            </button>
          </>
        ) : (
          <p>Preview a program to review it here.</p>
        )}
        {message ? <p>{message}</p> : null}
      </section>
    </div>
  );
}

function keepValidGroupSelection(current: string[], groups: AdminGroupSummary[], fallbackGroupId: string): string[] {
  const availableGroupIds = new Set(groups.map((group) => group.groupId));
  const next = current.filter((groupId) => availableGroupIds.has(groupId));
  return next.length > 0 ? next : [fallbackGroupId];
}

function getReplacementConfirmationText(impacts: WeekReplacementImpact[]): string {
  const lines = impacts.map(
    (impact) =>
      `- ${impact.groupName}: Week ${impact.weekNumber} "${impact.existingTitle}" will be replaced by "${impact.importedTitle}".`
  );

  return [
    "Importing will replace existing week content for the selected groups.",
    "",
    ...lines,
    "",
    "Continue?"
  ].join("\n");
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
                {getProgramWeekDisplayName(candidate)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Day</span>
          <select value={day.dayNumber} onChange={(event) => onDayChange(Number(event.target.value))}>
            {week.days.map((candidate) => (
              <option key={candidate.dayNumber} value={candidate.dayNumber}>
                {getProgramDayDisplayName(candidate)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="render-preview-header stack">
        <div>
          <p className="eyebrow">{getProgramWeekDisplayName(week)}</p>
          <h2>
            {getProgramDayDisplayName(day)}
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
  const partial = isPartialSection(section);

  return (
    <section className="render-preview-section">
      <div className="section-layout">
        {!shouldShowCompletionControl(section) || partial ? (
          <span className="section-check" aria-hidden="true" />
        ) : (
          <label className="section-check" aria-label={`Preview ${section.title} checkbox`}>
            <input disabled type="checkbox" />
          </label>
        )}

        <div className="section-content">
          <div>
            {shouldShowPointLabel(section) ? <p className="eyebrow">{getSectionPointLabel(section)}</p> : null}
            <h3>{section.title}</h3>
          </div>
          {section.body ? <p>{section.body}</p> : null}
          {partial ? (
            <div className="field preview-partial-control">
              <span>{getCompletionControlLabel(section)}</span>
              {hasCompletionItems(section) ? (
                <div className="completion-checklist preview" role="group" aria-label={getCompletionControlLabel(section)}>
                  {getCompletionItems(section).map((item) => (
                    <label className="completion-check-item" key={item.id}>
                      <input disabled type="checkbox" />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="completion-picker preview" role="group" aria-label={getCompletionControlLabel(section)}>
                  {getCompletionOptions(section).map((completionCount) => (
                    <button className={completionCount === 0 ? "active" : ""} disabled key={completionCount} type="button">
                      {completionCount}
                    </button>
                  ))}
                </div>
              )}
              <small>
                Preview: 0/{section.points} points. Users can enter 0-{section.maxCompletions}{" "}
                {pluralizeUnit(section.completionUnit ?? "completion", section.maxCompletions ?? 0)}.
              </small>
            </div>
          ) : null}
          {section.scripture?.map((scripture) => (
            <blockquote className="scripture" key={scripture.reference}>
              <strong>{scripture.reference}</strong>
              <p>{scripture.text}</p>
            </blockquote>
          ))}
          {section.breathPrayer && section.breathPrayer.length > 0 ? (
            <div className="breath-prayer" aria-label="Breath prayer preview">
              <p className="eyebrow">Breathe the following prayer</p>
              <div className="breath-prayer-grid">
                {section.breathPrayer.map((pair, pairIndex) => (
                  <div className="breath-prayer-row" key={`${pair.inhale}-${pairIndex}`}>
                    <div>
                      <span>Inhale {pairIndex + 1}</span>
                      <p>{pair.inhale}</p>
                    </div>
                    <div>
                      <span>Exhale {pairIndex + 1}</span>
                      <p>{pair.exhale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {section.prompts?.map((prompt) => (
            <label className="field" key={prompt.id}>
              <span>{prompt.label}</span>
              <textarea className="journal-textarea" disabled placeholder="Write your response" />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function isPartialSection(section: ProgramSection): boolean {
  return Boolean(section.maxCompletions && section.maxCompletions > 1 && section.pointsPerCompletion);
}

function hasCompletionItems(section: ProgramSection): boolean {
  return Boolean(section.completionItems && section.completionItems.length > 0);
}

function getCompletionItems(section: ProgramSection) {
  return section.completionItems ?? [];
}

function shouldShowCompletionControl(section: ProgramSection): boolean {
  return section.points > 0;
}

function shouldShowPointLabel(section: ProgramSection): boolean {
  return section.points > 0 || isPartialSection(section);
}

function getSectionPointLabel(section: ProgramSection): string {
  if (!isPartialSection(section)) {
    return formatPoints(section.points);
  }

  const unit = section.completionUnit ?? "completion";
  return `${formatPoints(section.pointsPerCompletion ?? 1)} per ${unit}, ${section.maxCompletions} ${pluralizeUnit(
    unit,
    section.maxCompletions ?? 0
  )} max`;
}

function getCompletionOptions(section: ProgramSection): number[] {
  return Array.from({ length: (section.maxCompletions ?? 0) + 1 }, (_, index) => index);
}

function getCompletionControlLabel(section: ProgramSection): string {
  return `${capitalize(pluralizeUnit(section.completionUnit ?? "completion", section.maxCompletions ?? 0))} completed`;
}

function pluralizeUnit(unit: string, count: number): string {
  return count === 1 ? unit : `${unit}s`;
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
