import { Message } from "discord.js";
import { errorEmbed } from "./embeds";
import modules from "./modules";
import Logger from "../logger";

export interface Args {
  command: string;
  action: string;
  args: string[];
  splitMsg: string[];
  logger: Logger;
}

const logger = new Logger("dcli");

export default async function dcliListener(msg: Message): Promise<void> {
  if (msg.author.bot) {
    return;
  }

  const splitMsg = msg.content.split(" ");

  if (splitMsg.length < 1) {
    await msg.reply(
      errorEmbed()
        .setTitle("Unknown command")
        .setDescription(
          "The Omnibot commands channel can only be used for Omnibot commands."
        )
    );
    return;
  }

  const args: Args = {
    command: splitMsg[0],
    action: splitMsg[1] || "",
    args: splitMsg.slice(2),
    splitMsg,
    logger,
  };

  switch (args.command) {
    case "modules":
      await modules(msg, {
        ...args,
        logger: logger.createChildLogger("modules"),
      });
      return;
    case "module":
      await modules(msg, {
        ...args,
        logger: logger.createChildLogger("modules"),
      });
      return;
  }
}
