import type { Program } from "@/types/program";

/**
 * Starter template shown in the admin import page.
 *
 * It follows the conventions in docs/program-yaml-reference.md: Day 1 is the weekly mission overview ending with
 * the Weekly Meeting, and the reflection days run Wednesday, Thursday, Friday, Monday, Tuesday with the week due
 * before Tuesday evening's meeting. Real weekly content lives in imports/; paste one of those files into the
 * import page.
 */
export const sampleProgram: Program = {
  program: {
    id: "lifepoint-deep-roots-fall-2026",
    title: "Deep Roots",
    version: "1.0.0",
    description: "Deep Roots weekly missions adapted for the Lifepoint men's group."
  },
  weeks: [
    {
      weekNumber: 1,
      title: "Week One Mission",
      summary: "Complete the Week One mission, including the daily Reading and Reflection, before Tuesday evening's meeting.",
      days: [
        {
          dayNumber: 1,
          label: "Weekly Mission",
          title: "Weekly Mission",
          sections: [
            {
              id: "chapter-challenge",
              title: "Chapter Challenge",
              body: "Weekly physical/spiritual discipline instructions from the source content. 1 point per day.",
              completionUnit: "day",
              completionItems: [
                { id: "wednesday", label: "Wednesday" },
                { id: "thursday", label: "Thursday" },
                { id: "friday", label: "Friday" },
                { id: "monday", label: "Monday" },
                { id: "tuesday", label: "Tuesday" }
              ],
              maxCompletions: 5,
              points: 5,
              pointsPerCompletion: 1
            },
            {
              id: "chapter-reading",
              title: "Chapter Reading",
              body: "Read the assigned chapter of the book.",
              points: 6
            },
            {
              id: "memorization",
              title: "Memorization",
              body: "Scripture reference and verse text from the source content.",
              points: 2
            },
            {
              id: "aerobic-exercise",
              title: "Aerobic Exercise",
              body: "10 minutes, 2 days this week. Some suggestions are walking, running, hiking, bike riding, swimming, etc.",
              completionUnit: "day",
              maxCompletions: 2,
              points: 2,
              pointsPerCompletion: 1
            },
            {
              id: "weekly-meeting",
              title: "Weekly Meeting",
              body: "Attend the Tuesday evening weekly meeting. The whole program meets together for group discussion, then splits into TEAMs for small group discussion. Check in with each other, recite the memory verse, discuss the daily book questions, and pray for each other.",
              points: 8
            }
          ]
        },
        {
          dayNumber: 2,
          label: "Wednesday",
          title: "Reading and Reflection",
          sections: [
            {
              id: "chapter-challenge",
              title: "Answer the daily book question.",
              points: 0,
              prompts: [{ id: "wednesday-book-question", label: "Daily book question from the source content." }]
            },
            {
              id: "spiritual-action",
              title: "Spiritual Action: Reading and Reflection",
              body: "Read the assigned passage slowly two times.",
              points: 1,
              prompts: [
                { id: "wednesday-q1", label: "First Bible reading question from the source content." },
                { id: "wednesday-q2", label: "Second Bible reading question from the source content." },
                { id: "wednesday-q3", label: "Third Bible reading question from the source content." }
              ]
            },
            {
              id: "breath-prayer",
              title: "Breath Prayer",
              breathPrayer: [
                { inhale: "You breathed life into me...", exhale: "Every breath is Your gift to me." },
                { inhale: "You sustain me each moment...", exhale: "My existence depends on You." }
              ],
              points: 0
            },
            {
              id: "apply-gods-truth",
              title: "Apply God's Truth to Your Life",
              points: 0,
              prompts: [
                {
                  id: "wednesday-apply-summary",
                  label:
                    "Write down one or two sentences that summarize what God might be saying to you through reading and praying His word."
                },
                {
                  id: "wednesday-apply-action",
                  label:
                    "Write down one practical action step you will take today to live out what you learned in your reading, reflection, and prayer."
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
