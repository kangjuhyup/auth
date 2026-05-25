type DebugValue = string | number | boolean | null | undefined;

type DebugPayload = Record<string, DebugValue | DebugValue[]>;

const DEBUG_STORAGE_KEY = 'interaction_debug';

function readDebugFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryFlag = params.get(DEBUG_STORAGE_KEY);
    if (queryFlag === '1' || queryFlag === 'true') {
      window.localStorage.setItem(DEBUG_STORAGE_KEY, '1');
      return true;
    }
    if (queryFlag === '0' || queryFlag === 'false') {
      window.localStorage.removeItem(DEBUG_STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function debugInteraction(
  event: string,
  payload?: DebugPayload,
): void {
  if (!readDebugFlag()) {
    return;
  }

  if (payload) {
    console.debug('[interaction-ui]', event, payload);
    return;
  }

  console.debug('[interaction-ui]', event);
}
