import re
from typing import List, Tuple

_TAG_PATTERNS = [
    r',\s*(?:isn[\'’]?t|is\s+not)\s+it\??$',
    r',\s*(?:aren[\'’]?t|are\s+not)\s+you\??$',
    r',\s*(?:aren[\'’]?t|are\s+not)\s+we\??$',
    r',\s*(?:aren[\'’]?t|are\s+not)\s+they\??$',
    r',\s*(?:isn[\'’]?t|is\s+not)\s+he\??$',
    r',\s*(?:isn[\'’]?t|is\s+not)\s+she\??$',
    r',\s*(?:doesn[\'’]?t|does\s+not)\s+it\??$',
    r',\s*(?:don[\'’]?t|do\s+not)\s+you\??$',
    r',\s*right\??$',
    r',\s*true\??$',
]

def split_sentences(text: str) -> List[Tuple[str, str]]:
    clean = (text or "").strip()
    if not clean:
        return []
    chunks = re.findall(r'(.*?[.!?]+(?:\s+|$)|.+?$)', clean, flags=re.DOTALL)
    results = []
    for c in chunks:
        c = c.strip()
        if not c:
            continue
        punct_match = re.search(r'([.!?]+)$', c)
        if punct_match:
            punct = punct_match.group(1)[0]
            body = c[:punct_match.start()].strip()
        else:
            punct = '.' if (len(chunks) > 1 or clean.endswith('.')) else ''
            body = c
        if body:
            results.append((body, punct))
    return results

def extract_tag_question(text: str) -> Tuple[str, bool]:
    clean = text.strip()
    for pat in _TAG_PATTERNS:
        m = re.search(pat, clean, flags=re.IGNORECASE)
        if m:
            base = clean[:m.start()].strip()
            return base, True
    return clean, False

def extract_asl_tag(gloss: str) -> Tuple[str, bool]:
    clean = gloss.strip()
    m = re.search(r',\s*(?:RIGHT|TRUE)\??$|\s+(?:RIGHT|TRUE)\??$', clean, flags=re.IGNORECASE)
    if m:
        base = clean[:m.start()].strip()
        return base, True
    return clean, False

def tag_for_subject(raw_tokens: List[str]) -> str:
    subj = raw_tokens[0].lower() if raw_tokens else ''
    if subj in ('you', 'ix-2'):
        return ", aren't you?"
    elif subj in ('we', 'ix-1p'):
        return ", aren't we?"
    elif subj in ('they', 'ix-3p'):
        return ", aren't they?"
    elif subj in ('he', 'ix-he'):
        return ", isn't he?"
    elif subj in ('she', 'ix-she'):
        return ", isn't she?"
    else:
        return ", isn't it?"

phrase_map = {
    "thank you": "THANK-YOU",
    "thanks": "THANK-YOU",
    "you are welcome": "WELCOME",
    "good morning": "MORNING GOOD",
    "good afternoon": "AFTERNOON GOOD",
    "good night": "NIGHT GOOD",
    "how are you": "HOW YOU?",
    "hello": "HELLO",
    "hi": "HI",
    "hey": "HEY",
    "hello how are you": "HELLO, HOW YOU?",
    "hi how are you": "HI, HOW YOU?",
    "hey how are you": "HEY, HOW YOU?",
    "hello what is your name": "HELLO, YOUR NAME WHAT?",
    "hi what is your name": "HI, YOUR NAME WHAT?",
    "hello who are you": "HELLO, YOU WHO?",
    "hi who are you": "HI, YOU WHO?",
    "hello nice to meet you": "HELLO, NICE MEET YOU",
    "hi nice to meet you": "HI, NICE MEET YOU",
    "my name is": "MY NAME",
    "what is your name": "YOUR NAME WHAT?",
    "who are you": "YOU WHO?",
    "where are you": "YOU WHERE?",
    "i don't know": "ME DON'T-KNOW",
    "i do not know": "ME DON'T-KNOW",
    "see you later": "SEE LATER",
}

phrasal_map_en = {
    "thank you": "Thank you!",
    "thank-you": "Thank you!",
    "thanks": "Thanks!",
    "welcome": "You are welcome.",
    "morning good": "Good morning!",
    "good morning": "Good morning!",
    "afternoon good": "Good afternoon!",
    "good afternoon": "Good afternoon!",
    "night good": "Good night!",
    "good night": "Good night!",
    "hello": "Hello!",
    "hi": "Hi!",
    "hey": "Hey!",
    "hello how you": "Hello, how are you?",
    "hello how you?": "Hello, how are you?",
    "hello you how": "Hello, how are you?",
    "hello you how?": "Hello, how are you?",
    "how you hello": "Hello, how are you?",
    "how you hello?": "Hello, how are you?",
    "hi how you": "Hi, how are you?",
    "hi how you?": "Hi, how are you?",
    "hi you how": "Hi, how are you?",
    "hi you how?": "Hi, how are you?",
    "how you": "How are you?",
    "how you?": "How are you?",
    "your name what": "What is your name?",
    "your name what?": "What is your name?",
    "you who": "Who are you?",
    "you who?": "Who are you?",
    "see later": "See you later.",
    "nice meet you": "Nice to meet you.",
}

unique_nouns = {'moon', 'sun', 'sky', 'weather', 'world', 'food', 'water', 'flower'}
adjectives = {
    'tired', 'sick', 'happy', 'sad', 'late', 'ready', 'angry', 'hungry', 'thirsty',
    'busy', 'deaf', 'hearing', 'fine', 'good', 'bad', 'beautiful', 'pretty', 'nice',
    'cold', 'hot', 'warm', 'sunny', 'rainy', 'windy', 'clean', 'dirty', 'delicious'
}
places = {"store", "school", "park", "hospital", "library", "bank", "restaurant", "home", "market", "bathroom", "work", "church", "bed"}

def _single_sentence_asl_to_english(gloss: str, terminal_punct: str = "") -> str:
    base, has_tag = extract_asl_tag(gloss)
    raw_tokens_tag = re.findall(r"[\w'-]+", base)

    clean = base.strip()
    if not clean:
        return ""

    lowered = re.sub(r'[?!.,;:]', '', clean).lower().strip()
    if lowered in phrasal_map_en:
        res = phrasal_map_en[lowered]
        if has_tag:
            tag = tag_for_subject(raw_tokens_tag)
            return f"{res.rstrip('.?!')}{tag}"
        return res

    is_question = (terminal_punct == "?") or ("?" in clean) or has_tag
    raw_tokens = re.findall(r"[\w'-]+|\?", clean)

    tokens = []
    for t in raw_tokens:
        upper = t.upper()
        if upper in ("IX", "IX-1", "IX:1", "IX-I", "IX-ME", "ME"):
            tokens.append("I")
        elif upper in ("IX-2", "IX:2", "IX-YOU", "YOU"):
            tokens.append("you")
        elif upper in ("IX-3", "IX:3", "IX-HE", "HE"):
            tokens.append("he")
        elif upper in ("IX-SHE", "SHE"):
            tokens.append("she")
        elif upper in ("IX-IT", "IT"):
            tokens.append("it")
        elif upper in ("WE", "US", "IX-1P"):
            tokens.append("we")
        elif upper in ("THEY", "THEM", "IX-3P"):
            tokens.append("they")
        elif upper in ("MY", "POSS-1", "POSS:1"):
            tokens.append("my")
        elif upper in ("YOUR", "POSS-2", "POSS:2"):
            tokens.append("your")
        elif upper in ("DON'T-KNOW", "DONT-KNOW"):
            tokens.extend(["do", "not", "know"])
        elif upper in ("THANK-YOU",):
            tokens.extend(["thank", "you"])
        else:
            tokens.append(t.lower())

    greeting_prefix = ""
    if len(tokens) > 1 and tokens[0].lower() in ("hello", "hi", "hey"):
        greeting_prefix = tokens[0].capitalize()
        tokens = tokens[1:]
    elif len(tokens) > 1 and tokens[-1].lower() in ("hello", "hi", "hey"):
        greeting_prefix = tokens[-1].capitalize()
        tokens = tokens[:-1]

    def _with_greeting(sentence: str) -> str:
        if not sentence:
            return f"{greeting_prefix}!" if greeting_prefix else ""
        if greeting_prefix:
            if sentence.startswith("I ") or sentence == "I":
                first_clause = sentence
            else:
                first_clause = sentence[0].lower() + sentence[1:] if len(sentence) > 1 else sentence.lower()
            return f"{greeting_prefix}, {first_clause}"
        return sentence

    wh_words = {"who", "what", "where", "when", "why", "how", "which"}
    found_wh = [w for w in tokens if w in wh_words]
    time_words_past = {"yesterday", "past", "before"}
    is_past = any(w in time_words_past for w in tokens) or "finish" in tokens

    irregular_past = {
        "go": "went", "see": "saw", "eat": "ate", "buy": "bought", "read": "read",
        "meet": "met", "have": "had", "has": "had", "make": "made", "take": "took",
        "do": "did", "write": "wrote", "say": "said", "come": "came", "find": "found",
        "give": "gave", "learn": "learned", "study": "studied", "play": "played",
        "help": "helped", "want": "wanted", "need": "needed", "like": "liked",
        "bake": "baked", "cook": "cooked", "run": "ran", "walk": "walked"
    }

    if found_wh and (is_question or (len(tokens) > 0 and tokens[-1] in wh_words) or len(tokens) <= 5):
        wh = found_wh[0]
        rest = [w for w in tokens if w != wh and w != "?" and w != "finish"]
        subj = "you" if "you" in rest else ("I" if "I" in rest else ("he" if "he" in rest else ("she" if "she" in rest else None)))
        if subj:
            other_words = [w for w in rest if w != subj]
            other_str = (" " + " ".join(other_words)) if other_words else ""
            be_verb = "am" if subj == "I" else ("is" if subj in ("he", "she", "it") else "are")
            return _with_greeting(f"{wh.capitalize()} {be_verb} {subj}{other_str}?")

    tokens_no_finish = [w for w in tokens if w != "finish" and w != "?"]

    # Check unique noun + adjective (e.g. MOON BEAUTIFUL -> The moon is beautiful)
    if len(tokens_no_finish) == 2 and tokens_no_finish[0] in unique_nouns and tokens_no_finish[1] in adjectives:
        noun = tokens_no_finish[0]
        adj = tokens_no_finish[1]
        base_res = f"The {noun} is {adj}"
        if has_tag:
            tag = tag_for_subject(raw_tokens_tag)
            return _with_greeting(f"{base_res}{tag}")
        return _with_greeting(f"{base_res}.")

    # Check Subject + Adjective (e.g. ME TIRED -> I am tired)
    if len(tokens_no_finish) == 2 and tokens_no_finish[0] in ("I", "you", "he", "she", "it", "we", "they") and tokens_no_finish[1] in adjectives:
        subj = tokens_no_finish[0]
        adj = tokens_no_finish[1]
        be_verb = "am" if subj == "I" else ("is" if subj in ("he", "she", "it") else "are")
        base_res = f"{subj} {be_verb} {adj}"
        if has_tag:
            tag = tag_for_subject(raw_tokens_tag)
            return _with_greeting(f"{base_res}{tag}")
        return _with_greeting(f"{base_res}.")

    # Check Time + Subject/Adjective (e.g. TODAY SUNNY -> Today is sunny)
    if len(tokens_no_finish) == 2 and tokens_no_finish[0] in ("today", "yesterday", "tomorrow") and tokens_no_finish[1] in adjectives:
        time_w = tokens_no_finish[0].capitalize()
        adj = tokens_no_finish[1]
        be_verb = "was" if time_w == "Yesterday" else "is"
        base_res = f"{time_w} {be_verb} {adj}"
        if has_tag:
            tag = tag_for_subject(raw_tokens_tag)
            return _with_greeting(f"{base_res}{tag}")
        return _with_greeting(f"{base_res}.")

    out = []
    i = 0
    while i < len(tokens_no_finish):
        w = tokens_no_finish[i]
        if w in ("go",):
            verb_form = "went" if is_past else ("goes" if len(out) > 0 and out[-1] in ("he", "she", "it") else "go")
            if i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] in places:
                place = tokens_no_finish[i+1]
                if place in ("home", "work", "bed"):
                    out.extend([verb_form, place])
                elif place in ("school", "church"):
                    out.extend([verb_form, "to", place])
                else:
                    out.extend([verb_form, "to", "the", place])
                i += 2
                continue
            else:
                out.append(verb_form)
                i += 1
                continue
        out.append(w)
        i += 1

    res = " ".join(out)
    if res:
        words = res.split()
        capitalized_words = []
        for idx, word in enumerate(words):
            if word.lower() == "i":
                capitalized_words.append("I")
            elif idx == 0:
                capitalized_words.append(word.capitalize())
            else:
                capitalized_words.append(word)
        res = " ".join(capitalized_words)
        if has_tag:
            tag = tag_for_subject(raw_tokens_tag)
            return _with_greeting(f"{res.rstrip('.?!')}{tag}")
        if terminal_punct == "?":
            res += "?"
        elif terminal_punct == "!":
            res += "!"
        elif not res.endswith((".", "?", "!")):
            res += "?" if is_question else "."
        return _with_greeting(res)
    return f"{greeting_prefix}!" if greeting_prefix else ""

def rule_based_asl_to_english(gloss: str) -> str:
    clean = (gloss or "").strip()
    if not clean:
        return ""
    sentences = split_sentences(clean)
    if not sentences:
        return ""
    if len(sentences) == 1:
        body, punct = sentences[0]
        return _single_sentence_asl_to_english(body, punct)
    results = []
    for body, punct in sentences:
        eng = _single_sentence_asl_to_english(body, punct or ".")
        if not eng.endswith((".", "?", "!")):
            eng += "."
        results.append(eng)
    return " ".join(results)

# Test ASL -> English
print("ASL -> EN (1):", rule_based_asl_to_english("MOON BEAUTIFUL, RIGHT?"))
print("ASL -> EN (2):", rule_based_asl_to_english("HELLO! HOW YOU? MOON BEAUTIFUL, RIGHT?"))
print("ASL -> EN (3):", rule_based_asl_to_english("TODAY SUNNY. ME GO SCHOOL."))
