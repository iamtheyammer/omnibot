import { TextChannel } from "discord.js";
import { RemoteModuleConfig } from "../../config/fetch_remote_module";
import ModuleDependencyManager from "../../dependency_manager/module_dependency_manager";

export interface Config {
  version: number;
  config_source: "current_file" | "remote" | "";
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

export const ConfigInitialState: Config = {
  version: -1,
  config_source: "",
  logging: {
    destination: [],
  },
  dcli: {},
  discord_token: "",
  modules: [],
};

export type ConfigState = Config;

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

export type ConfigActionTypes = PropagateConfigAction;

export const PROPAGATE_CONFIG = "PROPAGATE_CONFIG";

export interface PropagateConfigAction {
  type: typeof PROPAGATE_CONFIG;
  config: Config;
}
