import * as https from 'https';
import * as http from 'http';
import * as path from 'path';

export interface TranslationConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  targetLanguage: string;
  chunkSize: number;
  requestTimeoutMs: number;
}

interface ApiResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: { message: string; code?: string; type?: string };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function translateMarkdown(
  content: string,
  originalFilePath: string,
  config: TranslationConfig
): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error(
      'API key not configured. Please set mdTranslator.apiKey in VS Code Settings (Cmd+, / Ctrl+,).'
    );
  }

  const { frontmatter, body } = extractFrontmatter(content);
  const { processed, restore } = protectNonTranslatable(body);
  const withAbsPaths = fixRelativeImagePaths(processed, originalFilePath);
  const chunks = buildChunks(withAbsPaths, config.chunkSize);

  const results: string[] = [];
  for (const chunk of chunks) {
    if (!needsTranslation(chunk)) {
      results.push(chunk);
    } else {
      results.push(await callApiWithRetry(chunk, config));
    }
  }

  return frontmatter + restore(results.join(''));
}

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^(---[ \t]*\n[\s\S]*?\n---[ \t]*\n)/);
  return match
    ? { frontmatter: match[1], body: content.slice(match[1].length) }
    : { frontmatter: '', body: content };
}

// ---------------------------------------------------------------------------
// Protect blocks that must not be translated
// ---------------------------------------------------------------------------

type RestoreFn = (text: string) => string;

function protectNonTranslatable(content: string): { processed: string; restore: RestoreFn } {
  const restorers: RestoreFn[] = [];
  let processed = content;

  // Fenced code blocks (``` or ~~~, with optional language tag, any depth ≥ 3)
  const codeBlocks: string[] = [];
  processed = processed.replace(
    /^(`{3,}|~{3,})[^\n]*\n(?:[^\n]*\n)*?\1[ \t]*$/gm,
    (match) => {
      const idx = codeBlocks.push(match) - 1;
      return `\n\nMDT_CODE_${idx}\n\n`;
    }
  );
  restorers.push((t) => t.replace(/MDT_CODE_(\d+)/g, (_, i) => codeBlocks[+i] ?? ''));

  // Block math $$ ... $$
  const mathBlocks: string[] = [];
  processed = processed.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    const idx = mathBlocks.push(match) - 1;
    return `MDT_MATH_${idx}`;
  });
  restorers.push((t) => t.replace(/MDT_MATH_(\d+)/g, (_, i) => mathBlocks[+i] ?? ''));

  // Inline code (double-backtick first, then single)
  const inlineCode: string[] = [];
  processed = processed.replace(/``[^\n]*?``|`[^`\n]+`/g, (match) => {
    const idx = inlineCode.push(match) - 1;
    return `MDT_INLINE_${idx}`;
  });
  restorers.push((t) => t.replace(/MDT_INLINE_(\d+)/g, (_, i) => inlineCode[+i] ?? ''));

  // Inline math $ ... $ (after double-$$ already handled)
  const inlineMath: string[] = [];
  processed = processed.replace(/\$[^$\n]+\$/g, (match) => {
    const idx = inlineMath.push(match) - 1;
    return `MDT_IMATH_${idx}`;
  });
  restorers.push((t) => t.replace(/MDT_IMATH_(\d+)/g, (_, i) => inlineMath[+i] ?? ''));

  // Compose restorers in reverse order (last protected → first restored)
  const restore: RestoreFn = (text) => restorers.reduceRight((t, fn) => fn(t), text);
  return { processed, restore };
}

function needsTranslation(chunk: string): boolean {
  const stripped = chunk.replace(/MDT_(?:CODE|MATH|INLINE|IMATH)_\d+/g, '').trim();
  return stripped.length > 0;
}

// ---------------------------------------------------------------------------
// Fix relative image src → absolute file:// so preview can load them
// ---------------------------------------------------------------------------

function fixRelativeImagePaths(content: string, originalFilePath: string): string {
  if (!originalFilePath) {
    return content;
  }
  const dir = path.dirname(originalFilePath);
  return content.replace(
    /!\[([^\]]*)\]\(([^)#?\s]+)((?:[#?][^)]*)?)\)/g,
    (match, alt, src, extra) => {
      if (/^(https?|file|data):\/\//i.test(src) || path.isAbsolute(src)) {
        return match;
      }
      const abs = path.resolve(dir, src).replace(/\\/g, '/');
      const fileUri = abs.startsWith('/') ? `file://${abs}` : `file:///${abs}`;
      return `![${alt}](${fileUri}${extra})`;
    }
  );
}

// ---------------------------------------------------------------------------
// Chunk content at heading / paragraph boundaries
// ---------------------------------------------------------------------------

function buildChunks(content: string, maxSize: number): string[] {
  if (content.length <= maxSize) {
    return [content];
  }

  const chunks: string[] = [];
  const lines = content.split('\n');
  let current = '';

  for (const line of lines) {
    const isHeading = /^#{1,6}\s/.test(line);
    const wouldExceed = current.length + line.length + 1 > maxSize;

    if (isHeading && wouldExceed && current.length > maxSize / 4) {
      // Start a new chunk at the heading
      chunks.push(current);
      current = line + '\n';
    } else if (!isHeading && wouldExceed) {
      // Try to break at the last blank line
      const blankIdx = current.lastIndexOf('\n\n');
      if (blankIdx > 0 && blankIdx > current.length - maxSize / 2) {
        chunks.push(current.slice(0, blankIdx + 2));
        current = current.slice(blankIdx + 2) + line + '\n';
      } else {
        chunks.push(current);
        current = line + '\n';
      }
    } else {
      current += line + '\n';
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = (lang: string): string =>
  `You are a professional technical translator specialising in software documentation, \
academic papers, and technical articles. Translate the following Markdown content into ${lang}.

ABSOLUTE RULES — violate none:
1. Preserve ALL Markdown syntax verbatim: headings (#–######), **bold**, *italic*, \
***bold italic***, ~~strikethrough~~, > blockquotes, ordered/unordered lists (keep \
indentation and bullet characters), task lists (- [ ]/- [x]), tables (|), horizontal \
rules (---), footnotes.
2. Placeholders MDT_CODE_N, MDT_INLINE_N, MDT_MATH_N, MDT_IMATH_N represent \
non-translatable content. Reproduce them EXACTLY — same token, same position, same \
surrounding whitespace.
3. Hyperlinks [text](url): translate display text only; URL is unchanged.
4. Images ![alt](src): translate alt text only; src is unchanged.
5. Preserve all blank lines, paragraph spacing, and list nesting exactly.
6. Output ONLY the translated Markdown — no preamble, no notes, no trailing commentary.`;

async function callApiWithRetry(text: string, config: TranslationConfig): Promise<string> {
  try {
    return await doCallApi(text, config);
  } catch (err) {
    if (isRetryable(err)) {
      await sleep(1500);
      return doCallApi(text, config);
    }
    throw err;
  }
}

async function doCallApi(text: string, config: TranslationConfig): Promise<string> {
  const payload = JSON.stringify({
    model: config.model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(config.targetLanguage) },
      { role: 'user', content: text },
    ],
  });

  const endpoint = config.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions';
  const url = new URL(endpoint);
  const raw = await httpRequest(url, config.apiKey, payload, config.requestTimeoutMs);

  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(raw) as ApiResponse;
  } catch {
    throw new Error(`Failed to parse API response. Raw: ${raw.slice(0, 200)}`);
  }

  if (parsed.error) {
    throw new Error(`API error (${parsed.error.type ?? parsed.error.code}): ${parsed.error.message}`);
  }

  const result = parsed.choices?.[0]?.message?.content;
  if (typeof result !== 'string' || result.trim() === '') {
    throw new Error('API returned an empty response. Check your model name and API key.');
  }

  return unwrapFence(result);
}

/** Some models ignore instructions and wrap output in a markdown fence. Strip it. */
function unwrapFence(text: string): string {
  const m = text.match(/^```(?:markdown)?\n([\s\S]*)\n```$/);
  return m ? m[1] : text;
}

// ---------------------------------------------------------------------------
// HTTP helper (no external dependencies, works with http:// and https://)
// ---------------------------------------------------------------------------

function httpRequest(
  url: URL,
  apiKey: string,
  body: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) { return false; }
  const m = err.message.toLowerCase();
  return m.includes('timeout') || m.includes('econnreset') || m.includes('socket') || m.includes('network');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
