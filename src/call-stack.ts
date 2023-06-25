import fs from "fs";
import chalk from "chalk";

export async function resolveCallStack(
  callStack: number[],
  symbolsFilePath: string
): Promise<void> {
  // Load the symbols from the file
  const symbolFileContent = fs.readFileSync(symbolsFilePath, "utf8");
  const symbolLines = symbolFileContent.split("\n");

  type SymbolMap = Record<number, string>;
  const symbolMap: SymbolMap = {};

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
