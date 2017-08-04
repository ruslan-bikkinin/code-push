import {IReleaseHooks, ReleaseHook} from "../../definitions/cli";

export class ReleaseHooks {
  
  public hooks: IReleaseHooks;

  public constructor(hooks: IReleaseHooks) {
    this.hooks = hooks;
  }
  
  public toArray(): ReleaseHook[] {
    return Object.keys(this.hooks).map<ReleaseHook>((key: string) => {
      return this.hooks[key];
    });
  }
}

var releaseHooks = new ReleaseHooks({
  signing: require('./signing'),
  coreRelease: require('./core-release'),
});

export default releaseHooks;
