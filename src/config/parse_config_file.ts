import chalk from "chalk";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { normalize } from "path";
import ModuleDependencyManager from "../dependency_manager/module_dependency_manager";
import { omnibotDependenciesAreValid } from "../dependency_manager/omnibot_dependencies";

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
    remote_url?: string;
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
    local_path?: string;
    remote_url?: string;
  };
  dependencies: ModuleDependencyManager;
  config: any;
}

// export interface OmnibotGuildConfig {
//   id: string;
//   permissions?: number;
//   modules?: string[];
// }

class ConfigError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "ConfigError";
  }
}

const simpleDependencyRegex = /^(omnibot|npm):.+$/;

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

      if (m.source.source !== "local") {
        err("only local modules are currently supported", idx);
      }

      if (!m.source.local_path) {
        err("no local path specified", idx);
      }

      try {
        await access(
          normalize(m.source.local_path as string),
          fsConstants.R_OK
        );
      } catch {
        err(
          `module (${m.source.local_path}) either does not exist or is not readable`,
          idx
        );
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

      const processedModule: OmnibotModule = {
        id: m.id,
        name: m.name || m.id,
        source: m.source,
        dependencies: new ModuleDependencyManager(m.id, m.dependencies || []),
        config: m.config,
      };

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
