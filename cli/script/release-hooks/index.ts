import {ReleaseHook} from "../../definitions/cli";

export var hooks: ReleaseHook[] = [
  require('./signing'),
  require('./core-release'),
];
