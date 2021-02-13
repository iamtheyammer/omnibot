import { readFile } from "fs/promises";
import { normalize } from "path";
import * as Discord from "discord.js";
import parseConfigFile, { Config } from "./config";
import Logger from "./logger";
import ModuleManager from "./module_manager/module_manager";
import chalk from "chalk";
import { DependencyManager } from "./dependency_manager/dependency_manager";

let config: Config | string[];
const logger = new Logger("core");

const client = new Discord.Client();
// initialize

const dependencyManager = new DependencyManager();
const moduleManager = new ModuleManager(client, dependencyManager);

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
  } catch (e) {
    logger.fatal(`Fatal error parsing config: ${e}`);
    process.exit(1);
    return;
  }

  await client.login(config.discord_token);
  if (client.user) {
    client.user.setActivity("starting up...", { type: "PLAYING" });
  }

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
      `There was an error loading these modules: ${chalk.bold(
        erroredModules.join(", ")
      )}. Please check the logs for more info!`
    );
  }

  logger.success(
    `Sucessfully loaded these modules: ${chalk.bold(loadedModules.join(", "))}!`
  );
}
init();
