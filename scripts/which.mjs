import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const description = "Show which s installation is active";

export default function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  console.log(root);
}
