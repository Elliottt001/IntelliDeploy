import {expect,test} from 'vitest';
import {getHomeMiboMotion} from '../features/home/homeMotionPolicy';
test('actual avatar and cloud presentations select both source SMART owners before card/base fallback',()=>{
 for(const state of [{avatarHovered:true},{avatarPressed:true},{avatarSourceNodeId:'188:16338'}])expect(getHomeMiboMotion({...state,expandedCard:'store',cloudPressed:true})?.nodeId).toBe('188:16337');
 for(const state of [{cloudPressed:true},{cloudSourceNodeId:'188:16981'},{cloudSourceNodeId:'188:16759'}])expect(getHomeMiboMotion({...state,expandedCard:'products'})?.nodeId).toBe('188:16805');
 for(const [card,owner] of [['store','268:22950'],['products','268:23284'],['community','268:23618'],['profile','268:23952']] as const)expect(getHomeMiboMotion({expandedCard:card})?.nodeId).toBe(owner);
 expect(getHomeMiboMotion({})?.nodeId).toBe('266:21193');
 for(const state of [{avatarHovered:true},{cloudPressed:true}]){const motion=getHomeMiboMotion(state)!;expect(motion.transition).toBe('SMART_ANIMATE');expect(motion.targetNodeId).toBe('164:6118');expect(motion.durationMs).toBe(600.0000238418579);expect(motion.easingFunction).toEqual([0.41999998688697815,0,1,1]);}
});
