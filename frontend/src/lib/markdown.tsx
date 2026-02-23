import React from 'react';

// ---------------------------------------------------------------------------
// Markdown renderer for Discord-style chat formatting
// Supports: bold, italic, underline, strikethrough, spoiler, inline code,
// fenced code blocks, blockquotes, headings, lists, masked links,
// @mentions, #channels, and raw URLs.
// ---------------------------------------------------------------------------

/** Escape regex special characters */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Highlight search matches
// ---------------------------------------------------------------------------

function highlightText(text: string, query: string, keyBase: string): React.ReactNode[] {
  if (!query) return [text];
  const escaped = esc(query);
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={`${keyBase}-hl-${i}`} className="bg-rally-blue/30 text-white rounded-sm px-0.5">{p}</mark>
    ) : (
      p
    ),
  );
}

// ---------------------------------------------------------------------------
// Inline parser — handles formatting within a single line/paragraph
// ---------------------------------------------------------------------------

// Order matters: longer/more specific patterns first
const INLINE_RULES: Array<{
  pattern: RegExp;
  render: (match: RegExpExecArray, key: string, query?: string) => React.ReactNode;
}> = [
  // Fenced inline code: `code`
  {
    pattern: /`([^`\n]+?)`/,
    render: (m, key) => (
      <code
        key={key}
        className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] font-mono text-rally-green"
      >
        {m[1]}
      </code>
    ),
  },
  // Spoiler: ||text||
  {
    pattern: /\|\|(.+?)\|\|/,
    render: (m, key) => <SpoilerSpan key={key} text={m[1]} />,
  },
  // Bold + Italic: ***text***
  {
    pattern: /\*\*\*(.+?)\*\*\*/,
    render: (m, key, q) => (
      <strong key={key} className="font-semibold text-white">
        <em>{renderInline(m[1], key, q)}</em>
      </strong>
    ),
  },
  // Bold: **text**
  {
    pattern: /\*\*(.+?)\*\*/,
    render: (m, key, q) => (
      <strong key={key} className="font-semibold text-white">
        {renderInline(m[1], key, q)}
      </strong>
    ),
  },
  // Underline + Bold: __**text**__
  {
    pattern: /__\*\*(.+?)\*\*__/,
    render: (m, key, q) => (
      <span key={key} className="underline font-semibold text-white">
        {renderInline(m[1], key, q)}
      </span>
    ),
  },
  // Underline: __text__
  {
    pattern: /__(.+?)__/,
    render: (m, key, q) => (
      <span key={key} className="underline">
        {renderInline(m[1], key, q)}
      </span>
    ),
  },
  // Italic: *text* or _text_
  {
    pattern: /(?:\*(.+?)\*|_(.+?)_)/,
    render: (m, key, q) => (
      <em key={key}>{renderInline(m[1] || m[2], key, q)}</em>
    ),
  },
  // Strikethrough: ~~text~~
  {
    pattern: /~~(.+?)~~/,
    render: (m, key, q) => (
      <span key={key} className="line-through text-white/50">
        {renderInline(m[1], key, q)}
      </span>
    ),
  },
  // Masked link: [text](url)
  {
    pattern: /\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-rally-blue underline hover:brightness-125"
      >
        {m[1]}
      </a>
    ),
  },
  // @mention
  {
    pattern: /@([\w]+)/,
    render: (m, key) => (
      <span
        key={key}
        className="rounded bg-rally-blue/15 px-0.5 text-rally-blue cursor-pointer hover:underline"
      >
        @{m[1]}
      </span>
    ),
  },
  // #channel
  {
    pattern: /#([\w-]+)/,
    render: (m, key) => (
      <span
        key={key}
        className="rounded bg-rally-blue/15 px-0.5 text-rally-blue cursor-pointer hover:underline"
      >
        #{m[1]}
      </span>
    ),
  },
  // Raw URL
  {
    pattern: /(https?:\/\/[^\s<]+)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-rally-blue underline hover:brightness-125 break-all"
      >
        {m[1]}
      </a>
    ),
  },
];

/** Recursively parse inline formatting tokens */
function renderInline(
  text: string,
  keyPrefix: string,
  searchQuery?: string,
): React.ReactNode[] {
  if (!text) return [];

  for (const rule of INLINE_RULES) {
    const match = rule.pattern.exec(text);
    if (match) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + match[0].length);
      const parts: React.ReactNode[] = [];

      if (before) parts.push(...renderInline(before, `${keyPrefix}-b`, searchQuery));
      parts.push(rule.render(match, `${keyPrefix}-${match.index}`, searchQuery));
      if (after) parts.push(...renderInline(after, `${keyPrefix}-a`, searchQuery));

      return parts;
    }
  }

  // No inline tokens matched — return as highlighted text
  return highlightText(text, searchQuery || '', keyPrefix);
}

// ---------------------------------------------------------------------------
// Spoiler component — click to reveal
// ---------------------------------------------------------------------------

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <span
      onClick={() => setRevealed((r) => !r)}
      className={
        revealed
          ? 'bg-white/10 rounded px-0.5 cursor-pointer'
          : 'bg-white/20 text-transparent rounded px-0.5 cursor-pointer select-none hover:bg-white/25'
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRevealed((r) => !r); }}
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lightweight syntax tokenizer
// ---------------------------------------------------------------------------

const KEYWORDS_JS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete)\b/g;
const KEYWORDS_PY = /\b(def|class|return|if|elif|else|for|while|with|as|import|from|try|except|finally|raise|yield|lambda|pass|break|continue|and|or|not|is|in|True|False|None|self|async|await|print)\b/g;
const KEYWORDS_RUST = /\b(fn|let|mut|const|if|else|for|while|loop|match|return|use|mod|pub|struct|enum|impl|trait|self|Self|where|type|as|in|ref|move|async|await|unsafe|extern|crate|super)\b/g;
const KEYWORDS_GO = /\b(func|var|const|return|if|else|for|range|switch|case|break|continue|type|struct|interface|map|chan|go|defer|select|import|package|nil|true|false)\b/g;
const KEYWORDS_JAVA = /\b(public|private|protected|static|final|class|interface|extends|implements|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|import|package|void|this|super|abstract|synchronized)\b/g;
const KEYWORDS_CPP = /\b(int|float|double|char|bool|void|auto|const|static|class|struct|enum|namespace|using|return|if|else|for|while|do|switch|case|break|continue|new|delete|try|catch|throw|public|private|protected|virtual|override|template|typename|include|define)\b/g;
const KEYWORDS_CSS = /\b(color|background|border|margin|padding|display|flex|grid|position|width|height|font|text|align|justify|overflow|opacity|transition|transform|animation|z-index|top|left|right|bottom|content|cursor|outline|box-shadow|none|auto|inherit|initial|important)\b/g;

const LANG_KEYWORD_MAP: Record<string, RegExp> = {
  js: KEYWORDS_JS, javascript: KEYWORDS_JS, jsx: KEYWORDS_JS,
  ts: KEYWORDS_JS, typescript: KEYWORDS_JS, tsx: KEYWORDS_JS,
  py: KEYWORDS_PY, python: KEYWORDS_PY,
  rust: KEYWORDS_RUST, rs: KEYWORDS_RUST,
  go: KEYWORDS_GO, golang: KEYWORDS_GO,
  java: KEYWORDS_JAVA, kotlin: KEYWORDS_JAVA,
  c: KEYWORDS_CPP, cpp: KEYWORDS_CPP, 'c++': KEYWORDS_CPP, h: KEYWORDS_CPP,
  css: KEYWORDS_CSS, scss: KEYWORDS_CSS,
};

/** Tokenize code into highlighted spans. Covers strings, comments, numbers, keywords. */
function tokenizeCode(code: string, language: string): React.ReactNode {
  const lang = language.toLowerCase();

  // JSON: highlight keys, strings, numbers, booleans
  if (lang === 'json') {
    return tokenizeJSON(code);
  }

  // HTML/XML: highlight tags and attributes
  if (lang === 'html' || lang === 'xml' || lang === 'svg' || lang === 'htm') {
    return tokenizeHTML(code);
  }

  const keywordRe = LANG_KEYWORD_MAP[lang];
  if (!keywordRe) return code; // unsupported language, plain text

  // Combined regex: line comments, block comments, strings, numbers, keywords, rest
  const tokenRe = new RegExp(
    [
      '(\\/\\/[^\\n]*)',                             // line comment
      '(\\/\\*[\\s\\S]*?\\*\\/)',                    // block comment
      '(#[^\\n]*)',                                   // hash comment (python, etc.)
      '(`[^`]*`)',                                    // template literal
      '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')', // strings
      '(\\b\\d+(?:\\.\\d+)?\\b)',                    // numbers
      '([\\w$]+)',                                    // identifiers
    ].join('|'),
    'g',
  );

  const hasHashComments = ['py', 'python', 'rust', 'rs', 'rb', 'ruby', 'sh', 'bash', 'yaml', 'yml', 'toml'].includes(lang);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = tokenRe.exec(code)) !== null) {
    // Text between tokens
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index));
    }

    const [full, lineComment, blockComment, hashComment, templateLit, str, num, ident] = match;

    if (lineComment) {
      parts.push(<span key={i++} className="token-comment">{lineComment}</span>);
    } else if (blockComment) {
      parts.push(<span key={i++} className="token-comment">{blockComment}</span>);
    } else if (hashComment && hasHashComments) {
      parts.push(<span key={i++} className="token-comment">{hashComment}</span>);
    } else if (templateLit) {
      parts.push(<span key={i++} className="token-string">{templateLit}</span>);
    } else if (str) {
      parts.push(<span key={i++} className="token-string">{str}</span>);
    } else if (num) {
      parts.push(<span key={i++} className="token-number">{num}</span>);
    } else if (ident) {
      // Check if it's a keyword
      keywordRe.lastIndex = 0;
      if (keywordRe.test(ident)) {
        parts.push(<span key={i++} className="token-keyword">{ident}</span>);
      } else {
        parts.push(ident);
      }
    } else {
      parts.push(full);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex));
  }

  return <>{parts}</>;
}

function tokenizeJSON(code: string): React.ReactNode {
  const re = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(code)) !== null) {
    if (match.index > lastIndex) parts.push(code.slice(lastIndex, match.index));

    if (match[1]) {
      // key
      parts.push(<span key={i++} className="token-property">{match[1]}</span>);
      parts.push(match[2]); // colon
    } else if (match[3]) {
      parts.push(<span key={i++} className="token-string">{match[3]}</span>);
    } else if (match[4]) {
      parts.push(<span key={i++} className="token-keyword">{match[4]}</span>);
    } else if (match[5]) {
      parts.push(<span key={i++} className="token-number">{match[5]}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) parts.push(code.slice(lastIndex));
  return <>{parts}</>;
}

function tokenizeHTML(code: string): React.ReactNode {
  const re = /(<!--[\s\S]*?-->)|(<\/?)([\w-]+)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*)(\/?>)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(code)) !== null) {
    if (match.index > lastIndex) parts.push(code.slice(lastIndex, match.index));

    if (match[1]) {
      // Comment
      parts.push(<span key={i++} className="token-comment">{match[1]}</span>);
    } else if (match[2]) {
      // Tag
      parts.push(<span key={i++} className="token-punctuation">{match[2]}</span>);
      parts.push(<span key={i++} className="token-tag">{match[3]}</span>);
      // Attributes
      if (match[4]) {
        const attrRe = /([\w-]+)(=)("[^"]*"|'[^']*'|[^\s>]*)/g;
        let attrMatch: RegExpExecArray | null;
        let attrLast = 0;
        const attrStr = match[4];
        while ((attrMatch = attrRe.exec(attrStr)) !== null) {
          if (attrMatch.index > attrLast) parts.push(attrStr.slice(attrLast, attrMatch.index));
          parts.push(<span key={i++} className="token-attr">{attrMatch[1]}</span>);
          parts.push(attrMatch[2]);
          parts.push(<span key={i++} className="token-string">{attrMatch[3]}</span>);
          attrLast = attrMatch.index + attrMatch[0].length;
        }
        if (attrLast < attrStr.length) parts.push(attrStr.slice(attrLast));
      }
      parts.push(<span key={i++} className="token-punctuation">{match[5]}</span>);
    } else if (match[6]) {
      parts.push(<span key={i++} className="token-string">{match[6]}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) parts.push(code.slice(lastIndex));
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Code block with copy button + syntax highlighting
// ---------------------------------------------------------------------------

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const highlighted = React.useMemo(
    () => tokenizeCode(code, language),
    [code, language],
  );

  return (
    <div className="group/code relative my-1.5 rounded-md border border-white/10 bg-[#0D1117] overflow-hidden">
      {/* Header with language label + copy */}
      <div className="flex items-center justify-between px-3 py-1 bg-white/[0.02] border-b border-white/5">
        <span className="text-[10px] font-mono uppercase text-rally-text-muted tracking-wider">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-rally-text-muted hover:text-rally-blue transition-colors opacity-0 group-hover/code:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <pre className="p-3 overflow-x-auto">
        <code className="text-sm font-mono text-rally-text leading-relaxed whitespace-pre">
          {highlighted}
        </code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block-level parser
// ---------------------------------------------------------------------------

/**
 * Main entry point. Renders markdown content as React nodes.
 * Handles block-level structures (code blocks, blockquotes, headings, lists)
 * then delegates to renderInline for inline formatting.
 */
export function renderMarkdown(
  content: string,
  searchQuery?: string,
): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Fenced code block ---
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const lang = codeMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <CodeBlock key={`cb-${blockKey++}`} language={lang} code={codeLines.join('\n')} />,
      );
      continue;
    }

    // --- Multiline blockquote (>>>) ---
    if (line.startsWith('>>> ')) {
      const quoteLines = [line.slice(4)];
      i++;
      while (i < lines.length) {
        quoteLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${blockKey++}`}
          className="border-l-[3px] border-rally-blue/40 pl-3 my-1 text-white/70"
        >
          {renderInline(quoteLines.join('\n'), `bqi-${blockKey}`, searchQuery)}
        </blockquote>,
      );
      continue;
    }

    // --- Single-line blockquote (>) ---
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${blockKey++}`}
          className="border-l-[3px] border-rally-blue/40 pl-3 my-1 text-white/70"
        >
          {quoteLines.map((ql, qi) => (
            <React.Fragment key={qi}>
              {qi > 0 && <br />}
              {renderInline(ql, `bql-${blockKey}-${qi}`, searchQuery)}
            </React.Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // --- Headings ---
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      const sizeClass =
        level === 1
          ? 'text-xl font-bold'
          : level === 2
            ? 'text-lg font-bold'
            : 'text-base font-semibold';
      blocks.push(
        <Tag
          key={`h-${blockKey++}`}
          className={`font-display ${sizeClass} text-white my-1`}
        >
          {renderInline(text, `h-${blockKey}`, searchQuery)}
        </Tag>,
      );
      i++;
      continue;
    }

    // --- Unordered list ---
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="list-disc list-inside my-1 space-y-0.5">
          {items.map((item, li) => (
            <li key={li} className="text-gray-300">
              {renderInline(item, `li-${blockKey}-${li}`, searchQuery)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // --- Ordered list ---
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="list-decimal list-inside my-1 space-y-0.5">
          {items.map((item, li) => (
            <li key={li} className="text-gray-300">
              {renderInline(item, `oli-${blockKey}-${li}`, searchQuery)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // --- Subtext: -# text ---
    if (line.startsWith('-# ')) {
      blocks.push(
        <p key={`sub-${blockKey++}`} className="text-xs text-rally-text-muted my-0.5">
          {renderInline(line.slice(3), `sub-${blockKey}`, searchQuery)}
        </p>,
      );
      i++;
      continue;
    }

    // --- Empty line ---
    if (line.trim() === '') {
      i++;
      continue;
    }

    // --- Plain paragraph with inline formatting ---
    blocks.push(
      <span key={`p-${blockKey++}`}>
        {i > 0 && lines[i - 1]?.trim() !== '' && <br />}
        {renderInline(line, `p-${blockKey}`, searchQuery)}
      </span>,
    );
    i++;
  }

  return <>{blocks}</>;
}
