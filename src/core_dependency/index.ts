import { Client } from "discord.js";
import { timeout, TimeoutError } from "promise-timeout";
import { OmnibotModule } from "../config";
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
      if (this.listeners.omnibot && this.listeners.omnibot.beforeunload) {
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
      throw new Error(
        "Insufficient permissions: omnibot:discordclient must be in this module's dependency list."
      );
    }
  }
}
