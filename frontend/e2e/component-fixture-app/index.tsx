import { View } from 'react-native';
import { CommunitySourceRail } from '../../features/community/DiscoveryCard';

const longBody = '这一段 fixture 正文故意很长，用来验证正文槽可以自然承载多行内容，而不会把作者、时间或生产 Publication 字段塞进帖子区域。';

export default function ComponentFixtureIndex() {
  return <View testID="component-fixture-community" style={{ flex: 1, backgroundColor: '#EFF3FF', paddingTop: 188, paddingLeft: 21, overflow: 'hidden' }}>
    <CommunitySourceRail cards={[
      { id: 'fixture-long', copy: { author: 'component-fixture-author', time: '12分钟前', body: longBody } },
      { id: 'fixture-second', kind: 'standard', copy: { author: 'second-author', time: '刚刚', body: '第二张卡片保留独立文字槽。' } },
      { id: 'fixture-third', kind: 'square', copy: { author: null, time: null, body: null } },
    ]} />
  </View>;
}
