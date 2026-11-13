import {expect,test,vi} from 'vitest';
test('external delivery opens its actual URL without issuing platform identity',async()=>{
 const {openDelivery}=await import('../services/openDelivery');
 const issue=vi.fn();const open=vi.fn();
 await openDelivery({kind:'EXTERNAL_LINK',url:'https://notes.example/'} as any,issue,open);
 expect(open).toHaveBeenCalledWith('https://notes.example/');
 expect(issue).not.toHaveBeenCalled();
});
