const PLATEFORM_URL =
  import.meta.env.VITE_PLATEFORM_URL ||
  'https://plateform-frontend-production.up.railway.app';

interface RemoteContainer {
  init: (shareScope: Record<string, unknown>) => void;
  get: (module: string) => Promise<() => { default: React.ComponentType<any> }>;
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

export async function loadRemoteComponent(moduleName: string) {
  const container = await loadRemoteEntry();
  const factory = await container.get(moduleName);
  const result = factory();

  // React.lazy expects { default: Component }
  // The federation factory may return the component directly or { default: Component }
  if (result && typeof result === 'object' && 'default' in result) {
    return result;
  }
  return { default: result };
}
