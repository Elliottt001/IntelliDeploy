import {View,type StyleProp,type ViewStyle} from 'react-native';
import type {ReactNode} from 'react';
export type OrderedHomeCardsProps={children:ReactNode;expandedKey:string|null;style:StyleProp<ViewStyle>};
export function OrderedHomeCards({children,style}:OrderedHomeCardsProps){return <View style={style}>{children}</View>;}
