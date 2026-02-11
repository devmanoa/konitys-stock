import { useEffect, useRef, useState } from 'react'
import { loadRemoteComponent, getRemoteReact } from '../../remoteLoader'

interface RemoteMounterProps {
  moduleName: string
  props: Record<string, any>
  fallback?: React.ReactNode
  className?: string
}

/**
 * Mounts a remote federated component inside an isolated DOM node
 * using the remote's own React 18 + ReactDOM, avoiding version conflicts
 * with the host app's React 19.
 */
export default function RemoteMounter({ moduleName, props, fallback, className }: RemoteMounterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const componentRef = useRef<React.ComponentType<any> | null>(null)
  const remoteReactRef = useRef<{ React: any; ReactDOM: any } | null>(null)

  // Load the remote component and React on mount
  useEffect(() => {
    let cancelled = false

    Promise.all([
      loadRemoteComponent(moduleName),
      getRemoteReact(),
    ]).then(([Component, remoteReact]) => {
      if (cancelled) return
      componentRef.current = Component
      remoteReactRef.current = remoteReact
      setLoaded(true)
    }).catch((err) => {
      console.error(`Failed to load remote module "${moduleName}":`, err)
    })

    return () => { cancelled = true }
  }, [moduleName])

  // Render/update the remote component when props change
  useEffect(() => {
    if (!loaded || !containerRef.current || !componentRef.current || !remoteReactRef.current) return

    const { React: remoteReact, ReactDOM: remoteReactDOM } = remoteReactRef.current
    const Component = componentRef.current

    // Create root once
    if (!rootRef.current) {
      if (remoteReactDOM.createRoot) {
        rootRef.current = remoteReactDOM.createRoot(containerRef.current)
      } else {
        // Fallback for React 18 without createRoot (shouldn't happen)
        rootRef.current = {
          render: (el: any) => remoteReactDOM.render(el, containerRef.current),
          unmount: () => remoteReactDOM.unmountComponentAtNode(containerRef.current),
        }
      }
    }

    const element = remoteReact.createElement(Component, props)
    rootRef.current.render(element)
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        // Defer unmount to avoid React warnings
        const root = rootRef.current
        rootRef.current = null
        setTimeout(() => {
          try { root.unmount() } catch { /* ignore */ }
        }, 0)
      }
    }
  }, [])

  if (!loaded && fallback) {
    return <>{fallback}</>
  }

  return <div ref={containerRef} className={className} />
}
