/**
 * Client-Side ASL Gloss & Deaf English Translator
 * Provides offline-resilient S-V-O and Time-Topic-Comment ASL glossing:
 * - Lemmatization of past and continuous verbs to base root signs
 * - Strips non-signing copulas (is, am, are, was, were) and articles (a, an, the)
 * - Moves WH-words (WHAT, WHERE, WHO, WHY, HOW) to sentence end
 * - Moves Time words to sentence beginning
 * - Appends 'FINISH' to completed past actions
 * - Transforms pronouns and possessives (POSS-HIS, POSS-HER, POSS-THEIR)
 */

const IRREGULAR_ASL_VERBS: Record<string, { base: string; isPast: boolean }> = {
  placed: { base: 'PLACE', isPast: true },
  lost: { base: 'LOSE', isPast: true },
  found: { base: 'FIND', isPast: true },
  went: { base: 'GO', isPast: true },
  ran: { base: 'RUN', isPast: true },
  saw: { base: 'SEE', isPast: true },
  took: { base: 'TAKE', isPast: true },
  gave: { base: 'GIVE', isPast: true },
  cried: { base: 'CRY', isPast: true },
  walked: { base: 'WALK', isPast: true },
  talked: { base: 'TALK', isPast: true },
  spoke: { base: 'SPEAK', isPast: true },
  wrote: { base: 'WRITE', isPast: true },
  read: { base: 'READ', isPast: false },
  asked: { base: 'ASK', isPast: true },
  told: { base: 'TELL', isPast: true },
  answered: { base: 'ANSWER', isPast: true },
  solved: { base: 'SOLVE', isPast: true },
  moved: { base: 'MOVE', isPast: true },
  shifted: { base: 'SHIFT', isPast: true },
  reflected: { base: 'REFLECT', isPast: true },
  translated: { base: 'TRANSLATE', isPast: true },
  flipped: { base: 'FLIP', isPast: true },
  turned: { base: 'TURN', isPast: true },
  joined: { base: 'JOIN', isPast: true },
  started: { base: 'START', isPast: true },
  began: { base: 'START', isPast: true },
  finished: { base: 'FINISH', isPast: true },
  learned: { base: 'LEARN', isPast: true },
  taught: { base: 'TEACH', isPast: true },
  fought: { base: 'FIGHT', isPast: true },
  created: { base: 'CREATE', isPast: true },
  founded: { base: 'FOUND', isPast: true },
  decided: { base: 'DECIDE', isPast: true },
  wanted: { base: 'WANT', isPast: true },
  needed: { base: 'NEED', isPast: true },
  opened: { base: 'OPEN', isPast: true },
  closed: { base: 'CLOSE', isPast: true },
  checked: { base: 'CHECK', isPast: true },
  clicked: { base: 'CLICK', isPast: true },
  muted: { base: 'MUTE', isPast: true },
  unmuted: { base: 'UNMUTE', isPast: true },
  shared: { base: 'SHARE', isPast: true },
  noticed: { base: 'NOTICE', isPast: true },
  remembered: { base: 'REMEMBER', isPast: true },
  forgot: { base: 'FORGET', isPast: true },
  became: { base: 'BECOME', isPast: true },
  brought: { base: 'BRING', isPast: true },
  bought: { base: 'BUY', isPast: true },
  caught: { base: 'CATCH', isPast: true },
  heard: { base: 'HEAR', isPast: true },
  knew: { base: 'KNOW', isPast: true },
  felt: { base: 'FEEL', isPast: true },
  left: { base: 'LEAVE', isPast: true },
  met: { base: 'MEET', isPast: true },
  paid: { base: 'PAY', isPast: true },
  sat: { base: 'SIT', isPast: true },
  stood: { base: 'STAND', isPast: true },
  spent: { base: 'SPEND', isPast: true },
  understood: { base: 'UNDERSTAND', isPast: true },
  won: { base: 'WIN', isPast: true },
  baked: { base: 'BAKE', isPast: true },
  bakes: { base: 'BAKE', isPast: false },
  baking: { base: 'BAKE', isPast: false },
  liked: { base: 'LIKE', isPast: true },
  loved: { base: 'LOVE', isPast: true },
  saved: { base: 'SAVE', isPast: true },
  smiled: { base: 'SMILE', isPast: true },
  lived: { base: 'LIVE', isPast: true },
  cared: { base: 'CARE', isPast: true },
  // Continuous forms
  walking: { base: 'WALK', isPast: false },
  running: { base: 'RUN', isPast: false },
  eating: { base: 'EAT', isPast: false },
  reading: { base: 'READ', isPast: false },
  writing: { base: 'WRITE', isPast: false },
  moving: { base: 'MOVE', isPast: false },
  shifting: { base: 'SHIFT', isPast: false },
  reflecting: { base: 'REFLECT', isPast: false },
  translating: { base: 'TRANSLATE', isPast: false },
  studying: { base: 'STUDY', isPast: false },
  learning: { base: 'LEARN', isPast: false },
  talking: { base: 'TALK', isPast: false },
  looking: { base: 'LOOK', isPast: false },
  crying: { base: 'CRY', isPast: false },
  playing: { base: 'PLAY', isPast: false },
  helping: { base: 'HELP', isPast: false },
  meeting: { base: 'MEET', isPast: false },
  // 3rd person forms
  moves: { base: 'MOVE', isPast: false },
  shifts: { base: 'SHIFT', isPast: false },
  flips: { base: 'FLIP', isPast: false },
  reflects: { base: 'REFLECT', isPast: false },
  translates: { base: 'TRANSLATE', isPast: false },
  wants: { base: 'WANT', isPast: false },
  needs: { base: 'NEED', isPast: false },
  helps: { base: 'HELP', isPast: false },
  finds: { base: 'FIND', isPast: false },
  loses: { base: 'LOSE', isPast: false },
  takes: { base: 'TAKE', isPast: false },
  gives: { base: 'GIVE', isPast: false },
  asks: { base: 'ASK', isPast: false },
  says: { base: 'SAY', isPast: false },
  speaks: { base: 'SPEAK', isPast: false },
  writes: { base: 'WRITE', isPast: false },
  reads: { base: 'READ', isPast: false },
  understands: { base: 'UNDERSTAND', isPast: false },
};

const ASL_PRONOUNS_MAP: Record<string, string> = {
  i: 'ME',
  me: 'ME',
  my: 'MY',
  mine: 'MY',
  you: 'YOU',
  your: 'YOUR',
  yours: 'YOUR',
  he: 'HE',
  him: 'HE',
  his: 'POSS-HIS',
  she: 'SHE',
  her: 'POSS-HER',
  hers: 'POSS-HER',
  they: 'THEY',
  them: 'THEY',
  their: 'POSS-THEIR',
  theirs: 'POSS-THEIR',
  we: 'WE',
  us: 'WE',
  our: 'OUR',
  ours: 'OUR',
  it: 'IT',
  its: 'POSS-ITS',
};

const ASL_TIME_WORDS = new Set([
  'yesterday', 'tomorrow', 'today', 'now', 'past', 'future',
  'morning', 'night', 'afternoon', 'evening', 'beginning', 'before',
  'earlier', 'later', 'first', 'finally', 'then', 'soon', 'always', 'never'
]);

const ASL_WH_WORDS = new Set(['who', 'what', 'where', 'when', 'why', 'how', 'which']);

const ASL_NON_STEM_ING = new Set([
  'during', 'morning', 'evening', 'meeting', 'building', 'clothing',
  'ceiling', 'ring', 'string', 'king', 'wing', 'spring', 'thing',
  'something', 'anything', 'nothing', 'everything', 'setting', 'beginning'
]);

const ASL_NON_STEM_ED = new Set([
  'bed', 'red', 'fed', 'sled', 'shed', 'seed', 'feed', 'need', 'speed'
]);

const ASL_PHRASAL_RULES: Array<[RegExp, string]> = [
  [/\bdo\s+not\s+know\b|\bdon't\s+know\b/gi, "DON'T-KNOW"],
  [/\bdo\s+not\s+understand\b|\bdon't\s+understand\b/gi, "DON'T-UNDERSTAND"],
  [/\bcannot\b|\bcan't\b/gi, "CAN'T"],
  [/\bdid\s+not\b|\bdidn't\b/gi, "NOT"],
  [/\bdoes\s+not\b|\bdoesn't\b/gi, "NOT"],
  [/\bdo\s+not\b|\bdon't\b/gi, "NOT"],
  [/\bwill\s+not\b|\bwon't\b/gi, "WON'T"],
  [/\bthank\s+you\b|\bthanks\b/gi, "THANK-YOU"],
  [/\byou\s+are\s+welcome\b|\byou're\s+welcome\b/gi, "WELCOME"],
  [/\bvideo\s+conferencing\b|\bvideo\s+conference\b|\bonline\s+meeting\b/gi, "VIDEO-MEET"],
  [/\bsign\s+language\b/gi, "SIGN-LANGUAGE"],
  [/\bstory\s+grammar\b/gi, "STORY-GRAMMAR"],
  [/\bcoordinate\s+grid\b|\bcartesian\s+plane\b/gi, "GRID"],
  [/\blook\s+for\b|\blooked\s+for\b|\blooking\s+for\b/gi, "SEARCH"],
  [/\blook\s+at\b|\blooked\s+at\b|\blooking\s+at\b/gi, "LOOK-AT"],
  [/\bpick\s+up\b|\bpicked\s+up\b|\bpicking\s+up\b/gi, "PICK-UP"],
  [/\bplaced\s+on\b|\bput\s+on\b/gi, "PLACE-ON"],
  [/\bturn\s+on\b|\bturned\s+on\b/gi, "TURN-ON"],
  [/\bturn\s+off\b|\bturned\s+off\b/gi, "TURN-OFF"],
  [/\bwake\s+up\b|\bwoke\s+up\b/gi, "WAKE-UP"],
  [/\bsit\s+down\b|\bsat\s+down\b/gi, "SIT-DOWN"],
  [/\bstand\s+up\b|\bstood\s+up\b/gi, "STAND-UP"],
];

function singleSentenceAslGloss(sentence: string, origPunct: string): string {
  const clean = sentence.trim();
  if (!clean) return '';

  let working = clean;
  for (const [pattern, repl] of ASL_PHRASAL_RULES) {
    working = working.replace(pattern, repl);
  }

  const rawTokens = working.replace(/[?!.,;:]/g, '').split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return '';

  const timeTokens: string[] = [];
  const whTokens: string[] = [];
  const contentTokens: string[] = [];
  let isPastAction = false;

  let i = 0;
  const filteredTokens: string[] = [];
  while (i < rawTokens.length) {
    const tok = rawTokens[i];
    const tokLower = tok.toLowerCase();
    if (tokLower === 'in' && i + 1 < rawTokens.length && /^\d{4}$/.test(rawTokens[i + 1])) {
      timeTokens.push(`YEAR ${rawTokens[i + 1]}`);
      isPastAction = true;
      i += 2;
      continue;
    }
    filteredTokens.push(tok);
    i++;
  }

  for (const tok of filteredTokens) {
    if (tok.includes('-') && tok === tok.toUpperCase()) {
      contentTokens.push(tok);
      continue;
    }

    const tokLower = tok.toLowerCase();

    // Omit articles and copula forms
    if (['a', 'an', 'the'].includes(tokLower)) continue;
    if (['is', 'am', 'are', 'was', 'were', 'be', 'been', 'being'].includes(tokLower)) {
      if (['was', 'were'].includes(tokLower)) isPastAction = true;
      continue;
    }
    if (['do', 'does', 'did'].includes(tokLower)) {
      if (tokLower === 'did') isPastAction = true;
      continue;
    }
    if (tokLower === 'to' && contentTokens.length > 0) continue;
    if (['of', 'by'].includes(tokLower)) continue;

    // Interrogatives
    if (ASL_WH_WORDS.has(tokLower)) {
      whTokens.push(tok.toUpperCase());
      continue;
    }

    // Time indicators
    if (ASL_TIME_WORDS.has(tokLower)) {
      timeTokens.push(tok.toUpperCase());
      continue;
    }

    // Pronouns
    if (ASL_PRONOUNS_MAP[tokLower]) {
      contentTokens.push(ASL_PRONOUNS_MAP[tokLower]);
      continue;
    }

    // Verbs & Stemming
    if (IRREGULAR_ASL_VERBS[tokLower]) {
      const { base, isPast } = IRREGULAR_ASL_VERBS[tokLower];
      if (isPast) isPastAction = true;
      contentTokens.push(base);
      continue;
    } else if (tokLower.endsWith('ed') && tokLower.length > 4 && !ASL_NON_STEM_ED.has(tokLower)) {
      isPastAction = true;
      let base = tokLower.slice(0, -2);
      if (base.endsWith('i')) {
        base = base.slice(0, -1) + 'y';
      } else if (/([b-df-hj-np-tv-z])\1$/.test(base)) {
        base = base.slice(0, -1);
      }
      contentTokens.push(base.toUpperCase());
      continue;
    } else if (tokLower.endsWith('ing') && tokLower.length > 5 && !ASL_NON_STEM_ING.has(tokLower)) {
      let base = tokLower.slice(0, -3);
      if (/([b-df-hj-np-tv-z])\1$/.test(base)) {
        base = base.slice(0, -1);
      }
      contentTokens.push(base.toUpperCase());
      continue;
    }

    contentTokens.push(tok.toUpperCase());
  }

  const ordered: string[] = [];
  if (timeTokens.length > 0) ordered.push(...timeTokens);
  if (contentTokens.length > 0) ordered.push(...contentTokens);

  if (isPastAction && whTokens.length === 0 && !ordered.includes('FINISH')) {
    ordered.push('FINISH');
  }

  if (whTokens.length > 0) {
    ordered.push(...whTokens);
  }

  let resStr = ordered.join(' ');
  if (whTokens.length > 0 || origPunct === '?') {
    if (!resStr.endsWith('?')) resStr += '?';
  } else if (origPunct === '!') {
    if (!resStr.endsWith('!')) resStr += '!';
  } else if (origPunct === '.') {
    if (!resStr.endsWith('.') && !resStr.endsWith('?') && !resStr.endsWith('!')) {
      resStr += '.';
    }
  }

  return resStr || clean.toUpperCase();
}

/**
 * Translates standard English text into ASL Gloss / Deaf English structure.
 */
export function translateToAslGloss(text: string): string {
  if (!text || !text.trim()) return '';

  const clean = text.trim();
  const pattern = /([^.?!]+)([.?!]+)?/g;
  const matches = Array.from(clean.matchAll(pattern));

  if (!matches || matches.length === 0) {
    return singleSentenceAslGloss(clean, '');
  }

  const results: string[] = [];
  for (const match of matches) {
    const clause = (match[1] || '').trim();
    const punct = (match[2] || '').trim();
    if (clause) {
      const g = singleSentenceAslGloss(clause, punct || '.');
      if (g) {
        results.push(g.endsWith('.') || g.endsWith('?') || g.endsWith('!') ? g : `${g}.`);
      }
    }
  }

  return results.join(' ');
}
