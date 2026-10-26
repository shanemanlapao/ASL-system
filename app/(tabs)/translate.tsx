import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../context/config";
import { COLORS } from "../../context/theme";

const TRANSLATE_URL = `${API_URL}/translate`;

type Direction = "en_to_asl" | "asl_to_en";

const PHRASAL_ASL_MAP: Record<string, string> = {
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
  "how you": "How are you?",
  "how you?": "How are you?",
  "your name what": "What is your name?",
  "your name what?": "What is your name?",
  "you name what": "What is your name?",
  "you name what?": "What is your name?",
  "name your what": "What is your name?",
  "name your what?": "What is your name?",
  "you who": "Who are you?",
  "you who?": "Who are you?",
  "you where": "Where are you?",
  "you where?": "Where are you?",
  "you from where": "Where are you from?",
  "you from where?": "Where are you from?",
  "me don't-know": "I don't know.",
  "me dont know": "I don't know.",
  "me not know": "I do not know.",
  "see later": "See you later.",
  "see-you later": "See you later.",
  "nice meet you": "Nice to meet you.",
  "meet you nice": "Nice to meet you.",
  "time what": "What time is it?",
  "time what?": "What time is it?",
  "deaf me": "I am deaf.",
  "me deaf": "I am deaf.",
  "hearing you": "Are you hearing?",
  "hearing you?": "Are you hearing?",
  "bathroom where": "Where is the bathroom?",
  "bathroom where?": "Where is the bathroom?",
  "please help me": "Please help me.",
  "help me please": "Please help me.",
  "i love you": "I love you.",
  "me love you": "I love you.",
  "sorry": "I am sorry.",
  "yes": "Yes.",
  "no": "No.",
};

const IRREGULAR_PAST: Record<string, string> = {
  go: 'went', see: 'saw', eat: 'ate', buy: 'bought', read: 'read',
  meet: 'met', have: 'had', has: 'had', make: 'made', take: 'took',
  do: 'did', write: 'wrote', say: 'said', come: 'came', find: 'found',
  give: 'gave', learn: 'learned', study: 'studied', play: 'played',
  help: 'helped', want: 'wanted', need: 'needed', like: 'liked',
  bake: 'baked', cook: 'cooked', run: 'ran', walk: 'walked',
};

function localAslToEnglish(gloss: string): string {
  const clean = gloss.trim();
  if (!clean) return "";

  const lowered = clean.replace(/[!.,;:]/g, "").toLowerCase().trim();
  if (PHRASAL_ASL_MAP[lowered]) return PHRASAL_ASL_MAP[lowered];
  if (PHRASAL_ASL_MAP[clean.toLowerCase()]) return PHRASAL_ASL_MAP[clean.toLowerCase()];

  const isQuestion = clean.includes("?");
  const rawTokens = clean.match(/[\w'-]+|\?/g) || [];

  const tokens: string[] = [];
  for (const t of rawTokens) {
    const upper = t.toUpperCase();
    if (["IX", "IX-1", "IX:1", "IX-I", "IX-ME", "ME"].includes(upper)) tokens.push("I");
    else if (["IX-2", "IX:2", "IX-YOU", "YOU"].includes(upper)) tokens.push("you");
    else if (["IX-3", "IX:3", "IX-HE", "HE"].includes(upper)) tokens.push("he");
    else if (["IX-SHE", "SHE"].includes(upper)) tokens.push("she");
    else if (["IX-IT", "IT"].includes(upper)) tokens.push("it");
    else if (["WE", "US", "IX-1P"].includes(upper)) tokens.push("we");
    else if (["THEY", "THEM", "IX-3P"].includes(upper)) tokens.push("they");
    else if (["MY", "POSS-1", "POSS:1"].includes(upper)) tokens.push("my");
    else if (["YOUR", "POSS-2", "POSS:2"].includes(upper)) tokens.push("your");
    else if (["DON'T-KNOW", "DONT-KNOW"].includes(upper)) tokens.push("do", "not", "know");
    else if (upper === "THANK-YOU") tokens.push("thank", "you");
    else if (upper === "SEE-YOU") tokens.push("see", "you");
    else if (upper === "GIVE-ME") tokens.push("give", "me");
    else tokens.push(t.toLowerCase());
  }

  const whWords = new Set(["who", "what", "where", "when", "why", "how", "which"]);
  const foundWh = tokens.filter((w) => whWords.has(w));
  const isPast = tokens.some((w) => ["yesterday", "past", "before"].includes(w)) || tokens.includes("finish");

  if (foundWh.length > 0 && (isQuestion || (tokens.length > 0 && whWords.has(tokens[tokens.length - 1])) || tokens.length <= 5)) {
    const wh = foundWh[0];
    const rest = tokens.filter((w) => w !== wh && w !== "?" && w !== "finish");
    const subj = rest.includes("you") ? "you" : (rest.includes("I") ? "I" : (rest.includes("he") ? "he" : (rest.includes("she") ? "she" : null)));

    const actionVerbs = new Set(["live", "go", "do", "work", "study", "want", "like", "eat", "see", "buy", "learn", "play", "sleep", "start", "come"]);
    const adjectives = new Set(["tired", "sick", "happy", "sad", "late", "ready", "angry", "hungry", "thirsty", "busy", "deaf", "hearing", "fine", "good", "bad"]);

    const hasVerb = rest.some((w) => actionVerbs.has(w));
    const hasAdj = rest.some((w) => adjectives.has(w));

    if (wh === "what" && (rest.includes("name") || rest.includes("your"))) {
      return "What is your name?";
    } else if (wh === "where" && rest.includes("bathroom")) {
      return "Where is the bathroom?";
    } else if (wh === "who" && rest.length > 0 && ["that", "this"].includes(rest[rest.length - 1])) {
      return `Who is ${rest[rest.length - 1]}?`;
    } else if (hasAdj && subj) {
      const beVerb = subj === "I" ? "am" : (["he", "she", "it"].includes(subj) ? "is" : "are");
      const adj = rest.find((w) => adjectives.has(w));
      return `${wh.charAt(0).toUpperCase() + wh.slice(1)} ${beVerb} ${subj} ${adj}?`;
    } else if (hasVerb && subj) {
      const v = rest.find((w) => actionVerbs.has(w));
      const aux = isPast ? "did" : (["he", "she", "it"].includes(subj) ? "does" : "do");
      const otherWords = rest.filter((w) => w !== subj && w !== v);
      const otherStr = otherWords.length > 0 ? ` ${otherWords.join(" ")}` : "";
      return `${wh.charAt(0).toUpperCase() + wh.slice(1)} ${aux} ${subj} ${v}${otherStr}?`;
    } else if (subj) {
      const otherWords = rest.filter((w) => w !== subj);
      const otherStr = otherWords.length > 0 ? ` ${otherWords.join(" ")}` : "";
      const beVerb = subj === "I" ? "am" : (["he", "she", "it"].includes(subj) ? "is" : "are");
      return `${wh.charAt(0).toUpperCase() + wh.slice(1)} ${beVerb} ${subj}${otherStr}?`;
    }
  }

  let tokensNoFinish = tokens.filter((w) => w !== "finish" && w !== "?");
  const countableNouns = new Set(["cake", "book", "car", "apple", "dog", "cat", "letter", "pencil", "house", "shirt", "game", "song", "movie", "bike"]);
  const subjects = new Set(["I", "you", "he", "she", "it", "we", "they"]);
  if (tokensNoFinish.length >= 3 && countableNouns.has(tokensNoFinish[0]) && subjects.has(tokensNoFinish[1])) {
    tokensNoFinish = [tokensNoFinish[1], ...tokensNoFinish.slice(2), tokensNoFinish[0]];
  }

  const adjectives = new Set(["tired", "sick", "happy", "sad", "late", "ready", "angry", "hungry", "thirsty", "busy", "deaf", "hearing", "fine", "good", "bad"]);
  const actionVerbs = new Set(["bake", "cook", "eat", "drink", "go", "walk", "run", "read", "write", "learn", "study", "see", "watch", "buy", "sell", "give", "take", "make", "meet", "help", "sleep", "drive", "swim", "play"]);
  const modalVerbs = new Set(["want", "like", "need", "hope", "plan", "try", "love", "prefer"]);
  const places = new Set(["store", "school", "park", "hospital", "library", "bank", "restaurant", "home", "market", "bathroom", "work", "church", "bed"]);

  const out: string[] = [];
  let i = 0;
  while (i < tokensNoFinish.length) {
    const w = tokensNoFinish[i];

    if (["my", "your", "his", "her"].includes(w) && i + 1 < tokensNoFinish.length && tokensNoFinish[i + 1] === "name") {
      out.push(w, "name", "is");
      i += 2;
      continue;
    }

    if (subjects.has(w) && i + 1 < tokensNoFinish.length && adjectives.has(tokensNoFinish[i + 1])) {
      let beVerb = w === "I" ? "am" : (["he", "she", "it"].includes(w) ? "is" : "are");
      if (isPast) beVerb = ["I", "he", "she", "it"].includes(w) ? "was" : "were";
      out.push(w, beVerb, tokensNoFinish[i + 1]);
      i += 2;
      continue;
    }

    if (modalVerbs.has(w) && i + 1 < tokensNoFinish.length && actionVerbs.has(tokensNoFinish[i + 1])) {
      let modal = isPast ? (IRREGULAR_PAST[w] || `${w}ed`) : w;
      if (!isPast && out.length > 0 && ["he", "she", "it"].includes(out[out.length - 1])) {
        modal = `${w}s`;
      }
      out.push(modal, "to", tokensNoFinish[i + 1]);
      i += 2;
      continue;
    }

    if (w === "go") {
      const verbForm = isPast ? "went" : (out.length > 0 && ["he", "she", "it"].includes(out[out.length - 1]) ? "goes" : "go");
      if (i + 1 < tokensNoFinish.length && places.has(tokensNoFinish[i + 1])) {
        const place = tokensNoFinish[i + 1];
        if (["home", "work", "bed"].includes(place)) {
          out.push(verbForm, place);
        } else if (["school", "church"].includes(place)) {
          out.push(verbForm, "to", place);
        } else {
          out.push(verbForm, "to", "the", place);
        }
        i += 2;
        continue;
      } else {
        out.push(verbForm);
        i += 1;
        continue;
      }
    }

    if (actionVerbs.has(w)) {
      let v = isPast ? (IRREGULAR_PAST[w] || `${w}ed`) : w;
      if (!isPast && out.length > 0 && ["he", "she", "it"].includes(out[out.length - 1])) {
        v = `${w}s`;
      }
      out.push(v);
      i += 1;
      continue;
    }

    if (countableNouns.has(w) && out.length > 0 && !["a", "an", "the", "my", "your", "his", "her", "our", "their", "this", "that"].includes(out[out.length - 1])) {
      const article = "aeiou".includes(w[0]) ? "an" : "a";
      out.push(article, w);
      i += 1;
      continue;
    }

    out.push(w);
    i += 1;
  }

  const resWords = out.map((word, idx) => {
    if (word.toLowerCase() === "i") return "I";
    if (idx === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    if (idx === out.length - 1 && out.length >= 3 && out[idx - 2].toLowerCase() === "my" && out[idx - 1].toLowerCase() === "name") {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  });

  let res = resWords.join(" ");
  if (res && !/[.?!]$/.test(res)) {
    res += isQuestion ? "?" : ".";
  }
  return res;
}

import { translateToAslGloss } from "../../context/aslTranslator";

function localEnglishToAsl(text: string): string {
  return translateToAslGloss(text);
}

export default function TranslateScreen() {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<Direction>("en_to_asl");
  const [engineMode, setEngineMode] = useState<"rule" | "neural">("rule");
  const [engineInfo, setEngineInfo] = useState<string | null>(null);

  const fromLabel = direction === "en_to_asl" ? "Basic English" : "ASL Gloss";
  const toLabel = direction === "en_to_asl" ? "ASL Gloss" : "Basic English";
  const placeholder =
    direction === "en_to_asl"
      ? "Type in Basic English..."
      : "Type in ASL Gloss (e.g. IX WANT BAKE CAKE)...";

  const handleSwap = () => {
    setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
    setEngineInfo(null);
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    } else {
      setInputText("");
      setTranslatedText("");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setTranslatedText("");
    setEngineInfo(null);
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: inputText, 
          direction,
          force_engine: engineMode 
        }),
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      const res = data.result ?? data.error;
      if (res) {
        setTranslatedText(res);
        if (data.engine) {
          const lat = data.latency_ms ? ` (${data.latency_ms} ms)` : "";
          setEngineInfo(`${data.engine}${lat}`);
        }
      } else {
        const fallback = direction === "en_to_asl" ? localEnglishToAsl(inputText) : localAslToEnglish(inputText);
        setTranslatedText(fallback);
        setEngineInfo("local-offline");
      }
    } catch (error: any) {
      console.log("Translation server unreachable, falling back to local engine:", error);
      const fallback = direction === "en_to_asl" ? localEnglishToAsl(inputText) : localAslToEnglish(inputText);
      setTranslatedText(fallback);
      setEngineInfo("local-offline");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setTranslatedText("");
    setEngineInfo(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Translation Tool</Text>
          <Text style={styles.subtitle}>Translate between Basic English and ASL Gloss</Text>
        </View>

        {/* Engine Mode Selector */}
        <View style={styles.engineSelectorCard}>
          <Text style={styles.engineSelectorLabel}>ENGINE MODE</Text>
          <View style={styles.enginePillRow}>
            <TouchableOpacity
              style={[
                styles.enginePill,
                engineMode === "rule" && styles.enginePillActiveRule,
              ]}
              onPress={() => {
                setEngineMode("rule");
                setEngineInfo(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={14}
                color={engineMode === "rule" ? "#FFFFFF" : COLORS.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.enginePillText,
                  engineMode === "rule" && styles.enginePillTextActive,
                ]}
              >
                Fast Linguistic
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.enginePill,
                engineMode === "neural" && styles.enginePillActiveNeural,
              ]}
              onPress={() => {
                setEngineMode("neural");
                setEngineInfo(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="hardware-chip"
                size={14}
                color={engineMode === "neural" ? "#FFFFFF" : COLORS.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.enginePillText,
                  engineMode === "neural" && styles.enginePillTextActive,
                ]}
              >
                Neural mBART-50
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Direction Swap Card */}
        <TouchableOpacity
          style={styles.languageToggleCard}
          onPress={handleSwap}
          activeOpacity={0.85}
        >
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>FROM</Text>
            <Text style={[styles.languageActive, { color: direction === "en_to_asl" ? COLORS.primary : COLORS.aslTeal }]}>
              {fromLabel}
            </Text>
          </View>

          <View style={styles.swapIconContainer}>
            <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>TO</Text>
            <Text style={[styles.languageActive, { color: direction === "en_to_asl" ? COLORS.aslTeal : COLORS.primary }]}>
              {toLabel}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputTitle}>Enter text to translate</Text>
            {inputText.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={inputText}
              onChangeText={setInputText}
            />
          </View>

          <Text style={styles.characterCount}>{inputText.length} characters</Text>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[
            styles.translateButton,
            (loading || !inputText.trim()) && styles.translateButtonDisabled,
          ]}
          onPress={handleTranslate}
          disabled={loading || !inputText.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.translateButtonText}>Translating...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="language" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.translateButtonText}>Translate</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Translation Result Card (Only rendered when there is a result) */}
        {translatedText !== "" && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                <Text style={styles.resultTitle}>{toLabel}</Text>
                {engineInfo && (
                  <View
                    style={[
                      styles.engineBadge,
                      engineInfo.includes("mbart")
                        ? styles.engineBadgeNeural
                        : styles.engineBadgeRule,
                    ]}
                  >
                    <Text
                      style={[
                        styles.engineBadgeText,
                        engineInfo.includes("mbart")
                          ? styles.engineBadgeTextNeural
                          : styles.engineBadgeTextRule,
                      ]}
                    >
                      {engineInfo.includes("mbart")
                        ? `🧠 ${engineInfo}`
                        : `⚡ ${engineInfo}`}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setInputText(translatedText);
                  setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
                  setTranslatedText("");
                  setEngineInfo(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text selectable style={styles.resultText}>
              {translatedText}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // Anti-glare Slate-50 canvas
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 12,
    paddingBottom: 80,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 3,
  },
  // Language Direction Card
  languageToggleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  languageSection: {
    flex: 1,
    alignItems: "center",
  },
  languageLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  languageActive: {
    fontSize: 15,
    fontWeight: "700",
  },
  swapIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Input Card
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  textInputContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 90,
    lineHeight: 22,
  },
  characterCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "right",
    fontWeight: "500",
  },
  // Translate Button
  translateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  translateButtonDisabled: {
    backgroundColor: "#DDD6FE",
    shadowOpacity: 0,
    elevation: 0,
  },
  translateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Result Card
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resultText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 25,
  },
  // Engine Selector Card
  engineSelectorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  engineSelectorLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  enginePillRow: {
    flexDirection: "row",
    gap: 8,
  },
  enginePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  enginePillActiveRule: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  enginePillActiveNeural: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
  },
  enginePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  enginePillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // Engine Result Badge
  engineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  engineBadgeRule: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  engineBadgeNeural: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  engineBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  engineBadgeTextRule: {
    color: "#1D4ED8",
  },
  engineBadgeTextNeural: {
    color: "#6D28D9",
  },
});
