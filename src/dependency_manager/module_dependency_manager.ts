import Logger from "../logger";
import { DependencyManager } from "./dependency_manager";

export default class ModuleDependencyManager {
  // private readonly dependencies: { [namespace: string]: Set<string> | { [dependency: string]: Set<string>} };
  public readonly dependencies: Set<string> = new Set();
  private readonly logger: Logger;

  constructor(moduleName: string, dependencies: string[]) {
    this.logger = new Logger(`module_dependency_manager:${moduleName}`);

    this.dependencies = new Set(dependencies);
  }

  public hasDependency(dependency: string): boolean {
    return this.dependencies.has(dependency);
  }

  public getModuleDependencies(): string[] {
    return Array.from(this.dependencies).filter((d) =>
      DependencyManager.isIntermoduleDependency(d)
    );
  }
}
