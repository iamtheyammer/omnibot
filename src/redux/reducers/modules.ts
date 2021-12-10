import {
  ADD_LOADED_MODULE,
  ADD_MODULE_EXPORTS,
  ModulesActionTypes,
  ModulesState,
  UNLOAD_MODULE,
} from "../types/modules";

const modulesDefaultState: ModulesState = {
  loaded_modules: {},
  module_exports: {},
};

export default function modules(
  state: ModulesState = modulesDefaultState,
  action: ModulesActionTypes
): ModulesState {
  switch (action.type) {
    case ADD_LOADED_MODULE:
      return {
        ...state,
        loaded_modules: {
          ...state.loaded_modules,
          [action.module.id]: action.module,
        },
      };
    case ADD_MODULE_EXPORTS:
      return {
        ...state,
        module_exports: {
          ...state.module_exports,
          [action.moduleId]: action.exports,
        },
      };
    case UNLOAD_MODULE: {
      // loadedModules contains all EXCEPT action.moduleId
      // https://stackoverflow.com/a/47227198
      const {
        // eslint-disable-next-line no-empty-pattern
        [action.moduleId]: {},
        ...loadedModules
      }: ModulesState["loaded_modules"] = state.loaded_modules;
      const {
        // eslint-disable-next-line no-empty-pattern
        [action.moduleId]: {},
        ...moduleExports
      }: ModulesState["module_exports"] = state.module_exports;

      return {
        ...state,
        loaded_modules: loadedModules,
        module_exports: moduleExports,
      };
    }
    default:
      return state;
  }
}
