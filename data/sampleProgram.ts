import type { CompletedSectionKey } from "@/lib/scoring";
import type { Program, ProgramDay, ProgramSection } from "@/types/program";

type ScriptureSeed = {
  reference: string;
  text: string;
};

type DaySeed = {
  title: string;
  focus: string;
  scripture: ScriptureSeed;
};

type WeekSeed = {
  title: string;
  summary: string;
  days: DaySeed[];
};

const weekSeeds: WeekSeed[] = [
  {
    title: "Foundation",
    summary: "Identity, honesty, and the first daily commitments.",
    days: [
      {
        title: "Begin Honestly",
        focus: "Bring what is true into the light before you try to fix it.",
        scripture: {
          reference: "Psalm 139:23-24",
          text: "Search me, God, and know my heart; test me and know my anxious thoughts."
        }
      },
      {
        title: "Tell the Truth",
        focus: "Confession is agreement with God about reality.",
        scripture: {
          reference: "1 John 1:9",
          text: "If we confess our sins, he is faithful and just and will forgive us our sins."
        }
      },
      {
        title: "Receive Mercy",
        focus: "Mercy is not earned by better language or stronger resolve.",
        scripture: {
          reference: "Hebrews 4:16",
          text: "Let us then approach God's throne of grace with confidence."
        }
      },
      {
        title: "Name the Battle",
        focus: "Specific words make vague struggles easier to face.",
        scripture: {
          reference: "Ephesians 6:13",
          text: "Put on the full armor of God, so that when the day of evil comes, you may be able to stand."
        }
      },
      {
        title: "One Faithful Step",
        focus: "Choose an act of obedience small enough to complete today.",
        scripture: {
          reference: "Luke 16:10",
          text: "Whoever can be trusted with very little can also be trusted with much."
        }
      },
      {
        title: "Practice Rest",
        focus: "Rest is trust expressed through limits.",
        scripture: {
          reference: "Matthew 11:28",
          text: "Come to me, all you who are weary and burdened, and I will give you rest."
        }
      },
      {
        title: "Bring It to the Group",
        focus: "Prepare to speak plainly and listen well when the group meets.",
        scripture: {
          reference: "James 5:16",
          text: "Confess your sins to each other and pray for each other so that you may be healed."
        }
      }
    ]
  },
  {
    title: "Practice",
    summary: "Repeatable rhythms for repentance, prayer, and brotherhood.",
    days: [
      {
        title: "Daily Bread",
        focus: "Ask for enough grace for today.",
        scripture: {
          reference: "Matthew 6:11",
          text: "Give us today our daily bread."
        }
      },
      {
        title: "Prayer Without Performance",
        focus: "Prayer is communion before it is output.",
        scripture: {
          reference: "Matthew 6:6",
          text: "When you pray, go into your room, close the door and pray to your Father."
        }
      },
      {
        title: "Hidden Habits",
        focus: "Private rhythms shape public faithfulness.",
        scripture: {
          reference: "Galatians 6:8",
          text: "Whoever sows to please the Spirit, from the Spirit will reap eternal life."
        }
      },
      {
        title: "Ask for Help",
        focus: "Brotherhood grows when need is spoken plainly.",
        scripture: {
          reference: "Galatians 6:2",
          text: "Carry each other's burdens, and in this way you will fulfill the law of Christ."
        }
      },
      {
        title: "Review the Week",
        focus: "Slow review helps obedience become visible.",
        scripture: {
          reference: "Psalm 90:12",
          text: "Teach us to number our days, that we may gain a heart of wisdom."
        }
      },
      {
        title: "Practice Gratitude",
        focus: "Gratitude names gifts before scarcity takes the lead.",
        scripture: {
          reference: "1 Thessalonians 5:18",
          text: "Give thanks in all circumstances; for this is God's will for you in Christ Jesus."
        }
      },
      {
        title: "Prepare to Share",
        focus: "Brief preparation helps group time become honest and useful.",
        scripture: {
          reference: "Proverbs 27:17",
          text: "As iron sharpens iron, so one person sharpens another."
        }
      }
    ]
  },
  {
    title: "Brotherhood",
    summary: "Building trust, accountability, and shared courage.",
    days: [
      {
        title: "Known by Name",
        focus: "You cannot be strengthened by brothers who do not know you.",
        scripture: {
          reference: "John 10:14",
          text: "I am the good shepherd; I know my sheep and my sheep know me."
        }
      },
      {
        title: "Carry Weight",
        focus: "Bearing burdens requires attention before advice.",
        scripture: {
          reference: "Romans 12:15",
          text: "Rejoice with those who rejoice; mourn with those who mourn."
        }
      },
      {
        title: "Speak Clearly",
        focus: "Clear words are a form of love.",
        scripture: {
          reference: "Ephesians 4:15",
          text: "Speaking the truth in love, we will grow to become in every respect the mature body."
        }
      },
      {
        title: "Receive Correction",
        focus: "Correction can be a gift when it is anchored in truth.",
        scripture: {
          reference: "Proverbs 12:1",
          text: "Whoever loves discipline loves knowledge, but whoever hates correction is stupid."
        }
      },
      {
        title: "Commit Together",
        focus: "Shared commitments help good intentions become action.",
        scripture: {
          reference: "Hebrews 10:24",
          text: "Consider how we may spur one another on toward love and good deeds."
        }
      },
      {
        title: "Encourage a Brother",
        focus: "Encouragement becomes stronger when it is specific.",
        scripture: {
          reference: "1 Thessalonians 5:11",
          text: "Encourage one another and build each other up."
        }
      },
      {
        title: "Show Up Honestly",
        focus: "Presence matters most when it is truthful.",
        scripture: {
          reference: "Hebrews 3:13",
          text: "Encourage one another daily, as long as it is called Today."
        }
      }
    ]
  },
  {
    title: "Discipline",
    summary: "Training attention, desire, and daily obedience.",
    days: [
      {
        title: "Order the Morning",
        focus: "First attention often sets the direction of the day.",
        scripture: {
          reference: "Mark 1:35",
          text: "Very early in the morning, while it was still dark, Jesus got up, left the house and went off to a solitary place."
        }
      },
      {
        title: "Guard the Door",
        focus: "Not every desire deserves entry.",
        scripture: {
          reference: "Proverbs 4:23",
          text: "Above all else, guard your heart, for everything you do flows from it."
        }
      },
      {
        title: "Do the Small Thing",
        focus: "Small obedience is still obedience.",
        scripture: {
          reference: "Colossians 3:23",
          text: "Whatever you do, work at it with all your heart, as working for the Lord."
        }
      },
      {
        title: "Fast from Noise",
        focus: "Silence can reveal what constant noise keeps covered.",
        scripture: {
          reference: "Psalm 46:10",
          text: "Be still, and know that I am God."
        }
      },
      {
        title: "End the Day Clean",
        focus: "A simple review keeps drift from becoming hidden.",
        scripture: {
          reference: "Ephesians 4:26",
          text: "Do not let the sun go down while you are still angry."
        }
      },
      {
        title: "Renew the Pattern",
        focus: "Discipline grows through returning, not pretending you never drift.",
        scripture: {
          reference: "Galatians 6:9",
          text: "Let us not become weary in doing good, for at the proper time we will reap a harvest."
        }
      },
      {
        title: "Report Without Spin",
        focus: "Accountability is clearest when progress and failure are both named.",
        scripture: {
          reference: "Proverbs 28:13",
          text: "Whoever conceals their sins does not prosper, but the one who confesses and renounces them finds mercy."
        }
      }
    ]
  },
  {
    title: "Service",
    summary: "Moving faith outward through sacrifice and responsibility.",
    days: [
      {
        title: "Notice Need",
        focus: "Service begins with seeing people clearly.",
        scripture: {
          reference: "Philippians 2:4",
          text: "Not looking to your own interests but each of you to the interests of the others."
        }
      },
      {
        title: "Use Strength Well",
        focus: "Strength is stewardship, not self-display.",
        scripture: {
          reference: "1 Peter 4:10",
          text: "Use whatever gift you have received to serve others."
        }
      },
      {
        title: "Practice Generosity",
        focus: "Generosity trains the heart away from self-protection.",
        scripture: {
          reference: "2 Corinthians 9:7",
          text: "God loves a cheerful giver."
        }
      },
      {
        title: "Repair What Is Yours",
        focus: "Responsibility includes repair where you have caused strain.",
        scripture: {
          reference: "Matthew 5:24",
          text: "First go and be reconciled to them; then come and offer your gift."
        }
      },
      {
        title: "Serve at Home",
        focus: "The closest people should not receive the least patience.",
        scripture: {
          reference: "Joshua 24:15",
          text: "As for me and my household, we will serve the Lord."
        }
      },
      {
        title: "Serve Without Credit",
        focus: "Hidden service trains the heart away from applause.",
        scripture: {
          reference: "Matthew 6:3",
          text: "When you give to the needy, do not let your left hand know what your right hand is doing."
        }
      },
      {
        title: "Bring a Need",
        focus: "Service and need belong together in honest brotherhood.",
        scripture: {
          reference: "Acts 20:35",
          text: "It is more blessed to give than to receive."
        }
      }
    ]
  },
  {
    title: "Perseverance",
    summary: "Continuing faithfully when progress feels slow.",
    days: [
      {
        title: "Stay in the Fight",
        focus: "Weariness is real, but it does not have to lead.",
        scripture: {
          reference: "2 Timothy 4:7",
          text: "I have fought the good fight, I have finished the race, I have kept the faith."
        }
      },
      {
        title: "Remember Grace",
        focus: "Memory strengthens obedience when emotion is thin.",
        scripture: {
          reference: "Lamentations 3:22-23",
          text: "Because of the Lord's great love we are not consumed, for his compassions never fail."
        }
      },
      {
        title: "Tell the Group",
        focus: "Perseverance is strengthened by honest community.",
        scripture: {
          reference: "Ecclesiastes 4:10",
          text: "If either of them falls down, one can help the other up."
        }
      },
      {
        title: "Prepare for Pressure",
        focus: "Pressure reveals what needs practice before the moment arrives.",
        scripture: {
          reference: "James 1:12",
          text: "Blessed is the one who perseveres under trial."
        }
      },
      {
        title: "Finish Faithfully",
        focus: "Finishing well means returning to what matters.",
        scripture: {
          reference: "Hebrews 12:1",
          text: "Let us run with perseverance the race marked out for us."
        }
      },
      {
        title: "Bless the Next Man",
        focus: "Perseverance includes strengthening someone else for the road ahead.",
        scripture: {
          reference: "2 Corinthians 1:4",
          text: "We can comfort those in any trouble with the comfort we ourselves receive from God."
        }
      },
      {
        title: "Keep Walking",
        focus: "Tuesday is not the finish line; it is a checkpoint for continued obedience.",
        scripture: {
          reference: "Micah 6:8",
          text: "Act justly and to love mercy and to walk humbly with your God."
        }
      }
    ]
  }
];

export const sampleProgram: Program = {
  program: {
    id: "lifepoint-mens-group-v1",
    title: "Lifepoint Men's Group",
    version: "1.0.0",
    description: "A Lifepoint Church program for daily attention to mind, spirit, body, and honest reflection."
  },
  weeks: weekSeeds.map((week, weekIndex) => ({
    weekNumber: weekIndex + 1,
    title: week.title,
    summary: week.summary,
    days: week.days.map((day, dayIndex) => makeDay(weekIndex + 1, dayIndex + 1, day))
  }))
};

export const sampleCompletedSections = new Set<CompletedSectionKey>([
  "1:1:mind",
  "1:1:spirit",
  "1:1:body",
  "1:2:mind",
  "2:1:spirit"
]);

export const leaderboardRows = [
  { displayName: "James", score: 24 },
  { displayName: "Marcus", score: 31 },
  { displayName: "Ethan", score: 19 }
];

function makeDay(weekNumber: number, dayNumber: number, seed: DaySeed): ProgramDay {
  return {
    dayNumber,
    title: seed.title,
    sections: [
      makeMindSection(weekNumber, dayNumber, seed),
      makeSpiritSection(weekNumber, dayNumber, seed),
      makeBodySection(weekNumber, dayNumber),
      makeEndOfDaySection(weekNumber, dayNumber),
      ...makeBonusSections(dayNumber, seed)
    ]
  };
}

function makeMindSection(weekNumber: number, dayNumber: number, seed: DaySeed): ProgramSection {
  return {
    id: "mind",
    title: "Start of Day - Mind",
    body: seed.focus,
    points: 1,
    prompts: [
      {
        id: `w${weekNumber}d${dayNumber}-mind-1`,
        label: "What is occupying the most space in your mind this morning?",
        optional: true
      },
      {
        id: `w${weekNumber}d${dayNumber}-mind-2`,
        label: "What thought needs to be submitted to truth today?",
        optional: true
      },
      {
        id: `w${weekNumber}d${dayNumber}-mind-3`,
        label: "What is one clear priority for the day?",
        optional: true
      }
    ]
  };
}

function makeSpiritSection(weekNumber: number, dayNumber: number, seed: DaySeed): ProgramSection {
  return {
    id: "spirit",
    title: "Spirit",
    body: "Read the passage slowly, then apply it to the day in front of you.",
    points: 1,
    scripture: [seed.scripture],
    prompts: [
      {
        id: `w${weekNumber}d${dayNumber}-spirit-1`,
        label: "What does this passage reveal about God, you, or obedience?",
        optional: true
      },
      {
        id: `w${weekNumber}d${dayNumber}-spirit-2`,
        label: "How will you apply this passage before the day ends?",
        optional: true
      }
    ]
  };
}

function makeBodySection(weekNumber: number, dayNumber: number): ProgramSection {
  const workout = getWorkout(dayNumber);

  return {
    id: "body",
    title: "Body",
    body: `Workout: ${workout}. Complete it with steady form and no hurry.`,
    points: 1,
    prompts: [
      {
        id: `w${weekNumber}d${dayNumber}-body-1`,
        label: "What time will you do the workout?",
        optional: true
      }
    ]
  };
}

function makeEndOfDaySection(weekNumber: number, dayNumber: number): ProgramSection {
  return {
    id: "end-of-day-reflection",
    title: "End of Day - Reflection",
    body: "Close the day by reviewing what actually happened without spin.",
    points: 1,
    prompts: [
      {
        id: `w${weekNumber}d${dayNumber}-end-1`,
        label: "Did you do what you planned to do today?",
        optional: true
      },
      {
        id: `w${weekNumber}d${dayNumber}-end-2`,
        label: "Where did you obey, drift, or avoid action?",
        optional: true
      },
      {
        id: `w${weekNumber}d${dayNumber}-end-3`,
        label: "What do you need to confess, repair, or carry into tomorrow?",
        optional: true
      }
    ]
  };
}

function makeBonusSections(dayNumber: number, seed: DaySeed): ProgramSection[] {
  return [
    {
      id: "bonus-read-verse",
      title: "Bonus: Read This Verse",
      body: `Read ${seed.scripture.reference} once more, slowly and out loud.`,
      points: 1
    },
    {
      id: "bonus-bad-habit",
      title: "Bonus: Resist a Bad Habit",
      body: getBadHabitChallenge(dayNumber),
      points: 2
    },
    {
      id: "bonus-workout",
      title: "Bonus: Extra Workout",
      body: getBonusWorkout(dayNumber),
      points: 3
    }
  ];
}

function getWorkout(dayNumber: number): string {
  const workouts = [
    "20 push ups, 20 sit ups, and 20 squats",
    "25 jumping jacks, 20 push ups, and a 60-second plank",
    "20 lunges, 20 sit ups, and 20 squats",
    "30-second wall sit, 20 push ups, and 20 mountain climbers",
    "20 squats, 20 sit ups, and a 10-minute walk",
    "15 burpees, 20 lunges, and a 60-second plank",
    "20 push ups, 20 sit ups, and 20 squats"
  ];

  return workouts[(dayNumber - 1) % workouts.length];
}

function getBadHabitChallenge(dayNumber: number): string {
  const challenges = [
    "Do not scroll social media before noon.",
    "Do not complain about work, family, or responsibilities today.",
    "Do not eat or drink out of boredom today.",
    "Do not look at any private screen you would hide from the group.",
    "Do not speak harshly when correction or patience is required.",
    "Do not procrastinate the one task you already know matters.",
    "Do not isolate when you need to be honest with someone."
  ];

  return challenges[(dayNumber - 1) % challenges.length];
}

function getBonusWorkout(dayNumber: number): string {
  const workouts = [
    "Do 30 additional push ups.",
    "Do 40 additional bodyweight squats.",
    "Hold a plank for 2 total minutes.",
    "Take a brisk 20-minute walk.",
    "Do 30 lunges and 30 sit ups.",
    "Do 50 jumping jacks and 25 push ups.",
    "Stretch for 10 minutes and do 25 squats."
  ];

  return workouts[(dayNumber - 1) % workouts.length];
}
