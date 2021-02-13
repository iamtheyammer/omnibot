import chalk, { Chalk } from "chalk";

export default class Logger {
  private readonly moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  public createChildLogger(childName: string): Logger {
    return new Logger(`${this.moduleName}:${childName}`);
  }

  private pushLog(coloredMessage: Chalk | string) {
    const msg = coloredMessage.toString();
    const msgLines = msg.split("\n");

    // 1st line
    console.log(`${chalk.gray(`${this.moduleName} | `)}${msgLines[0]}`);

    // all other lines
    if (msgLines.length > 1) {
      msgLines
        .slice(1)
        .forEach((l) =>
          console.log(`${chalk.gray(`${this.moduleName} ---> | `)}${l}`)
        );
    }
  }

  public debug(message: string | any) {
    this.pushLog(chalk.gray(message));
  }

  public info(message: string) {
    this.pushLog(chalk.white(message));
  }

  public warn(message: string) {
    this.pushLog(chalk.yellow(message));
  }

  public error(message: string) {
    this.pushLog(chalk.red(message));
  }

  public fatal(message: string) {
    this.pushLog(chalk.bgRed(message));
  }

  public success(message: string) {
    this.pushLog(chalk.green(message));
  }
}
