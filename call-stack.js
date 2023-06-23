import fs from 'fs';
import chalk from 'chalk';

// Place your call stack here
let callStack = [
  3252,2366,2365,4134,4149,7175,2225,7007,7039,5218,
];

// Replace this with your symbol file path
let symbolsFilePath = 'symbols/MSB/GraphSearchLocalWorkflow.js.symbols';

// Load the symbols from the file
let symbolFileContent = fs.readFileSync(symbolsFilePath, 'utf8');
let symbolLines = symbolFileContent.split('\n');

let symbolMap = {};

// Parse the symbol file
symbolLines.forEach(line => {
  let parts = line.split(':');
  if (parts.length >= 2) {
    let symbolNumber = parseInt(parts[0]);  // Store the number as an integer
    let symbolName = parts.slice(1).join(':');  // Join all remaining parts
    symbolMap[symbolNumber] = symbolName;
  }
});

// Replace the hex numbers in the call stack with the symbol names
let resolvedCallStack = callStack.map(number => {
  let readableFunctionName = symbolMap[number].replace(/\\20/g, ' ').replace(/\\28/g, '(').replace(/\\29/g, ')').replace(/\\2c/g, ',');
  return readableFunctionName || `unknown function [${number}]`;
});

console.log(chalk.green('Resolved Call Stack:'));
resolvedCallStack.forEach((fn, index) => {
  // Add color to make it easier to differentiate the function calls
  console.log(chalk.blue(`Call #${index + 1}:`) + '\n' + chalk.yellow(fn) + '\n');
});
