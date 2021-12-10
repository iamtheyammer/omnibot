import {
  Config,
  PROPAGATE_CONFIG,
  PropagateConfigAction,
} from "../types/config";

export function propagateConfig(config: Config): PropagateConfigAction {
  return {
    type: PROPAGATE_CONFIG,
    config,
  };
}
