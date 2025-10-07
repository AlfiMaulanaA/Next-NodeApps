
"use client";

import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import BasicOSMMap from '@/components/basic-osm-map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RotateCcw, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

// 3D Model Component
function Model3D({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const meshRef = useRef<any>();

  // Auto-rotate animation
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <primitive
      ref={meshRef}
      object={gltf.scene}
      scale={[2, 2, 2]}
      position={[0, -1, 0]}
    />
  );
}

// Loading fallback for 3D model
function ModelFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading 3D Model...</p>
      </div>
    </Html>
  );
}

function TestPage() {
  const [autoRotate, setAutoRotate] = useState(true);
  const [modelScale, setModelScale] = useState(2);
  const controlsRef = useRef<any>();

  // Jakarta coordinates with some test locations
  const testMarkers = [
    {
      id: "monas",
      position: [-6.1751, 106.8650] as [number, number],
      title: "Monas",
      description: "Monumen Nasional Jakarta"
    },
    {
      id: "bundaran-hi",
      position: [-6.1929, 106.8230] as [number, number],
      title: "Bundaran HI",
      description: "Hotel Indonesia Roundabout"
    },
    {
      id: "kota-tua",
      position: [-6.1352, 106.8133] as [number, number],
      title: "Kota Tua",
      description: "Jakarta Old Town"
    }
  ];

  // 3D Viewer Controls
  const handleZoomIn = () => {
    if (controlsRef.current) {
      controlsRef.current.dollyIn(1.2);
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      controlsRef.current.dollyOut(1.2);
    }
  };

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Test Page - 3D Model Viewer & Jakarta Map
            <Badge variant="secondary">3D + Map Integration</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="3d" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="3d">3D Model Viewer</TabsTrigger>
              <TabsTrigger value="map">Jakarta Map</TabsTrigger>
            </TabsList>

            <TabsContent value="3d" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">3D Model: 3D.glb</Badge>
                  <Badge variant="outline">Three.js + React Three Fiber</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <Canvas
                  camera={{ position: [0, 0, 5], fov: 50 }}
                  style={{ background: 'transparent' }}
                >
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[10, 10, 5]} intensity={1} />
                  <pointLight position={[-10, -10, -5]} intensity={0.5} />

                  <Suspense fallback={<ModelFallback />}>
                    <Model3D url="/files/3D.glb" />
                    <ContactShadows position={[0, -2, 0]} opacity={0.4} />
                  </Suspense>

                  <OrbitControls
                    ref={controlsRef}
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    autoRotate={autoRotate}
                    autoRotateSpeed={0.5}
                  />

                  <Environment preset="city" />
                </Canvas>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <h4 className="font-medium mb-1">Interactive Controls</h4>
                  <p className="text-sm text-muted-foreground">
                    • Left click + drag: Rotate<br/>
                    • Right click + drag: Pan<br/>
                    • Scroll: Zoom in/out
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-medium mb-1">3D Features</h4>
                  <p className="text-sm text-muted-foreground">
                    • Auto-rotation enabled<br/>
                    • Realistic lighting<br/>
                    • Contact shadows<br/>
                    • Environment mapping
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-medium mb-1">Model Info</h4>
                  <p className="text-sm text-muted-foreground">
                    • Format: GLB (Binary glTF)<br/>
                    • Scale: {modelScale}x<br/>
                    • Position: Centered<br/>
                    • Animation: Auto-rotate
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="map" className="space-y-4">
              <BasicOSMMap
                center={[-6.2088, 106.8456]}
                zoom={11}
                height="500px"
                markers={testMarkers}
              />

              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Map Information</h3>
                <p className="text-sm text-gray-600">
                  This map displays Jakarta area with some landmarks marked.
                  Click on the markers to see more details about each location.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {testMarkers.map((marker) => (
                    <div key={marker.id} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                      <h4 className="font-medium">{marker.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{marker.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Lat: {marker.position[0]}, Lng: {marker.position[1]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default TestPage;
