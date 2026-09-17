/**
 * Resolves the 4 duplicate pairs that stored contradicting answers.
 * Dry-run by default; pass --apply to write. Previous values kept in `correction`.
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const db = client.database(process.env.COSMOS_DATABASE || "pyqpowerhouse");

const FIXES = [
  {
    container: "questions",
    id: "13155",
    reason: "Duplicate-pair conflict with 150056. Official key: both statements true and II explains I.",
    set: {
      answer: "(a) Both the statements are individually true and Statement II is the correct explanation of Statement I",
      explanation:
        "Statement I is true: the Communists left the AITUC in 1931 and formed the Red Trade Union Congress.\n" +
        "Statement II is true: following the Sixth Comintern Congress (1928), Indian Communists adopted a sectarian 'class against class' line and withdrew from the Congress-led mainstream national movement.\n" +
        "Statement II explains Statement I \u2014 the ideological break of 1928 is precisely what led to the 1931 split in the AITUC.",
    },
  },
  {
    container: "questions",
    id: "18201",
    reason: "Duplicate-pair conflict with 18101. Specific heat is independent of mass/shape (2 correct); statement 3 says 'only temperature', which is wrong.",
    set: {
      answer: "(d) 2 only",
      explanation:
        "Specific heat is an intensive property: it does not depend on the mass or the shape of the body, so statement 1 is incorrect and statement 2 is correct.\n" +
        "Statement 3 is incorrect because specific heat depends primarily on the material of the body, not 'only' on its temperature (temperature causes a small variation).\n" +
        "Hence only statement 2 is correct.",
    },
  },
  {
    container: "csat-questions",
    id: "58043",
    reason: "Duplicate of 58041 (explanation literally read 'Duplicate in PDF'). Correct value is 45.",
    set: {
      answer: "45",
      explanation:
        "p : q = 14 : 1 and pq = 1134, so 14q\u00b2 = 1134 \u2192 q\u00b2 = 81 \u2192 HCF q = 9 and LCM p = 126.\n" +
        "The numbers are 9a and 9b with a, b coprime and ab = 14.\n" +
        "The coprime pair (2, 7) gives the numbers 18 and 63, so the difference is 45.",
    },
  },
  {
    container: "english-questions",
    id: "81149",
    reason: "Duplicate-pair conflict with 80030. Correct ordering is R-Q-P-S.",
    set: {
      answer: "(c) RQPS",
      explanation:
        "The complete sentence reads: 'Peace is always the only alternative (R) not only during war and (Q) turbulent times (P) but also during peaceful times (S).'\n" +
        "The 'not only \u2026 but also' pair fixes Q and S, and P completes 'war and turbulent times'. Hence RQPS.",
    },
  },
];

const pkCache = new Map();
async function pkPath(name) {
  if (!pkCache.has(name)) {
    const { resource } = await db.container(name).read();
    pkCache.set(name, resource.partitionKey.paths[0].replace(/^\//, ""));
  }
  return pkCache.get(name);
}

let changed = 0;
for (const fix of FIXES) {
  const container = db.container(fix.container);
  const { resources } = await container.items
    .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: fix.id }] })
    .fetchAll();
  if (!resources.length) {
    console.log(`SKIP ${fix.id} not found in ${fix.container}`);
    continue;
  }
  const doc = resources[0];
  const previous = {};
  let dirty = false;
  for (const [k, v] of Object.entries(fix.set)) {
    if (JSON.stringify(doc[k]) === JSON.stringify(v)) continue;
    previous[k] = doc[k] ?? null;
    doc[k] = v;
    dirty = true;
  }
  if (!dirty) {
    console.log(`OK   ${fix.id} already correct`);
    continue;
  }
  const hist = Array.isArray(doc.correction) ? doc.correction : doc.correction ? [doc.correction] : [];
  hist.push({ at: new Date().toISOString(), reason: fix.reason, source: "duplicate-conflict-audit", previous });
  doc.correction = hist;
  console.log(`FIX  ${fix.id} (${fix.container})  answer: ${JSON.stringify(previous.answer)} \u2192 ${JSON.stringify(doc.answer)}`);
  if (APPLY) await container.item(doc.id, doc[await pkPath(fix.container)]).replace(doc);
  changed += 1;
}
console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"} - ${changed} change(s).`);
