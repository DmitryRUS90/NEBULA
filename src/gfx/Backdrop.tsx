import { useMemo } from 'react';
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
  type WebGLRenderer,
} from 'three';
import { NOISE } from './glsl';
import { fx } from '../core/fx';
import { TIERS } from '../core/perf';
import { useStore } from '../core/store';

/**
 * The nebula is baked once into a cube map: three density layers in R, G and B.
 * At runtime the backdrop is one texture read, tinted by the current scene, so it costs almost nothing per frame.
 */
function bake(gl: WebGLRenderer, size: number, octaves: number) {
  const rt = new WebGLCubeRenderTarget(size, { generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const scene = new Scene();
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
  scene.add(new Mesh(new BoxGeometry(10, 10, 10), mat));
  const cam = new CubeCamera(0.1, 100, rt);
  cam.update(gl, scene);
  mat.dispose();
  return rt;
}

export function Backdrop() {
  const gl = useThree((s) => s.gl);
  const tier = useStore((s) => s.tier);
  // baked once per tier change at the first mount size; later tier drops only reduce runtime cost elsewhere
  const rt = useMemo(() => {
    const cfg = TIERS[tier];
    return bake(gl, cfg.nebulaSize, tier === 'lite' ? 3 : 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  const uniforms = useMemo(
    () => ({
      uTex: { value: rt.texture },
      uInvProj: { value: new Matrix4() },
      uCamWorld: { value: new Matrix4() },
      uA: { value: new Vector3() },
      uB: { value: new Vector3() },
      uC: { value: new Vector3() },
      uTime: { value: 0 },
      uWarp: { value: 0 },
    }),
    [rt],
  );

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
