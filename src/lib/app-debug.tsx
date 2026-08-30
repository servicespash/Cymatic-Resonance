import { useEffect, useRef } from "react";

export function useComponentMountDebug(componentName: string) {
  const mountTime = useRef<number>(0);
  
  useEffect(() => {
    mountTime.current = performance.now();
    console.log(`[DEBUG_MOUNT] 🟢 <${componentName}> mounted at ${mountTime.current.toFixed(2)}ms`);
    
    return () => {
      const unmountTime = performance.now();
      const duration = (unmountTime - mountTime.current).toFixed(2);
      console.log(`[DEBUG_MOUNT] 🔴 <${componentName}> unmounted. Lived for ${duration}ms`);
    };
  }, [componentName]);
}

export function logDataFetchHook(hookName: string, status: string = 'started') {
  console.log(`[DEBUG_FETCH] 📡 ${hookName} - ${status} at ${performance.now().toFixed(2)}ms`);
}

export function withSuspenseDebug<P extends object>(
  WrappedComponent: React.ComponentType<P>, 
  componentName: string
) {
  return function DebugSuspendedComponent(props: P) {
    useComponentMountDebug(componentName);
    return <WrappedComponent {...props} />;
  }
}
