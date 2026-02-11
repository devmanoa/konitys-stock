import { useEffect, useRef, useState, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadRemoteComponent, getRemoteReact } from '../../remoteLoader'

interface RemoteMounterProps {
  moduleName: string
  props: Record<string, any>
  fallback?: React.ReactNode
  className?: string
}

/**
 * Pre-renders a host React 19 Lucide icon component to a static SVG string,
 * then returns a function component for the remote React 18 that injects
 * it via dangerouslySetInnerHTML — zero cross-version element conflicts.
 */
function makeSvgBridge(HostIcon: React.ComponentType<any>, remoteReact: any) {
  // Pre-render with default Lucide props to get the SVG markup
  const svgMarkup = renderToStaticMarkup(createElement(HostIcon, {
    size: 16,
    strokeWidth: 2,
  }))

  // Return a function component for the remote's React 18
  // It takes className and merges it onto the SVG via string replacement
  return function BridgedIcon(props: { className?: string }) {
    const finalSvg = props.className
      ? svgMarkup.replace('<svg ', `<svg class="${props.className}" `)
      : svgMarkup
    return remoteReact.createElement('span', {
      dangerouslySetInnerHTML: { __html: finalSvg },
      style: { display: 'inline-flex', alignItems: 'center' },
    })
  }
}

/**
 * Transforms sidebar sections props so that icon components (React 19 Lucide)
 * are bridged to static SVG wrappers compatible with the remote's React 18.
 */
function bridgeProps(props: Record<string, any>, remoteReact: any): Record<string, any> {
  if (!props.sections) return props

  return {
    ...props,
    sections: props.sections.map((section: any) => ({
      ...section,
      items: section.items.map((item: any) => {
        if (!item.icon) return item
        return {
          ...item,
          icon: makeSvgBridge(item.icon, remoteReact),
        }
      }),
    })),
  }
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
        rootRef.current = {
          render: (el: any) => remoteReactDOM.render(el, containerRef.current),
          unmount: () => remoteReactDOM.unmountComponentAtNode(containerRef.current),
        }
      }
    }

    // Bridge icon components in sidebar sections for cross-React compatibility
    const bridgedProps = bridgeProps(props, remoteReact)

    const element = remoteReact.createElement(Component, bridgedProps)
    rootRef.current.render(element)
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rootRef.current) {
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
