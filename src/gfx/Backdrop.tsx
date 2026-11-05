import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  BoxGeometry,
  CubeCamera,
  LinearFilter,
  Matrix4,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLCubeRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { NOISE } from './glsl';
import { fx } from '../core/fx';
import { TIERS, type Tier } from '../core/perf';
import { useStore } from '../core/store';

/** Higher is better. A nebula is only baked again when the tier goes up. */
const TIER_RANK: Record<Tier, number> = { lite: 0, balanced: 1, high: 2 };

/**
 * The nebula is baked once into a cube map: three density layers in R, G and B.
 * At runtime the backdrop is one texture read, tinted by the current scene, so it costs almost nothing per frame.
 */
function bake(gl: WebGLRenderer, size: number, octaves: number) {
  const rt = new WebGLCubeRenderTarget(size, { generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const scene = new Scene();
  const geo = new BoxGeometry(10, 10, 10);
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    defines: { OCT: octaves },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir);
        // galactic band across the sky
        float band = exp(-pow(d.y * 2.1 + d.x * 0.35 - 0.1, 2.0));
        float a = fbm(d * 1.5 + vec3(3.0, 1.0, 7.0));
        a = smoothstep(-0.25, 0.75, a) * (0.35 + 0.9 * band);
        float rid = 1.0 - abs(snoise(d * 3.1 + vec3(11.0, 2.0, 5.0)) + 0.55 * snoise(d * 6.2));
        float b = pow(clamp(rid, 0.0, 1.0), 3.0) * (0.25 + 1.1 * band) * smoothstep(-0.4, 0.6, a * 1.2 - 0.1);
        float c = smoothstep(0.1, 0.9, 0.5 + 0.5 * fbm(d * 7.5 + vec3(21.0, 4.0, 9.0))) * (0.25 + 0.9 * band);
        gl_FragColor = vec4(clamp(vec3(a, b, c), 0.0, 1.0), 1.0);
      }
    `,
  });
  // CubeCamera.update() switches the renderer to the cube and puts things back only when it reaches its last line.
  // Remember what was active so a failure in the middle cannot leave the renderer pointed at a target we are about to release.
  const prevTarget = gl.getRenderTarget();
  const prevFace = gl.getActiveCubeFace();
  const prevMipmapLevel = gl.getActiveMipmapLevel();
  const prevXr = gl.xr.enabled;
  let baked = false;
  try {
    scene.add(new Mesh(geo, mat));
    new CubeCamera(0.1, 100, rt).update(gl, scene);
    baked = true;
    return rt;
  } finally {
    if (!baked) {
      // back to what was active before, and only then is the half built cube released
      gl.setRenderTarget(prevTarget, prevFace, prevMipmapLevel);
      gl.xr.enabled = prevXr;
      rt.dispose();
    }
    // the temporary pieces are only needed while the cube is drawn
    geo.dispose();
    mat.dispose();
  }
}

export function Backdrop() {
  const gl = useThree((s) => s.gl);

  // One uniforms object for the whole life of the material: three.js keeps using the object it saw on the first draw,
  // so a new texture is always written into uTex.value, never swapped in with a new object.
  const uniforms = useMemo(
    () => ({
      uTex: { value: null as Texture | null },
      uInvProj: { value: new Matrix4() },
      uCamWorld: { value: new Matrix4() },
      uA: { value: new Vector3() },
      uB: { value: new Vector3() },
      uC: { value: new Vector3() },
      uTime: { value: 0 },
      uWarp: { value: 0 },
    }),
    [],
  );

  // The cube map is created here, not while rendering, so it can be released again.
  // It is baked for the current tier, and again only when the tier goes up. A lower tier keeps the finer nebula,
  // because one texture read costs the same at any size.
  useLayoutEffect(() => {
    let rt: WebGLCubeRenderTarget | null = null;
    let bakedTier: Tier | null = null;
    // A lost context takes the GPU side of the cube with it. After that, dispose() would only talk to handles
    // that no longer exist, so a stale target is simply dropped. It stays stale until a new cube is baked.
    let stale = false;
    let seenTier = useStore.getState().tier;
    let seenScene = useStore.getState().scene;

    const bakeFor = (tier: Tier) => {
      const next = bake(gl, TIERS[tier].nebulaSize, tier === 'lite' ? 3 : 5);
      // the new texture goes live first, then the previous target is released
      uniforms.uTex.value = next.texture;
      if (!stale) rt?.dispose();
      rt = next;
      stale = false;
      bakedTier = tier;
    };

    // Never below what was already reached, so a lower tier chosen later does not make the restored nebula coarser.
    const rebake = () => {
      const current = useStore.getState().tier;
      try {
        bakeFor(bakedTier !== null && TIER_RANK[bakedTier] > TIER_RANK[current] ? bakedTier : current);
      } catch (error) {
        console.warn(
          stale
            ? 'NEBULA: the nebula could not be restored after the graphics context came back. It is tried again when the scene or quality changes.'
            : 'NEBULA: the nebula could not be baked again, the previous one stays.',
          error,
        );
      }
    };

    const onContextLost = () => {
      stale = true;
      // nothing may sample the old cube; until a new one is baked the shader reads an empty one
      uniforms.uTex.value = null;
    };
    // three.js listens first and has rebuilt its own state by the time this runs, so the renderer can draw again.
    // `stale` makes sure one restore means one bake.
    const onContextRestored = () => {
      if (stale) rebake();
    };
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    bakeFor(useStore.getState().tier);

    const unsubscribe = useStore.subscribe((state) => {
      // only a change of tier or scene is a reason to look again
      if (state.tier === seenTier && state.scene === seenScene) return;
      seenTier = state.tier;
      seenScene = state.scene;
      if (gl.getContext().isContextLost()) return;
      // a restore that failed is retried here, an upgrade bakes finer, a downgrade changes nothing
      if (stale || (bakedTier !== null && TIER_RANK[state.tier] > TIER_RANK[bakedTier])) rebake();
    });

    return () => {
      unsubscribe();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      uniforms.uTex.value = null;
      if (!stale) rt?.dispose();
      rt = null;
    };
  }, [gl, uniforms]);

  useFrame((state, dt) => {
    const cam = state.camera;
    cam.updateMatrixWorld();
    uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    uniforms.uCamWorld.value.copy(cam.matrixWorld);
    uniforms.uA.value.copy(fx.tintA);
    uniforms.uB.value.copy(fx.tintB);
    uniforms.uC.value.copy(fx.tintC);
    uniforms.uTime.value += dt;
    uniforms.uWarp.value = fx.warp;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        vertexShader={/* glsl */ `
          uniform mat4 uInvProj;
          uniform mat4 uCamWorld;
          varying vec3 vDir;
          void main(){
            vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);
            vDir = mat3(uCamWorld) * normalize(v.xyz / v.w);
            gl_Position = vec4(position.xy, 0.9999, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform samplerCube uTex;
          uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
          uniform float uTime; uniform float uWarp;
          varying vec3 vDir;
          float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          void main(){
            vec3 d = normalize(vDir);
            vec3 t = textureCube(uTex, d).rgb;
            vec3 base = vec3(0.027, 0.043, 0.094);
            float breathe = 0.92 + 0.08 * sin(uTime * 0.25 + t.r * 6.0);
            vec3 col = base;
            col += uA * pow(t.r, 1.5) * 1.25 * breathe;
            col += uB * pow(t.g, 2.0) * 1.05;
            col += uC * pow(t.b, 3.0) * 0.8 * (0.4 + 0.6 * t.r);
            col *= 1.0 - uWarp * 0.35;
            col += (h12(gl_FragCoord.xy + uTime) - 0.5) / 160.0;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
