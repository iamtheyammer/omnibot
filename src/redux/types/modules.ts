import { OmnibotModule } from "./config";
import CoreDependency from "../../core_dependency";

export interface ManagedModule extends OmnibotModule {
  coreDependency: CoreDependency;
  normalizedPath?: string;
  importedCode: any;
}

export interface ModulesState {
  loaded_modules: { [moduleId: string]: ManagedModule };
  module_exports: { [moduleId: string]: any };
}

export const ADD_LOADED_MODULE = "ADD_LOADED_MODULE";

export interface AddLoadedModuleAction {
  type: typeof ADD_LOADED_MODULE;
  module: ManagedModule;
}

export const ADD_MODULE_EXPORTS = "ADD_MODULE_EXPORTS";

export interface AddModuleExportsAction {
  type: typeof ADD_MODULE_EXPORTS;
  moduleId: string;
  exports: any;
}

export const UNLOAD_MODULE = "UNLOAD_MODULE";

export interface UnloadModuleAction {
  type: typeof UNLOAD_MODULE;
  moduleId: string;
}

export type ModulesActionTypes =
  | AddLoadedModuleAction
  | AddModuleExportsAction
  | UnloadModuleAction;
