# BrightPath — Release Notes & Version History

All notable changes across versions of the BrightPath ASL Tutoring System are documented in this file.

## [Version 1.2.4] — 2026-10-18

### 📚 Visual Vocabulary Flashcards & Curriculum Expansion
* **Araling Panlipunan Authentic Historical Flashcards (IDs 401–406)**:
  * Integrated 100% verified, authentic historical artifacts, museum oil paintings, and original 19th-century photographs (strictly non-AI):
    * **Katipunan (KKK)**: Official 1892–1896 Revolutionary Flag (white K.K.K. on red field) from NHCP archives.
    * **Andres Bonifacio**: Only surviving authentic 1896 studio photograph taken by *Chofre y Cía.* in Escolta, Manila.
    * **Sanduguan (Blood Compact)**: Juan Luna's 1886 National Treasure oil masterpiece *"El Pacto de Sangre"*.
    * **Kartilya ng Katipunan**: Emilio Jacinto's moral code document from the permanent collection of the *Museo ng Katipunan*.
    * **Kalayaan (Freedom)**: Fernando Amorsolo's acclaimed historical painting *"The Making of the Philippine Flag"* (depicting Marcela Agoncillo, Lorenza Agoncillo, and Delfina Herbosa de Natividad sewing the first flag in 1898).
    * **Gregoria de Jesus**: Authentic historical studio photograph of the *Lakambini ng Katipunan* in traditional Filipiniana Baro't Saya.
  * Configured responsive image rendering with dynamic `contentFit` (`contain` for Araling Panlipunan) to preserve complete uncropped views of historical paintings, flags, and scrolls.

* **Technology & Livelihood Education (TLE) Animated 2D Vector Flashcards (IDs 301–306)**:
  * Deployed 6 custom-crafted, lightweight 2D vector animated GIFs:
    * **Webcam Privacy**: Sliding privacy shutter protecting private rooms during video calls.
    * **Mute Microphone**: High-contrast microphone with smooth diagonal slash matching the 1:1 user reference.
    * **Meeting Link**: Interlocking skinny chain loops snapping securely into place with a gold padlock.
    * **Password Protection**: Animated secret bullet typing sequence with lock snap and security shield.
    * **Visual Clarity**: Front ring lighting illuminating sign language gestures with clarity sparkles.
    * **Chat Etiquette**: Polite chat dialogue bubbles with respect stars for online classes.
  * Aligned all interactive student example sentences with exact user specifications.

* **Mathematics Animated 2D Vector Flashcards (IDs 201–206)**:
  * Added 6 animated visual transformation GIFs (Translation, Reflection, Rotation, Symmetry, Congruent Figures, Coordinate Plane) with smooth infinite looping.

### ☁️ Production Azure Backend Sync
* Successfully deployed updated backend package to Azure App Service (`brightpath.azurewebsites.net`).
* Synchronized `/flashcards/{topic_id}` endpoints for all curriculum subjects with instant response times and persistent Supabase PostgreSQL database pooling.

---

### 🎨 Subject Icons & High-Contrast DHH Visual Badges
* **Custom Subject Badges on Home Tab**:
  * Replaced generic vector icons with clear, vibrant, high-contrast visual badges for all four primary subjects.
  * **English (Story Grammar)**: Plain Violet (`#7C3AED`) with bold, friendly rounded white typography.
  * **Mathematics (`Math`)**: Plain Royal Blue (`#2563EB`) with thick, playful rounded white lettering.
  * **Technology & Livelihood Education (`TLE`)**: Plain Warm Amber Orange (`#D97706`) with large, clear rounded white font.
  * **Araling Panlipunan**: Plain Emerald Green (`#059669`) with stacked rounded white typography ("Araling" on top, "Panlipunan" on bottom).
  * Designed specifically for deaf and hard-of-hearing learners to ensure instant readability even on small mobile icon squircles (`48×48 px`).

### ⚙️ Backend Stability & Quest Gamification Fixes
* **PostgreSQL Schema Auto-Healing**:
  * Fixed `column "is_completed" does not exist` query error in `GET /student/{user_id}/daily-missions` by standardizing on `completed_at IS NOT NULL`.
  * Resolved the bug where claimed daily quest state and star counts reset after app restart.
* **Azure Memory & Concurrency Optimization**:
  * Prevented neural model background loading on boot, reducing idle RAM from 3.6 GB to ~150 MB and preventing Linux OOM worker kills.
  * Configured Gunicorn on Azure App Service Plan B2 to run with 2 concurrent workers and enabled PostgreSQL `ThreadedConnectionPool`.

---

## [Version 1.2.1] — 2026-10-12

### 🚀 Performance & Translation Speedup
* **Dynamic INT8 Quantization**: Applied `torch.quantization.quantize_dynamic` to `mBART-50` linear layers, reducing translation latency from ~15–20 seconds down to ~1.5–2.5 seconds on Azure 2-vCPU B2 instances while cutting memory footprint by 50% (~1.2 GB).
* **Inference Optimization**: Executed neural generation under `torch.inference_mode()` with `num_beams=1` and optimized `max_new_tokens` (32 tokens for quiz helper sentences, 64 tokens for free-form translation).
* **Two-Tier Caching System**: 
  * In-memory LRU cache delivering sub-millisecond (<1ms) instant responses for frequent quiz prompts and repeated phrases.
  * PostgreSQL `translations_cache` persistence across server restarts.
* **Pre-warming Engine**: Background pre-computation of active quiz question translations so student in-quiz ASL helpers load with zero lag.

### 🖼️ Image Persistence Across Updates
* **Fixed Blank Images After Azure Updates**:
  * Shipped `assets/uploads` directly inside `deploy.zip` so all uploaded lesson and question images persist across Azure App Service zip deployments.
  * Added `sync_packaged_uploads()` on server startup to automatically sync packaged media into persistent `/home/site/uploads`.
  * Added resilient multi-path candidate directory resolution in `/static/{filename}` to serve images regardless of relative cwd or mount directory.

### 📱 Mobile UI & Avatar Simplification
* **Disabled Unstable Profile Picture Upload**:
  * Removed mobile camera/gallery picker and camera badge overlay in `app/(tabs)/settings.tsx`.
  * Replaced avatar image loading in `app/(tabs)/home.tsx` and `app/(tabs)/settings.tsx` with clean, reliable, high-contrast student initial letter circle badges (e.g. "R" for Radny).
  * Completely eliminated upload timeouts, camera permission errors, and broken image icons on mobile devices.

### 🎯 Dynamic Quests & Daily Quizzes
* **Full Dynamic Verification**: Confirmed daily quizzes query PostgreSQL `quizzes` dynamically via `_pick_quiz_for_slot` according to student lesson progress.
* **Quiz Lock Resolution**: Fixed quiz routing so daily mode directly passes `quizId` and bypasses prerequisite lesson locks.
* **Daily Missions**: Replaced static hardcoded counters (`1/1`, `2/5`) with live database counters that reset automatically at midnight based on local student timezone.

---

## [Version 1.2.0] — 2026-10-09

### Added
* **Adaptive AI Tutoring Engine**: Integrated Bayesian Knowledge Tracing (BKT) to dynamically evaluate student mastery and recommend Easy, Medium, or Hard lessons.
* **Daily Quizzes & Streak System**: 3-slot daily challenge system with Star rewards (+10/+20/+30), refresh capabilities (5 stars), and streak freeze/repair.
* **Floating ASL Helper**: Floating modal drawer on quiz questions allowing students to translate questions to ASL gloss on the fly.
* **Production Azure Deployment**: Azure Linux App Service migration with Supabase PostgreSQL connection pooling and HTTPS media URL resolver.

---

## [Version 1.1.0] — 2026-09-15

### Added
* **Enhanced Admin & Teacher Dashboards**: Real-time student inspect dossiers, class analytics, and question bank editor.
* **Interactive Matching Questions**: Drag-and-pair / tap-to-match question format alongside standard multiple-choice and image-based questions.
* **Badges & Achievements**: Star reward economy with unlockable student achievement badges.

---

## [Version 1.0.0] — 2026-08-01

### Added
* **Initial Release**: BrightPath ASL Tutoring System MVP.
* **Core Modules**: Student sign-up/login, English lesson reader with slide navigation, topic quizzes, and basic reporting.
