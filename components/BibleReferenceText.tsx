import type { ReactNode } from "react";

const bibleBooks = [
  "1 Chronicles",
  "2 Chronicles",
  "1 Corinthians",
  "2 Corinthians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Song of Solomon",
  "Song of Songs",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Ecclesiastes",
  "Lamentations",
  "Deuteronomy",
  "Philippians",
  "Colossians",
  "Revelation",
  "Zephaniah",
  "Zechariah",
  "Philemon",
  "Proverbs",
  "Jeremiah",
  "Ephesians",
  "Galatians",
  "Leviticus",
  "Genesis",
  "Exodus",
  "Numbers",
  "Joshua",
  "Judges",
  "Psalms",
  "Psalm",
  "Isaiah",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Micah",
  "Nahum",
  "Haggai",
  "Matthew",
  "Romans",
  "Hebrews",
  "John",
  "Esther",
  "Nehemiah",
  "Malachi",
  "Obadiah",
  "Habakkuk",
  "Titus",
  "James",
  "Jude",
  "Ruth",
  "Ezra",
  "Job",
  "Joel",
  "Amos",
  "Jonah",
  "Mark",
  "Luke",
  "Acts"
];

const bookPattern = bibleBooks.map(escapeRegExp).join("|");
const bibleReferencePattern = new RegExp(
  `\\b(?:${bookPattern})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?:,\\s*\\d{1,3}(?::\\d{1,3})?(?:\\s*[-–]\\s*\\d{1,3})?)*`,
  "gi"
);

type BibleReferenceTextProps = {
  text: string;
};

export function BibleReferenceText({ text }: BibleReferenceTextProps) {
  return <>{linkBibleReferences(text)}</>;
}

export function linkBibleReferences(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(bibleReferencePattern)) {
    const reference = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(
      <a
        className="bible-reference-link"
        href={getEsvPassageUrl(reference)}
        key={`${reference}-${index}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {reference}
      </a>
    );
    lastIndex = index + reference.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export function getEsvPassageUrl(reference: string): string {
  const normalizedReference = reference
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*[-–]\s*(\d)/g, "$1–$2");
  const encodedReference = encodeURIComponent(normalizedReference)
    .replace(/%20/g, "+")
    .replace(/%3A/g, ":");

  return `https://www.esv.org/verses/${encodedReference}/`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
