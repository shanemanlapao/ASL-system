import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

dummy_kcs = [
    'kc_123', 'kc_test_title', 'kc_test_2', 'kc_sample',
    'KC_SG_CHARACTER', 'KC_SG_SETTING', 'KC_SG_PROBLEM', 'KC_SG_RESOLUTION'
]

print("Deleting dummy/unused KCs from knowledge_components & student_kc_mastery...")
for kc in dummy_kcs:
    cur.execute("DELETE FROM student_kc_mastery WHERE kc_name = %s", (kc,))
    cur.execute("DELETE FROM knowledge_components WHERE name = %s", (kc,))
    print(f"  Deleted: {kc}")

# Also update the dummy questions in quiz 1, 2, 3 so they don't break if queried
cur.execute("UPDATE questions SET knowledge_component = 'KC_VOCAB_VERB' WHERE knowledge_component IN ('kc_123', 'kc_test_title', 'kc_test_2', 'kc_sample')")

# Map Translation questions to KC_MATH_GEOM_TRANSLATION
cur.execute("UPDATE questions SET knowledge_component = 'KC_MATH_GEOM_TRANSLATION' WHERE knowledge_component LIKE 'trans_%'")
print(f"Updated Translation questions: {cur.rowcount} questions mapped to KC_MATH_GEOM_TRANSLATION")

# Map Katipunan questions to KC_AP_KATIPUNAN KCs
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_KATIPUNAN_FOUNDING' WHERE knowledge_component IN ('ap_basic_recall', 'ap_symbols_and_facts', 'ap_historical_causes')")
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_KATIPUNAN_OBJECTIVES' WHERE knowledge_component IN ('ap_brotherhood_concept', 'ap_national_transformation')")
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_KATIPUNAN_KARTILYA' WHERE knowledge_component IN ('ap_civic_equality', 'ap_mutual_aid_damayan')")
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_KATIPUNAN_SPREAD' WHERE knowledge_component IN ('ap_operational_secrecy', 'ap_triangle_system')")
print("Updated Katipunan questions mapped to KC_AP_KATIPUNAN_*")

# Register Bonifacio KCs if not existing
bonifacio_kcs = [
    ('araling-panlipunan', 'KC_AP_BONIFACIO_EARLY_LIFE', 'Andres Bonifacio: Early Life & Self-Education'),
    ('araling-panlipunan', 'KC_AP_BONIFACIO_LEADERSHIP', 'Andres Bonifacio: Leadership & Kartilya Ethics'),
    ('araling-panlipunan', 'KC_AP_BONIFACIO_LEGACY', 'Andres Bonifacio: Revolutionary Legacy & Kalayaan'),
]
for topic, name, title in bonifacio_kcs:
    cur.execute("""
        INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
        VALUES (%s, %s, %s, 0.10, 0.20, 0.25, 0.10)
        ON CONFLICT (name) DO NOTHING
    """, (topic, name, title))

cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_BONIFACIO_EARLY_LIFE' WHERE knowledge_component IN ('bonifacio_early_life', 'bonifacio_character_journey', 'bonifacio_leadership_facts')")
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_BONIFACIO_LEADERSHIP' WHERE knowledge_component IN ('bonifacio_leadership_ethics', 'bonifacio_organizing_skills', 'bonifacio_moral_philosophy')")
cur.execute("UPDATE questions SET knowledge_component = 'KC_AP_BONIFACIO_LEGACY' WHERE knowledge_component IN ('bonifacio_civic_equality', 'bonifacio_democratic_impact', 'bonifacio_legacy')")
print("Bonifacio questions mapped to KC_AP_BONIFACIO_*")

conn.commit()
cur.close()
conn.close()
print("Database cleanup & KC alignment complete!")
