import chalk from "chalk";
import { normalize } from "path";
import { isEqual } from "lodash";
import ModuleDependencyManager from "../dependency_manager/module_dependency_manager";
import { omnibotDependenciesAreValid } from "../dependency_manager/omnibot_dependencies";
import fetchRemoteModule, { RemoteModuleConfig } from "./fetch_remote_module";
import Logger from "../logger";

interface RawConfigFile {
  version: number;
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

export interface Parse_config_file {
  version: number;
  config_source: "current_file" | "remote";
  remote_config_url?: string;
  discord_token: string;
  modules: OmnibotModule[];
}

export interface OmnibotModule {
  id: string;
  name: string;
  source: {
    source: "local" | "remote";
    local_path: string;
    url?: string;
  };
  remoteModuleConfig?: RemoteModuleConfig;
  dependencies: ModuleDependencyManager;
  config: any;
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
): Promise<Parse_config_file> {
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
  const finalConfig: Parse_config_file = {
    version: config.version,
    config_source: config.config_source,
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

      let idx = config.modules.indexOf(m);
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
            require.resolve(normalize(m.source.local_path));
          } catch {
            err(
              `module (${m.source.local_path}) either does not exist or is not readable`,
              idx
            );
          }

          processedModule.source = {
            source: "local",
            local_path: m.source.local_path,
          };
          break;
        case "remote":
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
            remoteModuleConfig.dependencies &&
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
