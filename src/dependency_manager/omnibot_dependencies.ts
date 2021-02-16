// Core dependency. Allows Discord Event Listeners.
export const OMNIBOT_CORE = /^omnibot:core$/;

// Discord Client dependency. Allows access to full discord client.\
export const OMNIBOT_DISCORDCLIENT = /^omnibot:discordclient$/;

// Init Timeout. How long a module has to load. 0 = infinite.
export const OMNIBOT_INITTIMEOUT = /^omnibot:inittimeout:[0-9]{1,8}$/;

// Unload Timeout. How long a module has to run its beforeunload function. 0 = infinite.
export const OMNIBOT_UNLOADTIMEOUT = /^omnibot:unloadtimeout:[0-9]{1,8}$/;

// Module dependency, for intermodule dependencies.
export const OMNIBOT_MODULE = /^omnibot:module:[^:]+$/;

// Array of every valid dependency. Use omnibotDependenciesAreValid() most of the time.
export const allValidDependencies: RegExp[] = [
  OMNIBOT_CORE,
  OMNIBOT_DISCORDCLIENT,
  OMNIBOT_INITTIMEOUT,
  OMNIBOT_UNLOADTIMEOUT,
  OMNIBOT_MODULE,
];

/**
 * Checks if all omnibot dependencies are valid. Filters out other dependencies.
 * @param dependencies List of dependencies to validate
 * @returns If a dependency is invalid, the offending dependency. Else void.
 */
export function omnibotDependenciesAreValid(
  dependencies: string[] | Set<string>
): string | void {
  for (const d of dependencies instanceof Array
    ? dependencies
    : Array.from(dependencies)) {
    if (!d.startsWith("omnibot:")) {
      continue;
    }

    const validDep = allValidDependencies.some((vd) => vd.test(d));

    if (!validDep) {
      return d;
    }
  }

  return;
}
