import fs from "fs";
import chalk from "chalk";
import inquirer from "inquirer";
import { ArgumentsCamelCase, CommandModule } from "yargs";

export default function createCommandModule(): CommandModule {
  return {
    command: "callstack [symbolFile] [callStack]",
    aliases: ["cs"],
    describe: "Parse call stack from a symbol file",
    builder: (yargs) => {
      return yargs
        .positional("symbolFile", {
          type: "string",
          describe: "Path to the symbol file",
        })
        .positional("callStack", {
          type: "string",
          describe: "Array of call stack symbol indexes",
        })
        .option("delimiter", {
          alias: "d",
          type: "string",
          describe: "Delimiter to use when parsing the call stack",
        });
    },
    async handler(argv) {
      type CallStackArgs = {
        symbolFile: string;
        callStack: string;
        delimiter?: string;
      };
      let { symbolFile, callStack, delimiter } =
        argv as ArgumentsCamelCase<CallStackArgs>;

      if (delimiter === undefined) {
        delimiter = " ";
      }

      if (symbolFile === undefined) {
        const answers = await inquirer.prompt([
          {
            name: "symbolFile",
            type: "input",
            message: "Please provide the path to the symbol file:",
          },
        ]);
        symbolFile = answers.symbolFile;
        if (symbolFile === "") {
          console.log(chalk.red("Symbol file path is required"));
          return;
        }
      }

      if (callStack === undefined) {
        const answers = await inquirer.prompt([
          {
            name: "callStack",
            type: "input",
            message: `Please provide the call stack symbol indexes (${
              delimiter === " " ? "space" : `"${delimiter}"`
            } separated):`,
          },
        ]);
        callStack = answers.callStack;
        if (callStack === "") {
          console.log(chalk.red("Call stack is required"));
          return;
        }
      }

      const parsedCallStack = callStack.split(delimiter).map(Number);

      await resolveCallStack(parsedCallStack, symbolFile);
    },
  };
}

export async function resolveCallStack(
  callStack: number[],
  symbolsFilePath: string
): Promise<void> {
  // Load the symbols from the file
  const symbolFileContent = fs.readFileSync(symbolsFilePath, "utf8");
  const symbolLines = symbolFileContent.split("\n");

  const symbolMap: Record<number, string> = {};

  // Parse the symbol file
  symbolLines.forEach((line) => {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const symbolNumber = parseInt(parts[0]); // Store the number as an integer
      const symbolName = parts.slice(1).join(":"); // Join all remaining parts
      symbolMap[symbolNumber] = symbolName;
    }
  });

  // Replace the hex numbers in the call stack with the symbol names
  const resolvedCallStack = callStack.map((number) => {
    const readableFunctionName = symbolMap[number]
      .replace(/\\20/g, " ")
      .replace(/\\28/g, "(")
      .replace(/\\29/g, ")")
      .replace(/\\2c/g, ",");
    return readableFunctionName ?? `unknown function [${number}]`;
  });

  console.log(chalk.green("Resolved Call Stack:"));
  resolvedCallStack.forEach((fn, index) => {
    // Add color to make it easier to differentiate the function calls
    console.log(
      chalk.blue(`Call #${index + 1}:`) + "\n" + chalk.yellow(fn) + "\n"
    );
  });
}
