import { writeFile } from "fs/promises";
import samplePackageJson from "./sample_package.json";
import { normalize } from "path";
import { install as installPackages } from "pkg-install";
import Logger from "../logger";
import { OmnibotModule } from "../redux/types/config";
import { ChangeMap, connect, Module } from "newton-redux-reborn";
import State from "../redux/types";
import { Dispatch } from "redux";
import {
  addDependencyToTree,
  addDependentToModule,
  setSatisfiedModuleIds,
} from "../redux/actions/dependencies";
import {
  DependencyTree,
  DependencyTreeEntry,
} from "../redux/types/dependencies";

interface ProcessedDependency {
  namespace: string;
  dependency: string;
  dependencySplit: string[];
  identifier: string;
}

const depMgrRootLogger = new Logger("dependency_manager");

export class DependencyManager extends Module<DependencyManagerProps> {
  async onChange(changeMap: ChangeMap) {
    const logger = depMgrRootLogger.createChildLogger("onChange");

    // when modules change, determine change and add them
    if (changeMap.modules.hasChanged) {
      const prevModules = changeMap.modules.previousValue as OmnibotModule[];

      const newModules = this.props.modules.filter(
        (m) => !prevModules.some((pm) => pm.id === m.id)
      );
      logger.debug(
        `Detected ${newModules.length} new modules with ids ${newModules
          .map((m) => m.id)
          .join(", ")}, adding them`
      );

      newModules.forEach((m) => this.addModule(m));
    }

    // when the dependency tree changes, resolve dependencies
    if (changeMap.dependencyTree.hasChanged) {
      await this.resolveDependencies();
    }
  }

  /**
   * addModule adds a module's dependencies to the dependency tree.
   * It reacts to changes in the state tree.
   *
   * It does not resolve the dependencies-- make sure to call resolveDependencies before
   * loading modules!
   * @param module The module to add to the dependency tree
   */
  private addModule(module: OmnibotModule) {
    const logger = depMgrRootLogger.createChildLogger("addModule");

    const { id: moduleId } = module;
    const rawDeps = Array.from(module.dependencies.dependencies);
    logger.info(`Adding dependencies for module ${moduleId}`);
    // add dependencies to tree
    // create required resolution
    // wait for resolveModules call

    if (this.props.dependencyTree[moduleId]) {
      logger.info("Module is already in tree, skipping");
      return;
    }

    const deps = rawDeps.map((d) => DependencyManager.parseDependency(d));
    // first, handle all NPM dependencies
    const npmDeps = deps.filter((d) => d.namespace === "npm");
    if (npmDeps.length) {
      logger.debug(
        `Added these NPM dependencies for module ${moduleId}: ${npmDeps
          .map((d) => d.dependency)
          .join(", ")}.`
      );
    } else {
      logger.debug(`No NPM dependencies found for module ${moduleId}`);
    }

    // inter-module dependencies
    const imDeps = deps.filter(
      (d) => d.namespace === "omnibot" && d.dependencySplit[0] === "module"
    );

    if (!imDeps.length) {
      logger.debug(
        `Module ${moduleId} does not declare any intermodule dependencies.`
      );
    } else {
      if (
        imDeps.some(
          (d) =>
            d.namespace === "omnibot" &&
            d.dependency === "module" &&
            d.dependencySplit[1] === moduleId
        )
      ) {
        logger.fatal(`Module ${moduleId} depends on itself!`);
        return;
      }
    }

    const depTreeNode: DependencyTreeEntry = {
      dependencies: [],
      dependents: [],
    };

    // add dependencies to tree

    // add npm dependencies. only add dependencies
    for (const d of npmDeps) {
      // add only dependencies
      depTreeNode.dependencies.push(d.identifier);
    }

    for (const d of imDeps) {
      if (!this.props.modules.some((m) => m.id === d.dependencySplit[1])) {
        logger.fatal(
          `Unable to find module ${d.dependencySplit[1]} which is a dependency of ${module.id}!`
        );
        return;
      }

      // add the IMD as a dependency to this module
      const imDep = d.dependencySplit[1];
      depTreeNode.dependencies.push(d.identifier);

      // add this module as a dependent to IMD
      this.props.addDependentToModule(imDep, `omnibot:module:${moduleId}`);
      this.recursivelyCheckCyclicalDependencies(moduleId, new Set([imDep]));
    }

    this.props.addDependency(
      moduleId,
      depTreeNode.dependencies,
      depTreeNode.dependents
    );

    logger.debug(
      `Dependency tree for module ${moduleId}:\n${JSON.stringify(
        this.props.dependencyTree[moduleId],
        null,
        2
      )}`
    );
  }

  private recursivelyCheckCyclicalDependencies(
    moduleId: string,
    moduleIds: Set<string>
  ) {
    const logger = depMgrRootLogger.createChildLogger(
      "recursivelyCheckCyclicalDependencies"
    );

    logger.debug(
      `Recursively parsing module dependencies for ${Array.from(moduleIds)}`
    );

    for (const m of Array.from(moduleIds)) {
      const checkForImdModuleId = DependencyManager.isIntermoduleDependency(m)
        ? DependencyManager.parseDependency(m).dependencySplit[1]
        : m;
      if (!this.props.dependencyTree[checkForImdModuleId]) {
        logger.warn(
          `${m} is not in the tree yet, can't check for IMDs. This may cause dependency issues in the future.`
        );
        continue;
      }

      const imDepImds = this.props.dependencyTree[
        checkForImdModuleId
      ].dependencies
        .filter((dep) => DependencyManager.isIntermoduleDependency(dep))
        .map(
          (dep) => DependencyManager.parseDependency(dep).dependencySplit[1]
        );
      if (imDepImds.length) {
        logger.debug(
          `${m} depends on ${imDepImds}, checking for a dependency cycle`
        );
        imDepImds.forEach((imd) => {
          if (imd === moduleId) {
            throw new DependencyCycleDetectedError(
              `Dependency cycle detected in module ${imd} with ${checkForImdModuleId}!`
            );
          }
        });
        this.recursivelyCheckCyclicalDependencies(moduleId, new Set(imDepImds));
      } else {
        logger.debug(`No cyclical dependencies found in ${moduleId}!`);
      }
    }
  }

  /**
   * resolveDependencies attempts to resolve all stated dependencies.
   *
   * It resolves both Omnibot Module Dependencies (called module interdependencies)
   * and NPM dependencies.
   */
  private async resolveDependencies() {
    const logger = depMgrRootLogger.createChildLogger("resolveDependencies");
    logger.info("Resolving dependencies");
    logger.debug(
      `Full dependency tree:\n${JSON.stringify(
        this.props.dependencyTree,
        null,
        2
      )}`
    );

    const modulesToResolve = Object.keys(this.props.dependencyTree);

    const resolutionQueueSet: Set<string> = new Set();

    // run through each module
    modulesToResolve.forEach((moduleId) => {
      const deps = this.props.dependencyTree[moduleId];

      deps.dependencies.forEach((d) => {
        logger.debug(`Adding ${d} to the resolution queue (dependents)`);
        resolutionQueueSet.add(d);
      });
      deps.dependencies.forEach((d) => {
        logger.debug(`Adding ${d} to the resolution queue (dependencies)`);
        resolutionQueueSet.add(d);
      });
    });
    const resolutionQueue = Array.from(resolutionQueueSet);
    logger.info(`Resolving these modules: ${resolutionQueue.join(", ")}`);

    // first, resolve Omnibot dependencies
    logger.debug(`Resolving Omnibot dependencies (checking for presence)`);
    const omnibotDependencies = resolutionQueue
      .filter((d) => d.startsWith("omnibot:module:"))
      .map((d) => d.substring(15));

    // ensure that all dependencies appear in the tree.
    if (omnibotDependencies.length) {
      omnibotDependencies.forEach((d) => {
        if (!this.props.dependencyTree[d]) {
          throw new DependencyResolutionError(
            `Unable to resolve omnibot module dependency ${d}! (omnibot:module:${d})`
          );
        }
      });
      logger.debug("All omnibot module dependencies resolved!");
      // all omnibot modules validated.
    } else {
      logger.debug("No omnibot module dependencies to resolve");
    }

    const requiredPackages = resolutionQueue
      .filter((d) => d.startsWith("npm:"))
      .map((d) => d.substring(d.indexOf("npm:" + 1)));

    if (requiredPackages.length) {
      logger.debug("Resolving package (npm) dependencies");

      const missingPackages = requiredPackages
        .map((d) => d.substring(4))
        .filter((d) => {
          try {
            const modulePath = require.resolve(d);
            logger.info(`Found ${d} at ${modulePath}`);
            // false because we want to remove installed modules
            return false;
          } catch (e) {
            if (e.code === "MODULE_NOT_FOUND") {
              return true;
            } else {
              throw new DependencyResolutionError(
                `Error resolving NPM module ${d}: ${e}`
              );
            }
          }
        });

      if (missingPackages.length) {
        logger.info(
          `Attempting to fetch these missing packages: ${missingPackages.join(
            ", "
          )}. This may take a minute or two, so be patient!`
        );

        // try to add the sample package.json file to the current directory.
        // node will throw if it already exists. they recommend doing this
        // instead of checking if the file exists then writing.
        // https://nodejs.org/docs/latest-v14.x/api/fs.html#fs_fs_access_path_mode_callback
        try {
          await writeFile(
            normalize("./package.json"),
            JSON.stringify(samplePackageJson, null, 2),
            // use wx flag: throw if file exists
            { flag: "wx" }
          );
          logger.info("Wrote sample package.json file");
        } catch (e) {
          if (e.code === "EEXIST") {
            logger.debug("package.json file exists");
          } else {
            throw new DependencyResolutionError(
              `Unable to write sample package.json file: ${e}`
            );
          }
        }

        try {
          const installationOutput = await installPackages(missingPackages);
          logger.debug(
            `Output from package manager:\n${installationOutput.stdout}`
          );
        } catch (e) {
          throw new DependencyResolutionError(
            `Error installing NPM dependencies: ${e}`
          );
        }

        logger.success(
          `Installed these dependencies: ${missingPackages.join(", ")}!`
        );
      } else {
        logger.info("No missing NPM dependencies to install!");
      }
    } else {
      logger.info("No NPM dependencies to resolve");
    }

    this.props.setSatisfiedModuleIds(modulesToResolve);
    logger.success("Resolved module dependencies successfully!");
  }

  public static getModuleLoadOrder(dependencyTree: DependencyTree): string[] {
    const logger = depMgrRootLogger.createChildLogger("getModuleLoadOrder");

    const loadOrder: Set<string> = new Set();

    let pendingModules = Object.entries(dependencyTree);
    // load modules without dependencies first.
    pendingModules.forEach(([moduleId, treeEntry]) => {
      if (
        !Array.from(treeEntry.dependencies).some((d) =>
          DependencyManager.isIntermoduleDependency(d)
        )
      ) {
        // module has zero intermodule dependencies
        loadOrder.add(moduleId);
      }
    });

    logger.debug(
      `Identified ${
        loadOrder.size
      } modules without intermodule dependencies, loading them first: ${Array.from(
        loadOrder
      ).join(", ")}.`
    );

    // remove loaded modules from pendingModules
    const pruneLoadedModules = () => {
      pendingModules = pendingModules.filter(
        ([moduleId]) => !loadOrder.has(moduleId)
      );
    };

    pruneLoadedModules();

    // recursively load modules that depend on currently loaded modules
    while (pendingModules.length > 0) {
      // load any modules that depend on currently loaded modules

      pendingModules.forEach(([moduleId, treeEntry]) => {
        const deps: ProcessedDependency[] = Array.from(
          treeEntry.dependencies
        ).map((d) => DependencyManager.parseDependency(d));
        const imDeps: ProcessedDependency[] = deps.filter((d) =>
          DependencyManager.isIntermoduleDependency(d)
        );

        const everyImDepIsLoaded = imDeps.every((d) =>
          loadOrder.has(d.dependencySplit[1])
        );

        if (everyImDepIsLoaded) {
          logger.debug(
            `Every IMD for module ${moduleId} has been loaded, adding to queue`
          );
          loadOrder.add(moduleId);
        }
      });

      // prune any loaded modules and continue
      logger.debug("Pruning loaded modules");
      pruneLoadedModules();
    }

    return Array.from(loadOrder);
  }

  public static moduleHasModuleDependents(
    dependencyTree: DependencyTree,
    moduleId: string
  ): boolean {
    const logger = depMgrRootLogger.createChildLogger(
      "moduleHasModuleDependents"
    );

    if (!dependencyTree[moduleId]) {
      logger.warn(
        `There was an attempt to get module dependents for ${moduleId}, which is not in the tree.`
      );
      return false;
    } else {
      return (
        dependencyTree[moduleId].dependencies.filter((d) =>
          DependencyManager.isIntermoduleDependency(d)
        ).length > 0
      );
    }
  }

  public static getModuleDependenciesForModule(
    dependencyTree: DependencyTree,
    moduleId: string
  ): string[] {
    const logger = depMgrRootLogger.createChildLogger(
      "getModuleDependenciesForModule"
    );
    if (!dependencyTree[moduleId]) {
      logger.warn(
        `There was an attempt to get module dependencies for ${moduleId}, which is not in the tree.`
      );
      return [];
    } else {
      return dependencyTree[moduleId].dependencies
        .filter((d) => DependencyManager.isIntermoduleDependency(d))
        .map((d) => DependencyManager.parseDependency(d).dependencySplit[1]);
    }
  }

  private static parseDependency(dependency: string): ProcessedDependency {
    const firstColLoc = dependency.indexOf(":");

    return {
      namespace: dependency.substring(0, firstColLoc),
      dependency: dependency.substring(firstColLoc + 1),
      dependencySplit: dependency.substring(firstColLoc + 1).split(":"),
      identifier: dependency,
    };
  }

  public static isIntermoduleDependency(
    dependency: string | ProcessedDependency
  ): boolean {
    const d =
      typeof dependency === "object"
        ? dependency
        : this.parseDependency(dependency);

    return (
      d.namespace === "omnibot" &&
      d.dependencySplit[0] === "module" &&
      !!d.dependencySplit[1]
    );
  }
}

type DependencyManagerStateProps = {
  dependencyTree: State["dependencies"]["dependency_tree"];
  modules: State["config"]["modules"];
  // satisfiedModuleIds: State["dependencies"]["satisfied_module_ids"]
};

function mapStateToProps(state: State): DependencyManagerStateProps {
  return {
    dependencyTree: state.dependencies.dependency_tree,
    modules: state.config.modules,
    // satisfiedModuleIds: state.dependencies.satisfied_module_ids
  };
}

type DependencyManagerDispatchProps = {
  addDependency: typeof addDependencyToTree;
  addDependentToModule: typeof addDependentToModule;
  setSatisfiedModuleIds: typeof setSatisfiedModuleIds;
};

function mapDispatchToProps(
  dispatch: Dispatch
): DependencyManagerDispatchProps {
  return {
    addDependency: (moduleId, dependencies, dependents) =>
      dispatch(addDependencyToTree(moduleId, dependencies, dependents)),
    addDependentToModule: (moduleId, dependent) =>
      dispatch(addDependentToModule(moduleId, dependent)),
    setSatisfiedModuleIds: (moduleId) =>
      dispatch(setSatisfiedModuleIds(moduleId)),
  };
}

type DependencyManagerProps = DependencyManagerStateProps &
  DependencyManagerDispatchProps;

const ConnectedDependencyManager = connect(
  mapStateToProps,
  mapDispatchToProps
)(DependencyManager);

export default ConnectedDependencyManager;

class DependencyCycleDetectedError extends Error {}
class DependencyResolutionError extends Error {}
// class ModuleMissingError extends Error {}
