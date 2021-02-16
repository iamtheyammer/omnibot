import chalk, { Chalk } from "chalk";
import { TextChannel, MessageEmbed } from "discord.js";

let discordChannel: TextChannel;

export function pushLogsToDiscord(channel: TextChannel) {
  discordChannel = channel;
}

interface LogMessage {
  message: any;
  chalk: Chalk;
  level: string;
  levelInt: number;
  color: string;
}

export default class Logger {
  private readonly moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  public createChildLogger(childName: string): Logger {
    return new Logger(`${this.moduleName}:${childName}`);
  }

  private pushLog(message: LogMessage) {
    const msg = message.chalk(message.message);
    const msgLines = msg.split("\n");

    if (discordChannel) {
      if (2 > message.levelInt) {
        discordChannel.send(
          new MessageEmbed()
            .setTitle(`New ${message.level}`)
            .setAuthor(this.moduleName)
            .setDescription(message.message)
            .setColor(message.color)
        );
      } else if (5 > message.levelInt) {
        const newLineLoc = message.message.indexOf("\n");
        discordChannel.send(
          `\`${this.moduleName} / ${message.level}\` | ${
            newLineLoc !== -1
              ? `\`${message.message.substring(
                  0,
                  newLineLoc
                )}\`\n\`\`\`${message.message.substring(newLineLoc + 1)}\`\`\``
              : `\`${message.message}\``
          }`
        );
      }
    }

    // 1st line
    console.log(`${chalk.gray(`${this.moduleName} | `)}${msgLines[0]}`);

    // all other lines
    if (msgLines.length > 1) {
      msgLines
        .slice(1)
        .forEach((l: any) =>
          console.log(`${chalk.gray(`${this.moduleName} ---> | `)}${l}`)
        );
    }
  }

  public debug(message: string | any) {
    this.pushLog({
      message,
      chalk: chalk.gray,
      level: "debug",
      levelInt: 5,
      color: "#808080",
    });
  }

  public info(message: string) {
    this.pushLog({
      message,
      chalk: chalk.white,
      level: "info",
      levelInt: 4,
      color: "#ffffff",
    });
  }

  public log(message: string) {
    this.info(message);
  }

  public warn(message: string) {
    this.pushLog({
      message,
      chalk: chalk.yellow,
      level: "warn",
      levelInt: 3,
      color: "#ffff00",
    });
  }

  public success(message: string) {
    this.pushLog({
      message,
      chalk: chalk.green,
      level: "success",
      levelInt: 2,
      color: "#00ff00",
    });
  }

  public error(message: string) {
    this.pushLog({
      message,
      chalk: chalk.red,
      level: "error",
      levelInt: 1,
      color: "#800000",
    });
  }

  public fatal(message: string) {
    this.pushLog({
      message,
      chalk: chalk.bgRed,
      level: "fatal",
      levelInt: 0,
      color: "#ff0000",
    });
  }
}
