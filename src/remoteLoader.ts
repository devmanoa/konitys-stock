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
 * so remote components reuse our single instance instead of loading their own.
 */
function ensureSharedScope() {
  const g = globalThis as any;
  g.__federation_shared__ = g.__federation_shared__ || {};
  g.__federation_shared__['default'] = g.__federation_shared__['default'] || {};

  const shared = g.__federation_shared__['default'];

  if (!shared['react']) {
    shared['react'] = {
      '18.3.1': {
        get: () => () => React,
        scope: 'default',
      },
    };
  }

  if (!shared['react-dom']) {
    shared['react-dom'] = {
      '18.3.1': {
        get: () => () => ReactDOM,
        scope: 'default',
      },
    };
  }
}

let containerPromise: Promise<RemoteContainer> | null = null;

function loadRemoteEntry(): Promise<RemoteContainer> {
  if (containerPromise) return containerPromise;

  ensureSharedScope();

  containerPromise = import(/* @vite-ignore */ `${PLATEFORM_URL}/assets/remoteEntry.js`)
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
