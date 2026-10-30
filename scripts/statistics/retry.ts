import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";
import { StatisticsService } from "../../features/statistics/service.js";

if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) throw new Error("Cosmos storage configuration is missing");
const database = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY }).database("pyqpowerhouse");
const service = new StatisticsService(database);
console.log(await service.repair(25));
