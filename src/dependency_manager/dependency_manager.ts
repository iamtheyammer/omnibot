import { readFile } from "fs/promises";
import { normalize } from "path";
import { install as installPackages } from "pkg-install";
import Logger from "../logger";
import { OmnibotModule } from "../config/parse_config_file";
import * as Process from "process";

interface ProcessedDependency {
  namespace: string;
  dependency: string;
  dependencySplit: string[];
  identifier: string;
}

export class DependencyManager {
  private readonly dependencyTree: {
    [moduleId: string]: { dependsOn: string[]; dependencies: string[] };
  } = {};
  private readonly logger = new Logger("dependency_manager");
  private readonly modules: OmnibotModule[];

  constructor(modules?: OmnibotModule[]) {
    if (modules) {
      modules.forEach((m) =>
        this.addModule(
          m,
          modules.map((mo) => mo.id)
        )
      );
    }

    this.modules = modules || [];
  }

  /**
   * addModule adds a module's dependencies to the dependency tree.
   *
   * It does not resolve the dependencies-- make sure to call resolveDependencies before
   * loading modules!
   * @param module The module to add to the dependency tree
   * @param allModuleIds Array of all module IDs. Used to check for invalid module interdependencies
   */
  public addModule(module: OmnibotModule, allModuleIds: string[]) {
    const { id: moduleId } = module;
    const rawDeps = Array.from(module.dependencies.dependencies);
    this.logger.info(`Adding dependencies for module ${moduleId}`);
    // add dependencies to tree
    // create required resolution
    // wait for resolveModules call

    const deps = rawDeps.map((d) => DependencyManager.parseDependency(d));
    // first, handle all NPM dependencies
    const npmDeps = deps.filter((d) => d.namespace === "npm");
    if (npmDeps.length) {
      this.logger.debug(
        `Added these NPM dependencies for module ${moduleId}: ${npmDeps
          .map((d) => d.dependency)
          .join(", ")}.`
      );
    } else {
      this.logger.debug(`No NPM dependencies found for module ${moduleId}`);
    }

    // inter-module dependencies
    const imDeps = deps.filter(
      (d) => d.namespace === "omnibot" && d.dependencySplit[0] === "module"
    );

    if (!imDeps.length) {
      this.logger.debug(
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
        throw new DependencyResolutionError(
          `Module ${moduleId} depends on itself!`
        );
      }
    }

    // create tree node if it doesn't exist
    if (!this.dependencyTree[moduleId]) {
      this.dependencyTree[moduleId] = {
        dependsOn: [],
        dependencies: [],
      };
    }

    // add dependencies to tree

    // add npm dependencies. only add dependsOn
    for (const d of npmDeps) {
      // add only dependencies
      this.dependencyTree[moduleId].dependsOn.push(d.identifier);
    }

    for (const d of imDeps) {
      if (!allModuleIds.includes(d.dependencySplit[1])) {
        throw new DependencyResolutionError(
          `Unable to find module ${d.dependencySplit[1]} which is a dependency of ${module.id}!`
        );
      }

      // add dependency to this module
      const imDep = d.dependencySplit[1];
      this.dependencyTree[moduleId].dependsOn.push(d.identifier);

      // add dependent to dependent module
      if (!this.dependencyTree[imDep]) {
        this.dependencyTree[imDep] = {
          dependsOn: [],
          dependencies: [`omnibot:module:${moduleId}`],
        };
      } else {
        this.dependencyTree[imDep].dependencies.push(
          `omnibot:module:${moduleId}`
        );
        this.recursivelyCheckCyclicalDependencies(moduleId, new Set([imDep]));
      }
    }

    this.modules.push(module);
    this.logger.debug(
      `Dependency tree for module ${moduleId}:\n${JSON.stringify(
        this.dependencyTree[moduleId],
        null,
        2
      )}`
    );
  }

  private recursivelyCheckCyclicalDependencies(
    moduleId: string,
    moduleIds: Set<string>
  ) {
    this.logger.debug(
      `Recursively parsing module dependencies for ${Array.from(moduleIds)}`
    );

    for (const m of Array.from(moduleIds)) {
      const checkForImdModuleId = DependencyManager.isIntermoduleDependency(m)
        ? DependencyManager.parseDependency(m).dependencySplit[1]
        : m;
      if (!this.dependencyTree[checkForImdModuleId]) {
        this.logger.warn(
          `${m} is not in the tree yet, can't check for IMDs. This may cause dependency issues in the future.`
        );
        continue;
      }

      const imDepImds = this.dependencyTree[checkForImdModuleId].dependsOn
        .filter((dep) => DependencyManager.isIntermoduleDependency(dep))
        .map(
          (dep) => DependencyManager.parseDependency(dep).dependencySplit[1]
        );
      if (imDepImds.length) {
        this.logger.debug(
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
        this.logger.debug(`No cyclical dependencies found in ${moduleId}!`);
      }
    }
  }

  /**
   * resolveDependencies attempts to resolve all stated dependencies.
   *
   * It resolves both Omnibot Module Dependencies (called module interdependencies)
   * and NPM dependencies.
   */
  public async resolveDependencies() {
    this.logger.info("Resolving dependencies");
    this.logger.debug(
      `Full dependency tree:\n${JSON.stringify(this.dependencyTree, null, 2)}`
    );

    const resolutionQueueSet: Set<string> = new Set();

    // run through each module
    Object.entries(this.dependencyTree).forEach(([, deps]) => {
      deps.dependencies.forEach((d) => {
        this.logger.debug(`Adding ${d} to the resolution queue (dependencies)`);
        resolutionQueueSet.add(d);
      });
      deps.dependsOn.forEach((d) => {
        this.logger.debug(`Adding ${d} to the resolution queue (dependsOn)`);
        resolutionQueueSet.add(d);
      });
    });

    const resolutionQueue = Array.from(resolutionQueueSet);
    this.logger.info(`Resolving these modules: ${resolutionQueue.join(", ")}`);

    // first, resolve Omnibot dependencies
    this.logger.debug(`Resolving Omnibot dependencies (checking for presence)`);
    const omnibotDependencies = resolutionQueue
      .filter((d) => d.startsWith("omnibot:module:"))
      .map((d) => d.substring(15));

    // ensure that all dependencies appear in the tree.
    if (omnibotDependencies.length) {
      omnibotDependencies.forEach((d) => {
        if (!this.dependencyTree[d]) {
          throw new DependencyResolutionError(
            `Unable to resolve omnibot module dependency ${d}! (omnibot:module:${d})`
          );
        }
      });
      this.logger.debug("All omnibot module dependencies resolved!");
      // all omnibot modules validated.
    } else {
      this.logger.debug("No omnibot module dependencies to resolve");
    }

    const requiredPackages = resolutionQueue
      .filter((d) => d.startsWith("npm:"))
      .map((d) => d.substring(d.indexOf("npm:" + 1)));

    if (requiredPackages.length) {
      this.logger.debug("Resolving package (npm) dependencies");
      this.logger.debug("Reading package.json file");
      // check currently installed dependencies from package.json
      const packageFileRaw = await readFile(
        normalize("./package.json"),
        "utf8"
      );
      const packageFile: {
        // devDependencies: { [packageName: string]: string };
        dependencies: { [packageName: string]: string };
      } = JSON.parse(packageFileRaw);

      // only count production dependencies
      const installedPackages: string[] = Object.keys(packageFile.dependencies);

      this.logger.debug(
        `Found ${installedPackages.length} packages in package.json`
      );

      const missingPackages = requiredPackages
        .map((d) => d.substring(4))
        .filter((d) => !installedPackages.includes(d));

      if (missingPackages.length) {
        this.logger.info(
          `Attempting to fetch these missing packages: ${missingPackages.join(
            ", "
          )}`
        );

        try {
          // install missingPackages
          const installationOutput = await installPackages(missingPackages);
          this.logger.debug(installationOutput.stdout);
        } catch (e) {
          throw new DependencyResolutionError(
            `Error installing NPM dependencies: ${e}`
          );
        }

        this.logger.success(
          `Installed these dependencies: ${missingPackages.join(", ")}!`
        );
      } else {
        this.logger.info("No missing NPM dependencies to install!");
      }
    } else {
      this.logger.info("No NPM dependencies to resolve");
    }

    this.logger.success("Resolved module dependencies successfully!");
  }

  public getModuleLoadOrder(): OmnibotModule[] {
    const loadOrder: Set<string> = new Set();

    let pendingModules = [...this.modules];
    // load modules without dependencies first.
    pendingModules.forEach((m) => {
      if (
        !Array.from(m.dependencies.dependencies).some((d) =>
          DependencyManager.isIntermoduleDependency(d)
        )
      ) {
        // module has zero intermodule dependencies
        loadOrder.add(m.id);
      }
    });

    this.logger.debug(
      `Identified ${
        loadOrder.size
      } modules without intermodule dependencies, loading them first: ${Array.from(
        loadOrder
      ).join(", ")}.`
    );

    // remove loaded modules from pendingModules
    const pruneLoadedModules = () => {
      pendingModules = pendingModules.filter((m) => !loadOrder.has(m.id));
    };

    pruneLoadedModules();

    // recursively load modules that depend on currently loaded modules
    while (pendingModules.length > 0) {
      // load any modules that depend on currently loaded modules

      pendingModules.forEach((m) => {
        const deps: ProcessedDependency[] = Array.from(
          m.dependencies.dependencies
        ).map((d) => DependencyManager.parseDependency(d));
        const imDeps: ProcessedDependency[] = deps.filter((d) =>
          DependencyManager.isIntermoduleDependency(d)
        );

        const everyImDepIsLoaded = imDeps.every((d) =>
          loadOrder.has(d.dependencySplit[1])
        );

        if (everyImDepIsLoaded) {
          this.logger.debug(
            `Every IMD for module ${m.id} has been loaded, adding to queue`
          );
          loadOrder.add(m.id);
        }
      });

      // prune any loaded modules and continue
      this.logger.debug("Pruning loaded modules");
      pruneLoadedModules();
    }

    const moduleOrder: OmnibotModule[] = [];
    loadOrder.forEach((mId) => {
      const foundModule = this.modules.find((m) => m.id === mId);
      if (!foundModule) {
        throw new ModuleMissingError(`Unable to find ordered module ${mId}!`);
      }

      moduleOrder.push(foundModule);
    });

    return moduleOrder;
  }

  public moduleHasModuleDependents(moduleId: string): boolean {
    if (!this.dependencyTree[moduleId]) {
      this.logger.warn(
        `There was an attempt to get module dependents for ${moduleId}, which is not in the tree.`
      );
      return false;
    } else {
      return (
        this.dependencyTree[moduleId].dependencies.filter((d) =>
          DependencyManager.isIntermoduleDependency(d)
        ).length > 0
      );
    }
  }

  public getModuleDependenciesForModule(moduleId: string): string[] {
    if (!this.dependencyTree[moduleId]) {
      this.logger.warn(
        `There was an attempt to get module dependencies for ${moduleId}, which is not in the tree.`
      );
      return [];
    } else {
      return this.dependencyTree[moduleId].dependsOn
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

class DependencyCycleDetectedError extends Error {}
class DependencyResolutionError extends Error {}
class ModuleMissingError extends Error {}
