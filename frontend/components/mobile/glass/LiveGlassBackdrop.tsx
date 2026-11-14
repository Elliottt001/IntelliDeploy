import type {PropsWithChildren,ReactNode} from 'react';
import type {ViewStyle} from 'react-native';
// Web reads the live browser backdrop directly, without a capture/WASM import.
export function LiveGlassBackdrop({underlay,children}:PropsWithChildren<{underlay:ReactNode;mode?:'absolute'|'flow';interactiveUnderlay?:boolean;captureStyle?:ViewStyle}>){return <>{underlay}{children}</>;}
