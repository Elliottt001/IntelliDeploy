import {expect, test} from 'vitest';
import {latestAssistantForDisplay, needsDetailedReplyLayout, splitReplyLines} from '../features/chatbot/replyLayout';
test('raw whitespace and line counts cannot overflow the three-row compact layout', () => {
 for (const content of ['first\r\nsecond\r\nthird\r\n\r\n','\r\nfirst\r\n','\n\n\n\n','first\n\nthird','first\nsecond\nthird\nfourth']) expect(needsDetailedReplyLayout(content)).toBe(true);
 expect(needsDetailedReplyLayout('first\nsecond\nthird')).toBe(false);
 expect(needsDetailedReplyLayout('first')).toBe(false);
});

test('compact rows retain original CRLF and LF separators as actual message text', () => {
 expect(splitReplyLines('first\r\nsecond\r\nthird')).toEqual([
  {content:'first',separator:'\r\n'}, {content:'second',separator:'\r\n'}, {content:'third',separator:''},
 ]);
 expect(splitReplyLines('first\nsecond\nthird')).toEqual([
  {content:'first',separator:'\n'}, {content:'second',separator:'\n'}, {content:'third',separator:''},
 ]);
});

test('display dedup keeps byte-exact conversation history while hiding only the matching latest assistant', () => {
 const duplicate='\uFEFF保留第一行\r\n\r\n保留第三行';
 const conversation=[
  {id:'user',role:'user',content:'原始需求'},
  {id:'assistant',role:'assistant',content:duplicate},
 ];
 expect(latestAssistantForDisplay(conversation,duplicate)).toBeNull();
 expect(conversation).toEqual([
  {id:'user',role:'user',content:'原始需求'},
  {id:'assistant',role:'assistant',content:'\uFEFF保留第一行\r\n\r\n保留第三行'},
 ]);
 expect(latestAssistantForDisplay(conversation,duplicate.replace('\r\n','\n'))?.content).toBe(duplicate);
});

test('reply layout uses actual content length and separators without trimming FEFF bytes', () => {
 expect(needsDetailedReplyLayout('\uFEFF')).toBe(false);
 expect(needsDetailedReplyLayout('这是一段来自接口的真实长回复，需要按内容自然换行而不是根据任务阶段制造依赖列表或固定步骤。')).toBe(true);
 expect(splitReplyLines('\uFEFFfirst\r\n\r\nthird')).toEqual([
  {content:'\uFEFFfirst',separator:'\r\n'}, {content:'',separator:'\r\n'}, {content:'third',separator:''},
 ]);
});
