import {expect,test,vi} from 'vitest';
import {createElement} from 'react';
const capture=vi.hoisted(()=>({make:vi.fn()}));
vi.mock('@shopify/react-native-skia',()=>({makeImageFromView:capture.make,Canvas:()=>null,Image:()=>null}));
import {captureRoutePresentation,RouteSnapshotView} from '../components/mobile/sourceRouteSnapshot.native';
test('native route snapshot uses the actual view ref and explicit image ownership without offscreen GPU resources',async()=>{
 const image={dispose:vi.fn()},ref={current:{} as any};capture.make.mockResolvedValueOnce(image);
 const snapshot=await captureRoutePresentation(ref);expect(capture.make).toHaveBeenLastCalledWith(ref);
 expect(snapshot?.image).toBe(image);const view=RouteSnapshotView({snapshot:snapshot!,x:-25,y:0,width:430,height:932});
 expect(view.props.pointerEvents).toBe('none');expect(view.props.accessibilityElementsHidden).toBe(true);
 expect(view.props.style).toMatchObject({left:-25,width:430,height:932});
 snapshot!.dispose();expect(image.dispose).toHaveBeenCalledTimes(1);
 expect(await captureRoutePresentation({current:null})).toBeNull();
});
