import { Client } from "discord.js";
import { normalize, resolve } from "path";
import { OmnibotModule } from "../config/parse_config_file";
import CoreDependency from "../core_dependency";
import Logger from "../logger";
import { DependencyManager } from "../dependency_manager/dependency_manager";

interface ManagedModule extends OmnibotModule {
  coreDependency: CoreDependency;
  normalizedPath?: string;
  importedCode: any;
}

const logger = new Logger("module_manager");

class ModuleAlreadyLoadedError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "ModuleAlreadyLoadedError";
  }
}

export default class ModuleManager {
  private readonly discordClient: Client;
  private loadedModules: ManagedModule[] = [];
  private depedencyManager: DependencyManager;
  private moduleExports: { [moduleId: string]: any } = {};

  constructor(client: Client, dependencyManager: DependencyManager) {
    this.discordClient = client;
    this.depedencyManager = dependencyManager;
  }

  async loadModule(module: OmnibotModule) {
    logger.info(`Loading module ${module.id}...`);

    if (this.loadedModules.some((m) => m.id === module.id)) {
      logger.error(`Module with ID ${module.id} is already loaded!`);
      throw new ModuleAlreadyLoadedError(
        `The module with ID ${module.id} is already loaded!`
      );
    }

    const managedModule = module as ManagedModule;

    // load file
    const normalizedPath = resolve(normalize(module.source.local_path));

    const moduleDependencies = this.depedencyManager.getModuleDependenciesForModule(
      module.id
    );
    const moduleDependencyInjection: { [moduleId: string]: any } = {};

    moduleDependencies.forEach((mDep) => {
      const depExport = this.moduleExports[mDep];

      if (!depExport) {
        logger.error(`${module.id} depends on ${mDep}, but its exports aren't available!
          ${module.id} won't be able to access exports from ${mDep}.
          
          Make sure that ${mDep} actually exports something!`);
        return;
      }

      logger.debug(`Injecting ${mDep} into ${module.id}`);
      moduleDependencyInjection[mDep] = depExport;
    });

    try {
      logger.info(`Attempting to import from ${normalizedPath}...`);
      const importedModule = await import(normalizedPath);
      managedModule.coreDependency = new CoreDependency(
        module,
        this.discordClient,
        moduleDependencyInjection
      );
      managedModule.importedCode = importedModule;
      managedModule.normalizedPath = normalizedPath;
      importedModule.init(managedModule.coreDependency);
      if (this.depedencyManager.moduleHasModuleDependents(module.id)) {
        // we need to call omnibotExports
        logger.debug(`${module.id} has dependents, caching exports`);
        this.moduleExports[module.id] = importedModule.omnibotExports;
        if (!this.moduleExports[module.id]) {
          logger.error(`Nothing was exported from ${module.id}`);
        }
      } else {
        logger.debug(`${module.id} does not have module dependents`);
      }
      this.loadedModules.push(managedModule);
      this.updateStatus();
    } catch (e) {
      logger.error(`Error loading module ${module.id}: ${e}.`);
      throw e;
    }

    logger.info(`Successfully loaded module ${module.id}!`);
  }

  async unloadModule(moduleId: string) {
    const module = this.loadedModules.find((m) => m.id === moduleId);
    if (!module) {
      return;
    }

    await module.coreDependency.unload();

    // remove from node dependency cache
    // if we don't do this and reload the module
    // the code won't be reloaded
    if (module.normalizedPath) {
      logger.debug(
        `Removing ${module.normalizedPath} from the nodejs require cache`
      );
      delete require.cache[module.normalizedPath];
    }

    this.loadedModules = this.loadedModules.filter((m) => m.id !== moduleId);
    this.updateStatus();
  }

  public getLoadedModules(): OmnibotModule[] {
    return this.loadedModules;
  }

  private updateStatus() {
    logger.debug(
      `Updating status to show ${this.loadedModules.length} modules`
    );
    if (this.discordClient.user) {
      this.discordClient.user.setActivity(
        `with ${this.loadedModules.length} modules`,
        { type: "PLAYING" }
      );
    }
  }
}
