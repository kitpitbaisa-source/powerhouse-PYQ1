/**
 * Applies the verified NDA 2026 audit corrections.
 *
 * Dry-run by default. Pass --apply and --backup=<absolute path> to write.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const backupArg = process.argv.find((arg) => arg.startsWith("--backup="));
const backupPath = backupArg?.slice("--backup=".length);

if (APPLY && !backupPath) {
  throw new Error("--backup=<absolute path> is required with --apply.");
}
if (backupPath && !path.isAbsolute(backupPath)) {
  throw new Error("--backup must be an absolute path.");
}

const endpoint =
  process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = process.env.COSMOS_DATABASE || "pyqpowerhouse";

if (!key) {
  throw new Error("COSMOS_KEY is not set.");
}

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container("questions");

const correctPrompt = "Which of the statements given above is/are correct?";
const correctPluralPrompt = "Which of the statements given above are correct?";

const corrections = {
  "126074": {
    exam: "NDA (1) 2026",
    guard: "glass slab of refractive index",
    answer: "(b) π/3",
    explanation:
      "For the reflected ray to retrace its path, it must strike the polished surface BC normally. From the geometry shown in the paper, the required interior angle ABC is π/3. Hence option (b) is correct.",
  },
  "126078": {
    exam: "NDA (1) 2026",
    guard: "A colloid and a suspension",
    options: [
      "(a) I only",
      "(b) II and III only",
      "(c) I, II and III",
      "(d) I, II and IV",
    ],
    answer: "(d) I, II and IV",
  },
  "126129": {
    exam: "NDA (1) 2026",
    guard: "famous Jain pilgrimage sites",
    explanation:
      "Moodabidri in Karnataka and Sonagiri in Madhya Pradesh are prominent Jain pilgrimage centres. Madurai is not one of the intended Jain pilgrimage towns in this question. Hence I and III only are correct.",
  },
  "126147": {
    exam: "NDA (1) 2026",
    guard: "2024–2025 Ranji Trophy",
    explanation:
      "Vidarbha won the 2024-2025 Ranji Trophy. Therefore option (a) is correct.",
  },
  "126150": {
    exam: "NDA (1) 2026",
    guard: "Operation Kaveri",
    options: [
      "(a) A-III, B-II, C-I, D-IV",
      "(b) A-III, B-I, C-II, D-IV",
      "(c) A-IV, B-II, C-I, D-III",
      "(d) A-IV, B-I, C-II, D-III",
    ],
    answer: "(c) A-IV, B-II, C-I, D-III",
  },
  "12021819": {
    exam: "NDA (2) 2026",
    guard: "total internal reflection",
    options: [
      "(a) The phenomenon of total internal reflection can occur only if light is passing at any angle from a medium of low refractive index to a medium of high refractive index.",
      "(b) The phenomenon of total internal reflection can occur only if light is passing from a medium of high refractive index to a medium of low refractive index and at an angle greater than the critical angle.",
      "(c) The phenomenon of total internal reflection can occur only if light is passing at any angle from a medium of high refractive index to a medium of low refractive index.",
      "(d) The phenomenon of total internal reflection can occur only if light is passing from a medium of low refractive index to a medium of high refractive index and at an angle greater than the critical angle.",
    ],
    answer:
      "(b) The phenomenon of total internal reflection can occur only if light is passing from a medium of high refractive index to a medium of low refractive index and at an angle greater than the critical angle.",
    explanation:
      "Total internal reflection requires light to travel from a medium of higher refractive index to one of lower refractive index, with the angle of incidence greater than the critical angle. Hence option (b) is correct.",
  },
  "12021821": {
    exam: "NDA (2) 2026",
    guard: "inverse square law",
    answer: "(c) Three",
    explanation:
      "The official UPSC provisional key marks three of the listed fields as following an inverse-square dependence and excludes the strong nuclear force field. Hence option (c) is recorded for this question.",
  },
  "12021829": {
    exam: "NDA (2) 2026",
    guard: "A biconvex lens",
    question:
      "A biconvex lens is made of a material of refractive index 2 such that the ratio of radii of curvature of its two faces is 1 : 2. A point source in air is placed on the principal axis of this lens at a distance u from the lens. Which one of the following is correct if the image is formed exactly at the same distance as that of the point source? (where R is the radius of curvature of the first face)",
    options: ["(a) u = R", "(b) u = 2R", "(c) 2u = 3R", "(d) 3u = 4R"],
  },
  "12021834": {
    exam: "NDA (2) 2026",
    guard: "uniform rope hangs symmetrically",
    answer:
      "(b) As the rope starts moving, every point on the rope has the same speed, but not the same acceleration.",
    explanation:
      "Because the rope is inextensible, every point has the same speed at a given instant. The direction of motion changes along the curved portion over the pulley, so the acceleration vectors are not the same at every point. Hence option (b) is correct.",
  },
  "12021838": {
    exam: "NDA (2) 2026",
    guard: "Two point charges of 4 C and 16 C",
    options: [
      "(a) 0",
      "(b) (1/(4πε₀))(1/9) N C⁻¹",
      "(c) (1/(4πε₀))(2/9) N C⁻¹",
      "(d) (1/(4πε₀))(1/18) N C⁻¹",
    ],
  },
  "12021800": {
    exam: "NDA (2) 2026",
    guard: "percentages by mass of nitrogen",
    answer: "(d) 47% and 7%",
    explanation:
      "Urea is CO(NH₂)₂ and has molar mass 60. Nitrogen contributes 28/60 × 100 ≈ 46.67%, while hydrogen contributes 4/60 × 100 ≈ 6.67%. The nearest values are 47% and 7%, so option (d) is correct.",
  },
  "12021805": {
    exam: "NDA (2) 2026",
    guard: "Example of Colloid",
    answer: "(c) Three",
    explanation:
      "Cloud is an aerosol, mud is a sol, and milk is an emulsion. Rubber is a solid sol rather than a foam. Therefore three pairs are correctly matched, so option (c) is correct.",
  },
  "12021808": {
    exam: "NDA (2) 2026",
    guard: "complex permanent tissue",
    options: [
      "(a) I, II, III and IV",
      "(b) II, III and IV only",
      "(c) I, III and IV only",
      "(d) I and II only",
    ],
  },
  "12021810": {
    exam: "NDA (2) 2026",
    guard: "external fertilization",
    options: [
      "(a) II, III and IV",
      "(b) II and III only",
      "(c) I and IV only",
      "(d) I, II and III",
    ],
    answer: "(b) II and III only",
  },
  "12021863": {
    exam: "NDA (2) 2026",
    guard: "Steppes of Eurasia",
    question:
      "Consider the following statements:<br/>I. The Steppes of Eurasia are temperate grasslands.<br/>II. The Pampas of South America are classified as tropical grasslands.<br/>Which of the statements given above is/are correct?",
  },
  "12021864": {
    exam: "NDA (2) 2026",
    guard: "slash-and-burn agricultural practices",
    question:
      `Consider the following statements regarding the slash-and-burn agricultural practices in India:<br/>I. This practice is a primitive subsistence farming.<br/>II. This practice is known as Jhum in the North Eastern Hill region.<br/>III. When soil fertility decreases, farmers shift to a fresh patch of land.<br/>${correctPrompt}`,
  },
  "12021865": {
    exam: "NDA (2) 2026",
    guard: "western disturbances",
    question:
      `Consider the following statements regarding western disturbances in the Indian climate:<br/>I. These are shallow cyclonic depressions.<br/>II. They originate over the Caspian Sea and travel to India.<br/>${correctPrompt}`,
  },
  "12021866": {
    exam: "NDA (2) 2026",
    guard: "earthquake waves",
    question:
      `Consider the following statements regarding earthquake waves:<br/>I. P-waves are similar to sound waves.<br/>II. S-waves can travel through gaseous, liquid and solid materials.<br/>III. The zone between 105° and 145° from the epicentre is identified as the shadow zone for both P- and S-waves.<br/>${correctPluralPrompt}`,
  },
  "12021867": {
    exam: "NDA (2) 2026",
    guard: "Coriolis force",
    question:
      `Consider the following statements:<br/>I. At the equator, the Coriolis force is zero and here the winds blow perpendicular to the isobars.<br/>II. The Coriolis force is directly proportional to the angle of latitude.<br/>III. The Coriolis force and the resultant wind do not blow parallel to the isobars at higher latitudes.<br/>${correctPluralPrompt}`,
    options: [
      "(a) I, II and III",
      "(b) I and III only",
      "(c) II and III only",
      "(d) I and II only",
    ],
    answer: "(d) I and II only",
  },
  "12021870": {
    exam: "NDA (2) 2026",
    guard: "igneous rocks",
    question:
      `Consider the following statements with regard to igneous rocks:<br/>I. These rocks cannot be changed into metamorphic rocks.<br/>II. When molten material is cooled slowly at great depths, mineral grains tend to be very small.<br/>III. These rocks are known as primary rocks.<br/>${correctPrompt}`,
  },
  "12021871": {
    exam: "NDA (2) 2026",
    guard: "Prime Meridian",
    question:
      `Consider the following statements:<br/>I. The Prime Meridian is the same as the International Date Line.<br/>II. West of the International Date Line is always a day later than east of the line.<br/>III. The Earth turns 15° of longitude in an hour.<br/>${correctPrompt}`,
    options: [
      "(a) I and II only",
      "(b) I and III only",
      "(c) II and III only",
      "(d) III only",
    ],
    answer: "(c) II and III only",
    explanation:
      "The Prime Meridian and International Date Line are different, so statement I is incorrect. Locations west of the International Date Line are one calendar day ahead of locations immediately east of it, and Earth rotates 15° of longitude per hour. Hence II and III only are correct.",
  },
  "12021874": {
    exam: "NDA (2) 2026",
    guard: "structure of the atmosphere",
    question:
      `Consider the following statements regarding the structure of the atmosphere:<br/>I. The average height of the troposphere is higher nearer the poles than at the equator.<br/>II. The mesosphere contains the ozone layer.<br/>III. Radio waves transmitted from the Earth are reflected to the Earth by the ionosphere.<br/>IV. In the mesosphere, temperature decreases with an increase in altitude.<br/>${correctPluralPrompt}`,
  },
  "12021882": {
    exam: "NDA (2) 2026",
    guard: "Shortughai",
    options: [
      "(a) Conch shells",
      "(b) Iron",
      "(c) Copper",
      "(d) Lapis lazuli and camel",
    ],
  },
  "12021883": {
    exam: "NDA (2) 2026",
    guard: "Luddism",
    question:
      "Which of the following statements are correct regarding the demands of the protest movement known as Luddism (1811-17)?<br/>I. A minimum wage for workers.<br/>II. The right to form trade unions so that they could legally present their demands.<br/>III. The use of machinery for efficient labour-saving production.<br/>Select the answer using the code given below:",
    options: [
      "(a) I and II only",
      "(b) II and III only",
      "(c) I and III only",
      "(d) I, II and III",
    ],
    answer: "(a) I and II only",
    explanation:
      "The Luddites demanded measures such as a minimum wage and the legal right to organize and present workers' demands. They opposed, rather than demanded, the use of labour-saving machinery that displaced workers. Hence I and II only are correct.",
  },
  "12021884": {
    exam: "NDA (2) 2026",
    guard: "Industrial Revolution in Britain",
    question:
      `Consider the following statements regarding the Industrial Revolution in Britain:<br/>I. At the beginning of industrialisation, coal and iron ore were plentifully available in Britain.<br/>II. The blast furnace came into use at the beginning of the 18th century.<br/>III. Britain was lucky in possessing excellent coking coal and high-grade iron ore in the same basins.<br/>${correctPluralPrompt}`,
  },
  "12021886": {
    exam: "NDA (2) 2026",
    guard: "Age of Consent Bill",
    question:
      "Match List I with List II:<br/>List I (Event)<br/>A. Passing of the Age of Consent Bill<br/>B. Establishment of the Arya Samaj<br/>C. Death of Dayanand Saraswati<br/>D. Foundation of the Nagari Pracharini Sabha<br/>List II (Year)<br/>1. 1893<br/>2. 1883<br/>3. 1875<br/>4. 1891<br/>Select the answer using the code given below:",
    options: [
      "(a) A-4, B-3, C-2, D-1",
      "(b) A-3, B-4, C-1, D-2",
      "(c) A-4, B-3, C-1, D-2",
      "(d) A-3, B-4, C-2, D-1",
    ],
    answer: "(a) A-4, B-3, C-2, D-1",
  },
  "12021887": {
    exam: "NDA (2) 2026",
    guard: "Amarakosha",
    question:
      `Consider the following statements with regard to the types of land listed in the Amarakosha:<br/>I. Devamatrika refers to land watered by rain.<br/>II. Aprahata refers to fallow land.<br/>III. Pankila refers to highly fertile land.<br/>${correctPrompt}`,
    options: [
      "(a) I and II only",
      "(b) II only",
      "(c) I and III only",
      "(d) I, II and III",
    ],
  },
  "12021888": {
    exam: "NDA (2) 2026",
    guard: "role of political parties",
    question:
      `Consider the following statements regarding the role of political parties in modern democracies:<br/>I. In most democracies, elections are fought mainly among the candidates put up by political parties.<br/>II. Political parties put forward different policies and programmes and the voters choose from them.<br/>III. Political parties shape public opinion.<br/>${correctPluralPrompt}`,
  },
  "12021889": {
    exam: "NDA (2) 2026",
    guard: "Lahore Session",
    question:
      `Consider the following statements with regard to the Lahore Session:<br/>I. The Congress decided to observe Independence Day on 26 January 1930.<br/>II. It was decided to hoist the National Flag and sing patriotic songs at different venues.<br/>III. Gandhiji suggested that the event be held synchronously in all the places.<br/>${correctPluralPrompt}`,
  },
  "12021890": {
    exam: "NDA (2) 2026",
    guard: "Kailasanatha temple",
    question:
      `Consider the following statements:<br/>I. The Kailasanatha temple of Kanchi is the earliest Pallava temple hewn from solid rock.<br/>II. The Vaikuntha Perumal temple at Kanchi is a rare Pallava temple dedicated to Lord Vishnu.<br/>${correctPrompt}`,
  },
  "12021843": {
    exam: "NDA (2) 2026",
    guard: "national integration",
    options: [
      "(a) II, III and IV",
      "(b) I, II and IV",
      "(c) III and IV only",
      "(d) II and III only",
    ],
    answer: "(a) II, III and IV",
  },
  "12021848": {
    exam: "NDA (2) 2026",
    guard: "constitutional recognition for local bodies",
    options: [
      "(a) K. Hanumanthaiah Committee",
      "(b) Veerappa Moily Committee",
      "(c) P.K. Thungon Committee",
      "(d) Kasturirangan Committee",
    ],
  },
  "12021851": {
    exam: "NDA (2) 2026",
    guard: "supply BrahMos missiles",
    explanation:
      "The countries listed as having engaged with India for BrahMos missile supply are Indonesia, the Philippines and Vietnam, while Singapore is not included. Hence I, II and IV are correct.",
  },
  "12021855": {
    exam: "NDA (2) 2026",
    guard: "uranium supply agreement",
    explanation:
      "The March 2026 uranium supply agreement identified in the paper was signed by India and Canada. Hence option (b) is correct.",
  },
  "12021857": {
    exam: "NDA (2) 2026",
    guard: "Vayu Shakti-2026",
    options: [
      "(a) I, II and III",
      "(b) I and III only",
      "(c) II and III only",
      "(d) I only",
    ],
    answer: "(a) I, II and III",
    explanation:
      "Vayu Shakti-2026 took place in Jaisalmer, involved strikes by aircraft including Rafale, Tejas and Mirage 2000, and included Apache and Chinook helicopters. Hence I, II and III are correct.",
  },
  "12021859": {
    exam: "NDA (2) 2026",
    guard: "Khelo India Tribal Games",
    question:
      "Which of the following statements regarding the Khelo India Tribal Games is/are correct?<br/>I. The inaugural edition of the Khelo India Tribal Games was organized in two States: Jharkhand and Odisha.<br/>II. 'Morveer' was the official mascot of these games.<br/>III. The Khelo India Tribal Games are part of the Khelo India Scheme.<br/>Select the answer using the code given below:",
    explanation:
      "The inaugural games were not organized in both Jharkhand and Odisha as stated. Morveer was the official mascot, and the event forms part of the Khelo India Scheme. Hence II and III only are correct.",
  },
  "12021861": {
    exam: "NDA (2) 2026",
    guard: "have jute mills",
    explanation:
      "Tripura, Chhattisgarh, Assam and Odisha all have jute mills. Therefore all four States are included, so option (d) is correct.",
  },
  "12021879": {
    exam: "NDA (2) 2026",
    guard: "nature of rocks",
    explanation:
      "Rocks are aggregates of one or more minerals, and gabbro can be black while quartzite can be milky white. Granite is harder, not softer, than soapstone, and foliation is associated with metamorphic rather than sedimentary rocks. Therefore statements II and IV are not correct.",
  },
};

const ids = Object.keys(corrections);
if (ids.length !== 38) {
  throw new Error(`Expected 38 corrections, found ${ids.length}.`);
}

const { resource: metadata } = await container.read();
const partitionKey = metadata.partitionKey.paths[0].replace(/^\//, "");
const documents = [];

for (const id of ids) {
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  const active = resources.filter((resource) => resource.isActive !== false);
  if (active.length !== 1) {
    throw new Error(`Expected one active questions record for ${id}, found ${active.length}.`);
  }
  const document = active[0];
  const correction = corrections[id];
  if (document.exam !== correction.exam) {
    throw new Error(
      `Question ${id} exam mismatch: expected ${correction.exam}, found ${document.exam}.`,
    );
  }
  if (!String(document.question || "").includes(correction.guard)) {
    throw new Error(`Question ${id} failed guard: ${correction.guard}`);
  }
  documents.push(document);
}

if (APPLY) {
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
  console.log(`Backup written: ${backupPath}`);
}

const comparable = (value) => JSON.stringify(value);
let changed = 0;
let unchanged = 0;

for (const document of documents) {
  const correction = corrections[document.id];
  const previous = {};
  for (const field of ["question", "options", "answer", "explanation"]) {
    if (!(field in correction)) continue;
    if (comparable(document[field]) === comparable(correction[field])) continue;
    previous[field] = document[field] ?? null;
    document[field] = correction[field];
  }

  if (Object.keys(previous).length === 0) {
    console.log(`UNCHANGED ${document.id}`);
    unchanged += 1;
    continue;
  }

  const history = Array.isArray(document.correction)
    ? document.correction
    : document.correction
      ? [document.correction]
      : [];
  history.push({
    at: new Date().toISOString(),
    reason: "Apply verified NDA 2026 official-paper and provisional-key audit corrections.",
    source: "nda-2026-official-paper-audit",
    previous,
  });
  document.correction = history;
  document.modifiedAt = new Date().toISOString();

  console.log(
    `${APPLY ? "UPDATE" : "WOULD UPDATE"} ${document.id}: ${Object.keys(previous).join(", ")}`,
  );
  if (APPLY) {
    const { _rid, _self, _etag, _attachments, _ts, ...payload } = document;
    await container.item(payload.id, payload[partitionKey]).replace(payload);
  }
  changed += 1;
}

if (APPLY && changed > 0) {
  await container.items.upsert({ id: "__cache_version__", version: Date.now() });
  console.log("Cache version bumped.");
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} changed, ${unchanged} unchanged.`,
);
if (!APPLY) console.log("Re-run with --apply and --backup=<absolute path> to write.");
