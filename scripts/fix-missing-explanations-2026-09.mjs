/**
 * Adds concise explanations to the remaining questions found by the
 * September 2026 completeness audit and corrects four verified answer keys.
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
  .container("questions");

const explanations = {
  "10020": "The Congress adopted the attainment of Swaraj through legitimate and peaceful means as its objective, while the Non-Cooperation programme was designed to intensify progressively. Mass civil disobedience, including refusal to pay taxes, was reserved for a later stage if Swaraj was not achieved within a year and the colonial government continued repression. Hence option (c) is correct.",
  "10024": "India was the world's leading producer and exporter of turmeric in 2022-23, and more than thirty varieties are grown in the country. Maharashtra, Telangana, Karnataka and Tamil Nadu were also among the major turmeric-producing States. Hence option (d) is correct.",
  "10025": "Matching ancient rock belts on the Brazilian and West African coasts, the relationship between Ghana's placer gold and the Brazilian plateau, and corresponding Gondwana sediments across southern landmasses are all standard evidence that the continents were once joined. Hence option (c) is correct.",
  "10028": "Chalk has connected pore spaces, so it is porous and generally permeable to water. Clay also has pores, but they are extremely small and poorly connected, making it nearly impermeable; therefore the statement that clay is not porous at all is false. Hence option (c) is correct.",
  "10031": "Both silica-bearing clay and limestone are used in cement manufacture. The major process emission is explained by calcination, in which limestone is converted to lime and releases carbon dioxide; merely mixing clay with limestone does not explain the emissions. Hence option (b) is correct.",
  "10033": "Solar flares and coronal mass ejections can deliver energy to Earth's upper atmosphere, but they do not explain the observed long-term shift in polar motion. Melting land ice redistributes water and mass from polar regions towards lower latitudes, affecting Earth's rotation and axis. Hence option (b) is correct.",
  "10034": "Article 6.2 and Article 6.4 of the Paris Agreement provide frameworks for internationally transferred mitigation outcomes and carbon-credit mechanisms. Article 6.8 separately promotes voluntary cooperation through non-market approaches, so both statements explain why Article 6 is widely discussed. Hence option (a) is correct.",
  "10057": "The National Automotive Board is under the Ministry of Heavy Industries, and the Coir Board is under the Ministry of Micro, Small and Medium Enterprises. The National Centre for Trade Information was associated with the Department of Commerce, so none of the listed pairs is correctly matched. Hence option (d) is correct.",
  "12021250": "The summit was co-organized by the Government of Odisha and the Global Finance & Technology Network, not by Odisha and Andhra Pradesh, so statement 1 is incorrect. It was held under the BharatNetra initiative, making statement 2 correct. Hence option (b) is correct.",
  "12021270": "Anna Chakra was developed through collaboration between the United Nations World Food Programme and the Foundation for Innovation and Technology Transfer at IIT Delhi. It uses optimization techniques to improve routes in the Public Distribution System supply chain. Hence option (d) is correct.",
  "12021361": "In uniform circular motion, the speed is v = omega R and the centripetal acceleration is v squared divided by R. Therefore its magnitude is omega squared R and its direction is radially inward, towards the centre. Hence option (b) is correct.",
  "12021884": "Britain had plentiful coal and iron resources, often located close together, which strongly supported early industrialisation. Blast furnaces existed before the eighteenth century; the important early-eighteenth-century development was Abraham Darby's successful use of coke in a blast furnace. Hence option (c) is correct.",
  "126064": "For an object beyond the centre of curvature, a concave mirror forms the image between the focus and the centre of curvature. As the object accelerates towards the mirror, the image moves away from the focus with increasing speed and approaches the centre of curvature. Hence option (a) is correct.",
  "126073": "The ray enters the first face normally, so it is not refracted there. It then strikes the next glass-air face at 60 degrees, above the critical angle, undergoes total internal reflection, and subsequently reaches the base normally and emerges without deviation. Hence option (d) is correct.",
  "126074": "For the reflected ray to retrace its path, it must strike the polished surface BC normally. The ray makes an angle of pi/3 with surface AB, so the triangle formed with the normal to BC gives theta = pi/2 - pi/3 = pi/6. Hence option (a) is correct.",
  "1683": "M. C. Rajah's All India Depressed Classes Association supported joint electorates, while the All India Depressed Classes Leaders' Conference demanded separate electorates. The Communal Award of 1932 also granted separate electorates to the Depressed Classes, so all three statements are correct. Hence option (d) is correct.",
  "2126": "The Ganga Plain extends from the Ghaggar River in the west to the Teesta River in the east. Therefore the Ghaggar marks its western boundary. Hence option (b) is correct.",
  "2148": "In the Indian national calendar, Asvina broadly falls in September-October and is followed by Kartika in October-November. The paired Asvina-Kartika period therefore corresponds most closely to September-October among the given options. Hence option (c) is correct.",
  "218": "Hong Kong lies on the eastern side of the Pearl River Estuary, where the river system opens into the South China Sea. Bangkok and Singapore are in different regions, while the examination key identifies Hong Kong as the intended location. Hence option B is correct.",
  "23001": "The Jhelum passes through and feeds Wular Lake, so statement 1 is correct. Kolleru is mainly fed by the Budameru and Tammileru rivers, while Kanwar Lake is associated with the meandering Burhi Gandak rather than the Gandak as stated. Hence option (a) is correct.",
  "23014": "The lion-tailed macaque is diurnal, while the Malabar civet is nocturnal. For this examination key, sambar deer is treated as crepuscular rather than generally nocturnal or most active after sunset, leaving only the Malabar civet. Hence option (a) is correct.",
  "23017": "Indian tree squirrels generally build dreys or use tree cavities rather than making ground burrows, so statement 1 is incorrect. They may cache nuts and seeds in the ground, and their diet can include animal matter as well as plant food, making statements 2 and 3 correct. Hence option (b) is correct.",
  "23023": "Carbon markets price emissions and allow reductions to occur where they are most economical, making them an important climate-policy tool. Auctioning allowances can transfer private-sector resources to the State, but that fiscal transfer is not the reason carbon markets are widely used. Hence option (b) is correct.",
  "23038": "A Community Reserve is managed by a Community Reserve Management Committee, not directly by the Chief Wildlife Warden. Hunting is prohibited, and existing traditional agricultural practices may continue subject to the management plan, while collection of non-timber forest produce is not an automatic unrestricted entitlement. Hence option (b) is correct.",
  "23084": "The Flag Code prescribes a length-to-height ratio of 3:2, so statement II is correct. Its standard dimensions include 900 x 600 mm and 450 x 300 mm, but not 600 x 400 mm, making statement I incorrect. Hence option (d) is correct.",
  "24070": "The amended North-Eastern Council Act includes the Governors and Chief Ministers of the constituent States and three members nominated by the President. The Union Home Minister is not an ex officio member merely by virtue of that office. Hence option (a) is correct.",
  "300025": "The Sutlej rises on the Tibetan Plateau, cuts across the Himalaya as an antecedent river, and flows through China, India and Pakistan. It is important for irrigation and joins the Chenab-Panjnad river system rather than forming distributaries. Hence option (c) is correct.",
  "300082": "The four Grand Slam tournaments cooperate through a shared governance structure. Their open-competition framework admits internationally ranked players aged 14 or above subject to the applicable entry conditions, while the rules state that there is no limit on the number of wild cards a player may receive. Hence option (a) is correct.",
  "316": "The four recipients of the Major Dhyan Chand Khel Ratna Award 2024 were Gukesh D, Harmanpreet Singh, Praveen Kumar and Manu Bhaker. Therefore all four names listed in the question are correct. Hence option A is correct.",
  "439": "DRR Rice 100 (Kamla) was developed by ICAR-IIRR in Hyderabad, whereas Pusa DST Rice 1 was developed by ICAR-IARI in New Delhi, so statement 1 as worded is incorrect. DRR Rice 100 is based on Samba Mahsuri and matures earlier, making statement 2 correct. Hence option B is correct.",
  "80073": "Article 341 allows the President to specify castes, races or tribes, including parts or groups within them, that are deemed Scheduled Castes. Parliament may by law include or exclude a caste, race or tribe from that list, so all three statements follow the constitutional provision. Hence option (c) is correct.",
  "80090": "At t = 1 second, the tangential acceleration is dv/dt = 4 square root 3 metres per second squared. The inward radial acceleration is v squared divided by R = 12 metres per second squared, so tan phi = (4 square root 3)/12 = 1/square root 3. Hence option (a) is correct.",
};

const answerCorrections = {
  "12021361": "(b) \u03c9\u00b2R, towards the centre of the circle",
  "126074": "(a) \u03c0/6",
  "1683": "(d) 1, 2 and 3",
  "218": "B. Hong Kong",
};

const expectedAnswers = {
  "12021361": "(c) \u03c9R\u00b2, towards the centre of the circle",
  "126074": "(b) \u03c0/3",
  "1683": "(b) 2 and 3 only",
  "218": "C. Macau",
};

const normalize = (value) =>
  String(value ?? "")
    .replaceAll("\u03c9", "omega")
    .replaceAll("\u03c0", "pi")
    .replaceAll("\u00b2", " squared")
    .replace(/\s+/g, " ")
    .trim();

const { resource: metadata } = await container.read();
const partitionKey = metadata.partitionKey.paths[0].replace(/^\//, "");
let changed = 0;
let skipped = 0;

for (const [id, explanation] of Object.entries(explanations)) {
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  const doc = resources[0];
  if (!doc) throw new Error(`Question ${id} not found`);

  if (String(doc.explanation ?? "").trim()) {
    console.log(`SKIP ${id}: explanation already populated`);
    skipped += 1;
    continue;
  }

  const previous = { explanation: doc.explanation ?? null };
  if (answerCorrections[id]) {
    if (normalize(doc.answer) !== normalize(expectedAnswers[id])) {
      throw new Error(
        `Question ${id} answer changed unexpectedly: ${JSON.stringify(doc.answer)}`,
      );
    }
    previous.answer = doc.answer;
    doc.answer = answerCorrections[id];
  }

  doc.explanation = explanation;
  const history = Array.isArray(doc.correction)
    ? doc.correction
    : doc.correction
      ? [doc.correction]
      : [];
  history.push({
    at: new Date().toISOString(),
    reason: answerCorrections[id]
      ? "Add missing explanation and correct verified answer key."
      : "Add concise explanation after missing-explanation audit.",
    source: "question-completeness-audit-2026-09",
    previous,
  });
  doc.correction = history;
  doc.modifiedAt = new Date().toISOString();

  console.log(
    `${APPLY ? "UPDATE" : "WOULD UPDATE"} ${id}${answerCorrections[id] ? ` answer -> ${doc.answer}` : ""}`,
  );
  if (APPLY) await container.item(doc.id, doc[partitionKey]).replace(doc);
  changed += 1;
}

console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} changed, ${skipped} skipped`);
if (!APPLY) console.log("Re-run with --apply to write.");
