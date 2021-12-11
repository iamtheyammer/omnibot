import { readFile } from "fs/promises";
import { normalize } from "path";
import * as Discord from "discord.js";
import "./redux/index";
import parseConfigFile, { Config } from "./config/parse_config_file";
import Logger, { pushLogsToDiscord } from "./logger";
import ConnectedModuleManager from "./module_manager/module_manager";
import ConnectedDependencyManager from "./dependency_manager/dependency_manager";
import { TextChannel } from "discord.js";
import { dispatch, store } from "./redux";
import { propagateConfig } from "./redux/actions/config";

export let config: Config;
const logger = new Logger("core");

export const client = new Discord.Client();
// initialize

new ConnectedDependencyManager(store);
new ConnectedModuleManager(store);

client.on("ready", async () => {
  logger.success("Connected to Discord!");
});

async function init() {
  logger.info("Starting Omnibot...");
  let configFile = "";

  try {
    logger.info("Loading config file from `./omnibotconfig.json`");
    configFile = await readFile(normalize("./omnibotconfig.json"), "utf8");
  } catch (e) {
    logger.fatal("Unable to read config file (omnibotconfig.json):");
    process.exit(1);
    return;
  }

  try {
    logger.info("Parsing config file...");
    config = await parseConfigFile(configFile);

    dispatch(propagateConfig(config));
  } catch (e) {
    logger.fatal(`Fatal error parsing config: ${e}`);
    process.exit(1);
    return;
  }

  await client.login(config.discord_token);
  if (client.user) {
    client.user.setActivity("starting up...", { type: "PLAYING" });
  }

  if (config.logging && config.logging.destination.includes("discord")) {
    if (!config.logging.discord_channel_id) {
      logger.fatal(
        "No discord_channel_id specified for logging destination discord"
      );
      process.exit(1);
    }

    const channel: TextChannel = (await client.channels.fetch(
      config.logging.discord_channel_id
    )) as TextChannel;

    if (!(channel instanceof TextChannel)) {
      logger.fatal(
        `Logging discord_channel_id specified is not a text channel.`
      );
      process.exit(1);
    }

    if (!channel.manageable) {
      logger.fatal(
        "The bot doesn't have access to manage the logging discord channel."
      );
      process.exit(1);
    }

    logger.info("Configured logging to Discord!");
    config.logging.discord_channel = channel;
    pushLogsToDiscord(config.logging.discord_channel);
  }
}

init();
