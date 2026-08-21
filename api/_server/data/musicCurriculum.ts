// Curated music syllabus topic trees, served by POST /api/generation/syllabus for
// music syllabi instead of AI generation (deterministic, instant, no API key needed).
//
// Indian Music content is transcribed from the official Akshara Fine Arts curriculum
// documents (Sangeetham/Mridangam/Keyboard/Harmonium 10-grade frameworks). Western
// Music content is authored in ABRSM/Trinity graded style.
//
// Topic strings follow the exact format the frontend already consumes from /syllabus:
//   "Topic N: Name (Subtopic A, Subtopic B, ...)"
// Keys must match the Subject/Syllabus enum strings in types.ts.
// Served in English for every UI language — Carnatic and ABRSM terminology does not translate.

type GradeTopics = Record<string, string[]>;
type TopicMap = Record<string, GradeTopics>;

// ─── Indian Music (Carnatic) — Akshara Fine Arts ────────────────────────────────

const SANGEETHAM: GradeTopics = {
    'Grade 1': [
        'Topic 1: Shruti Basics (Meaning of Shruti, mother of music, sound vs musical pitch)',
        'Topic 2: Voice Preparation (Sitting posture, open throat, relaxed jaw, steady breath)',
        'Topic 3: Sapta Swaras (Sa Ri Ga Ma Pa Da Ni, ascending and descending order)',
        'Topic 4: Arohanam and Avarohanam (Upward and downward swara movement)',
        'Topic 5: Tala Introduction (Meaning of tala, clapping method, counting beats, steady time)',
        'Topic 6: Adi Tala Introduction (8-beat structure, Laghu, Drutam, counting 1 to 8)',
        'Topic 7: Beginner Listening (Recognising high and low pitch, matching the teacher’s Sa)',
        'Topic 8: Practice Discipline (Daily Shruti practice, swara practice, listening homework)'
    ],
    'Grade 2': [
        'Topic 1: Sarali Varisai (Meaning and purpose, first swara exercise, voice training)',
        'Topic 2: Mayamalavagowla Scale (Swaras, Arohanam, Avarohanam, why beginners use this raga)',
        'Topic 3: Swara Clarity (Clean Sa Ri Ga Ma, clear vowel sound, not swallowing notes)',
        'Topic 4: Laya Basics (Equal gap between swaras, not rushing, not dragging)',
        'Topic 5: Adi Tala with Sarali (Singing while putting tala, matching swara to beat)',
        'Topic 6: Kalapramanam (Meaning of speed, first speed, second speed introduction)',
        'Topic 7: Listening and Correction (Identifying flat notes, sharp notes, broken rhythm)',
        'Topic 8: Practice Method (Slow practice, phrase practice, teacher-follow method)'
    ],
    'Grade 3': [
        'Topic 1: Janta Varisai (Repeated swaras, double-note singing, strengthening the voice)',
        'Topic 2: Voice Stability (Same pitch repetition, avoiding shaking, maintaining Shruti)',
        'Topic 3: Swara Pressure (Strength vs shouting, balanced sound production)',
        'Topic 4: Gamaka Preparation (Plain note vs curved note, why some notes need life)',
        'Topic 5: Tala Stability (Singing repeated notes without disturbing the beat)',
        'Topic 6: Speed Development (Clarity in first and second speed, keeping Shruti)',
        'Topic 7: Breath Management (Where to breathe, completing a pattern without breaking)',
        'Topic 8: Common Janta Mistakes (Unequal repetition, wrong pitch, rushing the second note)'
    ],
    'Grade 4': [
        'Topic 1: Dhatu Varisai (Jumping swaras, non-linear movement, Sarali vs Dhatu)',
        'Topic 2: Swara Navigation (Skipping notes, returning to base swara, accuracy)',
        'Topic 3: Mental Concentration (Swara memory, predicting the next note)',
        'Topic 4: Voice Flexibility (Smooth jumps low to high and high to low)',
        'Topic 5: Dhatu with Adi Tala (Keeping tala while singing non-linear patterns)',
        'Topic 6: Raga Sense (Mayamalavagowla identity within jumping patterns)',
        'Topic 7: Listening Skill (Detecting wrong jumps, correcting through slow practice)',
        'Topic 8: Practice Strategy (Chunking method, breaking long patterns into phrases)'
    ],
    'Grade 5': [
        'Topic 1: Alankaram (Decorative swara patterns, bridge to Geetham)',
        'Topic 2: Sapta Tala (Dhruva, Matya, Rupaka, Jhampa, Triputa, Ata, Eka)',
        'Topic 3: Tala Angas (Laghu, Drutam, Anudrutam, hand gestures)',
        'Topic 4: Jathi Introduction (Tisra, Chatusra, Khanda, Misra, Sankeerna)',
        'Topic 5: Adi Tala Deeper Study (Why Adi Tala is Chatusra Jathi Triputa Tala)',
        'Topic 6: Swara-Tala Alignment (Matching each swara to the tala count)',
        'Topic 7: Speed Control (First, second and third speed awareness)',
        'Topic 8: Discipline in Practice (Accuracy before speed, why Alankaram must not be rushed)'
    ],
    'Grade 6': [
        'Topic 1: Geetham (Simple composition, bridge from exercise to song)',
        'Topic 2: Types of Geetham (Samanya Geetham, Lakshana Geetham, differences)',
        'Topic 3: Sahitya Introduction (Lyrics, pronunciation, meaning, emotional connection)',
        'Topic 4: Raga Lakshana (Arohanam, Avarohanam, important swaras, simple raga phrases)',
        'Topic 5: Tala in Composition (Keeping tala while singing lyrics and swaras)',
        'Topic 6: Swara-Sahitya Link (How words sit on notes, syllable awareness)',
        'Topic 7: Memorisation (Phrase-by-phrase learning, repetition, correction)',
        'Topic 8: Bhava Introduction (Singing with simple feeling, not flat recitation)'
    ],
    'Grade 7': [
        'Topic 1: Varnam (Why Varnam is central to Carnatic training, voice development)',
        'Topic 2: Varnam Structure (Pallavi, Anupallavi, Mukthayi Swaram, Charanam, Chitta Swaram)',
        'Topic 3: Raga Development (Signature phrases, important prayogas, raga colour)',
        'Topic 4: Tala Discipline (Long-form tala control, maintaining speed and structure)',
        'Topic 5: Swara-Sahitya Balance (Switching between swara and lyrics confidently)',
        'Topic 6: Stamina Training (Singing a full Varnam without losing Shruti or energy)',
        'Topic 7: Gamaka Application (Basic gamakas suitable for the raga)',
        'Topic 8: Performance Preparation (Starting pitch, tala confidence, memory, presentation)'
    ],
    'Grade 8': [
        'Topic 1: Kriti (Difference between Geetham, Varnam and Kriti)',
        'Topic 2: Kriti Structure (Pallavi, Anupallavi, Charanam)',
        'Topic 3: Composer Study (Tyagaraja, Muthuswami Dikshitar, Syama Sastri, Purandaradasa)',
        'Topic 4: Sahitya Meaning (Word meaning, devotional meaning, pronunciation)',
        'Topic 5: Raga Bhava (How raga supports meaning, mood of the composition)',
        'Topic 6: Sangati (Meaning of sangati, gradual variation development)',
        'Topic 7: Tala and Eduppu (Samam, Ateeta Eduppu, Anagata Eduppu)',
        'Topic 8: Presentation Skill (Shruti, tala, bhava, clarity, ending a Kriti properly)'
    ],
    'Grade 9': [
        'Topic 1: Manodharma Introduction (Creative music, learnt vs created music)',
        'Topic 2: Raga Alapana (Exploring raga without tala, building mood, raga identity)',
        'Topic 3: Raga Lakshana (Arohanam, Avarohanam, jeeva swaras, nyasa swaras, prayogas)',
        'Topic 4: Phrase Building (Starting from simple phrases, expanding naturally)',
        'Topic 5: Gamaka Development (Correct gamaka usage, avoiding mechanical notes)',
        'Topic 6: Voice Flow (Breath and continuity, smooth movement, maintaining tone)',
        'Topic 7: Listening Analysis (Learning from masters, identifying phrases, comparing styles)',
        'Topic 8: Short Alapana Practice (1-minute and 2-minute alapana, ending on a stable swara)'
    ],
    'Grade 10': [
        'Topic 1: RTP Introduction (Ragam, Tanam, Pallavi as the advanced Carnatic form)',
        'Topic 2: Ragam (Detailed raga exploration, gradual development, emotional depth)',
        'Topic 3: Tanam (Syllabic melodic movement, pulse without fixed tala, voice control)',
        'Topic 4: Pallavi (Meaning, structure, sahitya, tala placement)',
        'Topic 5: Neraval (Improvising on a line, maintaining sahitya, raga and tala discipline)',
        'Topic 6: Kalpana Swaram (Creative swara patterns, ending correctly, eduppu control)',
        'Topic 7: Laya Complexity (Gati, nadai, kanakku, kuraippu basics)',
        'Topic 8: Concert Presentation (Confidence, planning, stage discipline, respecting tradition)'
    ]
};

const MRIDANGAM: GradeTopics = {
    'Grade 1': [
        'Topic 1: Introduction to Mridangam (Role in Carnatic music, percussion and accompaniment)',
        'Topic 2: Parts of the Mridangam (Right side head, left side head, black central spot, body, straps)',
        'Topic 3: Sitting Posture and Placement (Cross-legged posture, straight back, stable placement)',
        'Topic 4: Hand Position (Right and left hand position, finger curve, wrist relaxation)',
        'Topic 5: Basic Strokes (Tha, Dhi, Nam, Thom, Chapu)',
        'Topic 6: Right-Hand and Left-Hand Practice (Single strokes, Tha Dhi Tha Dhi, Thom Thom patterns)',
        'Topic 7: Combined Hand Practice (Tha Thom, Dhi Thom, Tha Dhi Thom Nam)',
        'Topic 8: Basic Sollukattu (Tha Ka, Tha Ki Ta, Tha Ka Dhi Mi, Tha Ri Ki Ta)',
        'Topic 9: Adi Tala Awareness (8-count hand actions, clap, finger counts, wave)'
    ],
    'Grade 2': [
        'Topic 1: Level 1 Revision (Strokes, posture, basic sollukattu)',
        'Topic 2: Chatusra Nadai (Meaning of 4-count subdivision)',
        'Topic 3: Sarvalaghu (Meaning, smooth rhythm flow, rhythm walking)',
        'Topic 4: Akshara and Matra Awareness (Counting units inside the tala)',
        'Topic 5: Adi Tala in Chatusra Nadai (Playing 4-count flow inside 8 beats)',
        'Topic 6: Chatusra Sollukattu (Tha Ka Dhi Mi, Tha Ri Ki Ta, Tha Ka Thom Nam, Tha Dhi Thom Nam)',
        'Topic 7: Sarvalaghu Lesson Groups (4-syllable and 8-syllable sarvalaghu, mixed flow)',
        'Topic 8: Right-Left Coordination (Bass and treble balance, steady tempo, no rushing)'
    ],
    'Grade 3': [
        'Topic 1: Meaning of Jathi (Rhythmic grouping and count structure)',
        'Topic 2: Tisra Jathi (3 counts, Tha Ki Ta)',
        'Topic 3: Chatusra Jathi (4 counts, Tha Ka Dhi Mi)',
        'Topic 4: Khanda Jathi (5 counts, Tha Ka Tha Ki Ta)',
        'Topic 5: Misra Jathi Introduction (7 counts, Tha Ki Ta Tha Ka Dhi Mi)',
        'Topic 6: Sollu and Sollukattu (Rhythmic syllables, recite before playing)',
        'Topic 7: Both-Hand Jathi Coordination (Fingering changes across groupings, steady laya)',
        'Topic 8: Question-and-Answer Rhythm (Short call-and-response phrases)'
    ],
    'Grade 4': [
        'Topic 1: Kalapramanam (Meaning of tempo discipline)',
        'Topic 2: First Speed (Slow, clear stroke placement)',
        'Topic 3: Second Speed (Doubling while keeping clarity)',
        'Topic 4: Third Speed Introduction (Controlled fast playing)',
        'Topic 5: Speed vs Rushing (Difference between speed and losing control)',
        'Topic 6: Multi-Speed Recitation (Voice recitation in multiple speeds)',
        'Topic 7: Speed Practice Across Jathis (Chatusra, Tisra, Khanda and mixed patterns in Adi Tala)',
        'Topic 8: Starting and Ending Correctly (Clean ending on samam)'
    ],
    'Grade 5': [
        'Topic 1: Tala and Alankara (Rhythmic cycle, structured patterns inside talas)',
        'Topic 2: Tala Angas (Laghu, Dhrutam, Anudhrutam, hand actions)',
        'Topic 3: Sapta Tala (Dhruva, Matya, Rupaka, Jhampa, Triputa, Ata, Eka)',
        'Topic 4: Important Talas (Adi Tala, Rupaka Tala, Eka Tala, Misra Chapu, Khanda Chapu)',
        'Topic 5: Akshara and Matra (Counting structure inside tala cycles)',
        'Topic 6: Fitting Jathi into Tala (Where the sollu sits inside the tala)',
        'Topic 7: Rhythmic Placement (Starting and ending patterns on samam)',
        'Topic 8: Fingering and Sound Clarity (Clean strokes inside tala cycles)'
    ],
    'Grade 6': [
        'Topic 1: Meaning of Eduppu (Starting point of a phrase in the tala cycle)',
        'Topic 2: Samam, Ateeta and Anagata Eduppu (On the beat, before the beat, after the beat)',
        'Topic 3: Meaning of Arudi (Rhythmic resting point)',
        'Topic 4: Role of Mridangam in Accompaniment (Musical service, not showing off)',
        'Topic 5: Simple Song Support Patterns (Sarvalaghu for songs)',
        'Topic 6: Playing for Geetham-Type Compositions (Supporting simple compositions)',
        'Topic 7: Listening Skill (Following the main artist while playing)',
        'Topic 8: Volume Control, Silence and Space (Soft balanced accompaniment, avoiding overplaying)'
    ],
    'Grade 7': [
        'Topic 1: Meaning of Mora (Structured ending pattern)',
        'Topic 2: Three-Time Repetition Method (Repeating a phrase three times to land)',
        'Topic 3: Meaning of Korvai (Composed rhythmic structure)',
        'Topic 4: Difference Between Mora and Korvai',
        'Topic 5: Meaning of Kanakku (Rhythmic calculation, counting phrase length)',
        'Topic 6: Simple Kanakku (Tha Ka Dhi Mi x3 = 12, Tha Ki Ta x3 = 9, Tha Ka Tha Ki Ta x3 = 15)',
        'Topic 7: Landing on Samam (Counting, saying, then playing)',
        'Topic 8: Endings After Sarvalaghu (Clean simple endings without rushing)'
    ],
    'Grade 8': [
        'Topic 1: Meaning of Nadai (Rhythmic gait, subdivision of the beat)',
        'Topic 2: Nadai Bhedam (Changing the rhythmic texture without losing the tala)',
        'Topic 3: Difference Between Jathi and Nadai (Count shape vs how the beat walks)',
        'Topic 4: The Five Nadais (Tisra 3, Chatusra 4, Khanda 5, Misra 7, Sankirna 9)',
        'Topic 5: Nadai Transitions (Chatusra to Tisra, Chatusra to Khanda)',
        'Topic 6: Laya Stability (Keeping the tala steady during subdivision changes)',
        'Topic 7: Fingering for Nadai Patterns (Correct fingering per subdivision)',
        'Topic 8: Nadai Patterns in Adi Tala (Applying subdivision changes inside the cycle)'
    ],
    'Grade 9': [
        'Topic 1: Structure of a Kriti (Pallavi, Anupallavi, Charanam and the Mridangam role in each)',
        'Topic 2: Meaning of Sangati (Phrase development and variation support)',
        'Topic 3: Kriti Eduppu and Arudi (Correct entry and resting points in compositions)',
        'Topic 4: Sarvalaghu for Kriti Accompaniment (Playing according to song mood)',
        'Topic 5: Kalpana Swaram Support (Responding to creative swara singing)',
        'Topic 6: Neraval Support (Sensitive accompaniment for improvised lines)',
        'Topic 7: Accompanying Different Instruments (Vocal, Veena, Keyboard, group singing)',
        'Topic 8: Concert Etiquette (Volume, tone control, stage discipline)'
    ],
    'Grade 10': [
        'Topic 1: Meaning of Tani Avartanam (The percussion solo in a Carnatic concert)',
        'Topic 2: Tani Avartanam Structure (Opening sarvalaghu, development, nadai variation, kuraippu, mora, korvai, return)',
        'Topic 3: Sarvalaghu Development (Expanding rhythmic ideas gradually)',
        'Topic 4: Nadai Variation in Tani (Tasteful subdivision changes)',
        'Topic 5: Kuraippu (Systematically reducing phrase length)',
        'Topic 6: Advanced Mora and Korvai (Calculated endings, correct landing)',
        'Topic 7: Ragam-Tanam-Pallavi Support (Pallavi eduppu, arudi, trikalam awareness)',
        'Topic 8: Professional Concert Etiquette (When to play, what to play, how much, when to stop)'
    ]
};

const KEYBOARD_CARNATIC: GradeTopics = {
    'Grade 1': [
        'Topic 1: Instrument Care and Posture (Safe handling, sitting position, relaxed shoulders)',
        'Topic 2: Finger Numbers and Hand Position (Thumb 1 to little finger 5, curved fingers, neutral wrist)',
        'Topic 3: Keyboard Layout (White and black keys, groups of two and three black keys)',
        'Topic 4: Sapta Swaras on the Keyboard (Sa Ri Ga Ma Pa Da Ni orientation)',
        'Topic 5: Selected Tonic (Sa = E, why Sa must be declared)',
        'Topic 6: Five-Finger Swara Patterns (Simple right-hand patterns)',
        'Topic 7: Basic Pulse (Steady counting, short continuous exercises)'
    ],
    'Grade 2': [
        'Topic 1: Sarali Varisai on Keyboard (First swara exercises)',
        'Topic 2: Janta Varisai (Repeated-note control)',
        'Topic 3: Sthayi Development (Tara Sa, octave awareness)',
        'Topic 4: Tonic Mapping (Sa = E and Sa = G, locating swaras from a stated tonic)',
        'Topic 5: Left-Hand Tonic Support (Single Sa or Pa support)',
        'Topic 6: Second Speed Introduction (Playing patterns in two speeds)'
    ],
    'Grade 3': [
        'Topic 1: Dhatu Varisai (Jumping swara patterns on keys)',
        'Topic 2: Three Sthayis (Mandra, Madhya, Tara awareness)',
        'Topic 3: Thumb Crossing (Introductory crossing technique)',
        'Topic 4: Alankaram (Selected Alankarams on keyboard)',
        'Topic 5: Sapta Tala (Seven talas and their structure)',
        'Topic 6: Two-Hand Coordination (Two-hand independence foundations)'
    ],
    'Grade 4': [
        'Topic 1: Geetham on Keyboard (Playing simple compositions)',
        'Topic 2: Raga Identity (Arohanam, Avarohanam, recognising the raga)',
        'Topic 3: Phrase Fingering (Fingering chosen to protect the phrase)',
        'Topic 4: Grace Notes (Introductory ornamentation)',
        'Topic 5: Sa-Pa Drone (Left-hand drone support)',
        'Topic 6: Transposition Introduction (Moving phrases to a new Sa)'
    ],
    'Grade 5': [
        'Topic 1: Jatiswaram (Structure and performance)',
        'Topic 2: Swarajati (Structure and performance)',
        'Topic 3: Raga Classification (Grouping and identifying ragas)',
        'Topic 4: Position Shifts and Substitution (Moving hand positions smoothly)',
        'Topic 5: Three Speeds (First, second and third speed control)',
        'Topic 6: Octave Support and Dynamics (Left-hand octaves, volume shaping, group playing)'
    ],
    'Grade 6': [
        'Topic 1: Varnam on Keyboard (Varnam fingering and stamina)',
        'Topic 2: 72-Melakarta Introduction (The Melakarta system)',
        'Topic 3: Twelve Swarasthanas (Semitone positions, shared positions R2/G1, R3/G2, D2/N1, D3/N2)',
        'Topic 4: M1 and M2 (Shuddha and Prati Madhyama recognition)',
        'Topic 5: Transposition (Playing in different tonics)',
        'Topic 6: Gamaka Approximation (Suggesting gamakas within keyboard limits)'
    ],
    'Grade 7': [
        'Topic 1: Kriti on Keyboard (Kriti fingering and structure)',
        'Topic 2: Sangati and Sahitya (Variations and lyric awareness)',
        'Topic 3: Eduppu (Correct entry points)',
        'Topic 4: Composer Study (Tyagaraja, Muthuswami Dikshitar, Syama Sastri)',
        'Topic 5: Accompaniment Skills (Supporting a vocalist, Bhajan accompaniment)',
        'Topic 6: Kalpana Swara Introduction (Introductory creative swara playing)'
    ],
    'Grade 8': [
        'Topic 1: Raga Lakshana (Grammar and identity of ragas)',
        'Topic 2: Janya and Vakra Forms (Derived and zigzag raga structures)',
        'Topic 3: Short Alapana (Free raga exploration on keyboard)',
        'Topic 4: Developed Kalpana Swara (Creative swara patterns with correct endings)',
        'Topic 5: Gamaka Strategy (Planning ornaments for raga identity)',
        'Topic 6: Ensemble Response (Reacting musically within a group)'
    ],
    'Grade 9': [
        'Topic 1: Advanced Varnam and Kriti (Advanced repertoire and register control)',
        'Topic 2: Alapana Development (Extended raga exploration)',
        'Topic 3: Kalpana Swara (Advanced creative swara playing)',
        'Topic 4: Korappu (Structured rhythmic-melodic reduction)',
        'Topic 5: Concert Accompaniment (Supporting concert items)',
        'Topic 6: Keyboard Controls and Planning (Sound settings, concert preparation)'
    ],
    'Grade 10': [
        'Topic 1: Concert Repertoire (Complete concert-level pieces)',
        'Topic 2: Advanced Manodharma (Independent creative performance)',
        'Topic 3: RTP Awareness (Ragam, Tanam, Pallavi support)',
        'Topic 4: All 72 Melakartas (Complete Melakarta command)',
        'Topic 5: Professional Accompaniment (Concert-grade support)',
        'Topic 6: Ensemble Leadership (Leading and presenting professionally)'
    ]
};

const HARMONIUM: GradeTopics = {
    'Grade 1': [
        'Topic 1: Introduction to Harmonium (Keyboard, bellows, reeds, airflow, how sound is produced)',
        'Topic 2: Main Instrument Parts (White keys, black keys, bellows, stops, drone knobs, lid)',
        'Topic 3: Safe Opening, Closing and Care (Correct sequence, storage, clean and safe habits)',
        'Topic 4: Sitting Posture and Placement (Upright spine, relaxed shoulders, centre position, keyboard reach)',
        'Topic 5: Left-Hand Bellows Control (Opening and closing gently, sustained airflow, air-pressure awareness)',
        'Topic 6: Right-Hand Position and Finger Numbers (Curved fingers, neutral wrist, thumb 1 to little finger 5)',
        'Topic 7: Keyboard Layout and Pitch Direction (Black-key groups, higher and lower sound direction)',
        'Topic 8: Selected Tonic and First Swaras (Sa = E, Sa = G, Sa-Pa-upper Sa, introductory S R G M)',
        'Topic 9: Mayamalavagowla Awareness (Introductory Sa, R1, G3, M1 recognition)',
        'Topic 10: Four-Count Pulse and Listening Discipline (Steady count, matching Sa, teacher-led response)'
    ]
    // Grades 2-10: the official Akshara grade breakdown is not yet available —
    // these fall through to AI generation with the Carnatic prompt rules.
};

// ─── Western Music (ABRSM/Trinity-style, authored) ──────────────────────────────

const WESTERN_THEORY: GradeTopics = {
    'Grade 1': [
        'Topic 1: Note Values (Semibreve, minim, crotchet, quaver, tied notes, dotted notes)',
        'Topic 2: Rests (Semibreve, minim, crotchet and quaver rests)',
        'Topic 3: Time Signatures (2/4, 3/4, 4/4, bar lines, grouping of notes)',
        'Topic 4: The Treble Clef (Note names on lines and spaces, middle C)',
        'Topic 5: The Bass Clef (Note names on lines and spaces)',
        'Topic 6: Accidentals (Sharp, flat and natural signs)',
        'Topic 7: Major Scales and Key Signatures (C, G, D and F major)',
        'Topic 8: Tonic Triads (Root position triads of C, G, D and F major)',
        'Topic 9: Basic Terms and Signs (Dynamics p to f, tempo terms, slurs and ties)'
    ],
    'Grade 2': [
        'Topic 1: New Note Values (Semiquavers, dotted quavers, grouping in simple time)',
        'Topic 2: Ledger Lines (Notes above and below the staff)',
        'Topic 3: New Time Signatures (2/2, 3/2, 4/2 and 3/8)',
        'Topic 4: Major Keys to Two Sharps and Flats (A, B flat and E flat major)',
        'Topic 5: Minor Scales Introduction (A, E and D minor, harmonic form)',
        'Topic 6: Intervals by Number (2nd to octave above the tonic)',
        'Topic 7: Triplets (Grouping three notes in the time of two)',
        'Topic 8: Tonic Triads of New Keys (Major and minor tonic triads)',
        'Topic 9: More Terms and Signs (Tempo changes, articulation, dynamics pp to ff)'
    ],
    'Grade 3': [
        'Topic 1: Compound Time (6/8, 9/8, 12/8, grouping and dotted rhythms)',
        'Topic 2: Demisemiquavers (Very short note values and rests)',
        'Topic 3: Major Keys to Four Sharps and Flats (E, A flat major and relatives)',
        'Topic 4: Minor Scales (Harmonic and melodic forms, key signatures)',
        'Topic 5: Intervals by Number and Quality (Major, minor and perfect intervals above the tonic)',
        'Topic 6: Transposition at the Octave (Rewriting melodies an octave up or down)',
        'Topic 7: Four-Bar Rhythm Writing (Completing a rhythm in a given time signature)',
        'Topic 8: Phrase Structure (Question and answer phrases, anacrusis)'
    ],
    'Grade 4': [
        'Topic 1: The Chromatic Scale (Construction and notation)',
        'Topic 2: Double Sharps and Double Flats (Enharmonic equivalents)',
        'Topic 3: Major and Minor Keys to Five Sharps and Flats',
        'Topic 4: Technical Names of Scale Degrees (Tonic, supertonic, mediant, subdominant, dominant)',
        'Topic 5: All Intervals Within an Octave (Including augmented and diminished)',
        'Topic 6: Triads and Chords (Tonic, subdominant and dominant triads, chord identification)',
        'Topic 7: Duplets and Swung Rhythms (Irregular note groupings)',
        'Topic 8: The Alto Clef Introduction (Reading simple melodies in C clef)'
    ],
    'Grade 5': [
        'Topic 1: Irregular Time Signatures (5/4, 7/4, 5/8 and irregular groupings)',
        'Topic 2: All Major and Minor Keys (Up to six sharps and flats, circle of fifths)',
        'Topic 3: The Tenor Clef (Reading and transposing in all four clefs)',
        'Topic 4: Transposition for Orchestral Instruments (Transposing by major 2nd, minor 3rd, perfect 5th)',
        'Topic 5: Compound Intervals (Intervals larger than an octave)',
        'Topic 6: Chords and Inversions (Tonic, supertonic, subdominant, dominant chords in inversion)',
        'Topic 7: Cadence Recognition (Perfect, imperfect and plagal cadences)',
        'Topic 8: Ornaments and Musical Signs (Trill, turn, mordent, acciaccatura, appoggiatura)',
        'Topic 9: Instruments of the Orchestra (Families, ranges and transposing instruments)'
    ],
    'Grade 6': [
        'Topic 1: Harmonic Vocabulary (Diatonic chords in root position and inversions, figured indications)',
        'Topic 2: Cadences and Progressions (Perfect, imperfect, plagal, interrupted cadences)',
        'Topic 3: Melody Writing (Composing a balanced melody for a given opening)',
        'Topic 4: Figuration and Non-Chord Notes (Passing notes, auxiliary notes, suspensions)',
        'Topic 5: Score Reading (Short and open scores, SATB layout)',
        'Topic 6: Baroque and Classical Style (Composers, forms and characteristics)',
        'Topic 7: Analysis of Short Pieces (Keys, modulations, chords and structure)'
    ],
    'Grade 7': [
        'Topic 1: Advanced Harmony (Secondary dominants, dominant sevenths, modulation to related keys)',
        'Topic 2: Continuing a Bass Line or Melody (Stylistic completion exercises)',
        'Topic 3: Counterpoint Basics (Two-part writing, contrary and parallel motion)',
        'Topic 4: Romantic Period Style (Composers, harmony and expression)',
        'Topic 5: Orchestration Awareness (Instrumental colour, reading full scores)',
        'Topic 6: Analysis of Extended Passages (Modulation paths, thematic development)',
        'Topic 7: Historical Context (Performance practice across periods)'
    ],
    'Grade 8': [
        'Topic 1: Chromatic Harmony (Neapolitan sixth, augmented sixth chords, diminished sevenths)',
        'Topic 2: Advanced Modulation (Distant keys, enharmonic modulation)',
        'Topic 3: Completing a Passage in Style (Baroque chorale or trio sonata textures)',
        'Topic 4: Twentieth-Century Techniques (Modes, whole-tone and pentatonic scales, serial ideas)',
        'Topic 5: Full Score Analysis (Orchestral scores, transposing instruments at pitch)',
        'Topic 6: Composers and Repertoire Across History (Medieval to contemporary overview)',
        'Topic 7: Form and Structure (Sonata form, rondo, variations, fugue)'
    ]
};

const PIANO: GradeTopics = {
    'Grade 1': [
        'Topic 1: Posture and Hand Position (Sitting height, curved fingers, relaxed wrist)',
        'Topic 2: Note Reading (Treble and bass clef within an octave of middle C)',
        'Topic 3: Five-Finger Patterns (Legato and staccato touch)',
        'Topic 4: Scales (C, G major hands separately, one octave)',
        'Topic 5: Broken Chords (Simple broken triads, hands separately)',
        'Topic 6: Rhythm Basics (Crotchets, minims, quavers, steady pulse)',
        'Topic 7: Dynamics and Expression (Piano, forte, crescendo, diminuendo)',
        'Topic 8: Simple Repertoire (Short pieces in C and G major)'
    ],
    'Grade 2': [
        'Topic 1: Scales (Major and minor scales to two sharps and flats, hands separately)',
        'Topic 2: Broken Chords and Arpeggio Preparation',
        'Topic 3: Hands-Together Coordination (Simple two-hand textures)',
        'Topic 4: Articulation (Slurs, staccato, accents, phrasing)',
        'Topic 5: Sight-Reading Basics (Simple five-finger position pieces)',
        'Topic 6: Aural Skills (Echo clapping, pitch matching, recognising dynamics)',
        'Topic 7: Repertoire (Contrasting pieces from different periods)'
    ],
    'Grade 3': [
        'Topic 1: Scales (Major and minor to four sharps and flats, hands together, two octaves)',
        'Topic 2: Arpeggios (Root position, hands separately)',
        'Topic 3: Chromatic Scale (Beginning on any note)',
        'Topic 4: Finger Independence (Voicing, evenness, thumb-under technique)',
        'Topic 5: Pedalling Introduction (Simple sustain pedal use)',
        'Topic 6: Sight-Reading (Simple pieces with hand position changes)',
        'Topic 7: Repertoire (Baroque, Classical and modern pieces)'
    ],
    'Grade 4': [
        'Topic 1: Scales and Arpeggios (Most major and minor keys, two octaves hands together)',
        'Topic 2: Alberti Bass and Accompaniment Figures',
        'Topic 3: Ornaments (Trills, mordents, grace notes)',
        'Topic 4: Pedalling Technique (Legato pedalling, syncopated pedalling)',
        'Topic 5: Tone Control (Cantabile melody over accompaniment)',
        'Topic 6: Sight-Reading (Keys to three sharps and flats)',
        'Topic 7: Repertoire (Contrasting styles with character and expression)'
    ],
    'Grade 5': [
        'Topic 1: Scales (All keys, four octaves preparation, contrary motion)',
        'Topic 2: Arpeggios and Dominant Sevenths',
        'Topic 3: Velocity and Evenness (Faster passagework, rotation technique)',
        'Topic 4: Rubato and Romantic Phrasing',
        'Topic 5: Balance Between Hands (Voicing melody in chordal textures)',
        'Topic 6: Sight-Reading (Moderate difficulty with pedal)',
        'Topic 7: Repertoire (Sonatina movements, Romantic character pieces)'
    ],
    'Grade 6': [
        'Topic 1: Advanced Scales (Thirds, staccato scales, all keys)',
        'Topic 2: Arpeggios in Inversions',
        'Topic 3: Polyphonic Playing (Two- and three-part Baroque textures)',
        'Topic 4: Advanced Pedalling (Half pedal, una corda)',
        'Topic 5: Structural Interpretation (Sonata form awareness in performance)',
        'Topic 6: Sight-Reading (Full textures with expression)',
        'Topic 7: Repertoire (Bach inventions, Classical sonatas, Romantic and modern works)'
    ],
    'Grade 7': [
        'Topic 1: Virtuosic Technique Foundations (Octaves, double notes, leaps)',
        'Topic 2: Advanced Ornamentation and Style (Baroque and Classical conventions)',
        'Topic 3: Colour and Sonority (Layered voicing, orchestral thinking)',
        'Topic 4: Extended Works (Longer movements, stamina and memory)',
        'Topic 5: Sight-Reading (Advanced, all keys)',
        'Topic 6: Repertoire (Preludes and fugues, full sonata movements, impressionist works)'
    ],
    'Grade 8': [
        'Topic 1: Complete Technical Command (All scales, arpeggios and double notes at speed)',
        'Topic 2: Concert Repertoire (Major works from Baroque to contemporary)',
        'Topic 3: Interpretation and Personal Voice (Stylistic fidelity with individual expression)',
        'Topic 4: Performance Psychology (Stage presence, memory security, recovery)',
        'Topic 5: Advanced Sight-Reading and Quick Study',
        'Topic 6: Programme Building (Balancing a recital programme)'
    ]
};

const VIOLIN: GradeTopics = {
    'Grade 1': [
        'Topic 1: Instrument and Bow Hold (Posture, left-hand shape, relaxed bow grip)',
        'Topic 2: Open Strings (G, D, A, E, bowing straight, tone production)',
        'Topic 3: First Finger Patterns (First position, finger placement, intonation)',
        'Topic 4: Simple Scales (D and A major, one octave)',
        'Topic 5: Basic Bowing (Detache, smooth string crossing)',
        'Topic 6: Rhythm and Pulse (Crotchets, minims, quavers with the bow)',
        'Topic 7: Simple Pieces (Folk tunes and easy melodies in first position)'
    ],
    'Grade 2': [
        'Topic 1: Scales (G, D, A major two octaves preparation, natural minor introduction)',
        'Topic 2: Finger Patterns (High and low second finger)',
        'Topic 3: Slurred Bowing (Two and four notes per bow)',
        'Topic 4: Tone Development (Bow speed, weight and contact point)',
        'Topic 5: Sight-Reading Basics (Simple first-position melodies)',
        'Topic 6: Aural Skills (Echo singing, pitch matching)',
        'Topic 7: Repertoire (Contrasting short pieces)'
    ],
    'Grade 3': [
        'Topic 1: Scales and Arpeggios (Majors and minors two octaves)',
        'Topic 2: Introduction to Third Position (Simple shifts)',
        'Topic 3: Bowing Styles (Staccato, martele, string crossings)',
        'Topic 4: Dynamics with the Bow (Controlling volume and colour)',
        'Topic 5: Intonation Refinement (Listening and adjusting)',
        'Topic 6: Sight-Reading (Keys to two sharps and flats)',
        'Topic 7: Repertoire (Dances and character pieces)'
    ],
    'Grade 4': [
        'Topic 1: Position Work (First to third position shifting fluency)',
        'Topic 2: Introduction to Vibrato (Arm and wrist vibrato preparation)',
        'Topic 3: Scales and Arpeggios (Two octaves with shifts)',
        'Topic 4: Advanced Bow Strokes (Spiccato preparation, hooked bowing)',
        'Topic 5: Double Stop Preparation (Open-string double stops)',
        'Topic 6: Sight-Reading (Pieces with position changes)',
        'Topic 7: Repertoire (Concertino movements, expressive pieces)'
    ],
    'Grade 5': [
        'Topic 1: Positions One to Five (Fluent shifting)',
        'Topic 2: Vibrato Development (Consistent expressive vibrato)',
        'Topic 3: Three-Octave Scales Preparation',
        'Topic 4: Spiccato and Sautille (Off-string bowing)',
        'Topic 5: Double Stops (Thirds and sixths introduction)',
        'Topic 6: Sight-Reading (Moderate difficulty, dynamics and articulation)',
        'Topic 7: Repertoire (Concerto movements, sonatas)'
    ],
    'Grade 6': [
        'Topic 1: Advanced Positions (Up to seventh position)',
        'Topic 2: Three-Octave Scales and Arpeggios',
        'Topic 3: Expressive Techniques (Portamento, varied vibrato speeds)',
        'Topic 4: Complex Bowing Patterns (Mixed strokes, chords)',
        'Topic 5: Double Stops (Octaves introduction)',
        'Topic 6: Sight-Reading (Advanced first-to-fifth position)',
        'Topic 7: Repertoire (Baroque sonatas, Romantic showpieces)'
    ],
    'Grade 7': [
        'Topic 1: Virtuosic Left Hand (Fast passagework, trills, harmonics)',
        'Topic 2: Advanced Double Stops (Thirds, sixths, octaves in scales)',
        'Topic 3: Bowing Mastery (Ricochet, flying staccato introduction)',
        'Topic 4: Interpretation (Stylistic awareness across periods)',
        'Topic 5: Sight-Reading (Complex rhythms and positions)',
        'Topic 6: Repertoire (Concerto movements, virtuoso pieces)'
    ],
    'Grade 8': [
        'Topic 1: Complete Technical Command (All scales, arpeggios and double stops at speed)',
        'Topic 2: Concert Repertoire (Major concertos and sonatas)',
        'Topic 3: Advanced Interpretation (Personal voice, historical style)',
        'Topic 4: Performance Skills (Stage presence, memory, ensemble leading)',
        'Topic 5: Advanced Sight-Reading and Quick Study',
        'Topic 6: Orchestral Excerpts Awareness (Common audition passages)'
    ]
};

const GUITAR: GradeTopics = {
    'Grade 1': [
        'Topic 1: Instrument Basics (Parts of the guitar, tuning, sitting position)',
        'Topic 2: Right-Hand Technique (Rest stroke, free stroke or pick control)',
        'Topic 3: Open Chords (C, G, D, E minor, A minor)',
        'Topic 4: Simple Strumming Patterns (Down strums, steady pulse)',
        'Topic 5: Single-Note Melodies (First position, open strings and first frets)',
        'Topic 6: Basic Scales (C major one octave)',
        'Topic 7: Simple Pieces and Songs (Melody and chord accompaniment)'
    ],
    'Grade 2': [
        'Topic 1: More Open Chords (A, D minor, E, seventh chords)',
        'Topic 2: Strumming Development (Up and down strums, syncopation)',
        'Topic 3: Fingerstyle Introduction (Simple arpeggiated patterns)',
        'Topic 4: Scales (G and D major, A minor, two positions)',
        'Topic 5: Chord Changes (Smooth transitions in time)',
        'Topic 6: Sight-Reading Basics (First-position melodies)',
        'Topic 7: Repertoire (Easy classical or contemporary pieces)'
    ],
    'Grade 3': [
        'Topic 1: Barre Chord Introduction (F major shape, partial barres)',
        'Topic 2: Fingerstyle Patterns (Alternating bass, arpeggios)',
        'Topic 3: Scales (Two octaves, movable shapes)',
        'Topic 4: Position Playing (Notes up to fifth position)',
        'Topic 5: Dynamics and Tone (Tone colour, ponticello and tasto)',
        'Topic 6: Sight-Reading (Simple two-voice textures)',
        'Topic 7: Repertoire (Classical studies, folk arrangements)'
    ],
    'Grade 4': [
        'Topic 1: Full Barre Chords (Major and minor shapes across the neck)',
        'Topic 2: Advanced Fingerstyle (Independence of thumb and fingers)',
        'Topic 3: Scales and Arpeggios (Major, minor and chromatic, two octaves)',
        'Topic 4: Slurs (Hammer-ons and pull-offs)',
        'Topic 5: Position Shifts (Fluent movement along the neck)',
        'Topic 6: Sight-Reading (Melody with bass line)',
        'Topic 7: Repertoire (Classical pieces, contemporary styles)'
    ],
    'Grade 5': [
        'Topic 1: Advanced Chord Vocabulary (Extended and altered chords)',
        'Topic 2: Ornaments and Slur Combinations (Trills, grace notes)',
        'Topic 3: Scales (Three octaves where practical, all positions)',
        'Topic 4: Tremolo Introduction (Classical tremolo technique)',
        'Topic 5: Natural and Artificial Harmonics',
        'Topic 6: Sight-Reading (Multi-voice textures)',
        'Topic 7: Repertoire (Intermediate classical and fingerstyle works)'
    ],
    'Grade 6': [
        'Topic 1: Advanced Technique (Speed, accuracy, right-hand control)',
        'Topic 2: Polyphonic Playing (Independent voices, counterpoint)',
        'Topic 3: Advanced Harmonics and Percussive Effects',
        'Topic 4: Interpretation (Phrasing, rubato, stylistic awareness)',
        'Topic 5: Sight-Reading (Advanced positions and textures)',
        'Topic 6: Repertoire (Renaissance to modern guitar literature)'
    ],
    'Grade 7': [
        'Topic 1: Virtuosic Studies (Villa-Lobos style etudes, advanced arpeggios)',
        'Topic 2: Advanced Tremolo and Rasgueado',
        'Topic 3: Complete Fingerboard Knowledge (All keys in all positions)',
        'Topic 4: Stylistic Breadth (Baroque transcriptions, Spanish repertoire, modern works)',
        'Topic 5: Sight-Reading (Complex polyphony)',
        'Topic 6: Repertoire (Concert-level solo pieces)'
    ],
    'Grade 8': [
        'Topic 1: Complete Technical Command (All scales, arpeggios and slur patterns at speed)',
        'Topic 2: Concert Repertoire (Major works of the guitar literature)',
        'Topic 3: Advanced Interpretation (Personal voice, period style)',
        'Topic 4: Performance Skills (Stage presence, memory, programming)',
        'Topic 5: Advanced Sight-Reading and Quick Study',
        'Topic 6: Arrangement Awareness (Adapting music for guitar)'
    ]
};

const WESTERN_VOCAL: GradeTopics = {
    'Grade 1': [
        'Topic 1: Posture and Breathing (Aligned posture, diaphragmatic breath support)',
        'Topic 2: Pitch Matching (Singing back single notes and simple patterns)',
        'Topic 3: Simple Scales and Warm-Ups (Five-note patterns, humming, vowels)',
        'Topic 4: Diction Basics (Clear vowels and consonants)',
        'Topic 5: Rhythm in Singing (Keeping pulse, simple note values)',
        'Topic 6: Simple Songs (Folk songs and easy melodies within an octave)'
    ],
    'Grade 2': [
        'Topic 1: Breath Control Development (Longer phrases, sustained notes)',
        'Topic 2: Extending Range (Comfortable notes above and below the middle range)',
        'Topic 3: Major Scales and Arpeggios (Sung with letter names or solfege)',
        'Topic 4: Dynamics in Singing (Soft and loud with support)',
        'Topic 5: Simple Sight-Singing (Stepwise melodies)',
        'Topic 6: Repertoire (Contrasting songs with accompaniment)'
    ],
    'Grade 3': [
        'Topic 1: Tone Quality (Resonance, avoiding strain, open throat)',
        'Topic 2: Minor Scales and Intervals (Singing minor patterns and simple intervals)',
        'Topic 3: Legato and Phrasing (Smooth lines, phrase shaping)',
        'Topic 4: Diction in Performance (Text clarity, word stress)',
        'Topic 5: Sight-Singing (Simple leaps and dotted rhythms)',
        'Topic 6: Repertoire (Art songs, musical theatre, traditional songs)'
    ],
    'Grade 4': [
        'Topic 1: Register Blending (Smooth transitions between chest and head voice)',
        'Topic 2: Agility (Faster scale passages, simple melisma)',
        'Topic 3: Expression and Interpretation (Communicating the meaning of a song)',
        'Topic 4: Foreign Language Introduction (Simple Italian or other language songs)',
        'Topic 5: Sight-Singing (Wider range and varied rhythms)',
        'Topic 6: Repertoire (Contrasting periods and styles)'
    ],
    'Grade 5': [
        'Topic 1: Advanced Breath Management (Dynamic control across long phrases)',
        'Topic 2: Vibrato Awareness (Natural, healthy vibrato)',
        'Topic 3: Ornamentation Introduction (Simple Baroque and classical ornaments)',
        'Topic 4: Language Repertoire (Italian, German or French songs)',
        'Topic 5: Sight-Singing (Chromatic notes, minor keys)',
        'Topic 6: Repertoire (Art song, opera or musical theatre selections)'
    ],
    'Grade 6': [
        'Topic 1: Vocal Colour and Dynamics (Messa di voce, tonal variety)',
        'Topic 2: Advanced Agility (Runs, coloratura preparation)',
        'Topic 3: Stylistic Awareness (Baroque, Classical, Romantic, contemporary styles)',
        'Topic 4: Recitative and Aria Introduction',
        'Topic 5: Sight-Singing (Advanced intervals and modulation)',
        'Topic 6: Repertoire (Extended works in multiple languages)'
    ],
    'Grade 7': [
        'Topic 1: Advanced Technique (Full range command, sustained tessitura)',
        'Topic 2: Dramatic Interpretation (Character, text painting, stage presence)',
        'Topic 3: Complex Ornamentation (Cadenzas, da capo variation)',
        'Topic 4: Ensemble Singing Awareness (Duets, blending)',
        'Topic 5: Sight-Singing (Complex rhythms and chromaticism)',
        'Topic 6: Repertoire (Opera arias, lieder, oratorio, advanced musical theatre)'
    ],
    'Grade 8': [
        'Topic 1: Complete Vocal Command (Technical security across the full range)',
        'Topic 2: Recital Repertoire (Programme spanning periods and languages)',
        'Topic 3: Advanced Interpretation (Personal artistry, stylistic fidelity)',
        'Topic 4: Performance Psychology (Stagecraft, memory, recovery)',
        'Topic 5: Advanced Sight-Singing and Quick Study',
        'Topic 6: Vocal Health (Sustainable technique, care of the voice)'
    ]
};

// ─── Other Western instruments (generated ABRSM/Trinity-style scaffolds) ────────
// Each instrument supplies three technique descriptors (foundation / intermediate /
// advanced) that slot into a shared per-grade scaffold, so every instrument gets
// grade-scoped topics without hand-authoring 8 grades × 16 instruments.

interface InstrumentTechnique {
    found: string;   // Grades 1-2 technique focus
    inter: string;   // Grades 3-5 technique focus
    adv: string;     // Grades 6-8 technique focus
}

const makeWesternInstrumentTopics = (name: string, t: InstrumentTechnique): GradeTopics => ({
    'Grade 1': [
        `Topic 1: Instrument Basics (Parts of the ${name}, care, posture and hold)`,
        `Topic 2: Sound Production (${t.found})`,
        'Topic 3: Note Reading Basics (Staff notation, note names, simple rhythms)',
        'Topic 4: First Scales (C and G major, one octave)',
        'Topic 5: Rhythm and Pulse (Crotchets, minims, quavers, steady beat)',
        'Topic 6: Simple Pieces (Easy melodies and folk tunes)'
    ],
    'Grade 2': [
        `Topic 1: Technique Development (${t.found})`,
        'Topic 2: Scales (Major keys to two sharps and flats, minor scale introduction)',
        'Topic 3: Articulation and Dynamics (Legato, staccato, soft and loud playing)',
        'Topic 4: Sight-Reading Basics (Simple stepwise melodies)',
        'Topic 5: Aural Skills (Echo patterns, pitch matching, pulse recognition)',
        'Topic 6: Repertoire (Contrasting short pieces)'
    ],
    'Grade 3': [
        `Topic 1: Intermediate Technique (${t.inter})`,
        'Topic 2: Scales and Arpeggios (Majors and minors to four sharps and flats)',
        'Topic 3: Tone Quality (Evenness, control, projection)',
        'Topic 4: Phrasing (Shaping musical lines, breathing/bowing/picking plans)',
        'Topic 5: Sight-Reading (Keys to two sharps and flats)',
        'Topic 6: Repertoire (Dances and character pieces)'
    ],
    'Grade 4': [
        `Topic 1: Technique Expansion (${t.inter})`,
        'Topic 2: Scales and Arpeggios (Wider keys and ranges)',
        'Topic 3: Ornaments (Grace notes, trills, simple decorations)',
        'Topic 4: Ensemble Skills (Playing in time with others, balance)',
        'Topic 5: Sight-Reading (Pieces with position or register changes)',
        'Topic 6: Repertoire (Contrasting styles with character and expression)'
    ],
    'Grade 5': [
        `Topic 1: Advanced-Intermediate Technique (${t.inter})`,
        'Topic 2: Scales (All common keys, extended range)',
        'Topic 3: Expressive Playing (Rubato, dynamics shading, tonal colour)',
        'Topic 4: Style Awareness (Baroque, Classical, Romantic and modern styles)',
        'Topic 5: Sight-Reading (Moderate difficulty with expression marks)',
        'Topic 6: Repertoire (Sonatina-level and characteristic works)'
    ],
    'Grade 6': [
        `Topic 1: Advanced Technique (${t.adv})`,
        'Topic 2: Scales and Arpeggios (All keys, faster tempi)',
        'Topic 3: Interpretation (Structural awareness, period style)',
        'Topic 4: Extended Works (Longer movements, stamina)',
        'Topic 5: Sight-Reading (Full textures with expression)',
        'Topic 6: Repertoire (Intermediate-advanced literature)'
    ],
    'Grade 7': [
        `Topic 1: Virtuosic Foundations (${t.adv})`,
        'Topic 2: Complete Key Command (All scales and arpeggios at speed)',
        'Topic 3: Advanced Interpretation (Stylistic fidelity across periods)',
        'Topic 4: Performance Stamina (Extended programmes, memory)',
        'Topic 5: Sight-Reading (Complex rhythms and keys)',
        'Topic 6: Repertoire (Advanced concert works)'
    ],
    'Grade 8': [
        `Topic 1: Complete Technical Command (${t.adv})`,
        'Topic 2: Concert Repertoire (Major works of the instrument’s literature)',
        'Topic 3: Personal Interpretation (Individual voice with stylistic fidelity)',
        'Topic 4: Performance Skills (Stage presence, memory security, recovery)',
        'Topic 5: Advanced Sight-Reading and Quick Study',
        'Topic 6: Programme Building (Balancing a recital programme)'
    ]
});

// Drums are unpitched — scales/keys don't apply, so it gets its own tree.
const DRUMS: GradeTopics = {
    'Grade 1': [
        'Topic 1: Kit Basics (Parts of the drum kit, setup, posture, stick grip)',
        'Topic 2: First Strokes (Full, down, tap and up strokes on the snare)',
        'Topic 3: Reading Drum Notation (Kit staff, note values, rests)',
        'Topic 4: Basic Rock Beat (Kick, snare and hi-hat coordination in 4/4)',
        'Topic 5: Simple Fills (One-bar crotchet and quaver fills)',
        'Topic 6: Pulse and Timing (Playing with a metronome, steady tempo)'
    ],
    'Grade 2': [
        'Topic 1: Rudiment Foundations (Single stroke roll, double stroke roll, single paradiddle)',
        'Topic 2: Groove Development (Eighth-note rock and pop beats, hi-hat variations)',
        'Topic 3: Fills and Dynamics (Two-bar fills, accents, ghost note introduction)',
        'Topic 4: Reading Development (Groove charts, repeat signs)',
        'Topic 5: Aural Skills (Echo rhythms, recognising tempo changes)',
        'Topic 6: Song Playing (Keeping a beat through a full song form)'
    ],
    'Grade 3': [
        'Topic 1: Rudiment Development (Flams, drags, paradiddle variations)',
        'Topic 2: Groove Styles (Rock, pop and 12/8 blues shuffles)',
        'Topic 3: Sixteenth-Note Patterns (Hands and kick drum sixteenths)',
        'Topic 4: Hi-Hat Technique (Foot splashes, open and closed sounds)',
        'Topic 5: Sight-Reading (Simple kit parts with fills)',
        'Topic 6: Musical Form (Intros, verses, choruses, endings)'
    ],
    'Grade 4': [
        'Topic 1: Advanced Rudiments (Five and nine stroke rolls, flam taps)',
        'Topic 2: Groove Vocabulary (Funk sixteenth grooves, syncopation, ghost notes)',
        'Topic 3: Coordination Studies (Four-way independence foundations)',
        'Topic 4: Odd Time Introduction (3/4 and 6/8 grooves)',
        'Topic 5: Sight-Reading (Charts with dynamics and accents)',
        'Topic 6: Style Studies (Rock, funk, blues and pop feels)'
    ],
    'Grade 5': [
        'Topic 1: Rudiment Application (Applying rudiments around the kit)',
        'Topic 2: Latin and World Grooves (Bossa nova, samba introduction)',
        'Topic 3: Jazz Foundations (Swing ride pattern, comping introduction)',
        'Topic 4: Odd Time Signatures (5/4 and 7/8 grooves)',
        'Topic 5: Soloing Basics (Two and four bar solo phrases, trading fours)',
        'Topic 6: Sight-Reading (Medium-difficulty charts)'
    ],
    'Grade 6': [
        'Topic 1: Advanced Coordination (Full four-way independence)',
        'Topic 2: Jazz Development (Comping, brushes introduction, up-tempo swing)',
        'Topic 3: Latin Styles (Afro-Cuban patterns, songo and mambo introduction)',
        'Topic 4: Advanced Fills and Phrasing (Over-the-barline ideas, quintuplets)',
        'Topic 5: Chart Reading (Big band style figures and kicks)',
        'Topic 6: Dynamic Control (Playing musically at all volumes)'
    ],
    'Grade 7': [
        'Topic 1: Virtuosic Technique (Speed, endurance, finger control, Moeller technique)',
        'Topic 2: Advanced Styles (Fusion, drum and bass, metal double kick foundations)',
        'Topic 3: Metric Modulation (Implied time and tempo shifts)',
        'Topic 4: Extended Soloing (Structured solos, thematic development)',
        'Topic 5: Advanced Reading (Complex charts at sight)',
        'Topic 6: Studio Awareness (Playing to click, tone choices)'
    ],
    'Grade 8': [
        'Topic 1: Complete Technical Command (All rudiments at speed around the kit)',
        'Topic 2: Complete Style Command (Rock, jazz, Latin, funk and odd-time mastery)',
        'Topic 3: Musical Leadership (Driving a band, arrangement awareness)',
        'Topic 4: Concert Solo Performance (Extended solo construction)',
        'Topic 5: Advanced Sight-Reading and Quick Study',
        'Topic 6: Professional Practice (Gig preparation, sound checks, equipment care)'
    ]
};

const OTHER_WESTERN_INSTRUMENTS: Record<string, InstrumentTechnique> = {
    'Trumpet': {
        found: 'Embouchure formation, breath support, first valve combinations',
        inter: 'Lip flexibility, tonguing styles, slurs across harmonics',
        adv: 'Double and triple tonguing, extended range, vibrato control'
    },
    'Saxophone': {
        found: 'Embouchure, reed care, breath support, first fingerings',
        inter: 'Tonguing styles, dynamic control, register evenness',
        adv: 'Altissimo preparation, vibrato, advanced articulation and subtone'
    },
    'Flute': {
        found: 'Embouchure and air stream, head-joint tone, first fingerings',
        inter: 'Breath control, tonguing, second octave and tone colours',
        adv: 'Vibrato, third octave, double tonguing and harmonics'
    },
    'Bass Guitar': {
        found: 'Right-hand plucking, fretting-hand position, open-string grooves',
        inter: 'Scale patterns across the neck, slap basics, locking with the drums',
        adv: 'Advanced grooves, soloing, harmonics, slap and tap techniques'
    },
    'Cello': {
        found: 'Bow hold, sitting posture, open strings, first position',
        inter: 'Shifting to fourth position, vibrato preparation, string crossings',
        adv: 'Thumb position, advanced vibrato, double stops'
    },
    'Trombone': {
        found: 'Embouchure, breath support, slide positions one to three',
        inter: 'Legato tonguing, all seven slide positions, lip slurs',
        adv: 'Alternate positions, extended range, advanced legato style'
    },
    'Organ': {
        found: 'Manual technique, posture at the console, basic registration',
        inter: 'Pedal technique, legato fingering and substitution, hymn playing',
        adv: 'Advanced registration, trio textures, organ literature'
    },
    'Ukulele': {
        found: 'Holding and tuning, first chords (C, F, G7), simple strums',
        inter: 'Fingerpicking patterns, barre chords, movable shapes',
        adv: 'Campanella style, solo arrangements, advanced strumming'
    },
    'Clarinet': {
        found: 'Embouchure, reed care, breath support, first fingerings',
        inter: 'Crossing the break, tonguing, dynamic control',
        adv: 'Altissimo register, advanced articulation, tone colours'
    },
    'Harmonica': {
        found: 'Single-note playing, breath control, hole numbering',
        inter: 'Note bending, cross-harp second position, articulation',
        adv: 'Overblows, advanced positions, tongue-blocking textures'
    },
    'Viola': {
        found: 'Bow hold, posture, open strings, alto clef basics, first position',
        inter: 'Third position shifting, vibrato preparation, tone development',
        adv: 'Higher positions, double stops, advanced vibrato'
    },
    'Oboe': {
        found: 'Embouchure, reed basics, breath support, first fingerings',
        inter: 'Breath management, tonguing, half-hole and octave keys',
        adv: 'Reed adjustment, vibrato, advanced fingerings'
    },
    'French Horn': {
        found: 'Embouchure, right-hand position in the bell, first harmonics',
        inter: 'Lip slurs, accuracy across harmonics, stopped horn introduction',
        adv: 'Extended range, stopped horn technique, transposition'
    },
    'Banjo': {
        found: 'Holding and tuning, basic rolls (forward, backward), first chords',
        inter: 'Alternating rolls, slides, hammer-ons and pull-offs',
        adv: 'Melodic style, up-the-neck playing, backup techniques'
    },
    'Accordion': {
        found: 'Bellows control, right-hand keyboard position, first bass buttons',
        inter: 'Bellows shading, stradella bass patterns, register switches',
        adv: 'Advanced bellows techniques, complex bass work, style repertoire'
    }
};

// ─── Authoritative instrument facts (AI grounding) ──────────────────────────────
// Injected verbatim into quest-generation prompts so the AI never invents
// physical, posture or technique "facts". If a fact is not listed here and the
// model is not fully certain, the prompt tells it to test something else.

const INSTRUMENT_FACTS: Record<string, string[]> = {
    'Veena': [
        'The player sits cross-legged on the floor.',
        'The kudam (large resonator) rests ON THE FLOOR at the player\'s right side — never on the lap, shoulder or head.',
        'The small gourd (surakkai) rests on or near the player\'s left thigh; the neck slopes diagonally up to the left.',
        'The right hand plucks the strings (index and middle fingers on the main strings, little finger strums the tala strings); the left hand presses and slides on the frets.',
        'The Saraswati veena has 4 main playing strings and 3 tala (side/drone) strings, with 24 fixed frets.',
        'The instrument is tuned to the selected Sa; always state Sa in any pitch-dependent question.'
    ],
    'Mridangam': [
        'The Valanthalai is the smaller RIGHT-side head and produces the higher/treble sound.',
        'The Thoppi is the larger LEFT-side head and produces the bass sound.',
        'The black central spot (karanai) is on the right head.',
        'Basic strokes: Tha, Dhi and Nam are right-hand strokes; Thom is the left-hand bass stroke; Chapu is a sharp right-hand stroke.',
        'The player sits cross-legged with the mridangam placed horizontally and stable in front, right head to the right.',
        'Adi Tala has 8 counts (clap + 3 finger counts + clap + wave + clap + wave).'
    ],
    'Tabla': [
        'The tabla is a PAIR of drums: the smaller wooden dayan (right drum) and the larger metal-bodied bayan (left/bass drum).',
        'Both drum heads carry a black tuning paste (syahi).',
        'It is played with the fingers and palms, never with sticks.',
        'The player sits cross-legged with both drums in front.'
    ],
    'Harmonium': [
        'The LEFT hand pumps the bellows; the RIGHT hand plays the keyboard.',
        'Sound is produced by air from the bellows passing over free reeds.',
        'Black keys repeat in groups of two and three; there is no black key between E-F or B-C.',
        'Finger numbering: thumb = 1, index = 2, middle = 3, ring = 4, little = 5.',
        'The tonic Sa must be stated in any pitch question (e.g. if Sa = E, then Pa = B; if Sa = G, then Pa = D).'
    ],
    'Keyboard (Carnatic)': [
        'Swara-to-semitone distances above Sa: S=0, R1=1, R2/G1=2, R3/G2=3, G3=4, M1=5, M2=6, P=7, D1=8, D2/N1=9, D3/N2=10, N3=11, upper S=12.',
        'Shared physical positions: R2=G1, R3=G2, D2=N1, D3=N2.',
        'If Sa = E: R1=F, G3=G#, M1=A, P=B, N3=D#. If Sa = G: R1=G#, G3=B, M1=C, P=D.',
        'Finger numbering: thumb = 1, index = 2, middle = 3, ring = 4, little = 5.',
        'Always state the selected Sa in any pitch-dependent question.'
    ],
    'Sangeetham (Vocal)': [
        'The sapta swaras are Sa Ri Ga Ma Pa Da Ni.',
        'Adi Tala = Chatusra Jathi Triputa Tala = 4+2+2 = 8 counts.',
        'Mayamalavagowla is the traditional beginner raga for Sarali Varisai.',
        'The Carnatic Trinity: Tyagaraja, Muthuswami Dikshitar, Syama Sastri (Purandaradasa is the Pitamaha/father of Carnatic music).',
        'Kriti sections in order: Pallavi, Anupallavi, Charanam.',
        'Eduppu types: Samam (starts on the beat), Ateeta (starts before the beat), Anagata (starts after the beat).'
    ]
};

/** Authoritative facts to ground AI question generation; empty when none exist. */
export const getInstrumentFacts = (subject: string): string[] =>
    INSTRUMENT_FACTS[subject] ?? [];

// ─── Lookup ─────────────────────────────────────────────────────────────────────

export const INDIAN_MUSIC_TOPICS: TopicMap = {
    'Sangeetham (Vocal)': SANGEETHAM,
    'Mridangam': MRIDANGAM,
    'Keyboard (Carnatic)': KEYBOARD_CARNATIC,
    'Harmonium': HARMONIUM
    // Veena and Tabla: no curated data yet — AI fallback with Carnatic prompt rules.
};

export const WESTERN_MUSIC_TOPICS: TopicMap = {
    'Music Theory': WESTERN_THEORY,
    'Piano': PIANO,
    'Violin': VIOLIN,
    'Guitar': GUITAR,
    'Vocal (Western)': WESTERN_VOCAL,
    'Drums': DRUMS,
    ...Object.fromEntries(
        Object.entries(OTHER_WESTERN_INSTRUMENTS).map(([name, t]) => [name, makeWesternInstrumentTopics(name, t)])
    )
};

/** Curated topic list for a music subject/grade, or null when none exists (→ AI fallback). */
export const getCuratedTopics = (
    syllabus: string,
    subject: string,
    grade: string
): string[] | null => {
    const map =
        syllabus === 'Indian Music' ? INDIAN_MUSIC_TOPICS :
        syllabus === 'Western Music' ? WESTERN_MUSIC_TOPICS :
        null;
    return map?.[subject]?.[grade] ?? null;
};
