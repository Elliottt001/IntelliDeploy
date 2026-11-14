import type {PropsWithChildren,ReactNode} from 'react';
import {LiveGlassBackdrop} from '../../components/mobile/glass/LiveGlassBackdrop.native';
/** The later footer sees the actual earlier scroll presentation, rendered once. */
export function HomeFooterBackdrop({scrollContent,children}:PropsWithChildren<{scrollContent:ReactNode}>){return <LiveGlassBackdrop mode="flow" captureStyle={{flex:1}} underlay={scrollContent}>{children}</LiveGlassBackdrop>;}
/** Same-card control input is its earlier artwork/copy, never the control. */
export function HomeControlBackdrop({artwork,children}:PropsWithChildren<{artwork:ReactNode}>){return <LiveGlassBackdrop interactiveUnderlay underlay={artwork}>{children}</LiveGlassBackdrop>;}
