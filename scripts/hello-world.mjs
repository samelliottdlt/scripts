export const description = "A simple greeting";

export default function main(args) {
  const name = args[0] || "world";
  console.log(`Hello, ${name}!`);
}
