import callStackCommand from "./call-stack.js";
import updateShellCommand from "./update-shell.js";

export function createCommandModules() {
  return [callStackCommand(), updateShellCommand()];
}
