# How Notch plans a day: the research

Notch asks Gemini to plan your day. This document is the evidence behind the rules Gemini is given (the condensed version lives in `services/brainScience.js`). Every rule below says how strong its evidence is, because a lot of popular "brain productivity" advice is stronger in blog posts than in the literature.

**Read this first.** Brain imaging tells us which large-scale networks are *more active* during a kind of task. It does not say a task "uses only" one region, and nobody can measure your network fatigue from a to-do list. Notch uses networks as a practical way to group tasks that load the same kind of attention. These are evidence-informed scheduling heuristics, not medical advice.

---

## 1. The eight brain modes Notch sorts tasks into

The brain is better described as a set of large networks than as lobes doing jobs. Notch uses seven networks plus recovery:

| Mode | Network | Main regions | What it does | Typical tasks | Load |
|---|---|---|---|---|---|
| **Executive** | Frontoparietal control network ("multiple demand") | Dorsolateral prefrontal cortex, posterior parietal cortex | Holds rules and goals in mind, reasons, plans, inhibits distraction | Maths, coding, debugging, budgeting, exam questions, strategy, hard decisions | Very high |
| **Memory** | Hippocampal / medial temporal memory system | Hippocampus, medial temporal lobe, with prefrontal cortex | Encodes new material, retrieves it | Learning new material, flashcards, revision, learning lines, language practice | High |
| **Language** | Left-hemisphere language network | Left inferior frontal gyrus, left temporal cortex | Builds and understands sentences | Essays, reports, long emails, reading papers, editing | High |
| **Creative** | Default mode network coupled with the executive network | Medial prefrontal, posterior cingulate, lateral temporal and parietal cortex | Generates ideas by loose association, then judges them | Brainstorming, design, music, sketching, story ideas | Medium |
| **Social** | Mentalizing ("theory of mind") network | Medial prefrontal cortex, temporoparietal junction, precuneus | Models what other people think and feel | Calls, meetings, teaching, negotiating, caring for someone | Medium |
| **Movement** | Sensorimotor system | Motor cortex, cerebellum, basal ganglia | Coordinates the body | Gym, running, sport, yoga, cleaning, cooking | Low cognitive load (variable physical load) |
| **Autopilot** | Habit system | Dorsal striatum | Runs practised sequences with little conscious control | Chores, errands, quick admin, laundry, tidying | Very low |
| **Recovery** | Rest state | Default mode network at rest, parasympathetic nervous system | Lets directed attention recover | Walks outside, meals, naps, stretching | None |

Evidence:

- The language network, the theory-of-mind network and the "multiple demand" (executive) network are spatially and functionally separable, even though they sit next to each other in association cortex ([Hauptman, Blank & Fedorenko 2022](https://www.biorxiv.org/content/10.1101/2022.03.08.481056v1.full.pdf); [Fedorenko, Behr & Kanwisher 2011, PNAS](https://arxiv.org/pdf/2301.06627)). This is why "write an essay" and "solve a maths set" count as different modes even though both feel like "hard thinking".
- Social interaction consistently recruits the mentalizing network: bilateral TPJ, medial prefrontal cortex and posterior cingulate ([meta-analysis, Aperture Neuro](https://apertureneuro.org/article/138339-brain-bases-of-real-time-social-interaction-a-meta-analytic-investigation-of-human-neuroimaging-studies)).
- Creative thinking relies on cooperation between the default network (generating ideas) and the executive network (evaluating them), with the salience network switching between the two ([Beaty et al. 2015, Scientific Reports](https://www.nature.com/articles/srep10964); [Beaty et al. 2018, PNAS](https://www.pnas.org/doi/10.1073/pnas.1713532115)). Whether the division of labour is really this clean is still open.

---

## 2. Time of day: when each mode works best

### Attention follows a daily curve, anchored to *when you woke up*

- Attention is lowest in the first ~3 hours after your habitual wake time (circadian low plus sleep inertia). It peaks in hours 4–7 after waking, dips in hours 8–9 (the "post-lunch dip"), and peaks again in hours 10–15 ([Valdez 2019, Circadian Rhythms in Attention](https://pmc.ncbi.nlm.nih.gov/articles/PMC6430172/); [airport screener field study](https://www.sciencedirect.com/science/article/pii/S0169814124000945)).
- Time of day affects attention, executive function and memory, and chronotype shifts the curve: morning types do better early, evening types later ([Schmidt, Collette, Cajochen & Peigneux 2007](https://www.usailighting.com/stuff/contentmgr/files/1/d4a5e8097a28dd56c9843c79750baf9e/misc/timetothinkcircadian_schmidt.pdf)).
- Sleep loss deepens every trough: the morning low, the post-lunch dip and the first hours of the night (Valdez 2019).

**What Notch does.** It computes windows from your wake time, not the clock, so the same rules work for a nurse who wakes at 15:00. It puts Executive, Memory and Language work in the two peaks and keeps the first hours and the dip for Autopilot, Movement, Social and Recovery. For morning types it pulls the peaks a little earlier, for night owls a little later.

Evidence strength: **strong** for the existence of daily rhythms and chronotype effects; **moderate** for the exact hour windows, which vary between people and tasks.

### Creative insight works better at your *off-peak* time

People solved insight problems better at their non-optimal time of day, while analytic problems showed no consistent effect. The explanation offered is weaker inhibitory control, which lets "distracting" associations through ([Wieth & Zacks 2011, Thinking & Reasoning](https://www.researchgate.net/publication/254225496_Time_of_day_effects_on_problem_solving_When_the_non-optimal_is_optimal)).

**What Notch does.** It puts brainstorming and open-ended creative work in your off-peak window (evening for morning types, morning for night owls, or the post-lunch dip), and keeps *evaluating* and polishing creative work in a peak.

Evidence strength: **moderate** (one well-known study, consistent with related work by May et al. 2005).

### Physical strength and power peak late afternoon

Short, maximal efforts (sprints, jumps, max strength) are about 3–15% better in late afternoon or early evening than in the morning, tracking core body temperature, which peaks around 17:00–19:00. Endurance shows little time-of-day effect, and regular training at any time reduces the gap ([Examine summary](https://examine.com/faq/when-is-the-best-time-to-exercise-to-maximize-performance/); Atkinson & Reilly 1996).

**What Notch does.** Strength and sport sessions go late afternoon when possible. Light movement (walks, stretching, easy cardio) can go anywhere, especially in the morning low and the dip.

---

## 3. Fatigue: why the brain gets "tired" and what to do about it

- **Daylong hard control work builds up glutamate in the lateral prefrontal cortex.** After about six hours of high-demand control tasks, people had more glutamate in the lPFC (not in the visual cortex) and shifted toward low-effort, immediately rewarding choices, making roughly 10% more impulsive choices ([Wiehler et al. 2022, Current Biology](https://www.cell.com/current-biology/fulltext/S0960-9822(22)01111-3)). The link is correlational, not proven causal ([commentary](https://www.medicalnewstoday.com/articles/scientists-find-clues-that-may-explain-why-we-feel-tired-after-mentally-demanding-work)).
- **"Willpower as a fuel tank" (ego depletion) did not replicate.** A 23-lab preregistered replication with 2,141 people found essentially no effect ([Hagger et al. 2016](https://www.researchgate.net/publication/299470397_A_Multilab_Preregistered_Replication_of_the_Ego-Depletion_Effect)). So Notch doesn't model you as running out of willpower. It models *executive-network* load building up over a day of hard control work.
- **Sustained monitoring decays fast.** In vigilance tasks most of the drop in detection happens in the first ~30 minutes ([vigilance decrement, Mackworth](https://en.wikipedia.org/wiki/Vigilance_(psychology))).
- **The "90-minute focus cycle" is weak.** The 90-minute rhythm (Kleitman's basic rest–activity cycle) is clear in sleep. Daytime evidence is mixed, and some careful studies find no 90-minute wake cycle at all ([BRAC](https://en.wikipedia.org/wiki/Basic_rest%E2%80%93activity_cycle); [Penn State](https://pure.psu.edu/en/publications/ultradian-cognitive-performance-rhythms-during-sleep-deprivation/)).

**What Notch does.**

- Executive blocks are capped at about 60–90 minutes, with a 15–20 minute break after (a practical cap, not a claimed biological cycle).
- Total Executive time is kept to about 4 hours a day, mostly in the peaks.
- Monotonous monitoring or checking work is chunked into ≤30-minute pieces.
- Decisions that matter in the long run (money, plans, commitments) go *earlier* in the day, before lPFC fatigue biases you toward the easy, immediate option.
- The evening is for Autopilot, Social, Movement and light Memory review.

---

## 4. Clubbing tasks together: switch costs and attention residue

- **Every switch has a cost.** Switching between tasks costs time and accuracy. The cost grows with rule complexity and shrinks when you know what's next ([Rubinstein, Meyer & Evans 2001](https://www.apa.org/pubs/journals/releases/xhp274763.pdf); [APA summary](https://www.apa.org/topics/research/multitasking)). Each switch is small, but they add up. The often-quoted "40% productivity loss" is Meyer's estimate, not a finding of that paper.
- **Attention residue.** Part of your attention stays on the previous task, especially if it was left unfinished under time pressure, and this hurts the next task ([Leroy 2009](https://www.researchgate.net/publication/46489122_Why_is_it_so_Hard_to_do_My_Work_The_Challenge_of_Attention_Residue_when_Switching_Between_Work_Tasks)). Writing a quick "ready-to-resume" plan before switching reduces it (Leroy & Glomb 2018).
- **Language, social and executive networks are separable** (Section 1). Two tasks in the same network share setup: the rules, vocabulary and mental model are already loaded.

**What Notch does.**

1. It **clubs tasks of the same mode into one session** ("Executive sprint: calculus, then physics, then budget"), so you pay the setup cost once.
2. When it must switch, it prefers **cheap switches**: same network, or a move into a low-load mode (Executive → Movement is a rest; Executive → Creative is one of the most expensive switches).
3. It **finishes before it switches**. Tasks aren't split across the day unless they're longer than a sensible block.
4. It puts **a break or an Autopilot task between two heavy sessions in different networks**, which acts as a buffer for attention residue.

Evidence strength: **strong** for switch costs; **moderate** for attention residue; network grouping is a **reasonable extrapolation**, not a tested intervention.

---

## 5. Breaks: how long, how often, and what kind

- **Micro-breaks (≤10 minutes)** reliably increase vigor and reduce fatigue. They improve performance only on *less* demanding tasks. Longer breaks gave larger performance gains, and recovering from highly demanding tasks seems to need more than 10 minutes ([Albulescu et al. 2022, PLOS ONE](https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0272460&type=printable)).
- **Nature restores directed attention.** A ~50-minute walk in an arboretum improved backwards digit span by about 20%; an urban walk didn't ([Berman, Jonides & Kaplan 2008](https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02225.x)). The effect of merely *viewing* nature pictures has replicated poorly.
- **Exercise gives a short executive boost.** A single bout of exercise slightly improves cognition (meta-analysis of 79 studies), with the largest effect *after a delay* rather than during it. Sessions of at least ~11–20 minutes are needed, and the benefit lasts under about an hour ([Chang et al. 2012, Brain Research](https://www.sciencedirect.com/science/article/abs/pii/S0006899312004003)).

**What Notch does.**

| After | Break |
|---|---|
| Light work (Autopilot, Social) | 5 min micro-break, or none |
| 45–60 min of Language, Memory or Creative work | 10 min, away from the screen |
| 60–90 min of Executive work | 15–20 min, ideally a walk outside |
| A block of very hard work, around midday | 30–45 min meal break, in the dip |

It also puts **a demanding Executive or Memory task 15–60 minutes after moderate exercise**, to catch the post-exercise boost. Not straight after an all-out session: arousal settles in about 20 minutes.

---

## 6. Memory and learning

- **Spacing beats cramming.** Spaced retrieval practice beats massed practice (g ≈ 0.74), and testing yourself beats rereading (g ≈ 0.61) ([Latimier, Peyre & Ramus 2021](http://www.lscp.net/persons/ramus/docs/EPR20.pdf)).
- **Sleep consolidates learning.** During sleep the hippocampus replays new memories to the cortex. Learning, sleeping, then relearning halved the practice needed and improved retention at one week and six months ([Mazza et al. 2016, Psychological Science](https://www.hendrix.edu/uploadedFiles/Academics/Faculty_Resources/2016_FFC/Learn%20then%20sleep.pdf); [sleep-spindle meta-analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12507438/)).

**What Notch does.**

- New, hard learning goes in a peak (it needs Executive plus Memory).
- *Reviewing* with self-testing can go in the evening, 1–3 hours before sleep, so sleep consolidates it.
- A long study task is split into spaced sessions with self-testing rather than one marathon.

---

## 7. Turning the plan into action

- **If–then plans work.** Implementation intentions ("When X happens, I will do Y") improved goal attainment with a medium-to-large effect (d ≈ 0.65 across 94 tests). They help most with *starting* ([Gollwitzer & Sheeran 2006](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.565202/full)). A 2024 update covering 642 tests confirms the effect, though probably smaller for behaviour.

**What Notch does.** Every task gets a one-line cue: "When I sit down after breakfast, I'll open the calculus set." Starting is the hardest part, and the cue takes care of the decision for you.

---

## 8. Different people, different days

The same rules produce very different days, because the windows come from *your* wake time, chronotype and work. You tell Notch what you do; Gemini uses these patterns:

| Person | What their mind is mostly doing | What Notch adapts |
|---|---|---|
| **Student** | Memory and Executive (learning, problem sets), Language (essays) | Hardest subject in the first peak; spaced self-testing; review before sleep; exercise before a study block; no all-night cramming |
| **Software engineer** | Executive (debugging, design), Language (docs, review), Social (stand-ups) | Protects a 2–3 h deep Executive block in the peak; clubs meetings and messages together; code review in the second peak; admin in the dip |
| **Doctor / nurse / shift worker** | Social (patients), Executive under pressure, Memory (protocols) | Windows from *actual* wake time, even for night shifts; high-stakes decisions early in the shift; no hard learning in the circadian low (early-morning hours of a night shift); protects post-shift sleep |
| **Parent at home** | Social (caring), Autopilot (household), short Executive bursts | Hard tasks in short windows (naps, school hours); household jobs clubbed into autopilot runs; realistic short blocks |
| **Creative / designer / musician** | Creative (generation), Executive (critique), Motor (instrument) | Ideation off-peak, critique and polishing at peak, deliberate practice at peak, admin clubbed into one block |
| **Manager / founder** | Social (meetings), Executive (decisions), Language (writing) | Meetings clubbed back-to-back in one half of the day; strategy and big decisions early; email batched 2–3 times, never sprinkled |
| **Tradesperson / physical worker** | Movement and spatial Executive | Planning and quotes before physical work starts or after recovery; breaks for body *and* attention |
| **Athlete / training hard** | Movement, Memory (technique) | Strength and speed late afternoon; technique learning when fresh; recovery after hard sessions before cognitive work |

---

## 9. Priority: how Gemini decides High, Medium and Low

Brain timing decides *when*; priority decides *what has to happen*. Gemini sorts every task like an assistant would:

- **High.** A hard deadline today or tomorrow, real consequences if missed (money, health, legal, someone waiting on you), or a big lever on what you're trying to achieve (an exam, a launch, an interview).
- **Medium.** Important but flexible: progress on long projects, health habits, maintenance that will hurt if skipped for days.
- **Low.** Nice to have, can move to another day with no real cost.

Rules:

1. Priority decides what gets scheduled at all. If the day is too full, Low tasks are deferred first, and Gemini says so.
2. High tasks get the best brain window for their mode, not just the earliest slot.
3. Fixed appointments ("meeting at 3") are placed exactly at that time, and everything else is arranged around them.

---

## 10. Where this is honest about its limits

- Network labels are about which systems are most involved, not exclusive.
- The time windows are averages. If your energy in a slot doesn't match, tell Notch to replan; it starts again from the current time.
- None of this is medical advice. Persistent fatigue, poor sleep or trouble concentrating are worth raising with a doctor.
