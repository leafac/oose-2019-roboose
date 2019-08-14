import { Command } from "commander";
import { config } from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(() => {
    console.log(process.env.YEAR);
  });

config();
if (process.argv.length === 2) process.argv.push("--help");
program.parse(process.argv);
