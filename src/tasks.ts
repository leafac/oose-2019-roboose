import { Command } from "commander";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(() => {});

if (process.argv.length === 2) process.argv.push("--help");

program.parse(process.argv);
