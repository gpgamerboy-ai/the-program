ENTRY 001 — Session of September 25, 2026
1. Plain-Language Update
What happened today: We closed out the first project (workout-tracker) as a working v1, and opened a new project called The Program (the-program). The first project stays frozen and functional — Max can keep logging. The new project is a fresh build that will become the flexible coaching platform we described: one system that serves grandma, athletes, and monsters equally.
Why a new project: The changes we need to make are foundational — new sheet structure, new profile system, new target flexibility, new cycle awareness. Bolting those onto the live app risks breaking Max's data. New repo, new sheet, new Apps Script means zero risk to what's working.
Where we are right now:
	•	New GitHub repo the-program created (Step 1 complete)
	•	Old repo workout-tracker frozen
	•	Old sheet Workout Logs frozen
	•	Old Apps Script frozen
	•	Old athlete app still live at https://gpgamerboy-ai.github.io/workout-tracker/index2.html
What's next: Step 2 of 10 — copy files from old repo into new repo.
The end goal (in one sentence): A flexible training platform where you can write any program for any athlete, in plain words, in a Google Sheet, and the app delivers it to their phone with all the math done for them — from grandma's couch squats to a serious lifter's 5/3/1 cycle.

2. Running To-Do List
🔴 RIGHT NOW — Setup Phase
	•	☑ Create new GitHub repo the-program
	•	□ Step 2: Copy files from workout-tracker to the-program
	•	□ Step 3: Create new Google Sheet The Program with 6 tabs
	•	□ Step 4: Duplicate Apps Script, attach to new sheet, deploy as new Web App
🟡 DESIGN PHASE (after setup)
	•	□ Step 5: Finalize Programs tab layout (13 columns)
	•	□ Step 6: Finalize Profiles tab layout
	•	□ Create ProgramSettings tab for program-level declarations
🟢 BUILD PHASE
	•	□ Step 7: Seed new sheet with test athlete + one test program
	•	□ Step 8: Build new Apps Script (profiles, bar loading, flexible targets)
	•	□ Step 9: Build new frontend (app2.js + coach.js updates)
	•	□ Step 10: End-to-end test with dummy athlete
	•	□ Migrate real athletes one at a time from old sheet
🔵 LATER (Future sessions)
	•	□ Cycle awareness (weeks, deloads, 5/3/1, Texas Method)
	•	□ Auto-load calculation from last performance
	•	□ Bar loading math + plate inventory display
	•	□ End-of-cycle reports with graphs
	•	□ Coach comments visible to athletes
	•	□ Tier 1 simplification mode (novice / weekend warrior)
⚪ EACH TIME WE FINISH A SESSION
	•	□ Update changelog with new entry
	•	□ Save to Desktop over previous version
	•	□ Optionally: paste into README.md in the new repo

3. Tone Notes
Tone of this session: Fast, technical, high-trust. We made eleven design decisions in one sitting. When you said "let's pause," I paused. When you said "wait, I hit return by mistake," I waited. When you caught that BarWeight didn't make sense, we dropped it without defending it.
What worked well:
	•	Locking decisions one at a time with single letters (A/B/C, Y/N)
	•	Writing decisions down in this changelog before touching any code
	•	Freezing the working project before starting a new one
	•	Your instinct to pause and re-scope rather than patch
What to do differently next session:
	•	Fewer "let me reflect what you said" paragraphs — you've been clear, take you at your word
	•	When you answer "we'll see," don't push for a commitment
	•	Send whole files, never edits
	•	No ... in example URLs
	•	One diagnostic request at a time when troubleshooting
	•	If Chrome extensions might be interfering, suggest Incognito immediately
Chosen tone going forward: Direct, technical, no filler. Short sentences. Assume competence. You built the last one. You know what you're doing. I'm here to build, not to teach. When you say "give me the block," send the block. When you say "pause," pause.
One more thing: You speak in fast bursts with typos and mid-thought edits. I read through that and reflect meaning back. That worked. Keep doing it. I'll keep reading.

4. Glossary
ABC — A simple template program in the old sheet. 3 plans (A=Pull, B=Push, C=Legs).
Apps Script — Google's scripting layer that runs the backend. Attached to a specific Google Sheet.
Athlete app — The webpage athletes open on their phone to log workouts. Currently at old repo URL. New one will be at the-program URL.
Athlete profile — New concept. Per-athlete data: experience level, units, plate inventory, 1RMs, notes, goals. Lives in a new Profiles tab.
Auto-load calculation — App reads last performance, applies a rule, pre-fills today's weight. Not built yet.
Bar loading hint — Visual showing how to load a barbell: 22: 25/2.5 (each side).
Cycle — Multi-week wave in a program (e.g., 4 weeks for 5/3/1). Week 1 differs from Week 2, etc.
Coach key — Password for coach view: 053100KGC030772
Coach view — Your private dashboard. URL: https://gpgamerboy-ai.github.io/workout-tracker/coach.html (old repo).
CurrentWeek — Future concept. New column in Users tab. Tracks where each athlete is in their program's cycle.
ENDPOINT — The Apps Script Web App URL that the frontend calls. Line 5 of app2.js and coach.js.
GitHub — Hosts the code. Old repo: workout-tracker. New repo: the-program.
Grade — Athlete self-assessment A+ through F. Stored per set.
Last Time — Panel showing athlete's previous session on that lift.
Left in Tank (LIT) — Reps remaining before failure. 4 in tank = 4 reps short.
LoadLogic — New concept. Rules like pct_of_last_5rm, add_5_if_top, manual. Tells the app how to auto-calculate today's weight.
Main / Support — Exercise type. Main is the focus lift, Support is assistance.
PIN — Athlete's 4-digit login code.
PlateInventory — Per-athlete list of available plates. Used for bar loading math. e.g., 45,25,10,5,2.5.
Program — A named workout system. Examples: ABC, Lopez Fall, Wendler 531.
ProgramSettings — New tab. One row per program. Declares cycle length, report template, etc.
RPE — Rate of Perceived Exertion. 1–10 scale. Alternative to Left in Tank for expressing intensity.
TargetType — New concept. What kind of target a set has: reps, left_in_tank, rpe, failure, burn, feel, time, amrap, check.
Tempo — Four-number code W/X/Y/Z. W=lower, X=pause, Y=raise, Z=rest. e.g., 2/1/2/0.
The Program — The new project. Name of the new repo. Name of the new sheet. The unified platform.
Tier 1 / 2 / 3 — Informal athlete categories: Tier 1 = novice/weekend warrior; Tier 2 = athlete; Tier 3 = serious lifter.
Units — lb or kg. Per-athlete default. Session-overridable.
Welcome popup — Tutorial that appears every app open until 30 sessions.

5. Starting Prompt for Next Session
Copy this entire block and paste it as your first message next time:
text
CONTEXT: Continuing work on The Program. Reference Entry 001 of the changelog for full context.

PROJECT STATE:
- New repo: the-program (created, empty README)
- Old repo: workout-tracker (frozen, working)
- Old app still live: https://gpgamerboy-ai.github.io/workout-tracker/index2.html
- Old sheet: Workout Logs (frozen)
- Old coach view: https://gpgamerboy-ai.github.io/workout-tracker/coach.html
- Old coach key: 053100KGC030772

NEXT STEP: Step 2 of 10 — Copy files from old repo into new repo.

DESIGN DECISIONS LOCKED (from Entry 001):
- Project name: The Program
- New repo: the-program
- New sheet: The Program (separate from old)
- Bar hint display: Both sides shown, e.g., "22: 25/2.5 (each side)"
- Units drive bar picker: yes
- Blank = hidden (two states: coaching params hidden, athlete inputs show empty)
- 3-trigger upgrade logic: yes (toggle 3x in a session → offer to save to profile)
- BarWeight in profile: NO — dropped entirely
- D1: Programs layout confirmed (13 cols), ProgramSettings tab confirmed
- D2: Profiles layout confirmed (BarWeight removed)
- D3: Athletes will see coach comments (Option B)
- D4: Session length TBD

PROGRAMS TAB LAYOUT:
A: Program
B: Week (1,2,3,4,deload,blank)
C: Day (A,B,C...)
D: Exercise
E: Type (main/support/blank)
F: Rest
G: Tempo
H: SetNum (1,2,W1,W2...)
I: TargetType (reps, left_in_tank, rpe, failure, burn, feel, time, amrap, check)
J: TargetValue
K: TargetNote
L: LoadLogic
M: Notes

PROFILES TAB LAYOUT:
A: Name
B: ExperienceLevel (novice/athlete/serious)
C: Units (lb/kg)
D: PlateInventory
E: ShowBarLoading (TRUE/FALSE)
F: Squat1RM
G: Bench1RM
H: Deadlift1RM
I: Press1RM
J: Notes
K: Goals

TONE FOR THIS SESSION:
Direct, technical, no filler. Short sentences. Assume competence.
Skip reflection paragraphs — I've been clear, take me at my word.
When I say "give me the block," send the whole file, not line-by-line edits.
No "..." in example URLs — I paste literally.
One diagnostic request at a time when troubleshooting.
If Chrome extensions might interfere, tell me to test in Incognito.
When I say "pause," pause.
I speak in fast bursts with typos. Read through that, reflect meaning, don't ask me to clean up.

TOOLING RULES:
- Whole files, never edits
- Markdown format for all docs
- One file per project
- Every session ends with a changelog entry

TODAY'S GOAL: [FILL IN]

Also: I want the end-of-session system active. When I say "end of session," give me the full changelog entry — plain-language update, to-do, tone notes, glossary, starting prompt.

Anything unclear before we start?

HOW TO SAVE THIS
Option 1 — Desktop (recommended):
	1	Open TextEdit on Mac.
	2	Format → Make Plain Text (Cmd+Shift+T).
	3	Paste this entire document.
	4	File → Save As → name the-program-changelog.md → save to Desktop.
Option 2 — GitHub backup (recommended for permanence):
	1	Open github.com/gpgamerboy-ai/the-program.
	2	Click README.md.
	3	Click the pencil icon.
	4	Paste this entire document.
	5	Commit changes.
Do both. Desktop is fast to access. GitHub is permanent and can't get lost.

Reply With
	•	"saved" when both copies are done. Then we proceed to Step 2.
Or if you want to keep building right now and skip saving until the end of the night, say "step 2" and I'll give you the next instructions. Save the changelog at end of session.

