import { normalize, resolve } from "path";
import CoreDependency from "../core_dependency";
import Logger from "../logger";
import { OmnibotModule } from "../redux/types/config";
import { ChangeMap, connect, Module } from "newton-redux-reborn";
import State from "../redux/types";
import { Dispatch } from "redux";
import { ManagedModule } from "../redux/types/modules";
import {
  addLoadedModule,
  addModuleExports,
  unloadModule,
} from "../redux/actions/modules";
import { DependencyManager } from "../dependency_manager/dependency_manager";
import { client as discordClient } from "../index";

const logger = new Logger("module_manager");

class ModuleAlreadyLoadedError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "ModuleAlreadyLoadedError";
  }
}

class ModuleManager extends Module<ModuleManagerProps> {
  constructor(props: ModuleManagerProps) {
    super(props);
  }

  async onChange(changeMap: ChangeMap) {
    // load modules when their dependencies are satisfied
    if (changeMap.satisfiedModuleIds.hasChanged) {
      const previouslySatisfiedModuleIds = new Set(
        changeMap.satisfiedModuleIds.previousValue
      );
      const newlySatisfiedModuleIds = new Set(
        this.props.satisfiedModuleIds.filter(
          (mId) => !previouslySatisfiedModuleIds.has(mId)
        )
      );

      // determine order
      const allLoadOrder = DependencyManager.getModuleLoadOrder(
        this.props.dependencyTree
      );
      const filteredLoadOrder = allLoadOrder.filter((mId) =>
        newlySatisfiedModuleIds.has(mId)
      );

      logger.info(
        `Loading ${
          newlySatisfiedModuleIds.size
        } modules because their dependencies were just satisfied: ${filteredLoadOrder.join(
          ", "
        )}`
      );

      for (const mId of filteredLoadOrder) {
        const module = this.props.modules.find((m) => m.id === mId);
        if (!module) {
          logger.error(
            `Module id ${mId} just had its dependencies satisfied but is not available in config.modules!`
          );
          continue;
        }

        await this.loadModule(module);
      }
    }
  }

  private async loadModule(module: OmnibotModule) {
    logger.info(`Loading module ${module.id}...`);

    if (
      Object.keys(this.props.loadedModules).some((mId) => mId === module.id)
    ) {
      logger.error(`Module with ID ${module.id} is already loaded!`);
      throw new ModuleAlreadyLoadedError(
        `The module with ID ${module.id} is already loaded!`
      );
    }

    const managedModule = module as ManagedModule;

    // load file
    const normalizedPath = resolve(normalize(module.source.local_path));

    const moduleDependencies = DependencyManager.getModuleDependenciesForModule(
      this.props.dependencyTree,
      module.id
    );
    const moduleDependencyInjection: { [moduleId: string]: any } = {};

    moduleDependencies.forEach((mDep: string) => {
      const depExport = this.props.moduleExports[mDep];

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
        discordClient,
        moduleDependencyInjection
      );
      managedModule.importedCode = importedModule;
      managedModule.normalizedPath = normalizedPath;
      importedModule.init(managedModule.coreDependency);
      if (
        DependencyManager.moduleHasModuleDependents(
          this.props.dependencyTree,
          module.id
        )
      ) {
        // we need to call omnibotExports
        logger.debug(`${module.id} has dependents, caching exports`);
        if (!importedModule.omnibotExports) {
          logger.error(`Nothing was exported from ${module.id}`);
        } else {
          this.props.addModuleExports(module.id, importedModule.omnibotExports);
        }
      } else {
        logger.debug(`${module.id} does not have module dependents`);
      }

      this.props.addModule(managedModule);
    } catch (e) {
      logger.error(`Error loading module ${module.id}: ${e}.`);
      throw e;
    }

    logger.info(`Successfully loaded module ${module.id}!`);
  }

  private async unloadModule(moduleId: string) {
    logger.info(`Unloading module ${moduleId}...`);

    const module = this.props.loadedModules[moduleId];
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

    // TODO: tell dependent modules about the unload

    logger.info(`Unloaded module ${moduleId}.`);
  }
}

interface ModuleManagerStateProps {
  dependencyTree: State["dependencies"]["dependency_tree"];
  satisfiedModuleIds: State["dependencies"]["satisfied_module_ids"];
  loadedModules: State["modules"]["loaded_modules"];
  moduleExports: State["modules"]["module_exports"];
  modules: State["config"]["modules"];
}

function mapStateToProps(state: State): ModuleManagerStateProps {
  return {
    dependencyTree: state.dependencies.dependency_tree,
    satisfiedModuleIds: state.dependencies.satisfied_module_ids,
    loadedModules: state.modules.loaded_modules,
    moduleExports: state.modules.module_exports,
    modules: state.config.modules,
  };
}

interface ModuleManagerDispatchProps {
  addModule: typeof addLoadedModule;
  addModuleExports: typeof addModuleExports;
  unloadModule: typeof unloadModule;
}

function mapDispatchToProps(dispatch: Dispatch): ModuleManagerDispatchProps {
  return {
    addModule: (module: ManagedModule) => dispatch(addLoadedModule(module)),
    addModuleExports: (moduleId, exports) =>
      dispatch(addModuleExports(moduleId, exports)),
    unloadModule: (moduleId) => dispatch(unloadModule(moduleId)),
  };
}

type ModuleManagerProps = ModuleManagerStateProps & ModuleManagerDispatchProps;

const ConnectedModuleManager = connect(
  mapStateToProps,
  mapDispatchToProps
)(ModuleManager);

export default ConnectedModuleManager;
