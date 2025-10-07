
"use client";

import React from 'react';
import BasicOSMMap from '@/components/basic-osm-map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function TestPage() {
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

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Page - Jakarta Map</CardTitle>
        </CardHeader>
        <CardContent>
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
                <div key={marker.id} className="p-3 border rounded-lg bg-gray-50">
                  <h4 className="font-medium">{marker.title}</h4>
                  <p className="text-sm text-gray-600">{marker.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Lat: {marker.position[0]}, Lng: {marker.position[1]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TestPage;
