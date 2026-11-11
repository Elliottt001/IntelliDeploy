import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import { ProductArtwork, ProductMessage } from './ProductFolder';

type ProductItem = { id: string; name: string; status: string; summary?: string; creator?: string };
export function ProductList({ items, onOpen }: { items: readonly ProductItem[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return <ProductMessage>这个文件夹还没有应用</ProductMessage>;
  return <View style={styles.list}>{items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => onOpen(item.id)} style={styles.row} testID={`product-row-${item.id}`}>
    <ProductArtwork name={item.name} />
    <View style={styles.copy}>
      <Text style={styles.name}>{item.name}</Text>
      {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
      {item.creator ? <Text style={styles.summary}>{item.creator}</Text> : null}
      <Text style={styles.status}>{item.status}</Text>
    </View>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 12 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 68, minWidth: 44, padding: 12, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 20 },
  copy: { flex: 1 },
  name: { color: mobileColors.text, fontFamily: mobileFontFamilies.emphasis, fontSize: 15, lineHeight: 22 },
  summary: { color: mobileColors.text, fontFamily: mobileFontFamilies.body, fontSize: 13, lineHeight: 20 },
  status: { color: mobileColors.muted, fontFamily: mobileFontFamilies.body, fontSize: 12, lineHeight: 18 },
});
