/**
 * Restores numbered statements truncated from nine UPPSC Prelims 2025 questions.
 *
 * Verified against the UPPSC 2025 General Studies-I paper:
 * https://uppsc.up.nic.in/OuterPages/PreQuesPapers.aspx?ID=PrevQues
 *
 * Dry-run by default. Pass --apply to write.
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const container = client
  .database(process.env.COSMOS_DATABASE || "pyqpowerhouse")
  .container("state_pcs");

const FIXES = [
  {
    id: "20002126",
    question:
      "Iron dome missile defence system belongs to which of the following countries?\n" +
      "1. France\n" +
      "2. United States of America\n" +
      "3. Israel\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 2 and 3", "(c) Only 3", "(d) Only 1"],
    answer: "(c) Only 3",
  },
  {
    id: "20002161",
    question:
      "Who among the following had won the International Booker Prize in 2025?\n" +
      "1. Banu Mushtaq\n" +
      "2. Deepa Bhasthi\n" +
      "3. Sanjay Chauhan\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 2 and 3", "(c) Only 3", "(d) Only 1"],
    answer: "(a) 1 and 2",
  },
  {
    id: "20002164",
    question:
      "'BHARATPOL', an online portal for International Police Co-operation has been developed by which of the following?\n" +
      "1. Central Bureau of Investigation\n" +
      "2. Research and Analysis Wing\n" +
      "3. Intelligence Bureau\n" +
      "4. Enforcement Directorate\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 2 and 3", "(b) Only 3", "(c) 3 and 4", "(d) Only 1"],
    answer: "(d) Only 1",
  },
  {
    id: "20002191",
    question:
      "Which one of the following books is NOT written by Kalidas?\n" +
      "1. Meghaduta\n" +
      "2. Raghuvamsam\n" +
      "3. Shringar Shatak\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 2 and 3", "(c) Only 3", "(d) Only 1"],
    answer: "(c) Only 3",
  },
  {
    id: "20002193",
    question:
      "Which of the following Department prepares the National Indicator Framework Progress Report related to Sustainable Development Goals in Uttar Pradesh?\n" +
      "1. Department of Finance\n" +
      "2. Department of Education\n" +
      "3. Department of Planning\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 1 and 3", "(c) Only 3", "(d) Only 1"],
    answer: "(c) Only 3",
  },
  {
    id: "20002206",
    question:
      "The Appiko Movement is associated with which of the following Indian States?\n" +
      "1. Uttarakhand\n" +
      "2. Uttar Pradesh\n" +
      "3. Kerala\n" +
      "4. Karnataka\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 3 and 4", "(c) Only 4", "(d) Only 1"],
    answer: "(c) Only 4",
  },
  {
    id: "20002213",
    question:
      "'Adi Karmyogi Beta Version - A Responsive Governance Initiative' was launched by which of the following ministry in June 2025?\n" +
      "1. Ministry of AYUSH\n" +
      "2. Ministry of Women and Child Development\n" +
      "3. Ministry of Social Justice and Empowerment\n" +
      "4. Ministry of Tribal Affairs\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) Only 1 and 2", "(b) Only 2 and 3", "(c) Only 4", "(d) Only 1"],
    answer: "(c) Only 4",
  },
  {
    id: "20002224",
    question:
      "Operation Brahma was launched by India in March 2025 to provide humanitarian aid to which of the following countries?\n" +
      "1. Bangladesh\n" +
      "2. Myanmar\n" +
      "3. Sri Lanka\n" +
      "4. Malaysia\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) Only 2", "(b) Only 1 and 3", "(c) Only 2 and 4", "(d) Only 1"],
    answer: "(a) Only 2",
  },
  {
    id: "20002247",
    question:
      "The Global Financial Stability Report is released by which among the following?\n" +
      "1. International Monetary Fund\n" +
      "2. World Economic Forum\n" +
      "3. World Bank\n" +
      "Select the correct answer from the code given below:",
    options: ["(a) 1 and 2", "(b) 2 and 3", "(c) Only 3", "(d) Only 1"],
    answer: "(d) Only 1",
  },
];

let changed = 0;
let unchanged = 0;

for (const fix of FIXES) {
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false)",
      parameters: [{ name: "@id", value: fix.id }],
    })
    .fetchAll();

  if (resources.length !== 1) {
    throw new Error(`Expected one active state_pcs document for ${fix.id}, found ${resources.length}`);
  }

  const doc = resources[0];
  const previous = {};

  for (const field of ["question", "options", "answer"]) {
    if (JSON.stringify(doc[field]) === JSON.stringify(fix[field])) continue;
    previous[field] = doc[field] ?? null;
    doc[field] = fix[field];
  }

  if (!Object.keys(previous).length) {
    console.log(`OK   ${fix.id}`);
    unchanged += 1;
    continue;
  }

  const history = Array.isArray(doc.correction)
    ? doc.correction
    : doc.correction
      ? [doc.correction]
      : [];
  history.push({
    at: new Date().toISOString(),
    reason: "Restored numbered statements truncated from the UPPSC Prelims 2025 General Studies-I paper.",
    source: "UPPSC 2025 General Studies-I question paper",
    previous,
  });
  doc.correction = history;

  console.log(`FIX  ${fix.id}: ${Object.keys(previous).join(", ")}`);
  if (APPLY) await container.item(doc.id, doc.id).replace(doc);
  changed += 1;
}

console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"} - ${changed} changed, ${unchanged} unchanged.`);
if (!APPLY) console.log("Re-run with --apply to write.");
