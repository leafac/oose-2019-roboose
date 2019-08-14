import { Command } from "commander";
import * as dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(() => {
    console.log(process.env.YEAR);
  });

dotenv.config();
if (process.argv.length === 2) process.argv.push("--help");
program.parse(process.argv);
