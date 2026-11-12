import {expect, test} from 'vitest';
import {needsDetailedReplyLayout, splitReplyLines} from '../features/chatbot/replyLayout';
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
