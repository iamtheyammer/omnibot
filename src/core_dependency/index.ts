import { Client } from "discord.js";
import { timeout, TimeoutError } from "promise-timeout";
import { OmnibotModule } from "../config/parse_config_file";
import Logger from "../logger";

interface Listeners {
  [namespace: string]: {
    [eventName: string]: any[];
  };
}

interface ModuleInterdependencies {
  [moduleName: string]: any;
}

export default class CoreDependency {
  private readonly module: OmnibotModule;
  private readonly client: Client;
  public readonly logger;
  private readonly internalLogger;
  private listeners: Listeners = {};
  private modules: ModuleInterdependencies = {};

  constructor(
    m: OmnibotModule,
    discordClient: Client,
    moduleInterdependencies: ModuleInterdependencies
  ) {
    this.module = m;
    this.client = discordClient;
    this.logger = new Logger(`modules:${this.module.id}`);
    this.internalLogger = new Logger(
      `core_dependency:modules:${this.module.id}`
    );
    this.modules = moduleInterdependencies;
  }

  async unload() {
    this.internalLogger.info("Unloading...");
    try {
      if (this.listeners.discord) {
        this.internalLogger.debug("Removing discord listeners...");
        Object.entries(this.listeners.discord).forEach(([prop, listeners]) => {
          listeners.forEach((l: any, idx: number) => {
            this.internalLogger.debug(
              `Removing discord:${prop} listener ${idx}`
            );
            this.client.removeListener(prop, l);
          });
        });
      }

      if (this.listeners.omnibot && this.listeners.omnibot.beforeunload) {
        this.internalLogger.debug("Beforeunload listener present, running");
        await timeout(
          Promise.all(
            this.listeners.omnibot.beforeunload.map(async (f) => await f())
            // .filter((f) => f instanceof Promise)
          ),
          30000
        );
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        this.internalLogger.error("Timeout unloading module.");
      } else {
        this.internalLogger.error(`Error unloading module: ${e}`);
      }
    }
    this.internalLogger.success("Module unloaded.");
  }

  private addListener(
    eventNamespace: string,
    eventName: string,
    listener: any
  ) {
    if (!this.listeners[eventNamespace]) {
      this.listeners[eventNamespace] = {};
    }

    if (!(this.listeners[eventNamespace][eventName] instanceof Array)) {
      this.listeners[eventNamespace][eventName] = [];
    }

    this.listeners[eventNamespace][eventName].push(listener);
  }

  on(event: string, callback: any) {
    const [eventNamespace, eventName] = event.split(":");

    if (
      eventNamespace === "discord" &&
      !this.module.dependencies.hasDependency("omnibot:core")
    ) {
      throw new DependencyNotAvailableError(
        `In order to recieve Discord events, the omnibot:core dependency is required.`
      );
    }

    if (!callback) {
      throw new TypeError("You must specify a callback function!");
    }

    switch (eventNamespace) {
      case "discord":
        // pass callback to discord, save
        this.client.on(eventName, callback);
        this.addListener(eventNamespace, eventName, callback);
        break;
      default:
        this.addListener(eventNamespace, eventName, callback);
        break;
    }
  }

  public getClient(): Client {
    if (this.module.dependencies.hasDependency("omnibot:discordclient")) {
      return this.client;
    } else {
      throw new DependencyNotAvailableError(
        "Insufficient permissions: omnibot:discordclient must be in this module's dependency list."
      );
    }
  }
}

class DependencyNotAvailableError extends Error {}
