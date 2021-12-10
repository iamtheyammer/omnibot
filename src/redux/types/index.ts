import { ConfigState } from "./config";
import { DependenciesState } from "./dependencies";
import { ModulesState } from "./modules";

export default interface State {
  config: ConfigState;
  dependencies: DependenciesState;
  modules: ModulesState;
}
