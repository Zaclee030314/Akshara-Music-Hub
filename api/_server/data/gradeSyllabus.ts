// Official grade-exam syllabi (Grade 1-8), transcribed from the "Grade Level
// Syllabus" documents supplied by Akshara Fine Arts. Injected into AI quest
// prompts as the authoritative per-grade exam scope, and used to derive topic
// lists for subjects that have no hand-authored curriculum tree.
//
// Keys must match the Subject enum strings in types.ts. Spellings follow the
// source documents.

export interface GradeSyllabus {
    theory: string[];
    practical: string[];
    exam?: string;
    notes?: string;
}

type SubjectSyllabus = Record<string, GradeSyllabus>;

// ─── Sangeetham (Vocal) — Carnatic vocal grade exams ─────────────────────────────

const VOCAL_CARNATIC: SubjectSyllabus = {
    'Grade 1': {
        theory: [
            'Introduction to Music – basic technical terms: Nada, Sruti, Svara, Sthayi, Janaka and Janya ragas',
            'Tala – Sapta talas, Shadangas, Chapu tala',
            'Composers – Purandaradasar and Muthuswami Dikshitar'
        ],
        practical: [
            'Sarali Varisai – 14 (3 speeds)',
            'Janta Varisai – 9 (3 speeds)',
            'Melsthayi Varisai – 5 (3 speeds)',
            'Nottuswarams',
            'Adi Tala basic laya exercises'
        ]
    },
    'Grade 2': {
        theory: [
            'Musical forms – Abhyasa Ganam: Alankaram, Gitam',
            'Sapta talas and their structure – 5 Jatis, 3 main Angas of Sapta talas and their symbols',
            'The nomenclature of the 16 svaras',
            'Biography of Thirugnanasambanthar and Arunagirinathar'
        ],
        practical: [
            'Dhattu Varisais (3 speeds)',
            'Keezh Sthayi Varisais (3 speeds)',
            'Alankarams (3 speeds)',
            'Any 2 Gitams, one Tevaram and one Thiruppugazh',
            'Laya exercises in Sapta talas'
        ]
    },
    'Grade 3': {
        theory: [
            'Musical forms – Lakshana Gitam, Swarajathis, Varnams, Kritis and their structure in general',
            'Biography and contribution of Tyagarajar; disciples of Tyagarajar',
            'Technical terms – Gamaka, Vadi, Samvadi, Vivadi, Anuvadi, Prayogam, Varjya, Vakram, Upanga, Bhashanga, Nishadhantya, Dhaivatantya, Panchamantya, Madhyama shruti'
        ],
        practical: [
            'Lakshana Gitam – 1',
            'Swarajathi – 2',
            'One Adi Tala Varnam',
            'A Kriti of Muthuswami Dikshitar with Samashti Charanam (simple scale raga)',
            'Any 2 Divyanama Keerthanas of Tyagaraja'
        ]
    },
    'Grade 4': {
        theory: [
            'Classification of musical instruments – string, wind and percussion',
            'Biography and contribution of composers – Appar, Manickavasagar, Sundarar, Alwars, Annamayya, Badrachala Ramdass',
            'Historical musical references in Tamil treatises such as Silapathikaram'
        ],
        practical: [
            'Any 2 Adi Tala Varnams',
            'Kritis in the ragas Mayamalavagowla, Gambira Nattai, Shanmugapriya, Mohanam — by Tyagarajar, Muthuthandavar, Uttukadu Venkata Subbaiyer, Swathi Tirunal, Papanasam Sivan or Muthuswami Dikshitar',
            'Alankarams and Dattu Varisais in the ragas Shanmugapriya and Mohanam',
            'One each from: Thiruppavai, Thiruvasakam, Meenakshi Pillai Tamizh, Annamayya, Badrachala Ramdass, patriotic song of Subramanya Bharati',
            'Laya exercises in Rupaka Tala and Kanda Chapu'
        ]
    },
    'Grade 5': {
        theory: [
            '72 Melakarta – raga classification',
            'Dasavidha Gamakas',
            'Tala Dasa Pranas',
            'Study of the Tambura – structure, parts, construction and tuning',
            'Historical musical references in Tamil treatises – Pancha Marabu',
            'Biography and contribution of composers – Sirgazhi Muvar, Muthuthandavar, Marimuttai Pillai, Arunachala Kavirayar, Gopalakrishna Bharati'
        ],
        practical: [
            'Alankarams and Dattu Varisais in the ragas Pantuvarali, Keeravani, Karaharapriya, Sriranjani, Madhyamavathi',
            '3 Adi Tala Varnams in any of the ragas Saveri, Sahana, Kedaragaula, Darbar, Surutti, Begada',
            'Any 4 Kritis in the ragas Keeravani, Karaharapriya, Madhyamavathi, Sriranjani, Pantuvarali, Sahana — composers: Trinity, Gopalakrishna Bharati, Arunachala Kavirayar, Ramaswami Sivan, Harikesanallur Muttiah Bhagavathar, Papanasam Sivan',
            'A Pancharatna Kriti of Tyagaraja',
            'Laya exercises in Misra Chapu tala'
        ]
    },
    'Grade 6': {
        theory: [
            'Biography of composers such as Shyama Sastri and his disciples',
            'Folk music – folk instruments – contribution of Annamalai Reddiar',
            'Study of musical instruments and their structure – Violin and Mridangam',
            'Musical references in Panniru Thirumurai, Divya Prabandam and the Chandams of Thiruppugazh',
            'Talas mentioned in Caccatputah Venba and Pancha Marabu'
        ],
        practical: [
            'One Ata Tala Varnam',
            'One Pada Varnam',
            'Any 4 Kritis with decorative angas (Chittaswaram, Swara Sahityam, Madhyamakala Sahityam) in the ragas Kambodhi, Bhairavi, Purvikalyani, Saveri, Dhanyasi, Varali',
            'One each of the musical forms Padam, Javali, Ragamalika',
            'One from: Thiruppugazh in Chanda Talam, Thillana, Kuravanji'
        ]
    },
    'Grade 7': {
        theory: [
            'Musical instruments – Veena, Flute, Tavil, Nagaswaram',
            'Dasa Vidha Gamakas in the Viriboni Bhairavi Varnam',
            'Musical forms – Padam, Javali, Ragamalika, Thillana',
            'Overview of the musical treatises tracing the grammar of Carnatic music – Sangita Ratnakara, Chaturdandi Prakasika, Sangita Sampradaya Pradarshini',
            'Contribution of composers – Ganam Krishna Iyer, Dharmapuri Subbarayar, Ramaswamy Sivan, Neelakanta Sivan, Papanasam Sivan, Kavikunjara Bharati, Kotiswara Iyer, M.M. Dandapani Desikar, Periyasami Thooran'
        ],
        practical: [
            'One Ata Tala Varnam',
            'Kalpana Swaras in any two of the ragas Mayamalavagowla, Sankarabaranam, Shanmugapriya, Mohanam, Sriranjani, Keeravani, Karaharapriya, Madhyamavathi',
            'One Pancharatna Kriti of Tyagaraja and one Swarajathi of Shyama Shastri',
            'Raga Alapana for any 2 of the ragas Kambodhi, Pantuvarali, Kalyani, Karaharapriya, Purvikalyani, Saveri',
            'Any 4 Tamil Kritis by Neelakanta Sivan, Ramaswamy Sivan, Koteeswara Iyer, M.M. Dandapani Desikar or Periyasami Thooran'
        ]
    },
    'Grade 8': {
        theory: [
            'Sabha Ganam – Kucheri Paddhati (concert format)',
            'Introduction to Western music, Hindustani music and folk music',
            'The various seats of music in South India that contributed to the growth of Carnatic music',
            'Role of technology and its advancement in the propagation of Carnatic music'
        ],
        practical: [
            'Alankarams in Vivadi ragas – any 2 of Rasikapriya, Mararanjani, Dhanarupi, Nitimathi, Kanakangi, Gayakapriya',
            'Small Abhiprayams and Korvais for Kalpana Swaras in any 2 ragas (Adi, Rupaka, Kanda Chapu and Misra Chapu talas) from Mohanam, Sankarabaranam, Lalita, Mayamalavagowla, Lathangi, Hamsanadam, Suddha Saveri, Pantuvarali',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Suddha Madhyama raga – Sankarabaranam, Saveri, Begada, Dhanyasi, Karaharapriya, Thodi, Kambodhi or Keeravani',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Prati Madhyama raga – Kalyani, Shanmugapriya, Pantuvarali, Purvikalyani, Varali, Simmendra Madhyamam, Lathangi or Subapantuvarali',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Audava/Shadava raga – Lalitha, Arabhi, Bilahari, Sriranjani, Abhogi, Ritigaula, Madhyamavathi or Hindolam'
        ]
    }
};

// ─── Bharatanatyam (Dance) — classical dance grade exams ────────────────────────

const BHARATANATYAM: SubjectSyllabus = {
    'Grade 1': {
        theory: [
            'Primary information – Adavu, Korvai, 3 speeds, Adi talam, Rupaka talam',
            'Technical information – Siro bhedas, Asamyuta hastas, Viniyogas from Pataka to Arala',
            'Names of classical dances; Nattuvanars – Meenakshi Sundaram Pillai, Chokalingam Pillai; Legends – Smt. T. Balasaraswathi, Kalyani Sisters',
            'Texts – Thirukkural, Abhinayadarpanam, Purananooru'
        ],
        practical: [
            'Adavus – Thattadavu, Naattadavu, Paraval adavu, Kudithu mettu, Korvai adavu, Paidal adavu',
            'Project – mime a story with a moral using dance gestures'
        ]
    },
    'Grade 2': {
        theory: [
            'Primary information – Tirmanam, Nrtta, 4 types of abhinaya, Panchajati, kings who patronised the arts',
            'Technical information – Drishti bheda, Samyuta hastas, Viniyogas from Katakamukha to Chandrakala',
            'Names of folk dances; Nattuvanars – Kaatumannar Koil Muthukumara Pillai, Panchapakesa Nattuvanar; Legends – Smt. M.K. Saroja, Kumari Kamala',
            'Texts – Tolkappiyam, Silappadikaram, Agananooru'
        ],
        practical: [
            'Adavus – Kuthadavu, Thattimettu adavu, Sarukkal, Mandi, Ettadavu, Tirmana adavu, Kummi/Kolattam',
            'Project – Ramayana characters (any two)'
        ]
    },
    'Grade 3': {
        theory: [
            'Primary information – Nritya, Natya, Alarippu, Kavuthuvam, Sapta Tala',
            'Technical information – Griva bheda, Devata hastas, Viniyogas from Padmakosha to Chatura hasta',
            'Bharatanatyam; Rukmini Devi; Nattuvanars – Kandappa Pillai, K.N. Dandayudapani Pillai; Legends – Yamini Krishnamoorthy, Vyjayanthimala Bali',
            'Texts – Natyasastra, Manimekhalai, Kurunthogai'
        ],
        practical: [
            'Adavus in Tisram',
            'Compositions – Alarippu, Kavuthuvam',
            'Project – Panchasabhai and Panchabhootam'
        ]
    },
    'Grade 4': {
        theory: [
            'Primary information – Sollukkattu, Jati, Jatiswaram, Shabdam, Tanjore Quartet, Mallari',
            'Technical information – Mandalas and Sthanakas, Dashavatara hastas, Viniyogas from Bhramara to Trisula hasta',
            'Kathak, Kuchipudi; Nattuvanars – Pichiah Pillai, Subbaraya Pillai; Legends – Adyar K. Lakshman, Travancore Sisters',
            'Texts – Natyasastra, Manimekhalai, Kurunthogai'
        ],
        practical: [
            'Adavus in Misram',
            'Compositions – Jatiswaram, Shabdam',
            'Project – Dasavataram'
        ]
    },
    'Grade 5': {
        theory: [
            'Primary information – Bhava, Rasa, orchestra, Pushpanjali, Kirtanam, Kavadi Chindu',
            'Technical information – leaps and jumps, Varna bhedas, Bandhava hastas, Samyuta hastas from Anjali to Utsangam',
            'Odissi, Manipuri; Nattuvanars – Bavu Pillai, Ramaih Pillai; Legends – Dr. Padma Subrahmanyam, Prof. C.V. Chandrashekar',
            'Texts – Kutanul, Tevaram, Tiruvasakam, Paripadal'
        ],
        practical: [
            'Adavus in Khandam',
            'Compositions – Kirtanam/Kriti, Tillana, Kavadi Chindu/Kilikanni',
            'Project – Aarupadai Veedu'
        ]
    },
    'Grade 6': {
        theory: [
            'Primary information – Nayaka Nayaki Prakarna, evolution of the Margam, Paadal, Padam, Javali, Thodayam',
            'Technical information – twirls and turns, Navagraha hastas, Samyuta hastas from Sivalinga to Samputa',
            'Kathakali, Mohiniattam; Nattuvanars – Mahalingam Pillai, Muthuswamy Pillai; Legends – Dr. Sudharani Raghupathy, The Dhananjayans',
            'Texts – Kutanul, Tevaram, Tiruvasakam, Paripadal'
        ],
        practical: [
            'Adavus in Sankeernam',
            'Compositions – Padal/Bhajan/Abhang, Padam/Javali',
            'Project – Aarupadai Veedu'
        ]
    },
    'Grade 7': {
        theory: [
            'Primary information – revival of Bharatanatyam, importance of music and yoga, Pada varnam, Swarajati, Viruttam/slokam, Ashtapadi',
            'Technical information – gaits, Tala dasa pranas, Marga talas, Viniyogas from Pasa hasta to Bherunda hasta',
            'Sattriya, Chau; Nattuvanars – Kittappa Pillai, Dakshinamoorthy Pillai; Legends – Smt. Chitra Visveswaran, Lakshmi Viswanathan',
            'Texts – Kuravanji, Ainkurunooru'
        ],
        practical: [
            'Pada varnam / Swarajati / Daru varnam or an alternate composition',
            'Project – Krishna avatara'
        ]
    },
    'Grade 8': {
        theory: [
            'All primary and technical information of the previous grades (cumulative)',
            'All dance forms of the previous grades; Nattuvanars – Ellappa Pillai, Govindarajan Pillai; Legends – Smt. Mrinalini Sarabhai, Smt. Krishnaveni Lakshmanan',
            'Texts – Mahabharata Choodamani, Thoodu, Ula, Kalithogai'
        ],
        practical: [
            'All adavus and compositions of the previous grades (cumulative)',
            'Project – Mahabharata'
        ],
        notes: 'Cumulative grade — all previous levels are examinable.'
    }
};

// ─── Mridangam — Carnatic percussion grade exams ────────────────────────────────

const MRIDANGAM_EXAM: SubjectSyllabus = {
    'Grade 1': {
        theory: [
            'Basic technical terms – Talam, Avartanam, Aksharam',
            'Mridangam – its origin and history',
            'Sapta Talas; Jatis; Tala Angas and their symbols'
        ],
        practical: [
            'Adi Tala basic lessons',
            'Introduction to the 5 jatis and basic lessons',
            'Sapta Talas – thathakaram and basic exercises',
            'Rupaka Tala basic exercises',
            'Express notations of the lessons learnt in writing and orally'
        ]
    },
    'Grade 2': {
        theory: ['Nadais; Nadam; Kalam; Korvai; Theermanam; Mohra', 'Life history of Mridangam vidwans'],
        practical: [
            'Adi Tala Tisra Nadai exercises',
            'Rupaka Tala Tisra Nadai exercises',
            'Adi Tala and Rupaka Tala sarvalaghu varieties',
            'Theermanams for Adi and Rupaka Tala',
            'Tani avartanam – Adi and Rupaka Tala'
        ]
    },
    'Grade 3': {
        theory: [
            '35 Talas; concept of Gathis and the 175 Talas',
            'Five Dasa Pranas of Mridangam',
            'Mridangam – detailed study of structure, construction, making and maintenance'
        ],
        practical: [
            'Misra Chapu and Kanda Chapu basic exercises',
            'Misra Chapu and Kanda Chapu Tisra Nadai exercises',
            'Misra Chapu and Kanda Chapu sarvalaghu varieties',
            'Misra Chapu and Kanda Chapu theermanams',
            'Tani avartanam – Misra Chapu and Kanda Chapu'
        ]
    },
    'Grade 4': {
        theory: [
            'Differences between Mathalam, Thavil and Mridangam',
            'Classification of instruments – string, wind, other percussion'
        ],
        practical: [
            'Advanced exercises in Adi and Rupaka – Anulomam and Pratilomam',
            'Advanced exercises in Kanda Chapu and Misra Chapu – Anulomam and Pratilomam',
            'Advanced sarvalaghu patterns for Adi and Rupakam',
            'Advanced sarvalaghu patterns for Kanda Chapu and Misra Chapu',
            'Create and apply theermanams for Adi, Rupakam, Kanda Chapu and Misra Chapu'
        ]
    },
    'Grade 5': {
        theory: [
            'Yathi types; Tala Dasa Pranas',
            'Evolution of the system of notation in Carnatic music',
            'Percussion references in Tamil treatises – Silapathikaram, Panchamarabu, Tala Samuthiram'
        ],
        practical: [
            'Create korvais for Adi, Rupakam, Kanda Chapu and Misra Chapu (samam to samam)',
            'Create mohras for all 35 talas',
            'Misra kuraippu for Adi Talam and Kanda kuraippu for Rupaka Talam',
            'Tisra kuraippu for Misra Chapu and Sankirna kuraippu for Kanda Chapu',
            'Chatusra kuraippu for Khanda Jathi Triputa tala; write notations for the lessons learnt'
        ]
    },
    'Grade 6': {
        theory: ['108 Talas', 'Chandams of Thiruppugazh', 'Study of the Upa pakkavadyas'],
        practical: [
            'Adi Tala Varnams – 2',
            'Accompanying kritis in Adi Tala and Rupaka Tala',
            'Accompanying kritis in Misra Chapu and Kanda Chapu',
            'Accompanying Tevaram and Thiruppugazh (Chanda talam)',
            'Accompanying a Thillana'
        ]
    },
    'Grade 7': {
        theory: ['Varieties of percussion instruments of South India', 'Hindustani percussion instruments'],
        practical: [
            'Play an Ata Tala Varnam',
            'Create abhiprayam and korvais from samam to edam',
            'Create theermanams for kritis with different eduppu',
            'Tani avartanam in Adi, Rupakam, Kanda Chapu and Misra Chapu with different eduppu',
            'Play a Pancharatna Kriti of Tyagaraja'
        ]
    },
    'Grade 8': {
        theory: ['Seats of music in South India', 'Technology and its advancement in Carnatic music'],
        practical: [
            'Handling of Neraval and Kalpana Swaram',
            'Pallavi in Adi Talam',
            'Pallavi in Kanda Jathi Triputa Tala followed by tani avartanam',
            'Pallavi in any nadai with different eduppu followed by tani avartanam',
            'Accompany a full kucheri (1 hour)'
        ]
    }
};

// ─── Tabla — Hindustani percussion grade exams ──────────────────────────────────

const TABLA_EXAM: SubjectSyllabus = {
    'Grade 1': {
        theory: [
            'Construction and parts of Tabla and Dagga',
            'Method of playing the Dashavarnas on Tabla and Dagga',
            'Teen Taal, Jhap Taal, Ek Taal, Dadra, Keherwa and Chow Taal in detail; practice in Dugun and Chowgun laya in Taal-Lipi notation',
            'Taal-Lipi notation systems of Pandit Bhatkhande and Pandit Paluskar'
        ],
        practical: [
            'Bols: Tha, Na, Dha, Dhin, Thin, Ghee, Thraka, Kath, Thirakita, Thakitatha, Dhinagina, Ghidanaga, Theenthinna, Nagathaga',
            'Basic (mool) theka of Teen Taal, Jhap Taal, Ek Taal, Rupak Taal, Dadra, Keherwa, Chow Taal',
            'Oral rendering of those taals in normal, Dugun and Chowgun speeds with matra counting by hand',
            'Two kaydas each in Teen Taal and Jhap Taal with four paltas',
            'Two mukhdas, two tukdas and two tihais in Teen Taal and Jhap Taal'
        ]
    },
    'Grade 2': {
        theory: [
            'Technical terms – Sangeet, Nada, Swara, Laya (Vilambit, Madhya, Drut), Taal, Bol, Sam, Khali, Bhari, Vibhag, Avartan, Theka, Kayda, Mukhda, Tukda, Tihai, Laggi, Dugun, Tigun, Chowgun',
            'Biographies – Pandit Kanthe Maharaj, Ustad Alla Rakha, Amir Khusro, Habibuddin Khan'
        ],
        practical: [
            'Four badal thekas in Teen Taal, Jhap Taal, Ek Taal, Rupak Taal, Dadra, Keherwa, Chow Taal',
            'Four badal thekas and four tihais each in Teen Taal, Jhap Taal, Ek Taal and Rupak Taal',
            'Four badal thekas and four laggis in Dadra and Keherwa',
            'Chow Taal bols orally and on Tabla in Vilambit, Dugun and Chowgun',
            'Identify the sam and taal when sung/played by the examiner and execute saath-sangat'
        ]
    },
    'Grade 3': {
        theory: [
            'Classification of Indian musical instruments; history and development of Tabla',
            'Construction of Tabla and Dagga with sketches',
            'Theory of various taals; the five jatis (Chatushra, Tishra, Mishra, Khanda, Sankirna)',
            'Peshkar vs kayda; terms – Peshkar, Kayda, Tukda, Mukhda, Tihai, Una, Gat, Paran, Laggi, Ladi',
            'Importance of sam, khali, bhari, vibhag and avartan in taal construction'
        ],
        practical: [
            'Sing two swargeets and two lakshangeets and follow them on Tabla (raags such as Bhup, Desh, Khamaj, Bageshri, Durga, Kafi, Brindavani Sarang, Bhimpalasi, Jaunpuri, Bhairavi, Bhairav, Bihag, Tilang, Malkauns, Vibhas, Patdeep)',
            'Thekas of Punjabi, Sul Taal, Tevra, Dhamar, Matt Taal and Sawari',
            'Tabla solo in Teen Taal for 20 minutes',
            'Tabla solo in Jhap Taal for 15 minutes',
            '2 kaydas, 2 mukhdas, 2 tukdas and 3 tihais in Rupak Taal'
        ]
    },
    'Grade 4': {
        theory: [
            'Importance of taal in music; Tabla saath-sangat for singing and accompaniment',
            'Comparative study of Hindustani and Carnatic taal systems',
            'Gharanas of Tabla – Delhi, Banaras, Purab, Punjab, Ajrada',
            'Writing mukhda, tukda, tihai, gat, paran in Taal-Lipi; duties of a solo Tabla artist; rules of practice',
            'Biographies – Samta Prasad, Anokhelal Mishra, Nana Panse, Ustad Jahangir Khan, Kishan Maharaj, Amir Hussain Khan'
        ],
        practical: [
            'Kayda and theka in different gharana styles',
            '2 kaydas in Teen Taal in Adi laya',
            'Theka in vilambit laya',
            'Two Adi-laya kaydas in Rupak Taal',
            'Saath-sangat for a vocal rendering with vilambit theka'
        ]
    },
    'Grade 5': {
        theory: [
            'Indian music and rhythm instruments in the Vedic period; development from Mughal times to the present',
            'Position of music in society; tradition of Avanaddha instruments; the Pakhawaj; history of Tabla'
        ],
        practical: [
            '2 mukhdas, 2 tukdas and 3 tihais in Ek Taal',
            'Teen Taal theka in Adi and Kuadi laya',
            'Vilambit theka in Addha Taal for thumri, finishing with laggi',
            'Vilambit theka in Deepchandi Taal, finishing with laggi',
            'One kayda in any taal in Adi laya and Chatushra laya'
        ]
    },
    'Grade 6': {
        theory: [
            'Gharanas of Tabla; Dasha Pranas of taal; layakari; Taal-Lipi system; emotions (rasa) arising from taal and laya',
            'Biographies – Sharangadeva, Tansen, Amir Khusro, Gopal Nayak, Ram Sahai'
        ],
        practical: [
            'Tabla solo with detailed elaboration in Teen Taal',
            'Tabla solo with detailed elaboration in Jhap Taal',
            'Tabla solo in Ek Taal and Rupak Taal',
            'Tabla solo in Ada Chautaal',
            'Punjabi, Tappa Taal, Sul Taal, Sawari, Matt Taal and Pharodast Taal with explanation'
        ]
    },
    'Grade 7': {
        theory: [
            'Peshkar, Kayda, Gat, Mukhda, Tukda, Paran, Chakradar, Farmaishi, Chakradar tihai (damdar and bedamdar), Uthan, Salami, Mohra',
            'Comparative study of Carnatic and Hindustani taal systems',
            'Saath-sangat for vocal, instrumental and dance; rhythm in classical, folk and film music; discipline of the percussion artist'
        ],
        practical: [
            'Badal theka, laggi, ladi, baant, tihai in Dadra, Keherwa, Dhumali, Deepchandi, Bhajan theka and Khemta',
            'Pleasant vilambit theka in Teen Taal, Ek Taal, Jhap Taal and Tilwada',
            'Basic thekas of Brahma, Shikhar, Rudra, Lakshmi and Pashto Taal',
            'Tabla solo in Matt Taal (9 matra)',
            'Compose and render new mukhda, tukda and tihai'
        ]
    },
    'Grade 8': {
        theory: [
            'Avanaddha instruments in Bharata\'s Natyashastra, Sangita Ratnakara, Sangita Parijata, Sangita Sara',
            'Making Tabla melodious and effective; biographies – Kanthe Maharaj, Ustad Natthu Khan, Mehboob Saab, Mirajkar, Ahmed Jan Thirakwa, Samta Prasad',
            'Accompanying with prior knowledge of the raag; national integration through programmes beyond jugalbandi'
        ],
        practical: [
            'Demonstrate with hand signs Chautaal, Dhamar, Sul Taal, Rupak Taal and Jhap Taal in Dugun, Tigun and Chowgun, and render them on Tabla',
            '2 kaydas of Tishra variety in Jhap Taal and Rupak Taal',
            'Teen Taal theka with tukda, paran, chakradar gat and tihai',
            'Laggi, ladi and tihai with special layakari in Keherwa and Dadra',
            'Basic theka in any laya, then vocal rendering of gat, paran, chakradar, farmaishi and playing the same'
        ]
    }
};

// ─── Tavil — Carnatic percussion grade exams ────────────────────────────────────

const TAVIL_EXAM: SubjectSyllabus = {
    'Grade 1': {
        theory: ['Definitions – Nada, Shruti, Swara, Laya, Raga, Tala, Jati, Gati, Suladi Sapta Talas', 'Unique contribution of Tavil vidwans'],
        practical: [
            'Pillaiyar paadam',
            'Introduction to Adi Tala and rendering the lesson orally with talam',
            '3 speeds – names and exercises',
            'Adi Talam – Oru Vazhi Paadam, Iru Vazhi Paadam and Nangu Vazhi Paadam',
            'Writing notations for the lessons learnt'
        ]
    },
    'Grade 2': {
        theory: [
            'Construction and techniques of the Thavil; Nadaswaram – origin, construction and playing technique',
            'Life sketches of Tyagaraja, Muthuswami Dikshitar and Shyama Shastry; a Tavil vidwan and his contribution',
            'Nadaswaram and Thavil as Raja Vadyam and Mangala Vadyam'
        ],
        practical: [
            'Explanation of Adi Tala',
            'Tisram for the basic Adi Tala lessons',
            'The 5 jathis and thathakaram',
            'Introduction to Rupaka Talam and its basics',
            'Mohra in Adi Tala'
        ]
    },
    'Grade 3': {
        theory: [
            'Construction and techniques of the upa pakka vadyas – Kanjira, Mridangam',
            'Definitions – Karani, Vettu Thattu, Hechchu, Taggu, Mohra, Korvai, Meettu, Chapu, Arachapu',
            'Musical forms – Gitam, Swarajathi, Jathiswaram; Tamil composers – Muthuthandavar, Marimutta Pillai, Arunachala Kavirayar, Gopalakrishna Bharati'
        ],
        practical: [
            'Korvais in Adi Talam for 1, 2 and 4 avartanams',
            'Manodharma in Adi Talam – uruttu sols, mohra, korvai and arudhi',
            'Rupaka Tala – Oru/Iru/Nangu Vazhi Paadam and tisram',
            'Korvais for Rupaka Tala',
            'Angas and introduction to the Sapta Talas'
        ]
    },
    'Grade 4': {
        theory: [
            'Lakshana granthas with reference to laya and percussion – Silapathikaram and Panchamarabu',
            'Composers – Jayadevar, Narayana Theerthar, Badrachala Ramadasa, Thirugnanasambandar, Appar, Sundarar, Manikkavasagar',
            'Musical forms – Varnams; upa pakka vadyas – Ghatam, Morsing'
        ],
        practical: [
            'Kanda Chapu Tala and basic exercises',
            'Korvais for Kanda Chapu',
            'Misra Chapu Tala and basic exercises',
            'Korvais for Misra Chapu',
            'Introduction to the 35 talas'
        ]
    },
    'Grade 5': {
        theory: [
            'Lakshana granthas – Tala Samuthiram, Chaccatputa Venba, Panniru Thirumurai',
            'Composers – Arunagirinathar, Oothukadu Venkata Kavi, Purandara Dasa, Annamayya; musical form – Kriti'
        ],
        practical: [
            'The 35 talas with thathakaram, rendered orally with talam',
            'Study of the 175 talas',
            'Jathis for Adi, Rupaka, Misra Chapu and Kanda Chapu',
            'Nadai sols for Adi Talam',
            'Playing for kucheri in Chatusra Jathi Eka Talam'
        ]
    },
    'Grade 6': {
        theory: [
            'Lakshana granthas – Sangita Ratnakara, Chaturdandi Prakasika, Sangita Sampradaya Pradarshini',
            'Kucheri paddhati – Nadaswaram and Tavil in concerts, temples and ritual occasions'
        ],
        practical: [
            'Mohra, korvai and arudi for 2-kalai Adi, Rupakam, Kanda Chapu and Misra Chapu',
            'Concepts of 4, 8, 16 and 32 kandams',
            'Playing for kritis in 2-kalai Adi, Rupaka, Kanda Chapu and Misra Chapu',
            'Creating arudis and korvais for different eduppus',
            'Kuraippu – Misra (Adi), Kanda (Rupaka), Tisra (Misra Chapu), Sankirna (Kanda Chapu), Chatusra (Sankeerna Chapu) and patterns for the 35 talas'
        ]
    },
    'Grade 7': {
        theory: [
            'Post-Trinity composers; musical forms – Padam, Javali, Thillana, Ragamalika',
            'Mallari – structure and handling; Marga and Desi talas; Tala Dasa Pranas; 108 talas with angas and aksharas',
            'Seats of music in South India – Tanjore, Mysore, Thiruvananthapuram, Chennai'
        ],
        practical: [
            'Tani avartanam – Adi, Rupakam, Kanda Chapu and Misra Chapu',
            'Applying korvais in different tala structures',
            'Mallaris – Theerta, Taligai, Ther and playing techniques',
            'Alarippu in Kanda Nadai set in Chatusra Jathi Eka tala',
            'Jathis in Kanda Nadai, sols in different nadais and arudis'
        ]
    },
    'Grade 8': {
        theory: [
            'Evolution of notations; contemporary Tavil luminaries and their styles',
            'Percussion instruments of South India; Hindustani percussion instruments; technology in Carnatic music'
        ],
        practical: [
            'Playing for an Adi Tala Varnam, Ata Tala Varnam, Pancharatna Kriti of Tyagaraja and Thillana',
            'Accompanying Neraval',
            'Ragam Tanam Pallavi with tani avartanam in 2-kalai Adi, Khanda Jathi Triputa and Misra Jathi Triputa talas',
            'Different nadais in Adi Talam – kanda, tisra, misra, sankeerna – with korvais',
            'Playing a concert for 1 hour'
        ]
    }
};

// ─── Flute (Carnatic) grade exams ───────────────────────────────────────────────

const FLUTE_CARNATIC: SubjectSyllabus = {
    'Grade 1': {
        theory: VOCAL_CARNATIC['Grade 1'].theory,
        practical: [
            'Sarali Varisai – 14 (3 speeds) in Harikambodhi',
            'Janta Varisai – 9 (3 speeds) in Harikambodhi',
            'Dhattu Varisais (3 speeds) in Harikambodhi',
            'Fingering for Mayamalavagowla – 3 speeds',
            'Blowing and tonguing techniques'
        ],
        notes: 'Beginner varisais are taught in Harikambodhi on the flute; Mayamalavagowla is introduced as a fingering exercise.'
    },
    'Grade 2': {
        theory: VOCAL_CARNATIC['Grade 2'].theory,
        practical: [
            'Fingering exercises; blowing of long notes',
            'Alankarams with talam on the foot',
            'Keezh sthayi and Mel sthayi varisais',
            'Alankarams in Kalyani, Keeravani, Natabhairavi, Pantuvarali',
            'Any 4 Gitams'
        ]
    },
    'Grade 3': {
        theory: VOCAL_CARNATIC['Grade 3'].theory,
        practical: [
            'Gitam in a vakra raga',
            'Swarajathi',
            'One Adi Tala Varnam (2 speeds)',
            'A simple song/kriti',
            'Laya exercises in Adi Tala – reckoning in hand and foot'
        ]
    },
    'Grade 4': {
        theory: VOCAL_CARNATIC['Grade 4'].theory,
        practical: [
            'Any 2 Adi Tala Varnams – one Suddha Madhyamam and one Prati Madhyamam',
            'Kritis in Mayamalavagowla, Gambira Nattai, Shanmugapriya, Mohanam',
            'Alankarams and Dattu Varisais in Sankarabaranam, Mohanam, Pantuvarali',
            'Any 3 from Thiruppavai, Thiruvasakam, Meenakshi Pillai Tamizh, Annamayya, patriotic song of Subramanya Bharati',
            'Laya exercises in Rupaka Tala and Kanda Chapu – reckoning in hand and foot'
        ]
    },
    'Grade 5': {
        theory: VOCAL_CARNATIC['Grade 5'].theory,
        practical: [
            'Alankarams and Dattu Varisais in Keeravani, Karaharapriya, Sriranjani, Madhyamavathi, Dharmavathi',
            '3 Adi Tala Varnams in Kedaragaula, Darbar or Begada',
            'Any 4 Kritis in Keeravani, Karaharapriya, Madhyamavathi, Dharmavathi, Begada',
            'Pancharatna Kriti of Tyagaraja – Arabhi',
            'Laya exercises for Misra Chapu – reckoning in hand and foot'
        ]
    },
    'Grade 6': {
        theory: VOCAL_CARNATIC['Grade 6'].theory,
        practical: [
            'One Ata Tala Varnam',
            'One Pada Varnam',
            'Any 4 Kritis with decorative angas (Chittaswaram, Swara Sahityam, Madhyamakala Sahityam) in Kambodhi, Purvikalyani, Saveri, Dhanyasi, Varali',
            'Tongue technique for Kalpana Swaras in Mayamalavagowla, Sankarabaranam, Mohanam, Keeravani',
            'One Thillana'
        ]
    },
    'Grade 7': {
        theory: VOCAL_CARNATIC['Grade 7'].theory,
        practical: [
            'One Ata Tala Varnam and one Daru Varnam',
            'One Padam and one Ragamalika',
            'One Pancharatna Kriti of Tyagaraja and one Swarajathi of Shyama Shastri',
            'Raga Alapana for any 2 of Kambodhi, Pantuvarali, Karaharapriya, Saveri',
            'Abhiprayams and korvai for Adi Talam and Rupakam with tala on the foot'
        ]
    },
    'Grade 8': {
        theory: VOCAL_CARNATIC['Grade 8'].theory,
        practical: [
            'Tanam blowing techniques',
            'RTP in Adi Talam',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Suddha Madhyama raga – Sankarabaranam, Saveri, Begada, Dhanyasi, Karaharapriya, Thodi, Kambodhi or Keeravani',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Prati Madhyama raga – Kalyani, Shanmugapriya, Pantuvarali, Purvikalyani, Varali, Simmendra Madhyamam, Lathangi or Subapantuvarali',
            'A Kriti with Raga Alapana and Kalpana Swaram in one Audava/Shadava raga – Lalitha, Arabhi, Bilahari, Sriranjani, Abhogi, Ritigaula, Madhyamavathi or Hindolam'
        ]
    }
};

// ─── Violin (Carnatic) grade exams ──────────────────────────────────────────────

const VIOLIN_CARNATIC: SubjectSyllabus = {
    'Grade 1': {
        theory: [
            'Introduction to the various systems of Indian music',
            'Nada and Sruti; pitch and its connotations',
            'Sapta swaras, the twelve swarasthanas and the sixteen-swara nomenclature',
            'Three sthayis; symbols used in basic notation',
            'Technical terms – Tala, Nadai, Anga, Avartana, Shadangas, Uttaranga and Purvanga'
        ],
        practical: [
            'Pre-Grade foundation – Sarali Varisais in Mayamalavagowla (plain notes, 3 speeds, with sruti); full/half/quarter bow lengths; Adi and Rupaka Tala in Chatusra Nadai in 3 speeds; a simple devotional song',
            'Janta Varisais in Mayamalavagowla – plain notes, 3 speeds, with sruti',
            'Dhattu Varisais in Mayamalavagowla – plain notes, 3 speeds, with sruti',
            'Tara Sthayi Varisais in Mayamalavagowla – 3 speeds',
            'Mandra Sthayi Varisais in Mayamalavagowla – 3 speeds',
            'Alankarams in Mayamalavagowla – Chatusra Jathi Eka, Chatusra Jathi Rupaka, Tisra Jathi Triputa (3 speeds)'
        ],
        notes: 'The official syllabus has a separate Pre-Grade (no theory exam) — folded in here as the foundation.'
    },
    'Grade 2': {
        theory: [
            'Musical forms – Alankaram and Gitam',
            'The 3 main angas; Sapta Talas; Pancha Jati; Jati Bheda; the 35 talas',
            'Parts of the violin – body, fingerboard, tailpiece, scroll, bridge, pegs, sound post',
            'The four strings – nomenclature and tuning',
            'Life sketches – Purandaradasar; the Trinity (Syama Sastri, Tyagaraja, Muthuswami Dikshitar); Arunagirinathar'
        ],
        practical: [
            'Alankarams in Mayamalavagowla and Sankarabharanam – Chatusra Jathi Matya, Chatusra Jathi Dhruva, Misra Jathi Jhampa, Khanda Jathi Ata (3 speeds)',
            'Gitams – any four (2 in Malahari, 2 in any other raga)',
            'Nottuswara Sahityas – 2',
            'Thiruppugazh or devotional song – 1',
            'Sing the above with tala and sahitya'
        ]
    },
    'Grade 3': {
        theory: [
            'Musical forms – Jatiswaram, Swarajati',
            'Types of Varnams – Tana, Pada, Chauka, Daru and Ragamalika',
            'Life sketches of the Tevaram Muvar – Thirugnanasambandar, Thirunavukkarasar, Sundaramurthi Nayanar',
            'Tyagaraja and his disciples',
            'Classification of instruments – Tata (string), Sushira (wind), Ghana (metallic), Avanaddha (percussion)'
        ],
        practical: [
            'Lakshana Gitam – 1 (any language)',
            'Jatiswaram – 1; Swarajati – 1',
            'Adi Tala Varnam – 1, rendered as swara and sahitya',
            'Divyanama Kirtanam – 1; Tevaram – 1',
            'Reckoning Adi Tala in Chatusra Nadai with shifting eduppu'
        ]
    },
    'Grade 4': {
        theory: [
            'The 12 Alwars and a life sketch of Andal',
            'Muthuswami Dikshitar and his disciples',
            'Baluswami Dikshitar and the adaptation of the violin into Indian music',
            'Raga classification – Janaka, Janya, Vakra, Varjya, Upanga, Bhashanga',
            'The 72 Mela scheme of Venkatamakhin'
        ],
        practical: [
            'All 7 Alankarams in Kalyani and Karaharapriya in 3 speeds',
            'Any 2 Adi Tala Varnams in 2 speeds from Sankarabharanam, Hamsadhwani, Mohanam, Kalyani',
            'Divya Prabandham – 1; Thiruvasakam or Ramadasar kriti – 1',
            'Thiru Arutpa or Annamacharya kriti – 1; patriotic song – 1',
            'Kirtanam – any 3 in Mayamalavagowla, Mohanam, Sankarabharanam, Arabhi, Hamsadhwani or Kalyani by Tyagaraja, Swathi Tirunal, Muthu Thandavar, Arunachala Kavirayar or Papanasam Sivan'
        ]
    },
    'Grade 5': {
        theory: [
            'Musical forms – Kriti, Ragamalika',
            'Study of Tala and the Tala Dasa Pranas',
            'Syama Sastri and his lineage',
            'Introduction to Pann – the Tamil tradition',
            'Study of instruments – Nadaswaram and Tavil'
        ],
        practical: [
            'Adi Tala Varnam – any 2 from Saveri, Kambhoji, Kalyani, Abhogi',
            'Jatiswaram – Vasanta',
            'Kirtanam – any 4 in Hamsadhwani, Madhyamavathi, Kalyani, Bilahari, Harikambhoji, Karaharapriya (Tyagaraja, Swathi Tirunal, Muthu Thandavar, Arunachala Kavirayar, Papanasam Sivan, Dikshitar, Syama Sastri, Gopalakrishna Bharathi, Neelakanta Sivan, Ramaswamy Sivan)',
            'Thiruppavai – 1 or Thiruvempavai – 1',
            'Subramanya Bharati or Bharathidasan song – 1'
        ]
    },
    'Grade 6': {
        theory: [
            'Kalpita and Manodharma Sangita; forms – Raga Alapana, Kalpana Swaram, Neraval, Ragam-Tanam-Pallavi',
            'Raga Lakshana and sancharas – Mohanam, Abhogi, Kalyani, Sankarabharanam',
            'Life histories – Jayadeva, Narayana Tirtha, Swathi Tirunal, Oothukadu Venkata Kavi',
            'Study of instruments – Tanpura, Veena, Violin',
            'Technical terms – Eduppu, decorative angas, Chittaswaram, Madhyamakala Sahitya, Samashti Charana, Swarakshara'
        ],
        practical: [
            'Adi Tala Varnam – any 2 from Thodi, Pantuvarali, Sriragam, Begada',
            'Khanda Jati Ata Tala Varnam – 1 (Bhairavi)',
            'Kritis – 2 in Bhairavi, Lathangi, Thodi, Darbar or Sahana (prescribed composers)',
            'Ashtapadi – 1; Kavadi Chindu – 1; Meera Bhajan – 1',
            'Kalpana Swaram in any 5 of Mohanam, Sankarabharanam, Hamsadhwani, Kalyani, Bhairavi, Arabhi, Pantuvarali, Karaharapriya'
        ]
    },
    'Grade 7': {
        theory: [
            'Dasavidha Gamakas',
            'Raga lakshanas of Karaharapriya, Bhairavi, Kambhoji, Thodi, Pantuvarali, Purvikalyani',
            'Musical forms – Padam, Javali, Thillana, Ragamalika',
            'Study of instruments – Flute, Mridangam',
            'Kutcheri Paddhati'
        ],
        practical: [
            'Khanda Jathi Ata Tala Varnam – 1 (Kalyani or Kanada)',
            'Ragamalika – 1; Pada Varnam – 1; Thillana – 1',
            'Tyagaraja Pancharatnam – 2 (one Ghana raga and one Kshetra kriti)',
            'Ramadasar kriti or Meenakshi Ammai Pillai Tamil – 1; Abhang or Kavimani Desiga Vinayagam Pillai – 1',
            'Neraval and Kalpana Swaram in any 4 of Mohanam, Sankarabharanam, Hamsadhwani, Kalyani, Bhairavi, Arabhi, Pantuvarali, Karaharapriya, Thodi'
        ]
    },
    'Grade 8': {
        theory: [
            'Group kritis',
            'Introduction to Hindustani music, Western music and folk music',
            'Comparative study of Carnatic and Hindustani ragas',
            'Raga lakshana of Darbar, Bilahari, Kedaragaula, Surutti, Anandabhairavi, Sahana, Saveri',
            'Mathematics in music – Kovai, Kanakku, Porutham'
        ],
        practical: [
            'Padam – 1; Javali – 1',
            'Syama Sastri Swarajati – 1',
            'Bhajan – 1; group kriti of Muthuswami Dikshitar – 1',
            'Ragam Tanam Pallavi – 1',
            'Raga Alapana, Neraval and Kalpana Swara for any 3 ragas already covered'
        ]
    }
};

// ─── Lookup ─────────────────────────────────────────────────────────────────────

export const GRADE_SYLLABUS: Record<string, SubjectSyllabus> = {
    'Sangeetham (Vocal)': VOCAL_CARNATIC,
    'Mridangam': MRIDANGAM_EXAM,
    'Tabla': TABLA_EXAM,
    'Tavil': TAVIL_EXAM,
    'Flute (Carnatic)': FLUTE_CARNATIC,
    'Violin (Carnatic)': VIOLIN_CARNATIC,
    'Bharatanatyam (Dance)': BHARATANATYAM
};

export const getGradeSyllabus = (subject: string, grade: string): GradeSyllabus | null =>
    GRADE_SYLLABUS[subject]?.[grade] ?? null;

/** Derive a "Topic N: …" list from a grade syllabus (for subjects with no hand-authored topic tree). */
export const syllabusToTopics = (entry: GradeSyllabus): string[] => {
    const items = [
        ...entry.practical.map(p => `Practical – ${p}`),
        ...entry.theory.map(t => `Theory – ${t}`)
    ];
    return items.map((text, i) => `Topic ${i + 1}: ${text}`);
};
