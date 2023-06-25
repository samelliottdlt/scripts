import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { createCommandModules } from "./scripts/index.js";

const y = yargs(hideBin(process.argv));
const commandModules = createCommandModules();
for (const commandModule of commandModules) {
  y.command(commandModule);
}
y.demandCommand().help().argv;
