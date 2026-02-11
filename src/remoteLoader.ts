import * as React from 'react';
import * as ReactDOM from 'react-dom';

const PLATEFORM_URL =
  import.meta.env.VITE_PLATEFORM_URL ||
  'https://plateform-frontend-production.up.railway.app';

interface RemoteContainer {
  init: (shareScope: Record<string, unknown>) => void;
  get: (module: string) => Promise<() => any>;
}

/**
 * Register host React/ReactDOM into the federation shared scope
 * so remote components reuse our instance instead of loading their own.
 *
 * Also patch the remote's bundled React internals so that the JSX runtime
 * (which is statically imported) uses the same ReactCurrentOwner as
 * the host — preventing "element from an older version" errors.
 */
function ensureSharedScope() {
  const g = globalThis as any;
  g.__federation_shared__ = g.__federation_shared__ || {};
  g.__federation_shared__['default'] = g.__federation_shared__['default'] || {};

  const shared = g.__federation_shared__['default'];

  if (!shared['react']) {
    shared['react'] = {
      '18.2.0': {
        get: () => () => React,
        scope: 'default',
      },
    };
  }

  if (!shared['react-dom']) {
    shared['react-dom'] = {
      '18.2.0': {
        get: () => () => ReactDOM,
        scope: 'default',
      },
    };
  }
}

let containerPromise: Promise<RemoteContainer> | null = null;

async function patchRemoteReactInternals(): Promise<void> {
  // The remote's JSX runtime imports reactExports from a bundled React 18 file.
  // We load that file and replace its __SECRET_INTERNALS with ours so that
  // elements created by the remote's JSX runtime are recognized by our React 19.
  try {
    const remoteReactBundle = await import(
      /* @vite-ignore */ `${PLATEFORM_URL}/assets/__federation_shared_react-BVrXI7vh.js`
    );
    const remoteReact = remoteReactBundle.default || remoteReactBundle;
    if (remoteReact && remoteReact.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
      // Point the remote's ReactCurrentOwner to ours
      const hostInternals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
      if (hostInternals) {
        remoteReact.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner =
          hostInternals.ReactCurrentOwner;
        remoteReact.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher =
          hostInternals.ReactCurrentDispatcher;
      }
    }
  } catch {
    // If patching fails, continue anyway — the shared scope may still work
  }
}

function loadRemoteEntry(): Promise<RemoteContainer> {
  if (containerPromise) return containerPromise;

  ensureSharedScope();

  containerPromise = patchRemoteReactInternals()
    .then(() => import(/* @vite-ignore */ `${PLATEFORM_URL}/assets/remoteEntry.js`))
    .then((container: RemoteContainer) => {
      container.init({});
      return container;
    })
    .catch((err) => {
      containerPromise = null;
      throw err;
    });

  return containerPromise;
}

export async function loadRemoteComponent(moduleName: string): Promise<{ default: React.ComponentType<any> }> {
  const container = await loadRemoteEntry();
  const factory = await container.get(moduleName);
  const result = factory();

  // React.lazy expects { default: Component }
  if (result && typeof result === 'object' && 'default' in result) {
    return result;
  }
  return { default: result };
}
