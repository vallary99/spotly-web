import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Experience descriptions are plain text (backend stores a free-form
// string), but hosts often need to link out to a ticketing page. Rather
// than adding rich-text editing for MVP, this just auto-detects raw URLs
// in the text and renders them as real, clickable links.
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("http://") || part.startsWith("https://") ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta underline"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
