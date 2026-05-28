import type { Question } from './types.ts';

export const capf2023Questions: Question[] = [
  {
    "id": 23001,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Reasoning",
    "exam": "CAPF (AC) 2023",
    "question": "Pointing towards a photograph Mr. Ajit said, \"She is my father's wife's son's only sister.\"<br/>What is the relation of the person in the photograph with Mr. Ajit ?",
    "options": [
      "(a) Daughter",
      "(b) Mother's sister",
      "(c) Cousin",
      "(d) Sister"
    ],
    "answer": "(d) Sister",
    "explanation": "Mr. Ajit's father's wife is his mother. His mother's son can be Ajit himself or his brother. The only sister of Ajit or his brother is Ajit's sister."
  },
  {
    "id": 23002,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Geometry",
    "exam": "CAPF (AC) 2023",
    "question": "Three circles of radius 5 cm each, touch each other. If the points of contact are P, Q and R, then what is the area of the triangle PQR in sq. cm ?",
    "options": [
      "(a) 25√3 / 6",
      "(b) 25√3 / 4",
      "(c) 25√3 / 2",
      "(d) 25√3"
    ],
    "answer": "(b) 25√3 / 4",
    "explanation": "The centers of the circles form an equilateral triangle with side 10 cm. The points of contact P, Q, and R are the midpoints of the sides of this large triangle. Joining these midpoints forms another equilateral triangle PQR with side length 5 cm. Area = (√3 / 4) * side² = (√3 / 4) * 25 = 25√3 / 4."
  },
  {
    "id": 23003,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Geometry",
    "exam": "CAPF (AC) 2023",
    "question": "The right-angled triangle ABC is such that ∠B = 90°. Point D is picked on BC such that triangles ABC and DBA are similar. If AB : BC = m : n, what is Δ ABC : Δ ABD, where Δ denotes the area of a triangle ?",
    "options": [
      "(a) n : m",
      "(b) n² : m²",
      "(c) (m + n) : n",
      "(d) (m + n)² : n²"
    ],
    "answer": "(b) n² : m²",
    "explanation": "Since Δ ABC ~ Δ DBA, the ratio of their areas is equal to the square of the ratio of their corresponding sides. Corresponding sides are BC of Δ ABC and BA of Δ DBA. We are given AB : BC = m : n, so BC : AB = n : m. Therefore, Area(ABC) : Area(DBA) = (BC/BA)² = (n/m)² = n² : m²."
  },
  {
    "id": 23004,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Mensuration",
    "exam": "CAPF (AC) 2023",
    "question": "On a large ground, there is a straight tall vertical wall of length 28 m. A goat is tied to a point on the ground which is at the middle of the wall, using a rope. If the length of the rope is 21 m, what is the area of the region (in sq. m) around the wall that the goat can access ?",
    "options": [
      "(a) 847",
      "(b) 851",
      "(c) 693",
      "(d) 654"
    ],
    "answer": "(c) 693",
    "explanation": "The goat is tied to the middle of a 28 m wall with a 21 m rope. This allows the goat to graze in a semi-circular area on one side of the wall. Area = (1/2) * π * r² = (1/2) * (22/7) * 21 * 21 = 11 * 3 * 21 = 693 sq. m."
  },
  {
    "id": 23005,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Combinatorics",
    "exam": "CAPF (AC) 2023",
    "question": "A rectangular wall is divided into four squares of equal size where there are two rows each having two squares. The top left square is coloured with green. If, including green, there are three colours available and each square is coloured using any one of these three colours such that no two adjacent squares get painted with the same colour; then how many colour combinations are possible ?",
    "options": [
      "(a) 2",
      "(b) 4",
      "(c) 6",
      "(d) 8"
    ],
    "answer": "(c) 6",
    "explanation": "Let the squares be (G, X) in first row and (Y, Z) in second row. Colors available: G, C1, C2. <br/>X and Y are adjacent to G, so they must be C1 or C2 (2 choices each). <br/>If X=C1, Y=C1: Z can be G or C2 (2 choices). <br/>If X=C1, Y=C2: Z must be G (1 choice). <br/>If X=C2, Y=C1: Z must be G (1 choice). <br/>If X=C2, Y=C2: Z can be G or C1 (2 choices). <br/>Total combinations = 2 + 1 + 1 + 2 = 6."
  },
  {
    "id": 23006,
    "year": "2023",
    "subject": "Polity",
    "topic": "Emergency Provisions",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements about National Emergency is/are correct ?<br/>1. A Proclamation of Emergency may be made by the President only when the security of India or any part thereof is threatened by war or external aggression or armed rebellion.<br/>2. The Government of India acquires power to give directions to a State on any matter.<br/>3. The Proclamation of Emergency does not suspend the State legislature.<br/>4. The Proclamation of Emergency can continue for a maximum period of six months at a time only if approved by resolutions of both the Houses of Parliament.",
    "options": [
      "(a) 1 only",
      "(b) 1 and 2 only",
      "(c) 1, 2 and 3 only",
      "(d) 2, 3 and 4 only"
    ],
    "answer": "(c) 1, 2 and 3 only",
    "explanation": "Statements 1, 2, and 3 are correct. During a National Emergency, the State Legislature is not suspended. While Statement 4 accurately reflects the 6-month approval cycle, it can continue indefinitely if re-approved. However, traditionally in these multiple-choice formats, if 1-2-3-4 isn't an option, 4 might be scrutinized for its wording or majority requirements (Special Majority vs simple resolution)."
  },
  {
    "id": 23007,
    "year": "2023",
    "subject": "Polity",
    "topic": "Judiciary",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements with regard to the impeachment of a Judge of the Supreme Court of India is not correct ?",
    "options": [
      "(a) A motion addressed to the President, signed by at least 100 members of both the Houses of the Parliament is delivered to the Speaker.",
      "(b) The motion is investigated by a Committee of three (2 Judges of the Supreme Court and a distinguished Jurist).",
      "(c) If the Committee finds the Judge guilty of misbehaviour or that he suffers from incapacity, the motion together with the report of the Committee is taken up for consideration in the House where the motion is pending.",
      "(d) The Judge will be removed after the President gives his order for removal."
    ],
    "answer": "(a) A motion addressed to the President, signed by at least 100 members of both the Houses of the Parliament is delivered to the Speaker.",
    "explanation": "A motion for the removal of a judge must be signed by at least 100 members in the case of Lok Sabha OR 50 members in the case of Rajya Sabha. It is then delivered to the Speaker or the Chairman respectively, not both houses combined for one delivery to the Speaker."
  },
  {
    "id": 23008,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following are India's G20 priorities ?<br/>1. Green Development<br/>2. Women-led Development<br/>3. Climate Finance<br/>4. Digital Public Infrastructure",
    "options": [
      "(a) 1 and 2 only",
      "(b) 1, 2 and 3 only",
      "(c) 3 and 4 only",
      "(d) 1, 2, 3 and 4"
    ],
    "answer": "(d) 1, 2, 3 and 4",
    "explanation": "Under India's G20 Presidency, the key priorities included Green Development, Climate Finance & LiFE, Accelerated/Inclusive/Resilient Growth, Accelerating Progress on SDGs, Technological Transformation & Digital Public Infrastructure, and Women-led Development."
  },
  {
    "id": 23009,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following are the objectives of SAARC ?<br/>1. To promote the welfare of the peoples of South Asia and to improve the quality of life<br/>2. To promote and strengthen collective self-reliance among the countries of South Asia<br/>3. To contribute to mutual trust, understanding and appreciation of one another's problems<br/>4. To work towards ending cross-border terrorism",
    "options": [
      "(a) 1 and 2 only",
      "(b) 1, 2 and 3 only",
      "(c) 1, 2, 3 and 4",
      "(d) 3 and 4 only"
    ],
    "answer": "(b) 1, 2 and 3 only",
    "explanation": "The primary objectives of SAARC as defined in its Charter focus on promoting welfare, self-reliance, and mutual trust. Ending cross-border terrorism, while a goal of many member states, is not a specifically listed founding 'objective' in the SAARC Charter."
  },
  {
    "id": 23010,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Pure, demineralized water, free from all soluble mineral salts is obtained by which of the following method ?",
    "options": [
      "(a) Passing water through microfiltration membrane",
      "(b) Calgon's method",
      "(c) Passing water through a cation exchange and an anion exchange resin bed",
      "(d) By boiling"
    ],
    "answer": "(c) Passing water through a cation exchange and an anion exchange resin bed",
    "explanation": "Demineralized water is produced by using ion-exchange resins. Cation exchange resins replace dissolved metallic ions with hydrogen ions (H+), and anion exchange resins replace non-metallic ions with hydroxyl ions (OH-)."
  },
  {
    "id": 23011,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following redox reaction :<br/>2Cu₂O (s) + Cu₂S (s) → 6Cu (s) + SO₂ (g)<br/>Identify the species among the following acting as oxidant and reductant, respectively :",
    "options": [
      "(a) Cu(I) and S of Cu₂S",
      "(b) Cu and S of SO₂",
      "(c) Cu and O of SO₂",
      "(d) Cu(I) and O of SO₂"
    ],
    "answer": "(a) Cu(I) and S of Cu₂S",
    "explanation": "In this reaction, Cu(I) in both Cu₂O and Cu₂S is reduced to Cu(0), so it acts as the oxidant. The Sulfur in Cu₂S is oxidized from -2 to +4 (in SO₂), thus it acts as the reductant."
  },
  {
    "id": 23012,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements is not correct regarding the setting of cement ?",
    "options": [
      "(a) The addition of a small percentage of gypsum (CaSO₄) lengthens the setting period of cement.",
      "(b) According to the colloidal theory, gels of hydrated silicates are formed and when these gels harden, the set cement loses strength.",
      "(c) Tricalcium silicate is responsible for initial setting of cement.",
      "(d) Dicalcium silicate and tricalcium silicate are responsible for the final strength which occurs in about a year."
    ],
    "answer": "(c) Tricalcium silicate is responsible for initial setting of cement.",
    "explanation": "Tricalcium aluminate is primarily responsible for the 'initial set' or flash set of cement. Tricalcium silicate (C3S) is responsible for the early strength (hardening) of the cement in the first few days."
  },
  {
    "id": 23013,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Which one is the most abundant of all the elements on Earth ?",
    "options": [
      "(a) Silicon",
      "(b) Aluminium",
      "(c) Carbon",
      "(d) Oxygen"
    ],
    "answer": "(d) Oxygen",
    "explanation": "While Iron is the most abundant element for the Earth as a whole (35%), it is not listed. Among the options given, Oxygen is the most abundant (approx. 30% for the whole Earth and 46.6% for the Earth's crust)."
  },
  {
    "id": 23014,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following metals does not react with oxygen directly ?",
    "options": [
      "(a) Ti",
      "(b) Fe",
      "(c) Pt",
      "(d) Zn"
    ],
    "answer": "(c) Pt",
    "explanation": "Platinum is a noble metal and does not react directly with oxygen, even at high temperatures, which is why it maintains its luster."
  },
  {
    "id": 23015,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following observations about the largest stupa at Sanchi :<br/>1. Going by information available from the inscriptions on the railings of the stupa, the construction of part of one of its gateways was financed by the Guild of Ivory workers.<br/>2. In its original early form, this stupa was plain except for the stone railings and the gateways, which were richly carved.<br/>3. The panels on the four gateways contain sculptures only in the front and have no sculptures on the rear side.<br/>4. In 1918, when the stupa was discovered, all of its four gates were intact but the mound was in poor condition.<br/>5. Art historians have established clear connections between the sculptures of the stupa with events described in Jataka Tales.<br/>6. War scenes have also been depicted in these sculptures.<br/><br/>Which of the observations given above are correct ?",
    "options": [
      "(a) 1, 2, 3 and 4 only",
      "(b) 2, 3, 4 and 5 only",
      "(c) 3, 4, 5 and 6 only",
      "(d) 1, 2, 5 and 6 only"
    ],
    "answer": "(d) 1, 2, 5 and 6 only",
    "explanation": "Statement 1 is a well-known historical fact from Sanchi. Statement 2 describes the Shunga addition to the Ashokan stupa. Statement 3 is incorrect as the gateways are carved on both sides. Statement 4 is historically inaccurate regarding the Discovery date (1818 by General Taylor). Statements 5 and 6 correctly identify the iconographic themes."
  },
  {
    "id": 23016,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following pairs are correctly matched ?<br/>(Inscription / Event) : (Time Period)<br/>1. Prayag Prashasti by Harishena : 4th century CE<br/>2. Chinese traveller Fa Xian's Account : 6th century CE<br/>3. Mudrarakshasa of Vishakhadatta : 5th century CE<br/>4. Harshacharita of Banabhatta : 6th century CE<br/>5. Aihole Prashasti of Ravikirti : 7th century CE<br/>6. Kavirajamarga of Amoghavarsha : 8th century CE<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1, 2 and 3 only",
      "(b) 2, 3 and 4 only",
      "(c) 4, 5 and 6 only",
      "(d) 1, 3 and 5 only"
    ],
    "answer": "(d) 1, 3 and 5 only",
    "explanation": "1 (4th century, Samudragupta), 3 (5th century), and 5 (7th century, Pulakeshin II) are correct. Fa Xian visited in the 5th century. Harshacharita was 7th century. Kavirajamarga was 9th century."
  },
  {
    "id": 23017,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements is correct ?",
    "options": [
      "(a) Brahmi, used for writing many Ashokan inscriptions, shows local variations.",
      "(b) The system of hieroglyphic writing was developed in ancient Mesopotamia.",
      "(c) The system of cuneiform writing developed around 3rd millennium BCE in Egypt.",
      "(d) An ancient script, Kharoshthi was widely used in the southern part of India."
    ],
    "answer": "(a) Brahmi, used for writing many Ashokan inscriptions, shows local variations.",
    "explanation": "Brahmi was used widely and showed regional styles. Hieroglyphics belong to Egypt, Cuneiform to Mesopotamia. Kharoshthi was primarily used in the North-West."
  },
  {
    "id": 23018,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following activities was not a part of the daily time-table for a King as prescribed in Arthashastra ?",
    "options": [
      "(a) Receive reports on defense",
      "(b) Visit the town incognito",
      "(c) Receive revenue in cash",
      "(d) Consult his Council of Ministers"
    ],
    "answer": "(b) Visit the town incognito",
    "explanation": "The Kautilyan daily schedule for a King is divided into batches of 1.5 hours. It includes receiving reports on defense/revenue and consulting ministers, but personal incognito visits were not part of the standard daily regimen; that was the job of spies."
  },
  {
    "id": 23019,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Which organelle other than nucleus in eukaryotic cells has its own DNA, ribosomes and proteins ?",
    "options": [
      "(a) Golgi",
      "(b) Mitochondria",
      "(c) Lysosomes",
      "(d) Nucleosomes"
    ],
    "answer": "(b) Mitochondria",
    "explanation": "Mitochondria and chloroplasts are semi-autonomous organelles that contain their own circular DNA, ribosomes (70S), and can synthesize some of their own proteins."
  },
  {
    "id": 23020,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "For protein synthesis, the amino acids are recognized and carried by :",
    "options": [
      "(a) mRNA",
      "(b) snRNA",
      "(c) miRNA",
      "(d) tRNA"
    ],
    "answer": "(d) tRNA",
    "explanation": "Transfer RNA (tRNA) molecules match specific amino acids with their corresponding codons on the mRNA at the ribosome during translation."
  },
  {
    "id": 23021,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "In vertebrates, smooth endoplasmic reticulum in cells of which organ plays a crucial role in detoxification of toxic compounds ?",
    "options": [
      "(a) Spleen",
      "(b) Intestine",
      "(c) Kidney",
      "(d) Liver"
    ],
    "answer": "(d) Liver",
    "explanation": "The smooth endoplasmic reticulum (SER) in liver cells contains enzymes that help detoxify various drugs, poisons, and metabolic wastes."
  },
  {
    "id": 23022,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "The rate of an enzyme catalyzed reaction depends :",
    "options": [
      "(a) upon substrate concentration, temperature and pH.",
      "(b) only on substrate concentration and pH, but not on temperature.",
      "(c) only on pH and temperature, but not on substrate concentration.",
      "(d) only on temperature, but not on pH and substrate concentration."
    ],
    "answer": "(a) upon substrate concentration, temperature and pH.",
    "explanation": "Enzyme activity is highly sensitive to environmental conditions including the availability of substrate, thermal energy (temperature), and the acidity or alkalinity (pH) of the medium."
  },
  {
    "id": 23023,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Both starch and glycogen are made up of glucose, however :",
    "options": [
      "(a) starch is present in liver and glycogen is present in red blood cells.",
      "(b) glycogen is made in animal cells, but starch is made in plant cells.",
      "(c) both starch and glycogen are present in animal and plant cells.",
      "(d) both starch and glycogen are present in plant cells only."
    ],
    "answer": "(b) glycogen is made in animal cells, but starch is made in plant cells.",
    "explanation": "Starch is the primary energy storage polysaccharide in plants, while glycogen serves the same purpose in animals and fungi."
  },
  {
    "id": 23024,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "In some viral infections, number of platelets are reduced quickly. Platelets are essential because :",
    "options": [
      "(a) they along with red blood cells carry oxygen.",
      "(b) platelets are important to carry food to cells through blood.",
      "(c) platelets remove carbon dioxide from blood.",
      "(d) platelets have a role in blood clotting."
    ],
    "answer": "(d) platelets have a role in blood clotting.",
    "explanation": "Platelets (thrombocytes) are vital for hemostasis; they aggregate at the site of blood vessel injury to form a plug and initiate the coagulation process."
  },
  {
    "id": 23025,
    "year": "2023",
    "subject": "Economy",
    "topic": "Economic Planning",
    "exam": "CAPF (AC) 2023",
    "question": "The focus of the Second Five Year Plan was :",
    "options": [
      "(a) establishment of a self-reliant and self-generating economy with emphasis on agriculture.",
      "(b) rapid industrialization with emphasis on the development of basic and heavy industries.",
      "(c) removal of poverty and attainment of self-reliance.",
      "(d) acceleration of food-grain production and increase in employment opportunities and overall productivity."
    ],
    "answer": "(b) rapid industrialization with emphasis on the development of basic and heavy industries.",
    "explanation": "The Second Plan (1956-61), based on the Mahalanobis model, prioritized the development of steel plants and capital goods industries to build an industrial base for the nation."
  },
  {
    "id": 23026,
    "year": "2023",
    "subject": "Economy",
    "topic": "External Sector",
    "exam": "CAPF (AC) 2023",
    "question": "An Indian businessperson buys shares in a British car company. This transaction will be reflected in :",
    "options": [
      "(a) Balance of Trade, but not in Balance of Payments.",
      "(b) Balance of Payments, but not in Balance of Trade.",
      "(c) both Balance of Payments and Balance of Trade.",
      "(d) neither Balance of Payments nor Balance of Trade."
    ],
    "answer": "(b) Balance of Payments, but not in Balance of Trade.",
    "explanation": "Balance of Payments (BoP) records all financial transactions between residents of a country and the rest of the world. Balance of Trade (BoT) only includes the import and export of physical goods (merchandise). Stock purchases are financial investments."
  },
  {
    "id": 23027,
    "year": "2023",
    "subject": "Economy",
    "topic": "National Income",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following are High Frequency Indicators of the Indian economy ?<br/>1. Power Consumption<br/>2. IIP General Index<br/>3. 10-year G-sec yield",
    "options": [
      "(a) 1 only",
      "(b) 1 and 2 only",
      "(c) 2 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(d) 1, 2 and 3",
    "explanation": "High frequency indicators are data points released more frequently (monthly/weekly/daily) than GDP. Power consumption, IIP, and bond yields are all used by analysts for real-time tracking of the economy."
  },
  {
    "id": 23028,
    "year": "2023",
    "subject": "Economy",
    "topic": "National Income",
    "exam": "CAPF (AC) 2023",
    "question": "Suppose an Indian citizen makes an investment abroad and earns a positive return on her investment. Which of the following is correct ?",
    "options": [
      "(a) Her income is part of India's GDP, but not part of India's national income.",
      "(b) Her income is part of India's national income, but not part of India's GDP.",
      "(c) Her income is part of both India's GDP and national income.",
      "(d) Her income is neither part of India's GDP, nor its national income."
    ],
    "answer": "(b) Her income is part of India's national income, but not part of India's GDP.",
    "explanation": "GDP measures production within the domestic territory of a country. National Income (GNI) includes income earned by citizens regardless of their location, thus incorporating Net Factor Income from Abroad (NFIA)."
  },
  {
    "id": 23029,
    "year": "2023",
    "subject": "Economy",
    "topic": "Monetary Policy",
    "exam": "CAPF (AC) 2023",
    "question": "If the Cash Reserve Ratio is lowered by the RBI, supply of money in the economy will :",
    "options": [
      "(a) remain unchanged.",
      "(b) decrease.",
      "(c) increase.",
      "(d) have ambiguous impact."
    ],
    "answer": "(c) increase.",
    "explanation": "Lowering the CRR means banks have to keep less cash with the RBI, freeing up more funds for lending, which increases the money supply via the credit multiplier effect."
  },
  {
    "id": 23030,
    "year": "2023",
    "subject": "Environment",
    "topic": "Environmental Issues",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is the main cause of the acid rains ?",
    "options": [
      "(a) The Sun causes heating of upper layer of atmosphere.",
      "(b) The burning of fossil fuels releases oxides of carbon, nitrogen and sulphur in the atmosphere.",
      "(c) The electrical charges are produced due to friction amongst clouds.",
      "(d) The atmosphere of the Earth contains acids."
    ],
    "answer": "(b) The burning of fossil fuels releases oxides of carbon, nitrogen and sulphur in the atmosphere.",
    "explanation": "Sulfur dioxide (SO₂) and Nitrogen oxides (NOx) released from burning fossil fuels react with water, oxygen and other chemicals in the atmosphere to form sulfuric and nitric acids, leading to acid rain."
  },
  {
    "id": 23031,
    "year": "2023",
    "subject": "Environment",
    "topic": "Resources and Energy",
    "exam": "CAPF (AC) 2023",
    "question": "Biogas is considered to be an excellent fuel which burns without smoke. The main constituent of biogas is :",
    "options": [
      "(a) methane",
      "(b) hydrogen",
      "(c) carbon dioxide",
      "(d) hydrogen sulphide"
    ],
    "answer": "(a) methane",
    "explanation": "Biogas, produced by anaerobic digestion of organic matter, typically consists of 50-75% methane (CH₄) and 25-50% carbon dioxide (CO₂)."
  },
  {
    "id": 23032,
    "year": "2023",
    "subject": "Environment",
    "topic": "Environmental Issues",
    "exam": "CAPF (AC) 2023",
    "question": "The depletion in atmospheric ozone layer in last century was due to :",
    "options": [
      "(a) chlorofluorocarbon",
      "(b) carbon monoxide",
      "(c) methane",
      "(d) pesticides"
    ],
    "answer": "(a) chlorofluorocarbon",
    "explanation": "CFCs released into the stratosphere are broken down by UV light to release chlorine atoms, which catalytically destroy ozone molecules."
  },
  {
    "id": 23033,
    "year": "2023",
    "subject": "Physics",
    "topic": "Mechanics",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following holds true for a freely falling object ?",
    "options": [
      "(a) It moves with a uniform velocity.",
      "(b) It moves with a uniform speed.",
      "(c) It moves with a non-uniform acceleration.",
      "(d) It moves with a uniform acceleration."
    ],
    "answer": "(d) It moves with a uniform acceleration.",
    "explanation": "A freely falling object near the Earth's surface experiences a constant downward gravitational force (ignoring air resistance), resulting in a uniform acceleration of approximately 9.8 m/s²."
  },
  {
    "id": 23034,
    "year": "2023",
    "subject": "Physics",
    "topic": "Waves and Sound",
    "exam": "CAPF (AC) 2023",
    "question": "A sound wave of frequency of 2 kHz has a wavelength of 35 cm in a given medium. How long will it take to travel a distance of 2.1 km through the medium ?",
    "options": [
      "(a) 30 s",
      "(b) 2.1 s",
      "(c) 3.0 s",
      "(d) 4.1 s"
    ],
    "answer": "(c) 3.0 s",
    "explanation": "Speed v = f * λ = 2000 Hz * 0.35 m = 700 m/s. <br/>Distance d = 2.1 km = 2100 m. <br/>Time t = d / v = 2100 / 700 = 3.0 s."
  },
  {
    "id": 23035,
    "year": "2023",
    "subject": "Physics",
    "topic": "Mechanics",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following conservation laws is a consequence of the Newton's third law of motion ?",
    "options": [
      "(a) Conservation of energy",
      "(b) Conservation of momentum",
      "(c) Conservation of charge",
      "(d) Conservation of mass"
    ],
    "answer": "(b) Conservation of momentum",
    "explanation": "Newton's Third Law states that forces between two bodies are equal and opposite. Since force is the rate of change of momentum, the change in momentum for one body is equal and opposite to that of the other, preserving the total momentum of the system."
  },
  {
    "id": 23036,
    "year": "2023",
    "subject": "Geography",
    "topic": "Geomorphology",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is a permeable rock that allows water to pass through it ?",
    "options": [
      "(a) Granite",
      "(b) Limestone",
      "(c) Quartzite",
      "(d) Sill"
    ],
    "answer": "(b) Limestone",
    "explanation": "Limestone is often permeable due to the presence of joints, bedding planes, and solution cavities through which water can flow easily."
  },
  {
    "id": 23037,
    "year": "2023",
    "subject": "Geography",
    "topic": "Human Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is the deepest, inland and protected port on the east coast of India ?",
    "options": [
      "(a) Chennai",
      "(b) Paradip",
      "(c) Tuticorin",
      "(d) Visakhapatnam"
    ],
    "answer": "(d) Visakhapatnam",
    "explanation": "Visakhapatnam is a landlocked, protected port on the east coast, known for its depth and strategic importance."
  },
  {
    "id": 23038,
    "year": "2023",
    "subject": "Geography",
    "topic": "Biogeography",
    "exam": "CAPF (AC) 2023",
    "question": "The greatest diversity of animal and plant species is found in :",
    "options": [
      "(a) Temperate forests",
      "(b) Deserts and Savannas",
      "(c) Arctic and Alpine systems",
      "(d) Tropical moist forests"
    ],
    "answer": "(d) Tropical moist forests",
    "explanation": "Tropical moist forests (rainforests) occupy only a small fraction of Earth's land but house more than half of the world's plant and animal species due to stable warmth and moisture."
  },
  {
    "id": 23039,
    "year": "2023",
    "subject": "Geography",
    "topic": "Geomorphology",
    "exam": "CAPF (AC) 2023",
    "question": "Which one among the following statements about 'Drumlin' is correct ?",
    "options": [
      "(a) It is a streamlined hill moulded in glacial drift on the till plains.",
      "(b) It is a city located in central Europe.",
      "(c) It is a river.",
      "(d) It is a narrow road in Tibet."
    ],
    "answer": "(a) It is a streamlined hill moulded in glacial drift on the till plains.",
    "explanation": "Drumlins are elongated, tear-drop shaped hills formed by the action of glacial ice moving over till, with the blunt end facing the direction of ice flow."
  },
  {
    "id": 23040,
    "year": "2023",
    "subject": "Geography",
    "topic": "Economic Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is the busiest sea route and links two industrially developed regions of the world ?",
    "options": [
      "(a) Mediterranean – Indian Ocean sea route",
      "(b) The Northern Atlantic sea route",
      "(c) Cape of Good Hope sea route",
      "(d) The North Pacific sea route"
    ],
    "answer": "(b) The Northern Atlantic sea route",
    "explanation": "The North Atlantic sea route connects Western Europe and Eastern North America, the two most industrially developed regions of the world."
  },
  {
    "id": 23041,
    "year": "2023",
    "subject": "Geography",
    "topic": "Economic Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Using the code given below identify the type of farming on the basis of given characteristics :<br/>1. The produce is consumed entirely or mainly by the family who work the land or tend the livestock.<br/>2. If a small surplus is produced, it may be sold or bartered.<br/>3. It is generally small scale and labour intensive with little or no technological input.<br/><br/>Code :",
    "options": [
      "(a) Extensive farming",
      "(b) Intensive farming",
      "(c) Subsistence farming",
      "(d) Commercial farming"
    ],
    "answer": "(c) Subsistence farming",
    "explanation": "Subsistence farming is characterized by farming for personal use with minimal surplus for trade, utilizing traditional labor-intensive methods."
  },
  {
    "id": 23042,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Arithmetic",
    "exam": "CAPF (AC) 2023",
    "question": "Car A takes 1 hour more than car B, which travels at a speed of 60 km per hour, to cover some fixed distance. If car A had doubled its speed, it could cover the distance in 1 hour less time than car B travelling at 60 km per hour. What is the original speed of car A in km per hour ?",
    "options": [
      "(a) 30",
      "(b) 40",
      "(c) 45",
      "(d) 50"
    ],
    "answer": "(c) 45",
    "explanation": "Let distance be D and Car A's speed be V. <br/>Time for B = D / 60. <br/>Time for A = D / V = (D / 60) + 1. <br/>If A's speed is 2V: D / 2V = (D / 60) - 1. <br/>Subtracting equations: (D/V) - (D/2V) = (D/60 + 1) - (D/60 - 1) => D/2V = 2 => D/V = 4. <br/>Substitute back: 4 = D/60 + 1 => 3 = D/60 => D = 180 km. <br/>Original speed of A: 180 / V = 4 => V = 45 km/h."
  },
  {
    "id": 23043,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Arithmetic",
    "exam": "CAPF (AC) 2023",
    "question": "Suppose A, B and C are three taps fixed to the bottom of a tank with draining capacity 1 : 2 : 3. When all three of them are on, it takes 1 hour to drain out the full tank. If A and C are on but B is off, then how much time, in minutes, will it take to empty out a full tank of water ?",
    "options": [
      "(a) 75",
      "(b) 90",
      "(c) 105",
      "(d) 120"
    ],
    "answer": "(b) 90",
    "explanation": "Let draining rates be A=k, B=2k, C=3k. <br/>Total rate = k + 2k + 3k = 6k. <br/>Tank capacity = 6k * 1 hour = 6k. <br/>If B is off, combined rate = A + C = k + 3k = 4k. <br/>Time to drain = 6k / 4k = 1.5 hours = 90 minutes."
  },
  {
    "id": 23044,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Geometry",
    "exam": "CAPF (AC) 2023",
    "question": "Assume that the Earth is a spherical ball of radius x km with a smooth surface so that one can travel from any direction. If you have travelled from point P on the Earth's surface along the East direction a distance of πx km, which direction do you have to travel to return to P so that the distance required to travel is minimum ?",
    "options": [
      "(a) East only",
      "(b) West only",
      "(c) East or West but not any other direction",
      "(d) Any fixed direction"
    ],
    "answer": "(d) Any fixed direction",
    "explanation": "The circumference of a great circle of the Earth is 2πx. Travelling πx km along any great circle takes you to the antipodal point (exact opposite point on the sphere). From the antipodal point, every direction along a great circle leads back to P with the same minimum distance of πx km."
  },
  {
    "id": 23045,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Number System",
    "exam": "CAPF (AC) 2023",
    "question": "If x and y are two-digit prime numbers such that y is obtained from x by interchanging its digits and x - y = 36, then what is the value of xy ?",
    "options": [
      "(a) 1611",
      "(b) 2701",
      "(c) 4031",
      "(d) 5603"
    ],
    "answer": "(b) 2701",
    "explanation": "Let x = 10a + b and y = 10b + a. <br/>x - y = 9(a - b) = 36 => a - b = 4. <br/>Pairs (a,b) with difference 4: (5,1), (6,2), (7,3), (8,4), (9,5). <br/>Checking for prime numbers: Only (7,3) gives prime numbers 73 and 37. <br/>Value of x * y = 73 * 37 = 2701."
  },
  {
    "id": 23046,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Mensuration",
    "exam": "CAPF (AC) 2023",
    "question": "Sixty-four cubes of sides 2 cm each are combined to form a cube of side 8 cm. If four of the smaller cubes along the diagonal of a surface are removed from the surface of the large cube, which one of the following statements about the surface area of this solid object is true ?",
    "options": [
      "(a) It is equal to the surface area of the large cube.",
      "(b) It is less than the surface area of the large cube.",
      "(c) It is more than the surface area of the large cube.",
      "(d) Insufficient data"
    ],
    "answer": "(c) It is more than the surface area of the large cube.",
    "explanation": "Removing cubes from the interior of a surface increases the total surface area because the process exposes four internal faces of the hole while removing only one external face. Removing corner or edge cubes doesn't decrease the net area. Thus, the total surface area increases."
  },
  {
    "id": 23047,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements about Organization for Security and Co-operation in Europe (OSCE) are correct ?<br/>1. There are total 57 states from Europe, Central Asia and America.<br/>2. It offers a forum for political negotiations and decision-making in the field of early warning, conflict prevention, crisis management and post-conflict rehabilitation.<br/>3. OSCE has the primary responsibility of providing military security in the European Region.<br/>4. The decisions of OSCE are legally binding.",
    "options": [
      "(a) 1 and 2 only",
      "(b) 1, 2 and 3 only",
      "(c) 1, 2, 3 and 4",
      "(d) 3 and 4 only"
    ],
    "answer": "(a) 1 and 2 only",
    "explanation": "OSCE is the world's largest regional security-oriented intergovernmental organization with 57 participating states. Its decisions are politically (rather than legally) binding, and it does not have primary responsibility for military security, which largely falls to NATO and individual states."
  },
  {
    "id": 23048,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements about Quad is/are correct ?<br/>1. It is a group of four countries, namely, India, Australia, USA and France.<br/>2. Maritime cooperation is an important binding force among members of the Quad.<br/>3. The Quad members formed a working group on COVID-19 vaccines.",
    "options": [
      "(a) 1 only",
      "(b) 1 and 2 only",
      "(c) 2 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(c) 2 and 3 only",
    "explanation": "The Quad (Quadrilateral Security Dialogue) consists of India, Japan, Australia, and the USA (not France). Maritime security and stability in the Indo-Pacific are central to its mission, and it launched a vaccine partnership during the pandemic."
  },
  {
    "id": 23049,
    "year": "2023",
    "subject": "Polity",
    "topic": "Human Rights",
    "exam": "CAPF (AC) 2023",
    "question": "The National Human Rights Commission was established under the statute of :",
    "options": [
      "(a) The Protection of Human Rights Act, 1993",
      "(b) The Protection and Implementation of Human Rights Act, 1993",
      "(c) The Human Rights Act, 1993",
      "(d) The Human Rights Commission Act, 1993"
    ],
    "answer": "(a) The Protection of Human Rights Act, 1993",
    "explanation": "The NHRC is a statutory public body established on 12 October 1993 under the Protection of Human Rights Ordinance, which was later replaced by the Protection of Human Rights Act, 1993."
  },
  {
    "id": 23050,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following is/are not an official language(s) of the United Nations ?<br/>1. Arabic<br/>2. German<br/>3. Spanish<br/>4. Chinese<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 and 3 only",
      "(b) 1 and 4 only",
      "(c) 1 and 2 only",
      "(d) 2 only"
    ],
    "answer": "(d) 2 only",
    "explanation": "The United Nations has six official languages: Arabic, Chinese, English, French, Russian and Spanish. German is not an official language."
  },
  {
    "id": 23051,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "The method used in separating a mixture of two miscible liquids having sufficient difference in their boiling points is :",
    "options": [
      "(a) Filtration",
      "(b) Solvent Extraction",
      "(c) Centrifugation",
      "(d) Simple Distillation"
    ],
    "answer": "(d) Simple Distillation",
    "explanation": "Simple distillation is effective for separating miscible liquids with a boiling point difference of usually 25°C or more. Fractional distillation is used when the difference is smaller."
  },
  {
    "id": 23052,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements is correct ?",
    "options": [
      "(a) Alloys are mixtures.",
      "(b) Alloys are compounds.",
      "(c) Alloys are always made up of metals.",
      "(d) All alloys contain carbon as one of their components."
    ],
    "answer": "(a) Alloys are mixtures.",
    "explanation": "Alloys are homogeneous mixtures of a metal with other metals or non-metals. For example, steel is an alloy of iron and carbon, while brass is an alloy of copper and zinc."
  },
  {
    "id": 23053,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "The common element in graphite, fullerene, diamond and graphene is :",
    "options": [
      "(a) Oxygen",
      "(b) Nitrogen",
      "(c) Hydrogen",
      "(d) Carbon"
    ],
    "answer": "(d) Carbon",
    "explanation": "These are all allotropes of carbon, meaning they are different physical forms in which the same element, carbon, can exist."
  },
  {
    "id": 23054,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "The gas generated on reacting zinc with dilute sulphuric acid is :",
    "options": [
      "(a) Argon",
      "(b) Helium",
      "(c) Hydrogen",
      "(d) Nitrogen"
    ],
    "answer": "(c) Hydrogen",
    "explanation": "Active metals like Zinc react with dilute acids to displace hydrogen, producing a salt and hydrogen gas (Zn + H₂SO₄ → ZnSO₄ + H₂)."
  },
  {
    "id": 23055,
    "year": "2023",
    "subject": "Science",
    "topic": "Chemistry",
    "exam": "CAPF (AC) 2023",
    "question": "An aqueous solution of a salt is known as brine. The salt is :",
    "options": [
      "(a) Sodium chloride",
      "(b) Potassium chloride",
      "(c) Calcium chloride",
      "(d) Sodium nitrate"
    ],
    "answer": "(a) Sodium chloride",
    "explanation": "Brine is a high-concentration solution of common salt (NaCl) in water, frequently used in food preservation and industrial electrolysis."
  },
  {
    "id": 23056,
    "year": "2023",
    "subject": "Polity",
    "topic": "Public Services",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following commissions was not associated with public services in India ?",
    "options": [
      "(a) Aitchison Commission",
      "(b) Islington Commission",
      "(c) Lee Commission",
      "(d) Radhakrishnan Commission"
    ],
    "answer": "(d) Radhakrishnan Commission",
    "explanation": "The Radhakrishnan Commission (1948-49) was the University Education Commission. The others (Aitchison, Islington, Lee) were set up during the British era to reform the Indian Civil Services."
  },
  {
    "id": 23057,
    "year": "2023",
    "subject": "History",
    "topic": "Modern India",
    "exam": "CAPF (AC) 2023",
    "question": "Who among the following was known as 'Lokhitwadi' ?",
    "options": [
      "(a) Keshub Chandra Sen",
      "(b) Gopal Hari Deshmukh",
      "(c) M.G. Ranade",
      "(d) Gopal Ganesh Agarkar"
    ],
    "answer": "(b) Gopal Hari Deshmukh",
    "explanation": "Gopal Hari Deshmukh (1823–1892) was a social reformer and writer from Maharashtra who wrote under the pen name 'Lokhitwadi' (One who works for the people's welfare) in the weekly 'Prabhakar'."
  },
  {
    "id": 23058,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Harappan Site) : List-II (Location)<br/>A. Nageshwar : 1. Uttar Pradesh<br/>B. Alamgirpur : 2. Rajasthan<br/>C. Kalibangan : 3. Saurashtra<br/>D. Rakhigarhi : 4. Haryana<br/><br/>Code :",
    "options": [
      "(a) A-3, B-1, C-2, D-4",
      "(b) A-4, B-2, C-1, D-3",
      "(c) A-4, B-1, C-2, D-3",
      "(d) A-3, B-2, C-1, D-4"
    ],
    "answer": "(a) A-3, B-1, C-2, D-4",
    "explanation": "Nageshwar is in coastal Gujarat (Saurashtra). Alamgirpur is in UP. Kalibangan is in Rajasthan. Rakhigarhi is in Haryana."
  },
  {
    "id": 23059,
    "year": "2023",
    "subject": "History",
    "topic": "Modern India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following pairs of books and their authors is not correctly matched ?",
    "options": [
      "(a) Bandi Jiwan : Sachindranath Sanyal",
      "(b) The Philosophy of the Bomb : Bhagwati Charan Vohra",
      "(c) Indian Unrest : Annie Besant",
      "(d) Desher Katha : Sakharam Ganesh Deuskar"
    ],
    "answer": "(c) Indian Unrest : Annie Besant",
    "explanation": "The book 'Indian Unrest' was written by Valentine Chirol, who described Bal Gangadhar Tilak as the 'Father of Indian Unrest'. Annie Besant wrote 'How India Wrought for Freedom' and edited 'New India'."
  },
  {
    "id": 23060,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following is/are important markers for the archaeologists to identify an archaeological site as a 'centre of craft production' ?<br/>1. Evidence of raw materials such as stone nodules, whole shells, etc.<br/>2. Geographical expanse of the site<br/>3. Evidence of unfinished objects, rejects and waste material<br/>4. Evidence of variety of pottery",
    "options": [
      "(a) 1 only",
      "(b) 1 and 3 only",
      "(c) 2 and 4 only",
      "(d) 3 only"
    ],
    "answer": "(b) 1 and 3 only",
    "explanation": "Archaeologists typically look for raw material supplies and, more importantly, production debris (unfinished items, rejects, and waste flakes) to confirm a location was a specialized workshop or craft center."
  },
  {
    "id": 23061,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "In humans, urea is mainly formed from the metabolism of which one of the following components of food ?",
    "options": [
      "(a) Fatty acids",
      "(b) Vitamins",
      "(c) Amino acids",
      "(d) Glucose"
    ],
    "answer": "(c) Amino acids",
    "explanation": "Urea is the primary nitrogenous waste product in humans, formed primarily from the breakdown (deamination) of excess proteins and amino acids."
  },
  {
    "id": 23062,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "The lymph is mainly formed from the plasma of blood and it surrounds the cells. The main difference between blood and lymph is :",
    "options": [
      "(a) Lymph does not contain red blood cells.",
      "(b) Lymph does not contain white blood cells.",
      "(c) Lymph contains both red blood cells and white blood cells.",
      "(d) Lymph does not contain any cells."
    ],
    "answer": "(a) Lymph does not contain red blood cells.",
    "explanation": "Lymph is a colorless fluid formed from interstitial fluid. It contains lymphocytes (a type of WBC) but lacks erythrocytes (RBCs) and larger plasma proteins."
  },
  {
    "id": 23063,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "For the digestion of carbohydrate, protein and fat, enzymes such as amylase, trypsin and lipase are required. It is secreted into the duodenum through :",
    "options": [
      "(a) Bile",
      "(b) Plasma",
      "(c) Lymph",
      "(d) Pancreatic juice"
    ],
    "answer": "(d) Pancreatic juice",
    "explanation": "The pancreas secretes 'pancreatic juice' into the duodenum via the pancreatic duct. This juice contains enzymes like pancreatic amylase, trypsinogen (activated to trypsin), and pancreatic lipase."
  },
  {
    "id": 23064,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Lactic acid is formed in the muscles during exercise or running. It is formed :",
    "options": [
      "(a) to give extra energy from fat.",
      "(b) to give extra oxygen from lungs.",
      "(c) to give extra energy from glucose.",
      "(d) to give extra energy from vitamins."
    ],
    "answer": "(c) to give extra energy from glucose.",
    "explanation": "When oxygen supply is insufficient for aerobic respiration during intense exertion, muscle cells switch to anaerobic fermentation, converting pyruvate to lactic acid to regenerate NAD+ and allow glycolysis (energy from glucose) to continue."
  },
  {
    "id": 23065,
    "year": "2023",
    "subject": "Economy",
    "topic": "Fiscal Policy",
    "exam": "CAPF (AC) 2023",
    "question": "Fiscal deficit in the Union Budget means :",
    "options": [
      "(a) the difference between current expenditure and current revenue.",
      "(b) net increase in the borrowings of the Union Government from the Reserve Bank of India.",
      "(c) the sum of budgetary deficits and the net increase in internal and external borrowings.",
      "(d) None of the above"
    ],
    "answer": "(c) the sum of budgetary deficits and the net increase in internal and external borrowings.",
    "explanation": "Fiscal deficit represents the total borrowing requirement of the government from all sources (internal and external) to cover the gap between total expenditure and its non-debt receipts."
  },
  {
    "id": 23066,
    "year": "2023",
    "subject": "Economy",
    "topic": "Fiscal Policy",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is the largest component of revenue expenditure in the Union Budget 2022 – 23 ?",
    "options": [
      "(a) Interest payments",
      "(b) Defense expenditure",
      "(c) Expenditure on healthcare",
      "(d) Subsidies"
    ],
    "answer": "(a) Interest payments",
    "explanation": "Interest payments traditionally form the single largest component of the Union Government's revenue expenditure, often accounting for around 20% of the total budget outlay."
  },
  {
    "id": 23067,
    "year": "2023",
    "subject": "Economy",
    "topic": "External Sector",
    "exam": "CAPF (AC) 2023",
    "question": "Adequacy of foreign exchange reserves of a country is captured by which of the following indicators ?<br/>1. Reserves to import ratio<br/>2. Reserves to external debt ratio<br/>3. Reserves to GDP ratio<br/>4. Reserves to monetary aggregates",
    "options": [
      "(a) 1 and 3 only",
      "(b) 1, 2, 3 and 4",
      "(c) 2, 3 and 4 only",
      "(d) 1, 2 and 4 only"
    ],
    "answer": "(b) 1, 2, 3 and 4",
    "explanation": "All these metrics are used by central banks and institutions like the IMF to assess whether reserves are sufficient to cover trade obligations, debt servicing, and potential capital flight."
  },
  {
    "id": 23068,
    "year": "2023",
    "subject": "Economy",
    "topic": "National Income",
    "exam": "CAPF (AC) 2023",
    "question": "If all the people of the economy increase the proportion of income they save, the total value of savings in the economy will either decrease or remain unchanged. This phenomenon is known as :",
    "options": [
      "(a) Crowding out",
      "(b) Crowding in",
      "(c) Paradox of thrift",
      "(d) Paradox of prosperity"
    ],
    "answer": "(c) Paradox of thrift",
    "explanation": "Popularized by Keynes, the paradox of thrift suggests that if everyone tries to save more during a recession, aggregate demand falls, lowering total income and potentially reducing total savings."
  },
  {
    "id": 23069,
    "year": "2023",
    "subject": "Economy",
    "topic": "Monetary Policy",
    "exam": "CAPF (AC) 2023",
    "question": "The banks are required to maintain a certain ratio between their cash in hand and total assets. This ratio is known as :",
    "options": [
      "(a) Cash Reserve Ratio (CRR)",
      "(b) Statutory Liquidity Ratio (SLR)",
      "(c) Central Bank Reserve (CBR)",
      "(d) Statutory Bank Ratio (SBR)"
    ],
    "answer": "(b) Statutory Liquidity Ratio (SLR)",
    "explanation": "SLR is the minimum percentage of deposits that a commercial bank has to maintain in the form of liquid assets (cash, gold, or unencumbered approved securities) itself."
  },
  {
    "id": 23070,
    "year": "2023",
    "subject": "Physics",
    "topic": "Oscillations",
    "exam": "CAPF (AC) 2023",
    "question": "A simple harmonic motion of a particle is represented as, y = 10 cos ωt. The acceleration of the particle at time t = π / 2ω will be :",
    "options": [
      "(a) 10 ω",
      "(b) -10 ω²",
      "(c) 0",
      "(d) 10 / ω"
    ],
    "answer": "(c) 0",
    "explanation": "y = 10 cos(ωt). Velocity v = dy/dt = -10ω sin(ωt). Acceleration a = dv/dt = -10ω² cos(ωt). <br/>At t = π / 2ω, a = -10ω² cos(ω * π / 2ω) = -10ω² cos(π / 2) = -10ω² * 0 = 0."
  },
  {
    "id": 23071,
    "year": "2023",
    "subject": "Physics",
    "topic": "Electricity",
    "exam": "CAPF (AC) 2023",
    "question": "A wire of resistance R is cut into four equal parts. These parts are then connected in parallel. If the equivalent resistance of this combination is R', then the ratio R' / R is :",
    "options": [
      "(a) 1 / 16",
      "(b) 1 / 4",
      "(c) 4",
      "(d) 16"
    ],
    "answer": "(a) 1 / 16",
    "explanation": "Cutting the wire into 4 equal parts gives 4 wires each with resistance R/4. <br/>In parallel, 1 / R' = 1 / (R/4) + 1 / (R/4) + 1 / (R/4) + 1 / (R/4) = 4 * (4/R) = 16/R. <br/>So, R' = R / 16, which means R' / R = 1 / 16."
  },
  {
    "id": 23072,
    "year": "2023",
    "subject": "Physics",
    "topic": "Electromagnetism",
    "exam": "CAPF (AC) 2023",
    "question": "In experiment #1, a bar magnet is moved towards a conducting wire loop axially, with the magnet's north pole facing the loop. In experiment #2, the same process as in experiment #1 is repeated except that the south pole of the magnet faces the loop. Which one of the following statements is true in this context ?",
    "options": [
      "(a) The direction of current in the loop will be of opposite nature in both the experiments.",
      "(b) The direction of current in the loop will be the same in both the experiments.",
      "(c) No current will flow in either of the two experiments.",
      "(d) More current will flow in the loop in experiment #1."
    ],
    "answer": "(a) The direction of current in the loop will be of opposite nature in both the experiments.",
    "explanation": "According to Lenz's law, the induced current creates a magnetic field to oppose the change in flux. Moving a North pole toward a loop creates a field equivalent to a North pole; moving a South pole toward it creates a field equivalent to a South pole, requiring current in the opposite direction."
  },
  {
    "id": 23073,
    "year": "2023",
    "subject": "Geography",
    "topic": "Astronomy",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following correctly explains the change in seasons on Earth ?",
    "options": [
      "(a) Tilt of the Earth's axis",
      "(b) Rotation of the Earth on its own axis",
      "(c) Revolution of the Moon around the Sun",
      "(d) Interaction of the Earth with other planets"
    ],
    "answer": "(a) Tilt of the Earth's axis",
    "explanation": "The Earth's axis is tilted at an angle of 23.5 degrees relative to its orbital plane (the ecliptic). As Earth revolves around the Sun, this tilt causes different parts of the Earth to receive more or less sunlight at different times of the year."
  },
  {
    "id": 23074,
    "year": "2023",
    "subject": "Geography",
    "topic": "Indian Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements :<br/>1. The Great Northern Plains are formed by basins of three distinct river systems — the Indus, the Ganga and the Brahmaputra.<br/>2. They are one of the most densely populated areas on Earth.<br/>3. Between the Yamuna at Delhi and the Bay of Bengal, nearly 1600 km away, there is a drop of only 200 metres in elevation.<br/><br/>Which of the statements given above are correct ?",
    "options": [
      "(a) 1, 2 and 3",
      "(b) 2 and 3 only",
      "(c) 1 and 2 only",
      "(d) 1 and 3 only"
    ],
    "answer": "(a) 1, 2 and 3",
    "explanation": "All three statements are correct. The plains are a result of deposition by these three rivers and are among the most fertile and populated regions globally. The gradient is extremely gentle, dropping only about 1m for every 8km."
  },
  {
    "id": 23075,
    "year": "2023",
    "subject": "Geography",
    "topic": "Oceanography",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements :<br/>1. Many of the world's largest mountain chains exist beneath the sea.<br/>2. Some mountain chains are revealed as island arcs.<br/>3. The mid-oceanic ridges form the longest mountain chains.<br/>4. The mid-Atlantic ridge rises thirty-three metres above the floor of the Atlantic.<br/><br/>Which of the statements given above are correct ?",
    "options": [
      "(a) 1 and 2 only",
      "(b) 3 and 4 only",
      "(c) 1, 2 and 4 only",
      "(d) 1, 2 and 3 only"
    ],
    "answer": "(d) 1, 2 and 3 only",
    "explanation": "Statements 1, 2 and 3 are correct. The Mid-Oceanic ridge system is the longest mountain chain on Earth. Statement 4 is incorrect as the Mid-Atlantic ridge rises thousands of meters from the ocean floor, even breaking the surface to form islands like Iceland."
  },
  {
    "id": 23076,
    "year": "2023",
    "subject": "Geography",
    "topic": "Biogeography",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Temperate Grassland) : List-II (Region)<br/>A. Prairies : 1. Eurasia<br/>B. Steppes : 2. South Africa<br/>C. Pampas : 3. North America<br/>D. Veldt : 4. South America<br/><br/>Code :",
    "options": [
      "(a) A-2, B-1, C-4, D-3",
      "(b) A-2, B-4, C-1, D-3",
      "(c) A-3, B-1, C-4, D-2",
      "(d) A-3, B-4, C-1, D-2"
    ],
    "answer": "(c) A-3, B-1, C-4, D-2",
    "explanation": "Prairies are in North America, Steppes in Eurasia (Central Asia), Pampas in South America (Argentina), and Veldt in South Africa."
  },
  {
    "id": 23077,
    "year": "2023",
    "subject": "Geography",
    "topic": "Economic Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements about millets :<br/>1. Millets are often referred to as climate-resilient crops because they can grow on arid lands with minimal inputs and maintenance.<br/>2. Millets are a good source of minerals, dietary fibre, antioxidants and protein.<br/>3. Millets, including sorghum, account for less than 3% of the global grains trade.<br/><br/>Which of the statements given above are correct ?",
    "options": [
      "(a) 1 and 2 only",
      "(b) 1 and 3 only",
      "(c) 2 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(d) 1, 2 and 3",
    "explanation": "Millets are hardy crops that require less water and are nutrient-dense. Despite their importance for food security, they form a very small part of the international grain trade compared to wheat, rice, and maize."
  },
  {
    "id": 23078,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Data Interpretation",
    "exam": "CAPF (AC) 2023",
    "question": "Directions : The next three items are based on a survey on occurrence of vowels in a certain book irrespective of whether they are in upper or lower case.<br/><br/>Vowel: A, E, I, O, U<br/>Percentage: 20, 45, 15, 8, 12<br/><br/>For how many pairs of vowels is the chance of occurrence of any one of the two more than 34% in the book ?",
    "options": [
      "(a) 4",
      "(b) 5",
      "(c) 6",
      "(d) 7"
    ],
    "answer": "(b) 5",
    "explanation": "We need to find pairs with sum > 34%. <br/>Pairs with E (45%): (E,A), (E,I), (E,O), (E,U) -> 4 pairs. <br/>Other pairs: <br/>(A,I) = 20 + 15 = 35% (> 34%). <br/>(A,O) = 20 + 8 = 28%. <br/>(A,U) = 20 + 12 = 32%. <br/>(I,O) = 15 + 8 = 23%. <br/>(I,U) = 15 + 12 = 27%. <br/>(O,U) = 8 + 12 = 20%. <br/>Total = 4 + 1 = 5 pairs."
  },
  {
    "id": 23079,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Data Interpretation",
    "exam": "CAPF (AC) 2023",
    "question": "Among the three vowels which occur minimum number of times, what is the percentage of occurrence of the letter that occurs the maximum number of times among them ?",
    "options": [
      "(a) 42 6/7 %",
      "(b) 41 5/7 %",
      "(c) 40 4/7 %",
      "(d) 39 2/7 %"
    ],
    "answer": "(a) 42 6/7 %",
    "explanation": "The three vowels with minimum frequency are I (15%), O (8%), and U (12%). <br/>The maximum frequency among these three is 15%. <br/>Sum of these three = 15 + 8 + 12 = 35%. <br/>Percentage of 15% out of 35% = (15 / 35) * 100 = (3 / 7) * 100 = 300 / 7 = 42 6/7 %."
  },
  {
    "id": 23080,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Data Interpretation",
    "exam": "CAPF (AC) 2023",
    "question": "If \"O\" and \"U\", irrespective of upper or lower case, occur exactly 5040 times, then how many times does the letter \"E\" occur in the book in the upper or the lower case ?",
    "options": [
      "(a) 11840",
      "(b) 11600",
      "(c) 11430",
      "(d) 11340"
    ],
    "answer": "(d) 11340",
    "explanation": "Percentage of O + U = 8% + 12% = 20%. <br/>Given 20% of Total = 5040. <br/>Total Vowels = 5040 * 5 = 25200. <br/>Occurrence of E (45%) = 0.45 * 25200 = 11340."
  },
  {
    "id": 23081,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Number System",
    "exam": "CAPF (AC) 2023",
    "question": "Suppose a, b and c are three distinct natural numbers such that a + b + c = abc. Consider the following statements :<br/>1. The arithmetic mean of a, b and c is a natural number.<br/>2. The harmonic mean of a, b and c lies between 1 and 2.<br/><br/>Which of the statements given above is/are correct ?",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(c) Both 1 and 2",
    "explanation": "If a, b, c are distinct natural numbers such that their sum equals their product, they must be 1, 2, and 3. <br/>1. Arithmetic Mean = (1+2+3)/3 = 2 (Natural number). <br/>2. Harmonic Mean = 3 / (1/1 + 1/2 + 1/3) = 3 / (11/6) = 18/11 ≈ 1.636, which is between 1 and 2."
  },
  {
    "id": 23082,
    "year": "2023",
    "subject": "Mathematics",
    "topic": "Number System",
    "exam": "CAPF (AC) 2023",
    "question": "How many three-digit numbers are possible such that the difference between the original number and the number obtained by reversing the digits is 396 ? (no digit is repeated)",
    "options": [
      "(a) 4",
      "(b) 5",
      "(c) 50",
      "(d) 40"
    ],
    "answer": "(d) 40",
    "explanation": "Let the number be 100A + 10B + C. Difference = |99(A-C)| = 396 => |A-C| = 4. <br/>Pairs for (A,C) with difference 4 and non-zero A,C: (5,1), (6,2), (7,3), (8,4), (9,5). (5 pairs). <br/>If we assume A > C (as in some interpretations of such problems), we have 5 pairs. For each, B can be any of the remaining 8 digits (excluding A and C). Total = 5 * 8 = 40. (If A < C is also considered, it would be 80, but 40 is the standard answer choice here)."
  },
  {
    "id": 23083,
    "year": "2023",
    "subject": "Geography",
    "topic": "Human Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements is/are correct ?<br/>1. Population ageing is the process by which the share of the older population becomes proportionally lesser.<br/>2. In most of the developed countries, the population in higher age groups has increased.<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(b) 2 only",
    "explanation": "Population ageing is defined by a shift in the population's age distribution toward older ages. This means the share of the elderly population becomes proportionally greater, making Statement 1 incorrect. Statement 2 is correct as developed countries often have low birth rates and high life expectancy."
  },
  {
    "id": 23084,
    "year": "2023",
    "subject": "Environment",
    "topic": "Climate Change",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements is/are correct about 'Action for Climate Empowerment' (ACE) ?<br/>1. It is a term adopted by the UN Framework Convention on Climate Change.<br/>2. This term is related to the Paris Agreement.<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(c) Both 1 and 2",
    "explanation": "ACE is the name given by the UNFCCC to work under Article 6 of the Convention and Article 12 of the Paris Agreement, focusing on education, training, public awareness, and international cooperation on climate change."
  },
  {
    "id": 23085,
    "year": "2023",
    "subject": "Environment",
    "topic": "Climate Change",
    "exam": "CAPF (AC) 2023",
    "question": "What is 'Climate Neutral Now' initiative ?<br/>1. It encourages organizations and other interested stakeholders to act now in order to achieve a carbon neutral world by 2050.<br/>2. It derives its aims from the Paris Agreement.<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(c) Both 1 and 2",
    "explanation": "Climate Neutral Now is a UNFCCC initiative launched in 2015 to encourage non-state actors to take climate action to support the Paris Agreement's goal of limiting global warming to well-below 2°C or 1.5°C."
  },
  {
    "id": 23086,
    "year": "2023",
    "subject": "Polity",
    "topic": "National Security",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements is/are correct about KAVACH-2023 ?<br/>1. It is a joint coordination committee of all three wings of India's armed forces to protect India's borders.<br/>2. It is India's national level hackathon jointly launched by AICTE and BPRD to tackle cyber threats.<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(b) 2 only",
    "explanation": "KAVACH-2023 is a National Level Hackathon specifically designed to find innovative solutions to cyber security and crime challenges, organized by the Ministry of Education's Innovation Cell, AICTE, and the Bureau of Police Research and Development (BPRD)."
  },
  {
    "id": 23087,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one among the following statements with reference to the 'Neolithic Period' is not correct ?",
    "options": [
      "(a) The characteristic features of the period included ground and polished stone tools, agriculture, animal domestication and pottery.",
      "(b) This period is also known as the 'New Stone Age'.",
      "(c) The characteristic features appeared almost at the same time in various parts of the subcontinent.",
      "(d) Earliest evidence of agriculture is found from Mehrgarh around 8000 BCE."
    ],
    "answer": "(c) The characteristic features appeared almost at the same time in various parts of the subcontinent.",
    "explanation": "The Neolithic revolution was not simultaneous across India. It began much earlier in the North-West (Mehrgarh) and appeared significantly later in the South and East of the subcontinent."
  },
  {
    "id": 23088,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is not a pottery type ?",
    "options": [
      "(a) OCP",
      "(b) CCE",
      "(c) NBP",
      "(d) BRW"
    ],
    "answer": "(b) CCE",
    "explanation": "OCP (Ochre Coloured Pottery), NBP (Northern Black Polished Ware), and BRW (Black and Red Ware) are well-known archaeological pottery types in India."
  },
  {
    "id": 23089,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following political centers finds a mention in Ashokan inscriptions ?",
    "options": [
      "(a) Indraprastha",
      "(b) Kaushambi",
      "(c) Suvarnagiri",
      "(d) Kandahar"
    ],
    "answer": "(c) Suvarnagiri",
    "explanation": "Asokan inscriptions mention Suvarnagiri (the 'golden mountain') as one of the major provincial capitals (others being Taxila, Ujjayini, and Tosali)."
  },
  {
    "id": 23090,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements with reference to the ancient Indian coins is not correct ?",
    "options": [
      "(a) The Indo-Greeks issued the first coins bearing the name and images of rulers.",
      "(b) The Kushanas issued the first gold coins.",
      "(c) The Kushana gold coins were different in weight from the coins issued by contemporary Roman emperors.",
      "(d) These Kushana gold coins have been found from several sites in north India and central Asia."
    ],
    "answer": "(c) The Kushana gold coins were different in weight from the coins issued by contemporary Roman emperors.",
    "explanation": "The Kushana gold coins were remarkably similar in weight and standard to the Roman Aurei, likely to facilitate international trade."
  },
  {
    "id": 23091,
    "year": "2023",
    "subject": "History",
    "topic": "Ancient India",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements about the practice of Vedic sacrifices :<br/>1. The shrauta (Vedic sacrifices) involved the use of three fires — the garhapatya (householder's fire), ahavaniya (offertorial fire) and dakshinagni (southern fire).<br/>2. These fires were supposed to be placed in pits of different shapes, i.e., the garhapatya to be square, ahavaniya to be round and that of the dakshinagni, rectangle-shaped.<br/><br/>Which of the statements given above is/are correct ?",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(a) 1 only",
    "explanation": "Statement 1 is correct. However, in Statement 2, the shapes are swapped: the garhapatya was round and the ahavaniya was square."
  },
  {
    "id": 23092,
    "year": "2023",
    "subject": "Geography",
    "topic": "World Geography",
    "exam": "CAPF (AC) 2023",
    "question": "Trans-Siberian Railway from St. Petersburg to Vladivostok does not run across :",
    "options": [
      "(a) Altai range",
      "(b) Caucasus mountains",
      "(c) Ural mountains",
      "(d) Ob and Yenisei rivers"
    ],
    "answer": "(b) Caucasus mountains",
    "explanation": "The Caucasus mountains are located in Southwestern Russia (between the Black and Caspian Seas), far to the south of the Trans-Siberian route which traverses Northern/Central Russia through the Urals and across Siberian rivers like the Ob and Yenisei."
  },
  {
    "id": 23093,
    "year": "2023",
    "subject": "Geography",
    "topic": "Geomorphology",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements about Barchans :<br/>1. These landforms are found in Thar desert in India.<br/>2. The windward side has concave slope with maximum height at the centre.<br/>3. Two ends of the barchan are called horns.<br/><br/>Which of the statements given above is/are correct ?",
    "options": [
      "(a) 1 and 2 only",
      "(b) 2 and 3 only",
      "(c) 1 and 3 only",
      "(d) 3 only"
    ],
    "answer": "(c) 1 and 3 only",
    "explanation": "Barchans are crescent-shaped dunes. Statement 2 is incorrect because the windward side is convex and has a gentle slope, while the leeward side is concave and steep."
  },
  {
    "id": 23094,
    "year": "2023",
    "subject": "Science",
    "topic": "Resources and Energy",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements :<br/>1. Geothermal energy can be used to produce electricity or its hot water can be used directly for industry, agriculture, bathing and cleaning.<br/>2. Nuclear energy is often cheaper than some other sources of electricity.<br/>3. Thermal power stations burn fossil fuels to create steam to drive the turbines.<br/><br/>Which of the statements given above is/are correct ?",
    "options": [
      "(a) 1 only",
      "(b) 1, 2 and 3",
      "(c) 1 and 3 only",
      "(d) 2 and 3 only"
    ],
    "answer": "(c) 1 and 3 only",
    "explanation": "Statements 1 and 3 are fundamentally correct. The cost of nuclear energy (Statement 2) is a complex topic often involving high capital and decommissioning costs, making it more expensive than wind or solar in many modern analyses, thus it is frequently excluded in such competitive statements."
  },
  {
    "id": 23095,
    "year": "2023",
    "subject": "Environment",
    "topic": "Conventions",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (International Convention) : List-II (Theme)<br/>A. Stockholm Convention : 1. Hazardous chemicals and pesticides in international trade<br/>B. Minamata Convention : 2. Persistent organic pollutants<br/>C. Basel Convention : 3. Binding instrument on mercury<br/>D. Rotterdam Convention : 4. Transboundary movement of hazardous wastes and their disposal<br/><br/>Code :",
    "options": [
      "(a) A-1, B-4, C-3, D-2",
      "(b) A-1, B-3, C-4, D-2",
      "(c) A-2, B-4, C-3, D-1",
      "(d) A-2, B-3, C-4, D-1"
    ],
    "answer": "(d) A-2, B-3, C-4, D-1",
    "explanation": "Stockholm (POPs), Minamata (Mercury), Basel (Hazardous Wastes), Rotterdam (Hazardous Chemicals/Pesticides Trade)."
  },
  {
    "id": 23096,
    "year": "2023",
    "subject": "Polity",
    "topic": "Judiciary",
    "exam": "CAPF (AC) 2023",
    "question": "The Judgment of the Supreme Court in Peoples' Union for Civil Liberties v. Union of India 2004 is related to which of the following ?",
    "options": [
      "(a) Right to Shelter",
      "(b) Right against Custodial violence",
      "(c) Right to Information",
      "(d) Right to Speedy trial"
    ],
    "answer": "(c) Right to Information",
    "explanation": "The 2004 PUCL judgment (specifically the 2003/2004 sequence) clarified that voters have a fundamental right under Article 19 to know about the assets, liabilities, and criminal background of candidates, as part of the Right to Information."
  },
  {
    "id": 23097,
    "year": "2023",
    "subject": "Polity",
    "topic": "Judiciary",
    "exam": "CAPF (AC) 2023",
    "question": "Which among the following deals with Habeas Corpus ?",
    "options": [
      "(a) State of Uttar Pradesh v. Raj Narain and Ors. (1975)",
      "(b) Additional District Magistrate, Jabalpur v. Shivakant Shukla (1976)",
      "(c) Mrs. Maneka Gandhi v. Union of India (1978)",
      "(d) Nandini Satpathy v. P.L. Dani (1978)"
    ],
    "answer": "(b) Additional District Magistrate, Jabalpur v. Shivakant Shukla (1976)",
    "explanation": "Commonly known as the 'Habeas Corpus case', ADM Jabalpur is the infamous Emergency-era judgment where the SC ruled that the right to apply for Habeas Corpus could be suspended during emergency."
  },
  {
    "id": 23098,
    "year": "2023",
    "subject": "Polity",
    "topic": "Judiciary",
    "exam": "CAPF (AC) 2023",
    "question": "Which among the following statements regarding the powers of the High Courts under Article 226 of the Constitution of India is not correct ?",
    "options": [
      "(a) It can issue writs of habeas corpus, mandamus, quo warranto, certiorari, and prohibition.",
      "(b) Writs can be issued to enforce any rights conferred by Part-III and for any other purpose.",
      "(c) This power can derogate the power conferred on the Supreme Court under Article 32(2).",
      "(d) Writ can be issued to any authority under its jurisdiction."
    ],
    "answer": "(c) This power can derogate the power conferred on the Supreme Court under Article 32(2).",
    "explanation": "The writ jurisdiction of the High Court (Art 226) is concurrent with the Supreme Court's (Art 32) but it does not derogate or supersede the SC's powers."
  },
  {
    "id": 23099,
    "year": "2023",
    "subject": "Polity",
    "topic": "The Center",
    "exam": "CAPF (AC) 2023",
    "question": "Which among the following is not correct ?",
    "options": [
      "(a) Legislation on criminal law, barring exceptions, is a subject under the Concurrent List.",
      "(b) Bankruptcy and Insolvency are subjects under the Concurrent List.",
      "(c) Inter-State trade and commerce is a subject under the State List.",
      "(d) Banking is exclusively under the Union List."
    ],
    "answer": "(c) Inter-State trade and commerce is a subject under the State List.",
    "explanation": "Inter-State trade and commerce is a Union List subject (Entry 42). Intra-state trade is generally a State List subject."
  },
  {
    "id": 23100,
    "year": "2023",
    "subject": "Environment",
    "topic": "Conventions",
    "exam": "CAPF (AC) 2023",
    "question": "'Basel Convention', 'Rotterdam Convention' and 'Stockholm Convention' relate to which of the following ?",
    "options": [
      "(a) Human Rights of Prisoners",
      "(b) Management of Pollutants",
      "(c) Conservation of Wetlands",
      "(d) Conservation of Rivers"
    ],
    "answer": "(b) Management of Pollutants",
    "explanation": "The 'BRS' Conventions are international treaties aimed at protecting human health and the environment from hazardous chemicals and wastes (pollutants)."
  },
  {
    "id": 23101,
    "year": "2023",
    "subject": "Polity",
    "topic": "Fundamental Rights",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements regarding Article 32 of the Constitution of India is not correct ?",
    "options": [
      "(a) It is a guaranteed Right.",
      "(b) It can be suspended during an Emergency.",
      "(c) A writ can be issued against a private person.",
      "(d) The Supreme Court has the power to issue writs for 'any other purpose' also."
    ],
    "answer": "(d) The Supreme Court has the power to issue writs for 'any other purpose' also.",
    "explanation": "The Supreme Court's writ jurisdiction under Article 32 is restricted to the enforcement of Fundamental Rights (Part III) only. The 'any other purpose' clause applies to the High Courts under Article 226."
  },
  {
    "id": 23102,
    "year": "2023",
    "subject": "Polity",
    "topic": "Fundamental Duties",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements regarding the Fundamental Duties is/are correct ?<br/>1. They were not present in the original Constitution of India.<br/>2. They were added by the 42nd Amendment of the Constitution of India.<br/>3. It is a fundamental duty of every citizen to pay taxes.<br/><br/>Select the correct answer using the code given below :",
    "options": [
      "(a) 1 and 2 only",
      "(b) 2 and 3 only",
      "(c) 1, 2 and 3",
      "(d) 1 only"
    ],
    "answer": "(a) 1 and 2 only",
    "explanation": "Fundamental Duties were added by the 42nd Amendment (1976) on the recommendation of the Swaran Singh Committee. Although paying taxes was recommended, it was not included in the final list of Fundamental Duties."
  },
  {
    "id": 23103,
    "year": "2023",
    "subject": "Polity",
    "topic": "Parliament",
    "exam": "CAPF (AC) 2023",
    "question": "Consider the following statements regarding the Joint Session of the Parliament :<br/>1. It is presided over by the Speaker of the Lok Sabha.<br/>2. It is not applicable to Money Bills.<br/>3. It is not applicable to Constitution Amendment Bills.<br/><br/>Which of the statements given above are correct ?",
    "options": [
      "(a) 1 and 2 only",
      "(b) 2 and 3 only",
      "(c) 1 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(d) 1, 2 and 3",
    "explanation": "The President calls a joint sitting under Art 108. It is presided by the Speaker. Joint sittings cannot be held for Money Bills (Lok Sabha has supreme power) or Constitution Amendment Bills (must be passed by both Houses separately)."
  },
  {
    "id": 23104,
    "year": "2023",
    "subject": "Polity",
    "topic": "The Center",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements regarding the Prime Minister of India is not correct ?",
    "options": [
      "(a) The Prime Minister is appointed by the President.",
      "(b) The Prime Minister must be a member of the Lok Sabha at the time of appointment.",
      "(c) The Prime Minister's advice on the choice of other ministers is binding on the President.",
      "(d) The Prime Minister holds office during the pleasure of the President."
    ],
    "answer": "(b) The Prime Minister must be a member of the Lok Sabha at the time of appointment.",
    "explanation": "A person can be appointed PM even if they are not a member of either House, provided they become a member within six months. Furthermore, they can be a member of either the Lok Sabha or the Rajya Sabha."
  },
  {
    "id": 23105,
    "year": "2023",
    "subject": "Polity",
    "topic": "Constitutional Bodies",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements regarding the Attorney General of India is not correct ?",
    "options": [
      "(a) He is the first law officer of the Government of India.",
      "(b) He holds office during the pleasure of the President of India.",
      "(c) He is not a whole-time counsel for the Government of India.",
      "(d) He is debarred from private legal practice."
    ],
    "answer": "(d) He is debarred from private legal practice.",
    "explanation": "The Attorney General is not a government servant and is not debarred from private legal practice, though he cannot advise or hold a brief against the Government of India."
  },
  {
    "id": 23106,
    "year": "2023",
    "subject": "Polity",
    "topic": "Parliament",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Activity) : List-II (Time Slot)<br/>A. Question Hour : 1. Time slot that starts immediately after the Question Hour<br/>B. Half-an-Hour Discussion : 2. Usually the first hour of every sitting of the House<br/>C. Short Notice Question : 3. For matters of public importance which has been the subject of a recent question and the answer to which needs elucidation on a matter of fact<br/>D. Zero Hour : 4. For a matter of urgent public importance that can be asked with a notice of less than ten days<br/><br/>Code :",
    "options": [
      "(a) A-1, B-4, C-3, D-2",
      "(b) A-1, B-3, C-4, D-2",
      "(c) A-2, B-4, C-3, D-1",
      "(d) A-2, B-3, C-4, D-1"
    ],
    "answer": "(d) A-2, B-3, C-4, D-1",
    "explanation": "Standard procedures of the Indian Parliament: Question Hour (1st hour), Zero Hour (after Question Hour), Short Notice (urgent, <10 days), Half-an-Hour (recent question elucidation)."
  },
  {
    "id": 23107,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements about the G20 Summit in India in 2023 are correct ?<br/>1. Its theme was 'Vasudhaiva Kutumbakam' or 'One Earth, One Family, One Future'.<br/>2. The summit logo depicted Earth with a Lotus.<br/>3. Invitee countries include Spain, Mauritius and Bangladesh.",
    "options": [
      "(a) 1 and 2 only",
      "(b) 2 and 3 only",
      "(c) 1 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(d) 1, 2 and 3",
    "explanation": "All statements are correct. India's G20 Presidency emphasized global unity and invited several non-member 'guest' countries including Spain, Mauritius, UAE, Netherlands, Nigeria, Singapore, Oman, Egypt, and Bangladesh."
  },
  {
    "id": 23108,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "India's 'Operation Kaveri' was a rescue operation to evacuate its citizens from :",
    "options": [
      "(a) Ukraine",
      "(b) Afghanistan",
      "(c) Sudan",
      "(d) Turkiye"
    ],
    "answer": "(c) Sudan",
    "explanation": "Operation Kaveri was launched by the Indian Armed Forces in April 2023 to evacuate Indian citizens and foreign nationals from Sudan during the 2023 Sudan conflict."
  },
  {
    "id": 23109,
    "year": "2023",
    "subject": "Polity",
    "topic": "International Relations",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following statements are correct about the Shanghai Cooperation Organization (SCO) ?<br/>1. India is one of the member countries of SCO.<br/>2. The SCO Secretariat is located in Shanghai.<br/>3. The Regional Anti-Terrorist Structure (RATS) of SCO is located in Tashkent.",
    "options": [
      "(a) 1 and 2 only",
      "(b) 2 and 3 only",
      "(c) 1 and 3 only",
      "(d) 1, 2 and 3"
    ],
    "answer": "(c) 1 and 3 only",
    "explanation": "India joined SCO as a full member in 2017. RATS is correctly located in Tashkent. However, the SCO Secretariat is located in Beijing, not Shanghai."
  },
  {
    "id": 23110,
    "year": "2023",
    "subject": "Environment",
    "topic": "Conventions",
    "exam": "CAPF (AC) 2023",
    "question": "The historic UN Water Conference 2023 was held in :",
    "options": [
      "(a) New York",
      "(b) Geneva",
      "(c) Paris",
      "(d) Tokyo"
    ],
    "answer": "(a) New York",
    "explanation": "The UN 2023 Water Conference was held from March 22 to 24 in New York, the first such UN conference on water in 46 years."
  },
  {
    "id": 23111,
    "year": "2023",
    "subject": "Physics",
    "topic": "Optics",
    "exam": "CAPF (AC) 2023",
    "question": "For total internal reflection to occur, which of the following conditions must be satisfied ?<br/>1. Light must go from a denser medium to a rarer medium.<br/>2. The angle of incidence must be greater than the critical angle.",
    "options": [
      "(a) 1 only",
      "(b) 2 only",
      "(c) Both 1 and 2",
      "(d) Neither 1 nor 2"
    ],
    "answer": "(c) Both 1 and 2",
    "explanation": "TIR occurs when light traveling in a slower (denser) medium hits a boundary with a faster (rarer) medium at an angle exceeding the critical angle for that pair of materials."
  },
  {
    "id": 23112,
    "year": "2023",
    "subject": "Physics",
    "topic": "Sound",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Nature of propagation) : List-II (Medium)<br/>A. Sound waves travel fastest : 1. Air<br/>B. Sound waves travel at a slower speed than in solids : 2. Liquids<br/>C. Sound waves travel at a slower speed than in liquids : 3. Solids<br/>D. Sound waves do not travel : 4. Vacuum<br/><br/>Code :",
    "options": [
      "(a) A-4, B-1, C-2, D-3",
      "(b) A-4, B-2, C-1, D-3",
      "(c) A-3, B-2, C-1, D-4",
      "(d) A-3, B-1, C-2, D-4"
    ],
    "answer": "(c) A-3, B-2, C-1, D-4",
    "explanation": "Sound is a mechanical wave requiring a medium. It travels fastest in solids (due to high elasticity/density), slower in liquids, slowest in gases (air), and not at all in a vacuum."
  },
  {
    "id": 23113,
    "year": "2023",
    "subject": "Physics",
    "topic": "Optics",
    "exam": "CAPF (AC) 2023",
    "question": "The power of a concave lens is :",
    "options": [
      "(a) Positive",
      "(b) Negative",
      "(c) Dual",
      "(d) Zero"
    ],
    "answer": "(b) Negative",
    "explanation": "A concave lens is a diverging lens with a virtual focal point, so its focal length (f) is negative. Power P = 1/f is therefore also negative."
  },
  {
    "id": 23114,
    "year": "2023",
    "subject": "Physics",
    "topic": "Optics",
    "exam": "CAPF (AC) 2023",
    "question": "The splitting of white light into its constituent colours by a glass prism is called :",
    "options": [
      "(a) Dispersion",
      "(b) Reflection",
      "(c) Polarization",
      "(d) Retardation"
    ],
    "answer": "(a) Dispersion",
    "explanation": "Dispersion is the phenomenon where white light separates into its component colors (VIBGYOR) when passing through a prism due to different wavelengths refracting at slightly different angles."
  },
  {
    "id": 23115,
    "year": "2023",
    "subject": "Physics",
    "topic": "Electricity",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Component) : List-II (Utility)<br/>A. Battery : 1. Used to measure potential difference<br/>B. Rheostat : 2. Used to maintain a potential difference across a circuit<br/>C. Ammeter : 3. Used to change the current in a circuit<br/>D. Voltmeter : 4. Used to measure current in a circuit<br/><br/>Code :",
    "options": [
      "(a) A-1, B-4, C-3, D-2",
      "(b) A-1, B-3, C-4, D-2",
      "(c) A-2, B-3, C-4, D-1",
      "(d) A-2, B-4, C-3, D-1"
    ],
    "answer": "(c) A-2, B-3, C-4, D-1",
    "explanation": "Battery (Voltaic source), Rheostat (Variable resistor), Ammeter (Series current measure), Voltmeter (Parallel voltage measure)."
  },
  {
    "id": 23116,
    "year": "2023",
    "subject": "Physics",
    "topic": "Electricity",
    "exam": "CAPF (AC) 2023",
    "question": "In electric cells and batteries, energy is :",
    "options": [
      "(a) created from nothing.",
      "(b) the conversion of electrical energy into chemical energy.",
      "(c) the conversion of chemical energy into electrical energy.",
      "(d) simply the storage of electrical energy."
    ],
    "answer": "(c) the conversion of chemical energy into electrical energy.",
    "explanation": "Galvanic or voltaic cells utilize spontaneous chemical redox reactions occurring at the electrodes to generate an electric current (electrical energy)."
  },
  {
    "id": 23117,
    "year": "2023",
    "subject": "Physics",
    "topic": "Mechanics",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following is a non-contact force ?",
    "options": [
      "(a) Frictional force",
      "(b) Tension",
      "(c) Magnetic force",
      "(d) Normal force"
    ],
    "answer": "(c) Magnetic force",
    "explanation": "Non-contact forces (field forces) act over a distance without physical contact, e.g., Gravitational, Electromagnetic, and Magnetic forces. Friction and Tension require contact."
  },
  {
    "id": 23118,
    "year": "2023",
    "subject": "Physics",
    "topic": "Mechanics",
    "exam": "CAPF (AC) 2023",
    "question": "A truck of mass 2000 kg is moving with a velocity of 36 km / h. Its momentum is :",
    "options": [
      "(a) 20000 kg m / s",
      "(b) 72000 kg m / s",
      "(c) 36000 kg m / s",
      "(d) 10000 kg m / s"
    ],
    "answer": "(a) 20000 kg m / s",
    "explanation": "Velocity v = 36 km/h = 36 * (5/18) m/s = 10 m/s. <br/>Momentum p = m * v = 2000 kg * 10 m/s = 20000 kg m / s."
  },
  {
    "id": 23119,
    "year": "2023",
    "subject": "Physics",
    "topic": "Mechanics",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Newton's Laws) : List-II (Statements)<br/>A. First Law : 1. Action and Reaction are equal and opposite<br/>B. Second Law : 2. Law of inertia<br/>C. Third Law : 3. Rate of change of momentum is proportional to the applied force<br/><br/>Code :",
    "options": [
      "(a) A-1, B-3, C-2",
      "(b) A-2, B-1, C-3",
      "(c) A-2, B-3, C-1",
      "(d) A-3, B-2, C-1"
    ],
    "answer": "(c) A-2, B-3, C-1",
    "explanation": "Standard definitions of Newton's Laws of Motion."
  },
  {
    "id": 23120,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Match List-I with List-II and select the correct answer using the code given below the Lists :<br/>List-I (Component) : List-II (Functional Utility)<br/>A. Mitochondria : 1. Act as digestive bags<br/>B. Chloroplast : 2. Powerhouse of the cell<br/>C. Ribosome : 3. Sites for photosynthesis<br/>D. Lysosome : 4. Sites for protein synthesis<br/><br/>Code :",
    "options": [
      "(a) A-1, B-4, C-3, D-2",
      "(b) A-1, B-3, C-4, D-2",
      "(c) A-2, B-3, C-4, D-1",
      "(d) A-2, B-4, C-3, D-1"
    ],
    "answer": "(c) A-2, B-3, C-4, D-1",
    "explanation": "Cell organelle functions: Mitochondria (ATP production), Chloroplast (Starch production), Ribosome (Translation), Lysosome (Waste/Bacteria breakdown)."
  },
  {
    "id": 23121,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Which of the following have cell wall ?<br/>1. Bacteria<br/>2. Plant cell<br/>3. Amoeba",
    "options": [
      "(a) 1, 2 and 3",
      "(b) 2 and 3 only",
      "(c) 1 and 2 only",
      "(d) 1 only"
    ],
    "answer": "(c) 1 and 2 only",
    "explanation": "Bacteria (Peptidoglycan) and Plants (Cellulose) possess cell walls. Amoeba is a protozoan (animal-like protist) and lacks a cell wall."
  },
  {
    "id": 23122,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Which one among the following microorganisms is used for the commercial production of alcohol and wine ?",
    "options": [
      "(a) Yeast",
      "(b) Amoeba",
      "(c) Plasmodium",
      "(d) Bacteria"
    ],
    "answer": "(a) Yeast",
    "explanation": "Saccharomyces cerevisiae (Yeast) is used in fermentation to convert sugars into ethanol and carbon dioxide."
  },
  {
    "id": 23123,
    "year": "2023",
    "subject": "Science",
    "topic": "Biology",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following is not a fruit ?",
    "options": [
      "(a) Tomato",
      "(b) Brinjal",
      "(c) Radish",
      "(d) Lady's finger"
    ],
    "answer": "(c) Radish",
    "explanation": "In botany, a fruit is the seed-bearing structure in flowering plants formed from the ovary. Tomatoes, brinjals, and lady's fingers are botanical fruits. Radish is a modified root."
  },
  {
    "id": 23124,
    "year": "2023",
    "subject": "Environment",
    "topic": "Pollution",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements about water pollution is not correct ?",
    "options": [
      "(a) Industrial waste discharge causes water pollution.",
      "(b) High level of mercury in water leads to Minamata disease.",
      "(c) Excessive use of fertilizers in agriculture doesn't cause any water pollution.",
      "(d) Release of heated water in water bodies causes thermal pollution."
    ],
    "answer": "(c) Excessive use of fertilizers in agriculture doesn't cause any water pollution.",
    "explanation": "Fertilizers cause significant water pollution through runoff into water bodies, leading to eutrophication (excessive nutrient enrichment resulting in algal blooms and oxygen depletion)."
  },
  {
    "id": 23125,
    "year": "2023",
    "subject": "Environment",
    "topic": "Climate Change",
    "exam": "CAPF (AC) 2023",
    "question": "Which one of the following statements about Global Warming is not correct ?",
    "options": [
      "(a) Greenhouse effect leads to global warming.",
      "(b) Global warming is the rise in the Earth's temperature.",
      "(c) It is caused by the decrease in the concentration of greenhouse gases in the atmosphere.",
      "(d) Global warming leads to melting of glaciers."
    ],
    "answer": "(c) It is caused by the decrease in the concentration of greenhouse gases in the atmosphere.",
    "explanation": "Global warming is caused by an INCREASE in the concentration of greenhouse gases (like CO₂, CH₄, N₂O) which trap heat in the atmosphere."
  }
];
