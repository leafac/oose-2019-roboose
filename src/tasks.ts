import { Command } from "commander";

const program = new Command();

program
  .command("initialize")
  .action(() => {
  });

program.parse(process.argv);
