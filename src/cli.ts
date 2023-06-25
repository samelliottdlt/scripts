import { resolveCallStack } from "./call-stack.js";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { updateShell } from "./update-shell.js";
import inquirer from "inquirer";

interface CommandLineArgs {
  callStack?: number[];
  symbolFile?: string;
  addToPath?: boolean;
}

const argv = yargs(hideBin(process.argv))
  .option("symbolFile", {
    type: "string",
    describe: "Path to the symbol file",
  })
  .option("callStack", {
    type: "array",
    describe: "Array of call stack symbol indexes",
  })
  .option("addToPath", {
    type: "boolean",
    describe: "If passed, adds the binary to the PATH",
  }).argv as CommandLineArgs;

if (argv.addToPath ?? false) {
  updateShell();
}

async function getArgsAndResolve(): Promise<void> {
  let symbolFile = argv.symbolFile;
  let callStack = argv.callStack;

  if (symbolFile === undefined) {
    const answers = await inquirer.prompt([
      {
        name: "symbolFile",
        type: "input",
        message: "Please provide the path to the symbol file:",
      },
    ]);
    symbolFile = answers.symbolFile;
  }

  if (callStack === undefined) {
    const answers = await inquirer.prompt([
      {
        name: "callStack",
        type: "input",
        message:
          "Please provide the call stack symbol indexes (comma separated):",
        filter(value) {
          return value.split(",").map(Number);
        },
      },
    ]);
    callStack = answers.callStack;
  }

  if (symbolFile !== undefined && callStack !== undefined) {
    await resolveCallStack(callStack, symbolFile);
  }
}

getArgsAndResolve().catch((err) => {
  console.error(err);
  throw err;
});
