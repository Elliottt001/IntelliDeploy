import {expect,test} from '@playwright/test';
import {sourceControlStates} from '../../design/sourceControlMotionEvidence';
import {sourceNode} from '../../tests/figmaSource';
function originalMaskIds(node:typeof sourceControlStates[string]):string[]{return [...(sourceNode(node.sourceNodeId).mask?[node.sourceNodeId]:[]),...node.children.flatMap(originalMaskIds)];}
test('original default and hover avatar mask definitions remain referenced by rendered source paint',async({page})=>{
 await page.goto('/motion');const control=page.getByTestId('actual-source-avatar');await expect(control).toBeVisible();await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));
 for(const [state,hover] of [['270:26291',false],['188:16338',true]] as const){
  if(hover){await control.hover();await page.clock.runFor(1100);}
  const maskIds=originalMaskIds(sourceControlStates[state]);expect(maskIds.length).toBeGreaterThan(0);
  const tree=control.locator('svg').first();
  for(const nodeId of maskIds){const id=`actual-source-avatar-mask-${nodeId.replace(':','-')}`;await expect(tree.locator(`[id="${id}"]`)).toHaveCount(1);await expect(tree.locator(`[clip-path="url(#${id})"]`)).not.toHaveCount(0);}
 }
});
