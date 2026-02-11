const PLATEFORM_URL =
  import.meta.env.VITE_PLATEFORM_URL ||
  'https://plateform-frontend-production.up.railway.app';

interface RemoteContainer {
  init: (shareScope: Record<string, unknown>) => void;
  get: (module: string) => Promise<() => any>;
}

let containerPromise: Promise<RemoteContainer> | null = null;

function loadRemoteEntry(): Promise<RemoteContainer> {
  if (containerPromise) return containerPromise;

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

export async function loadRemoteComponent(moduleName: string): Promise<React.ComponentType<any>> {
  const container = await loadRemoteEntry();
  const factory = await container.get(moduleName);
  const result = factory();

  if (result && typeof result === 'object' && 'default' in result) {
    return result.default;
  }
  return result;
}

// Also expose a way to get remote's own React + ReactDOM
let remoteReactPromise: Promise<{ React: any; ReactDOM: any }> | null = null;

export function getRemoteReact(): Promise<{ React: any; ReactDOM: any }> {
  if (remoteReactPromise) return remoteReactPromise;

  remoteReactPromise = loadRemoteEntry().then(async (container) => {
    // The remote's __federation_fn_import resolves 'react' and 'react-dom'
    // from its own bundled copies via getSharedFromLocal
    const reactFactory = await container.get('./HeaderBar');
    // We need to import the remote's shared react directly
    const remoteReactModule = await import(
      /* @vite-ignore */ `${PLATEFORM_URL}/assets/__federation_shared_react-BVrXI7vh.js`
    );
    const remoteReactDOMModule = await import(
      /* @vite-ignore */ `${PLATEFORM_URL}/assets/__federation_shared_react-dom-BvZD8imA.js`
    );
    void reactFactory; // just to ensure container is loaded
    return {
      React: remoteReactModule.default || remoteReactModule,
      ReactDOM: remoteReactDOMModule.default || remoteReactDOMModule,
    };
  });

  return remoteReactPromise;
}
