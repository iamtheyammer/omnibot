import chalk from "chalk";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { normalize } from "path";
import ModuleDependencyManager from "./dependency_manager/module_dependency_manager";

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
  guild_allowlist?: string[];
  guild_blocklist?: string[];
  dependencies: string[];
  config: any;
}

export interface Config {
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
  guild_allowlist?: string[];
  guild_blocklist?: string[];
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

const discordIdRegex = /^[0-9]+$/;
const simpleDependencyRegex = /^(omnibot|npm):[0-z]+$/;

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

      // exists AND is array AND they all match discordIdRegex
      if (
        m.guild_allowlist &&
        (!Array.isArray(m.guild_allowlist) ||
          !m.guild_allowlist.every((gid) => discordIdRegex.test(gid)))
      ) {
        err("one or more guild ids in guild_allowlist is not valid", idx);
      }

      if (
        m.guild_blocklist &&
        (!Array.isArray(m.guild_blocklist) ||
          !m.guild_blocklist.every((gid) => discordIdRegex.test(gid)))
      ) {
        // permit single "*"
        if (
          !(
            Array.isArray(m.guild_blocklist) &&
            m.guild_blocklist.length === 1 &&
            m.guild_blocklist[0] === "*"
          )
        ) {
          err("one or more guild ids in guild_blocklist is not valid", idx);
        }
      }

      if (
        m.dependencies &&
        !m.dependencies.every((d) => simpleDependencyRegex.test(d))
      ) {
        err("one or more of your dependencies is not valid", idx);
      }

      // module is valid

      const processedModule: OmnibotModule = {
        id: m.id,
        name: m.name || m.id,
        source: m.source,
        guild_blocklist: m.guild_blocklist,
        guild_allowlist: m.guild_allowlist,
        dependencies: new ModuleDependencyManager(m.id, m.dependencies),
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
