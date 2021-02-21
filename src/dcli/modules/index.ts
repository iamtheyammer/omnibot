import { Message } from "discord.js";
import { Args } from "../index";
import listModules from "./list";
import unload from "./unload";
import info from "./info";
import load from "./load";

export default async function modules(msg: Message, args: Args) {
  if (!args.action) {
    await listModules(msg, args);
    return;
  }

  switch (args.action) {
    case "unload": {
      await unload(msg, {
        ...args,
        logger: args.logger.createChildLogger("unload"),
      });
      return;
    }
    case "info": {
      await info(msg, {
        ...args,
        logger: args.logger.createChildLogger("info"),
      });
      return;
    }
    case "load": {
      await load(msg, {
        ...args,
        logger: args.logger.createChildLogger("load"),
      });
      return;
    }
  }
}
