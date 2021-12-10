import {
  ConfigActionTypes,
  ConfigInitialState,
  ConfigState,
  PROPAGATE_CONFIG,
} from "../types/config";

export default function config(
  state: ConfigState = ConfigInitialState,
  action: ConfigActionTypes
): ConfigState {
  switch (action.type) {
    case PROPAGATE_CONFIG:
      return {
        ...action.config,
      };
    default:
      return state;
  }
}
