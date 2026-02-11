const PLATEFORM_URL =
  import.meta.env.VITE_PLATEFORM_URL ||
  'https://plateform-frontend-production.up.railway.app';

interface RemoteContainer {
  init: (shareScope: Record<string, unknown>) => Promise<void>;
  get: (module: string) => Promise<() => { default: React.ComponentType<any> }>;
}

let containerPromise: Promise<RemoteContainer> | null = null;

function loadRemoteEntry(): Promise<RemoteContainer> {
  if (containerPromise) return containerPromise;

  containerPromise = new Promise<RemoteContainer>((resolve, reject) => {
    const url = `${PLATEFORM_URL}/assets/remoteEntry.js`;

    import(/* @vite-ignore */ url)
      .then(() => {
        const container = (window as any).plateformRemote as RemoteContainer;
        if (!container) {
          reject(new Error('Remote container "plateformRemote" not found on window'));
          return;
        }
        // Initialize the container with empty shared scope
        container.init({}).then(() => resolve(container)).catch(() => resolve(container));
      })
      .catch((err) => {
        containerPromise = null;
        reject(err);
      });
  });

  return containerPromise;
}

export async function loadRemoteComponent(moduleName: string) {
  const container = await loadRemoteEntry();
  const factory = await container.get(moduleName);
  const module = factory();
  return module;
}
