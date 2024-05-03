var loc = window.location.pathname;
var dir = loc.substring(0, loc.lastIndexOf("/")) + "/";

export let config = {
  baseURL: dir,
  url(path) {
    return `${config.baseURL}${path}`;
  },
};

export function setConfig(options) {
  Object.assign(config, options);
}
