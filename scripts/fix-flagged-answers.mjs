/**
 * Corrects answer keys / malformed content for questions reported via user feedback.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Every change stores the previous value under `correction` so nothing is lost:
 *   correction: { at, reason, previous: { field: value, ... } }
 * No document is deleted.
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const db = client.database(process.env.COSMOS_DATABASE || "pyqpowerhouse");

const CONTAINERS = {
  prelims: "questions",
  state_pcs: "state_pcs",
  csat: "csat-questions",
  english: "english-questions",
};

/** @type {Array<{id:string,src:keyof typeof CONTAINERS,reason:string,set:Record<string,any>}>} */
const FIXES = [
  {
    id: "58041",
    src: "csat",
    reason: "LCM/HCF arithmetic: p=126, q=9; coprime pair (2,7) gives 18 and 63, difference 45.",
    set: {
      answer: "45",
      explanation:
        "p : q = 14 : 1 and pq = 1134, so 14q\u00b2 = 1134 \u2192 q\u00b2 = 81 \u2192 HCF q = 9 and LCM p = 126.\n" +
        "The numbers are 9a and 9b with a, b coprime and ab = 126/9 = 14.\n" +
        "Coprime factor pairs of 14 are (1, 14) \u2192 9 and 126, and (2, 7) \u2192 18 and 63.\n" +
        "The intended pair is 18 and 63, so the difference is 63 \u2212 18 = 45.",
    },
  },
  {
    id: "58042",
    src: "csat",
    reason: "LCM of the fractions is 54/5 = 10.8, not 5.4; 10.8 / 0.03 = 360.",
    set: {
      answer: "y = 360x",
      explanation:
        "HCF of fractions = HCF(numerators) / LCM(denominators) = HCF(3, 6, 9, 27) / LCM(5, 25, 20, 50) = 3/100.\n" +
        "LCM of fractions = LCM(numerators) / HCF(denominators) = LCM(3, 6, 9, 27) / HCF(5, 25, 20, 50) = 54/5.\n" +
        "So x = 3/100 and y = 54/5.\n" +
        "y / x = (54/5) \u00d7 (100/3) = 54 \u00d7 20 / 3 = 360. Hence y = 360x.",
    },
  },
  {
    id: "10039",
    src: "prelims",
    reason: "UPSC official key for CSE (P) 2025 is 'Only three'; the stored explanation already said option (b).",
    set: {
      answer: "(b) Only three",
      explanation:
        "Correctly matched: Cassava (woody shrub), Ginger (herb with pseudostem) and Malabar spinach (herbaceous climber).\n" +
        "Incorrectly matched: Mint is a perennial herb, not an annual shrub. Papaya is a large herbaceous plant with a soft, non-woody stem, not a woody shrub.\n" +
        "Hence only three pairs are correctly matched.",
    },
  },
  {
    id: "245",
    src: "prelims",
    reason: "Ain-i-Akbari lists Jyotisha among the Indian sciences prescribed by Akbar; Vyakarana is not in that list.",
    set: {
      answer: "D. Jyotisha",
      explanation:
        "In the Ain-i-Akbari, Abul Fazl records the subjects Akbar prescribed for study at school. Among the 'Indian sciences' listed is Jyotisha (astronomy/astrology).\n" +
        "Vyakarana (grammar), although a classical Indian discipline, does not appear in that prescribed list.",
    },
  },
  {
    id: "12021256",
    src: "prelims",
    reason: "IR Code 2020: re-skilling fund is 15 days' wages (statement 1 correct); negotiating union threshold is 51%, not 41% (statement 2 incorrect).",
    set: {
      answer: "(a) 1 only",
      explanation:
        "Statement 1 is correct: under the Industrial Relations Code, 2020 the employer must contribute an amount equal to 15 days' last-drawn wages of every retrenched worker to the Worker Re-skilling Fund, over and above retrenchment compensation.\n" +
        "Statement 2 is incorrect: where more than one registered trade union exists, the union with at least 51 per cent of the workers on the muster roll is recognised as the sole negotiating union. The threshold is 51 per cent, not 41 per cent.",
    },
  },
  {
    id: "12021253",
    src: "prelims",
    reason: "All three statements match the Promotion and Regulation of Online Gaming Act, 2025; social games promotion is expressly provided for.",
    set: {
      answer: "(a) 1, 2 and 3",
      explanation:
        "Statement 1 is correct: the Act requires the Central Government to recognise and register e-sports as a legitimate form of competitive sport.\n" +
        "Statement 2 is correct: the Act provides for facilitating the development and availability of online social games for recreational and educational purposes.\n" +
        "Statement 3 is correct: the Act prohibits online money games and online money gaming services, irrespective of whether the outcome turns on skill or chance.\n" +
        "Hence all three statements are correct.",
    },
  },
  {
    id: "80172",
    src: "english",
    reason: "Correct reading is R-P-S-Q: '...is often considered to be paradigmatic and the only instance worthy of attention in a comparative sociological study of peasant movements in India.'",
    set: {
      answer: "(c) RPSQ",
      explanation:
        "The complete sentence reads: 'The Telangana peasant revolt against the Nizam of Hyderabad in the 1940s is often (R) considered to be paradigmatic (P) and the only instance worthy of attention in a comparative (S) sociological study of peasant movements in India (Q).'\n" +
        "R opens the sentence, P supplies the complement of 'is often', S continues with 'and the only instance... in a comparative', and Q completes the noun phrase 'comparative sociological study...'. Hence RPSQ.",
    },
  },
  {
    id: "81062",
    src: "english",
    reason: "P must follow S1 ('such a partial replacement'); Q must precede S6 (both concern soviets).",
    set: {
      answer: "(b) PRSQ",
      explanation:
        "S1 states that Kerensky replaced Prince Lvov. P follows immediately, since 'such a partial replacement' refers back to that change.\n" +
        "R then gives the context that Lenin was in Switzerland during the February Revolution, and S continues with his arrival in April 1917 followed by Trotsky.\n" +
        "Q states what the revolutionaries wanted \u2014 a soviet of workers, soldiers and labourers \u2014 which leads directly into S6 on the role of the Soviets. Hence PRSQ.",
    },
  },
  {
    id: "20000814",
    src: "state_pcs",
    reason: "Spelling: 'Proration' corrected to 'Prorogation' (reported by user). Answer unchanged.",
    set: {
      question:
        "Consider the following statements :\n" +
        "1) The summoning of the House means convocation\n" +
        "2) Prorogation ends a session\n" +
        "3) Dissolution terminates a House\n" +
        "4) Prorogation of a session can be effected by the leader of the House alone\n" +
        "Out of these which is not true?",
    },
  },
  {
    id: "20000808",
    src: "state_pcs",
    reason: "Options were missing: the four statements had been stored in the options array, leaving no code options to choose from.",
    set: {
      question:
        "Which of the following Directive Principles do not follow Gandhian Principles?\n" +
        "1. Organization of Village Panchayats\n" +
        "2. Common Civil Code\n" +
        "3. Promotion of cottage Industry in rural areas\n" +
        "4. Right to work\n" +
        "Select the answer using the code given below :",
      options: ["(A) 1 and 2", "(B) 1 and 3", "(C) 2 and 4", "(D) 3 and 4"],
      answer: "(C) 2 and 4",
      explanation:
        "Article 40 (organisation of village panchayats) and Article 43 (promotion of cottage industries) are Gandhian Principles.\n" +
        "Article 44 (Uniform/Common Civil Code) is a Liberal\u2013Intellectual Principle and Article 41 (right to work) is a Socialist Principle.\n" +
        "Hence 2 and 4 do not follow Gandhian Principles.",
    },
  },
  {
    id: "14145",
    src: "prelims",
    reason: "List-II was missing, leaving the numbered options (1-4) undefined. Restored from the matching implied by the answer key.",
    set: {
      question:
        "Match List-I with List-II and select the correct answer using the code given below the Lists :\n" +
        "List-I (Temple)\n" +
        "A. Kailasanathar\n" +
        "B. Lingaraj\n" +
        "C. Kandariya Mahadev\n" +
        "D. Dilwara\n" +
        "List-II (Town)\n" +
        "1. Bhubaneshwar\n" +
        "2. Khajuraho\n" +
        "3. Mount Abu\n" +
        "4. Kanchipuram",
      explanation:
        "Kailasanathar temple is at Kanchipuram (Tamil Nadu) \u2014 A-4.\n" +
        "Lingaraj temple is at Bhubaneshwar (Odisha) \u2014 B-1.\n" +
        "Kandariya Mahadev temple is at Khajuraho (Madhya Pradesh) \u2014 C-2.\n" +
        "Dilwara temples are at Mount Abu (Rajasthan) \u2014 D-3.",
    },
  },
  {
    id: "2288",
    src: "prelims",
    reason: "Mis-tagged: a valency question was filed under International Relations.",
    set: { subject: "Science", topic: "Chemistry" },
  },
  {
    id: "300010",
    src: "prelims",
    reason: "Mis-tagged: a Rigvedic-period question was filed under Modern History.",
    set: { subject: "Ancient & Medieval History", topic: "Vedic Period" },
  },
  {
    id: "14249",
    src: "prelims",
    reason:
      "Options reference statement 4 but only three statements are stored; the original statement list could not be recovered from a reliable source. Flagged for manual review rather than guessed.",
    set: { needsReview: true, reviewNote: "Statement list incomplete - options refer to a statement 4 that is not present. Verify against the CDS (2) 2014 paper before serving." },
  },
];

const pkPathCache = new Map();
async function partitionKeyPath(containerName) {
  if (!pkPathCache.has(containerName)) {
    const { resource } = await db.container(containerName).read();
    pkPathCache.set(containerName, resource.partitionKey.paths[0].replace(/^\//, ""));
  }
  return pkPathCache.get(containerName);
}

let changed = 0;
let skipped = 0;

for (const fix of FIXES) {
  const containerName = CONTAINERS[fix.src];
  const container = db.container(containerName);
  const pkField = await partitionKeyPath(containerName);

  const { resources } = await container.items
    .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: fix.id }] })
    .fetchAll();

  if (!resources.length) {
    console.log(`SKIP  ${fix.id}  not found in ${containerName}`);
    skipped += 1;
    continue;
  }

  const doc = resources[0];
  const previous = {};
  let dirty = false;

  for (const [field, value] of Object.entries(fix.set)) {
    const before = doc[field];
    if (JSON.stringify(before) === JSON.stringify(value)) continue;
    previous[field] = before === undefined ? null : before;
    doc[field] = value;
    dirty = true;
  }

  if (!dirty) {
    console.log(`OK    ${fix.id}  already matches desired state`);
    skipped += 1;
    continue;
  }

  const history = Array.isArray(doc.correction) ? doc.correction : doc.correction ? [doc.correction] : [];
  history.push({ at: new Date().toISOString(), reason: fix.reason, source: "user-feedback-verification", previous });
  doc.correction = history;

  console.log(`FIX   ${fix.id}  ${containerName}`);
  for (const field of Object.keys(previous)) {
    const b = JSON.stringify(previous[field]);
    const a = JSON.stringify(doc[field]);
    console.log(`        ${field}: ${b && b.length > 90 ? b.slice(0, 90) + "..." : b}`);
    console.log(`          \u2192 ${a && a.length > 90 ? a.slice(0, 90) + "..." : a}`);
  }

  if (APPLY) await container.item(doc.id, doc[pkField]).replace(doc);
  changed += 1;
}

console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"} - ${changed} document(s) to change, ${skipped} unchanged.`);
if (!APPLY) console.log("Re-run with --apply to write.");
