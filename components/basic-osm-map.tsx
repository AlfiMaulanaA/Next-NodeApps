"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">Loading Map...</div>
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

interface BasicOSMMapProps {
  height?: string;
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    id: string;
    position: [number, number];
    title: string;
    description?: string;
  }>;
}

export default function BasicOSMMap({ 
  height = "400px",
  center = [-6.2088, 106.8456], // Jakarta coordinates
  zoom = 10,
  markers = []
}: BasicOSMMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Fix leaflet icon issue
    import('@/lib/fix-leaflet-icon');
  }, []);

  if (!isClient) {
    return (
      <div 
        className="w-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-gray-500">Loading Map...</div>
      </div>
    );
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden shadow-sm">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height }}
        className="w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Markers */}
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position}>
            <Popup>
              <div className="text-sm">
                <h3 className="font-semibold">{marker.title}</h3>
                {marker.description && <p>{marker.description}</p>}
                <p className="text-xs text-gray-500">
                  Lat: {marker.position[0]}, Lng: {marker.position[1]}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}