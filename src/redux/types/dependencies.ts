/*
 store dependency tree
 add actions for:
 - add module
*/

export interface DependencyTreeEntry {
  dependencies: string[];
  dependents: string[];
}

export type DependencyTree = {
  [moduleId: string]: DependencyTreeEntry;
};

export interface DependenciesState {
  // Tree containing all modules with their dependents and dependencies.
  dependency_tree: DependencyTree;
  // Modules that have all their dependencies satisfied.
  satisfied_module_ids: string[];
}

export const DependenciesDefaultState: DependenciesState = {
  dependency_tree: {},
  satisfied_module_ids: [],
};

export type DependenciesActionTypes =
  | AddDependencyToTreeAction
  | AddDependentToModuleAction
  | SetSatisfiedModuleIdsAction;

export const ADD_DEPENDENCY_TO_TREE = "ADD_DEPENDENCY_TO_TREE";

export interface AddDependencyToTreeAction {
  type: typeof ADD_DEPENDENCY_TO_TREE;
  moduleId: string;
  dependencies: string[];
  dependents: string[];
}

export const ADD_DEPENDENT_TO_MODULE = "ADD_DEPENDENT_TO_MODULE";

export interface AddDependentToModuleAction {
  type: typeof ADD_DEPENDENT_TO_MODULE;
  // the module that dependency requires
  moduleId: string;
  // the module that is depending on moduleId
  dependent: string;
}

export const SET_SATISFIED_MODULE_IDS = "SET_SATISFIED_MODULE_IDS";

export interface SetSatisfiedModuleIdsAction {
  type: typeof SET_SATISFIED_MODULE_IDS;
  moduleIds: string[];
}
