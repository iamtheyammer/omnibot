import {
  ADD_DEPENDENCY_TO_TREE,
  ADD_DEPENDENT_TO_MODULE,
  AddDependentToModuleAction,
  SET_SATISFIED_MODULE_IDS,
  SetSatisfiedModuleIdsAction,
} from "../types/dependencies";

export function addDependencyToTree(
  moduleId: string,
  dependencies: string[] = [],
  dependents: string[] = []
) {
  return {
    type: ADD_DEPENDENCY_TO_TREE,
    moduleId,
    dependents,
    dependencies,
  };
}

export function addDependentToModule(
  moduleId: string,
  dependent: string
): AddDependentToModuleAction {
  return {
    type: ADD_DEPENDENT_TO_MODULE,
    moduleId,
    dependent,
  };
}

export function setSatisfiedModuleIds(
  moduleIds: string[]
): SetSatisfiedModuleIdsAction {
  return {
    type: SET_SATISFIED_MODULE_IDS,
    moduleIds,
  };
}
