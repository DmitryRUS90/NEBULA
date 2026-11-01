import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { PortalGraphics } from './PortalGraphics';
import { useFit, useIsPortrait } from '../../core/hooks';
import { fx } from '../../core/fx';

export function PortalScene() {
  const fit = useFit();
  const portrait = useIsPortrait();
  const lift = useRef<Group>(null);

  useEffect(() => {
    fx.baseFov = 50;
  }, []);

  useFrame((state) => {
    // dolly toward the portal while it opens, and settle the lifted portal back to the centre
    const d = fx.dolly;
    const z = 9.5 * fit * (1 - d) + 0.9 * d;
    state.camera.position.set(0, 0, z);
    state.camera.lookAt(0, 0, 0);
    // the portal sits above the title block until it opens
    if (lift.current) lift.current.position.y = (portrait ? 1.7 : 1.3) * (1 - d);
  });

  return (
    <group ref={lift}>
      <PortalGraphics scale={portrait ? 0.7 : 0.72} />
    </group>
  );
}
