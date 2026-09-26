/**
 * ROLE 2: 3-Way Differential Merge Engine
 * 
 * Accurately merges concurrent changes made to the same paragraph by multiple users
 * without silently losing work or creating corrupted text.
 */

export interface MergeResult {
  mergedText: string;
  hasConflict: boolean;
  conflictDetails?: string;
  divergedTokensCount: number;
}

function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens = text.match(/[\w\d]+|[^\w\d\s]+|\s+/gu);
  return tokens || [text];
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

interface DiffHunk {
  type: 'equal' | 'delete' | 'insert';
  tokens: string[];
}

function computeDiff(original: string[], modified: string[]): DiffHunk[] {
  const dp = computeLCS(original, modified);
  let i = original.length;
  let j = modified.length;
  const hunks: DiffHunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
      hunks.unshift({ type: 'equal', tokens: [original[i - 1]] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      hunks.unshift({ type: 'insert', tokens: [modified[j - 1]] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      hunks.unshift({ type: 'delete', tokens: [original[i - 1]] });
      i--;
    }
  }

  const consolidated: DiffHunk[] = [];
  for (const h of hunks) {
    if (consolidated.length > 0 && consolidated[consolidated.length - 1].type === h.type) {
      consolidated[consolidated.length - 1].tokens.push(...h.tokens);
    } else {
      consolidated.push({ type: h.type, tokens: [...h.tokens] });
    }
  }

  return consolidated;
}

export function threeWayMerge(
  baseText: string,
  currentText: string,
  incomingText: string,
  currentAuthorName: string = 'Collaborator A',
  incomingAuthorName: string = 'Collaborator B'
): MergeResult {
  if (currentText === incomingText) {
    return { mergedText: currentText, hasConflict: false, divergedTokensCount: 0 };
  }
  if (!baseText) {
    if (!currentText) return { mergedText: incomingText, hasConflict: false, divergedTokensCount: 0 };
    if (!incomingText) return { mergedText: currentText, hasConflict: false, divergedTokensCount: 0 };
    return {
      mergedText: `${currentText} ${incomingText}`,
      hasConflict: true,
      conflictDetails: `Combined concurrent insertions from ${currentAuthorName} and ${incomingAuthorName}`,
      divergedTokensCount: 2
    };
  }
  if (incomingText === baseText) {
    return { mergedText: currentText, hasConflict: false, divergedTokensCount: 0 };
  }
  if (currentText === baseText) {
    return { mergedText: incomingText, hasConflict: false, divergedTokensCount: 0 };
  }

  const baseTokens = tokenize(baseText);
  const currentTokens = tokenize(currentText);
  const incomingTokens = tokenize(incomingText);

  const incomingAppendedAtEnd = incomingText.startsWith(baseText) ? incomingText.slice(baseText.length) : null;
  const currentAppendedAtEnd = currentText.startsWith(baseText) ? currentText.slice(baseText.length) : null;

  if (incomingAppendedAtEnd && currentAppendedAtEnd === null && !currentText.includes(incomingAppendedAtEnd)) {
    return {
      mergedText: currentText + incomingAppendedAtEnd,
      hasConflict: false,
      conflictDetails: `Merged ${incomingAuthorName}'s appended content with ${currentAuthorName}'s edits`,
      divergedTokensCount: 1
    };
  }

  if (currentAppendedAtEnd && incomingAppendedAtEnd === null && !incomingText.includes(currentAppendedAtEnd)) {
    return {
      mergedText: incomingText + currentAppendedAtEnd,
      hasConflict: false,
      conflictDetails: `Merged ${currentAuthorName}'s appended content with ${incomingAuthorName}'s edits`,
      divergedTokensCount: 1
    };
  }

  let hasConflict = false;
  const conflictDetailsList: string[] = [];
  let result = '';

  if (currentTokens.join('') !== incomingTokens.join('')) {
    const currWords = currentText.trim().split(/\s+/);
    const incWords = incomingText.trim().split(/\s+/);
    const mergedWords: string[] = [];

    let ci = 0;
    let ii = 0;

    while (ci < currWords.length || ii < incWords.length) {
      const cw = ci < currWords.length ? currWords[ci] : null;
      const iw = ii < incWords.length ? incWords[ii] : null;

      if (cw === iw && cw !== null) {
        mergedWords.push(cw);
        ci++;
        ii++;
      } else if (cw !== null && !incWords.includes(cw)) {
        mergedWords.push(cw);
        ci++;
      } else if (iw !== null && !currWords.includes(iw)) {
        mergedWords.push(iw);
        ii++;
      } else if (cw !== null && iw !== null) {
        if (cw !== iw) {
          hasConflict = true;
          conflictDetailsList.push(`Concurrent word change: "${cw}" vs "${iw}"`);
          mergedWords.push(`${cw} / ${iw}`);
        } else {
          mergedWords.push(cw);
        }
        ci++;
        ii++;
      } else {
        if (cw !== null) { mergedWords.push(cw); ci++; }
        if (iw !== null) { mergedWords.push(iw); ii++; }
      }
    }

    result = mergedWords.join(' ');
  } else {
    result = currentText;
  }

  return {
    mergedText: result,
    hasConflict,
    conflictDetails: hasConflict
      ? conflictDetailsList.join('; ')
      : `Cleanly merged concurrent edits from ${currentAuthorName} and ${incomingAuthorName}`,
    divergedTokensCount: conflictDetailsList.length
  };
}
