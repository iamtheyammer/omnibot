import {
  ADD_LOADED_MODULE,
  ADD_MODULE_EXPORTS,
  AddLoadedModuleAction,
  AddModuleExportsAction,
  ManagedModule,
  UNLOAD_MODULE,
  UnloadModuleAction,
} from "../types/modules";

export function addLoadedModule(module: ManagedModule): AddLoadedModuleAction {
  return {
    type: ADD_LOADED_MODULE,
    module,
  };
}

export function addModuleExports(
  moduleId: string,
  exports: any
): AddModuleExportsAction {
  return {
    type: ADD_MODULE_EXPORTS,
    moduleId,
    exports,
  };
}

export function unloadModule(moduleId: string): UnloadModuleAction {
  return {
    type: UNLOAD_MODULE,
    moduleId,
  };
}
