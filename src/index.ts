import { readFile } from "fs/promises";
import { normalize } from "path";
import * as Discord from "discord.js";
import parseConfigFile, { Config } from "./config/parse_config_file";
import Logger, { pushLogsToDiscord } from "./logger";
import ModuleManager from "./module_manager/module_manager";
import { DependencyManager } from "./dependency_manager/dependency_manager";
import { TextChannel } from "discord.js";

let config: Config;
const logger = new Logger("core");

const client = new Discord.Client();
// initialize

const dependencyManager = new DependencyManager();
const moduleManager = new ModuleManager(client, dependencyManager);

client.on("ready", async () => {
  logger.success("Connected to Discord!");
});

async function loadModules() {
  logger.debug("Loading modules...");
  // load modules
  const erroredModules = [];
  const loadedModules = [];
  logger.debug(
    `Discovered ${config.modules.length} modules: ${config.modules
      .map((m) => m.id)
      .join(", ")}.`
  );

  try {
    const mods = config.modules;
    mods.forEach((m) =>
      dependencyManager.addModule(
        m,
        mods.map((mo) => mo.id)
      )
    );
  } catch (e) {
    logger.fatal(`Error adding a module to the dependency tree: ${e}`);
    process.exit(1);
  }

  logger.info("Resolving dependencies...");
  try {
    await dependencyManager.resolveDependencies();
  } catch (e) {
    logger.fatal(`Error resolving dependencies: ${e}`);
    process.exit(1);
  }

  const orderedModules = dependencyManager.getModuleLoadOrder();

  for (const module of orderedModules) {
    logger.debug(`Loading module ${module.id}...`);
    try {
      await moduleManager.loadModule(module);
      loadedModules.push(module.id);
    } catch (e) {
      logger.error(`Error loading module ${module.id}.`);
      erroredModules.push(module.id);
    }
  }

  if (erroredModules.length) {
    logger.error(
      `There was an error loading these modules: ${erroredModules.join(
        ", "
      )}. Please check the logs for more info!`
    );
  }

  logger.success(
    `Successfully loaded these modules: ${loadedModules.join(", ")}!`
  );
}

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
    config = await parseConfigFile(configFile, client);
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

  await loadModules();
}
init();

// setTimeout(() => moduleManager.unloadModule("module3"), 10000);
