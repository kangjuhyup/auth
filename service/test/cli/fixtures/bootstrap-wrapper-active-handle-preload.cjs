const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function loadBootstrapRuntime(request, parent, isMain) {
  if (
    request === './bootstrap-runtime' &&
    parent?.filename.includes('/src/cli/bootstrap-')
  ) {
    return { runBootstrapCommand: async () => 1 };
  }
  return originalLoad.call(this, request, parent, isMain);
};

setInterval(() => undefined, 60_000);
