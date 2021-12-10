import { combineReducers } from "redux";
import config from "./config";
import dependencies from "./dependencies";
import modules from "./modules";

export default combineReducers({ config, dependencies, modules });
