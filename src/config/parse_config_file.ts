import chalk from "chalk";
import { normalize, resolve } from "path";
import { isEqual } from "lodash";
import ModuleDependencyManager from "../dependency_manager/module_dependency_manager";
import { omnibotDependenciesAreValid } from "../dependency_manager/omnibot_dependencies";
import fetchRemoteModule from "./fetch_remote_module";
import Logger from "../logger";
import { TextChannel } from "discord.js";
import { OmnibotModule } from "../redux/types/config";

interface RawConfigFile {
  version: number;
  logging?: {
    destination: ("console" | "discord")[];
    discord_channel_id?: string;
  };
  dcli?: {
    discord_channel_id?: string;
  };
  config_source: "current_file" | "remote";
  remote_config_url?: string;
  discord_token: string;
  modules: RawOmnibotModule[];
}

interface RawOmnibotModule {
  id: string;
  name: string;
  source: {
    source: "local" | "remote";
    local_path?: string;
    url?: string;
  };
  dependencies: string[];
  config: any;
}

export interface Config {
  version: number;
  config_source: "current_file" | "remote";
  logging: {
    destination: ("console" | "discord")[];
    discord_channel?: TextChannel;
    discord_channel_id?: string;
  };
  dcli: {
    discord_channel_id?: string;
    discord_channel?: TextChannel;
  };
  remote_config_url?: string;
  discord_token: string;
  modules: OmnibotModule[];
}

class ConfigError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "ConfigError";
  }
}

const simpleDependencyRegex = /^(omnibot|npm):.+$/;

const logger = new Logger("config_parser");

export default async function parseConfigFile(
  configFile: string
): Promise<Config> {
  const config = JSON.parse(configFile) as RawConfigFile;

  if (config.version !== 1) {
    throw new ConfigError(
      "Invalid config.version: only version 1 is supported at this time."
    );
  }

  if (config.config_source !== "current_file") {
    throw new ConfigError(
      "Invalid config.config_source: only current_file is supported at this time."
    );
  }

  if (!config.discord_token) {
    throw new ConfigError("Missing config.discord_token.");
  }

  // set up final config
  const finalConfig: Config = {
    version: config.version,
    config_source: config.config_source,
    logging: config.logging || { destination: ["console"] },
    dcli: config.dcli || {},
    remote_config_url: config.remote_config_url,
    discord_token: config.discord_token,
    modules: [],
  };

  // validate and transform modules

  if (config.modules && config.modules.length) {
    const idSet = new Set();
    const err = (error: string, idx: number) => {
      throw new ConfigError(`Fatal error in module ${idx}: ${error}`);
    };

    for (const m of config.modules) {
      const processedModule: OmnibotModule = {
        id: m.id,
        name: m.name || m.id,
        source: {
          source: "local",
          local_path: "OPEN AN ISSUE IF YOU SEE THIS!!",
        },
        dependencies: new ModuleDependencyManager(m.id, m.dependencies || []),
        config: m.config,
      };

      const idx = config.modules.indexOf(m);
      if (!m.id) {
        err("No id specified", idx);
      }

      if (idSet.has(m.id)) {
        err(`duplicate id "${m.id}"`, idx);
      }

      if (!m.source) {
        err("no source specified", idx);
      }

      switch (m.source.source) {
        case "local":
          if (!m.source.local_path) {
            err(`Missing source.local_path for source.source = "local"`, idx);
            continue;
          }

          try {
            const localPath = resolve(normalize(m.source.local_path));
            logger.debug(`Attempting to resolve ${m.id} from ${localPath}`);
            require.resolve(localPath);
          } catch (e) {
            err(
              `module (${m.source.local_path}) either does not exist or is not readable: ${e}`,
              idx
            );
          }

          processedModule.source = {
            source: "local",
            local_path: m.source.local_path,
          };
          break;
        case "remote": {
          // fetch module, check checksum
          if (!m.source.url) {
            err(`Missing source.url for source.source = "local"`, idx);
            continue;
          }

          logger.info(`Fetching remote module ${m.id} from ${m.source.url}...`);
          const { remoteModuleConfig, codePath } = await fetchRemoteModule(
            m.source.url,
            logger.createChildLogger("fetch_remote_module")
          );

          logger.info(`Successfully fetched module ${m.id}!`);

          if (
            m.dependencies &&
            !isEqual(m.dependencies, remoteModuleConfig.dependencies)
          ) {
            logger.warn(
              `Dependencies in remote module config for ${
                m.id
              } are different than dependencies specified in config file.
Using config file dependencies.

Dependencies specified in remote config file: ${remoteModuleConfig.dependencies.join(
                ", "
              )}`
            );
          } else if (!m.dependencies) {
            logger.info(
              `${
                m.id
              } has no dependencies specified in the config file, using dependencies from remote module configuration: ${remoteModuleConfig.dependencies.join(
                ", "
              )}`
            );
            processedModule.dependencies = new ModuleDependencyManager(
              m.id,
              remoteModuleConfig.dependencies
            );
          }

          processedModule.source = {
            source: "remote",
            local_path: codePath,
            url: m.source.url,
          };
          processedModule.remoteModuleConfig = remoteModuleConfig;
          break;
        }
        default:
          err("invalid module source", idx);
      }

      if (m.dependencies) {
        const invalidDependency = m.dependencies.find(
          (d) => !simpleDependencyRegex.test(d)
        );
        if (invalidDependency) {
          err(`${invalidDependency} is not a valid dependency`, idx);
        }

        const invalidOmnibotDependency = omnibotDependenciesAreValid(
          m.dependencies
        );
        if (invalidOmnibotDependency) {
          err(
            `${invalidOmnibotDependency} is not a valid omnibot dependency.`,
            idx
          );
        }
      }

      // module is valid
      idSet.add(m.id);
      finalConfig.modules.push(processedModule);
    }
  } else {
    console.log(
      chalk.yellow("Warning: No modules were specified in your config file.")
    );
  }

  return finalConfig;
}
