"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
export default function Classroom({ active = 3 }: { active?: number }) {
  return (
    <Canvas camera={{ position: [8, 8, 10], fov: 38 }} dpr={[1, 1.5]}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 8, 4]} intensity={2} />
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[8, 0.35, 6]} />
        <meshStandardMaterial color="#eedfc4" />
      </mesh>
      <mesh position={[0, 1, -2.8]}>
        <boxGeometry args={[7, 2.7, 0.15]} />
        <meshStandardMaterial color="#dbebd7" />
      </mesh>
      <mesh position={[0, 1.3, -2.65]}>
        <boxGeometry args={[3.1, 1.35, 0.12]} />
        <meshStandardMaterial color="#174b3d" />
      </mesh>
      {[2, 3, 4].map((g, i) => (
        <group key={g} position={[(i - 1) * 2.3, 0, 0.3]}>
          <GradeLabel grade={g} />
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[1, 1, 0.05, 32]} />
            <meshStandardMaterial
              color={active === g ? "#b5ee86" : "#d9e3d2"}
            />
          </mesh>
          {[-0.45, 0.45].map((x, j) => (
            <group key={j} position={[x, 0, 0]}>
              <mesh position={[0, 0.65, 0]}>
                <boxGeometry args={[0.7, 0.1, 0.6]} />
                <meshStandardMaterial color="#bd855c" />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[0.08, 0.65, 0.08]} />
                <meshStandardMaterial color="#735f48" />
              </mesh>
              <mesh position={[0, 1, 0.6]}>
                <sphereGeometry args={[0.18, 12, 12]} />
                <meshStandardMaterial color="#c58b67" />
              </mesh>
              <mesh position={[0, 0.67, 0.6]}>
                <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
                <meshStandardMaterial
                  color={["#e1b85e", "#86acaa", "#b19cc3"][i]}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[(active - 3) * 2.3, 1.1, -1.15]}>
        <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
        <meshStandardMaterial color="#17765a" />
      </mesh>
      <mesh position={[(active - 3) * 2.3, 1.7, -1.15]}>
        <sphereGeometry args={[0.23, 12, 12]} />
        <meshStandardMaterial color="#b97e58" />
      </mesh>
      <ContactShadows
        position={[0, -0.45, 0]}
        opacity={0.25}
        scale={14}
        blur={2}
      />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.4}
        maxPolarAngle={1.3}
      />
    </Canvas>
  );
}

// Keep labels inside the Three.js scene: DOM overlays create nested React roots.
function GradeLabel({ grade }: { grade: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Classroom labels need a 2D canvas.");
    context.font = "32px Arial";
    context.fillStyle = "#164636";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`Class ${grade}`, 128, 32);
    const label = new CanvasTexture(canvas);
    label.colorSpace = SRGBColorSpace;
    return label;
  }, [grade]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, 2.1, 0]} scale={[2, 0.5, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
