"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Plus, Minus } from "lucide-react";

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">Loading Map...</div>
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then(mod => mod.Polygon), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });

interface GeofenceArea {
  id: string;
  name: string;
  description: string;
  coordinates: Array<{lat: number; lng: number}>;
  radius?: number;
  type: "polygon" | "circle";
  center?: {lat: number; lng: number};
}

interface SimpleGeofenceMapProps {
  onAreaCreated: (area: GeofenceArea) => void;
  currentArea: GeofenceArea;
  existingAreas: GeofenceArea[];
}

export default function SimpleGeofenceMap({ onAreaCreated, currentArea, existingAreas }: SimpleGeofenceMapProps) {
  const [areaType, setAreaType] = useState<"polygon" | "circle">(currentArea.type || "polygon");
  const [coordinates, setCoordinates] = useState(currentArea.coordinates || [
    {lat: -6.2088, lng: 106.8456},
    {lat: -6.2100, lng: 106.8470},
    {lat: -6.2076, lng: 106.8480}
  ]);
  const [center, setCenter] = useState(currentArea.center || {lat: -6.2088, lng: 106.8456});
  const [radius, setRadius] = useState(currentArea.radius || 100);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Fix leaflet icon issue
    import('@/lib/fix-leaflet-icon');
  }, []);

  const addCoordinate = () => {
    setCoordinates([...coordinates, {lat: 0, lng: 0}]);
  };

  const removeCoordinate = (index: number) => {
    if (coordinates.length > 1) {
      setCoordinates(coordinates.filter((_, i) => i !== index));
    }
  };

  const updateCoordinate = (index: number, field: 'lat' | 'lng', value: string) => {
    const newCoords = [...coordinates];
    newCoords[index][field] = parseFloat(value) || 0;
    setCoordinates(newCoords);
  };

  const updateCenter = (field: 'lat' | 'lng', value: string) => {
    setCenter(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  // Handle marker drag for polygon points
  const handleMarkerDrag = (index: number, event: any) => {
    const { lat, lng } = event.target.getLatLng();
    const newCoords = [...coordinates];
    newCoords[index] = { lat, lng };
    setCoordinates(newCoords);
  };

  // Handle center marker drag for circle
  const handleCenterDrag = (event: any) => {
    const { lat, lng } = event.target.getLatLng();
    setCenter({ lat, lng });
  };

  // Add new polygon point by clicking on map
  const handleMapClick = (event: any) => {
    if (areaType === "polygon" && !isDragging) {
      const { lat, lng } = event.latlng;
      setCoordinates(prev => [...prev, { lat, lng }]);
      toast.info("Point added! Drag markers to adjust position.");
    }
  };

  // Reset to default coordinates
  const resetCoordinates = () => {
    if (areaType === "polygon") {
      setCoordinates([
        {lat: -6.2088, lng: 106.8456},
        {lat: -6.2100, lng: 106.8470},
        {lat: -6.2076, lng: 106.8480}
      ]);
    } else {
      setCenter({lat: -6.2088, lng: 106.8456});
    }
    toast.success("Reset to default coordinates");
  };

  const saveArea = () => {
    if (!currentArea.name.trim()) {
      toast.error("Please enter an area name");
      return;
    }

    let areaData: GeofenceArea;

    if (areaType === "circle") {
      areaData = {
        ...currentArea,
        type: "circle",
        center: center,
        radius: radius,
        coordinates: []
      };
    } else {
      if (coordinates.length < 3) {
        toast.error("Polygon must have at least 3 points");
        return;
      }
      
      areaData = {
        ...currentArea,
        type: "polygon",
        coordinates: coordinates,
        center: undefined,
        radius: undefined
      };
    }

    onAreaCreated(areaData);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Interactive Map */}
      <div className="flex-1 min-h-[400px] border rounded-lg overflow-hidden">
        {isClient ? (
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            onClick={handleMapClick}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Current area preview */}
            {areaType === "circle" ? (
              <>
                <Circle
                  center={[center.lat, center.lng]}
                  radius={radius}
                  pathOptions={{ 
                    color: 'red', 
                    fillColor: 'red', 
                    fillOpacity: 0.2,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div>
                      <strong>New Circle Geofence</strong><br/>
                      Center: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}<br/>
                      Radius: {radius}m<br/>
                      <em>Drag the marker to move center</em>
                    </div>
                  </Popup>
                </Circle>
                {/* Draggable center marker for circle */}
                <Marker
                  position={[center.lat, center.lng]}
                  draggable={true}
                  eventHandlers={{
                    dragstart: () => setIsDragging(true),
                    dragend: (e) => {
                      setIsDragging(false);
                      handleCenterDrag(e);
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <strong>Circle Center</strong><br/>
                      Drag to move center<br/>
                      {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              </>
            ) : coordinates.length > 0 ? (
              <>
                {/* Show polygon if we have enough points */}
                {coordinates.length > 2 && (
                  <Polygon
                    positions={coordinates.map(coord => [coord.lat, coord.lng])}
                    pathOptions={{ 
                      color: 'red', 
                      fillColor: 'red', 
                      fillOpacity: 0.2,
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>New Polygon Geofence</strong><br/>
                        Points: {coordinates.length}<br/>
                        <em>Drag markers to adjust shape</em>
                      </div>
                    </Popup>
                  </Polygon>
                )}
                
                {/* Draggable markers for polygon points */}
                {coordinates.map((coord, index) => (
                  <Marker
                    key={index}
                    position={[coord.lat, coord.lng]}
                    draggable={true}
                    eventHandlers={{
                      dragstart: () => setIsDragging(true),
                      dragend: (e) => {
                        setIsDragging(false);
                        handleMarkerDrag(index, e);
                      }
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>Point {index + 1}</strong><br/>
                        Drag to reposition<br/>
                        {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}<br/>
                        <button 
                          onClick={() => removeCoordinate(index)}
                          style={{ 
                            background: 'red', 
                            color: 'white', 
                            border: 'none', 
                            padding: '2px 6px', 
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '10px'
                          }}
                        >
                          Remove Point
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            ) : null}

            {/* Existing areas */}
            {existingAreas.map((area) => (
              area.type === "circle" && area.center ? (
                <Circle
                  key={area.id}
                  center={[area.center.lat, area.center.lng]}
                  radius={area.radius || 100}
                  pathOptions={{ 
                    color: 'blue', 
                    fillColor: 'blue', 
                    fillOpacity: 0.1,
                    weight: 1
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{area.name}</strong><br/>
                      {area.description}<br/>
                      Radius: {area.radius}m
                    </div>
                  </Popup>
                </Circle>
              ) : area.type === "polygon" && area.coordinates.length > 2 ? (
                <Polygon
                  key={area.id}
                  positions={area.coordinates.map(coord => [coord.lat, coord.lng])}
                  pathOptions={{ 
                    color: 'blue', 
                    fillColor: 'blue', 
                    fillOpacity: 0.1,
                    weight: 1
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{area.name}</strong><br/>
                      {area.description}<br/>
                      Points: {area.coordinates.length}
                    </div>
                  </Popup>
                </Polygon>
              ) : null
            ))}

            {/* Center marker */}
            <Marker position={[center.lat, center.lng]}>
              <Popup>
                <div>
                  <strong>Map Center</strong><br/>
                  {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <div className="text-gray-500">Loading Interactive Map...</div>
          </div>
        )}
      </div>

      {/* Area Configuration */}
      <div className="flex-shrink-0 space-y-4 max-h-96 overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Area Type</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetCoordinates}
            >
              Reset Position
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={areaType === "polygon" ? "default" : "outline"}
              size="sm"
              onClick={() => setAreaType("polygon")}
            >
              Polygon
            </Button>
            <Button
              type="button"
              variant={areaType === "circle" ? "default" : "outline"}
              size="sm"
              onClick={() => setAreaType("circle")}
            >
              Circle
            </Button>
          </div>
          
          {/* Interactive Instructions */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">📍 Interactive Map Instructions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {areaType === "polygon" ? (
                <>
                  <li>• <strong>Click</strong> on map to add new points</li>
                  <li>• <strong>Drag</strong> markers to reposition points</li>
                  <li>• <strong>Click</strong> marker popup to remove points</li>
                  <li>• Need at least 3 points for polygon</li>
                </>
              ) : (
                <>
                  <li>• <strong>Drag</strong> the center marker to move circle</li>
                  <li>• Adjust <strong>radius</strong> using input below</li>
                  <li>• Circle will update in real-time</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {areaType === "polygon" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Polygon Coordinates (Live Update)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCoordinate}>
                <Plus className="h-4 w-4 mr-1" />
                Add Point
              </Button>
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2">
              {coordinates.map((coord, index) => (
                <div key={index} className={`flex items-center gap-2 p-2 border rounded transition-colors ${isDragging ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
                  <span className="text-sm font-medium w-8 text-blue-600">#{index + 1}</span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={coord.lat.toFixed(6)}
                        onChange={(e) => updateCoordinate(index, 'lat', e.target.value)}
                        placeholder="Latitude"
                        className="text-xs"
                        readOnly={isDragging}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={coord.lng.toFixed(6)}
                        onChange={(e) => updateCoordinate(index, 'lng', e.target.value)}
                        placeholder="Longitude"
                        className="text-xs"
                        readOnly={isDragging}
                      />
                    </div>
                  </div>
                  {coordinates.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeCoordinate(index)}
                      disabled={isDragging}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✨ <strong>Interactive Mode:</strong> Coordinates update automatically when you drag markers</p>
              <p>🎯 Click on map to add points, drag markers to adjust position</p>
              {isDragging && <p className="text-blue-600 font-medium">🔄 Currently dragging marker...</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Circle Configuration (Live Update)</Label>
            
            <div className={`grid grid-cols-2 gap-4 p-3 border rounded transition-colors ${isDragging ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
              <div>
                <Label className="text-xs">Center Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={center.lat.toFixed(6)}
                  onChange={(e) => updateCenter('lat', e.target.value)}
                  placeholder="Center Latitude"
                  readOnly={isDragging}
                />
              </div>
              <div>
                <Label className="text-xs">Center Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={center.lng.toFixed(6)}
                  onChange={(e) => updateCenter('lng', e.target.value)}
                  placeholder="Center Longitude"
                  readOnly={isDragging}
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Radius (meters)</Label>
              <Input
                type="number"
                min="1"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value) || 100)}
                placeholder="Radius in meters"
                className="font-medium"
              />
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✨ <strong>Interactive Mode:</strong> Center coordinates update when you drag the marker</p>
              <p>🎯 Drag the center marker to move circle, adjust radius with input</p>
              {isDragging && <p className="text-blue-600 font-medium">🔄 Currently dragging center marker...</p>}
            </div>
          </div>
        )}

        {/* Existing Areas Display */}
        {existingAreas.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">Existing Geofence Areas</Label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {existingAreas.map((area, index) => (
                <div key={area.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                  <span className="font-medium">{area.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {area.type === "circle" 
                      ? `Circle (R: ${area.radius}m)` 
                      : `Polygon (${area.coordinates.length} points)`
                    }
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Button */}
        <div className="pt-4 border-t">
          <Button onClick={saveArea} className="w-full">
            Create Geofence Area
          </Button>
        </div>
      </div>
    </div>
  );
}