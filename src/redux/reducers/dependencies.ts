import {
  ADD_DEPENDENCY_TO_TREE,
  ADD_DEPENDENT_TO_MODULE,
  DependenciesActionTypes,
  DependenciesDefaultState,
  DependenciesState,
  SET_SATISFIED_MODULE_IDS,
} from "../types/dependencies";

export default function dependencies(
  state: DependenciesState = DependenciesDefaultState,
  action: DependenciesActionTypes
): DependenciesState {
  switch (action.type) {
    case ADD_DEPENDENCY_TO_TREE:
      return {
        ...state,
        dependency_tree: {
          ...state.dependency_tree,
          [action.moduleId]: {
            dependents: action.dependents,
            dependencies: action.dependencies,
          },
        },
      };
    case ADD_DEPENDENT_TO_MODULE:
      return {
        ...state,
        // if there is a tree branch for this module,
        // add new dependent to the entry
        dependency_tree: state.dependency_tree[action.moduleId]
          ? {
              ...state.dependency_tree,
              [action.moduleId]: {
                ...state.dependency_tree[action.moduleId],
                // if this dependent is already in the branch do nothing
                dependencies: state.dependency_tree[
                  action.moduleId
                ].dependents.includes(action.dependent)
                  ? state.dependency_tree[action.moduleId].dependents
                  : [
                      action.moduleId,
                      ...state.dependency_tree[action.moduleId].dependents,
                    ],
              },
            }
          : // add branch to tree since one does not already exist
            {
              ...state.dependency_tree,
              [action.moduleId]: {
                dependents: [action.dependent],
                dependencies: [],
              },
            },
      };
    case SET_SATISFIED_MODULE_IDS:
      return {
        ...state,
        satisfied_module_ids: action.moduleIds,
      };
    default:
      return state;
  }
}
