import type {PropsWithChildren,ReactNode} from 'react';
// Web reads the live browser backdrop directly, without a capture/WASM import.
export function LiveGlassBackdrop({underlay,children}:PropsWithChildren<{underlay:ReactNode;mode?:'absolute'|'flow'}>){return <>{underlay}{children}</>;}
