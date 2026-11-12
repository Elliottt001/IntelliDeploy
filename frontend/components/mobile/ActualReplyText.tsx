import {Text, type StyleProp, type TextStyle} from 'react-native';

// Conversation content is public API text, including any original whitespace or markers.
export function ActualReplyText({content, style, testID}: {content: string; style?: StyleProp<TextStyle>; testID?: string}) {
 return <Text accessibilityLabel={content} testID={testID} style={style}>{content}</Text>;
}
