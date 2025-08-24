"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Define Leaflet as external
let L: any = null;

interface GeofenceArea {
  id: string;
  name: string;
  description: string;
  coordinates: Array<{lat: number; lng: number}>;
  radius?: number;
  type: "polygon" | "circle";
  center?: {lat: number; lng: number};
}

interface GeofenceMapProps {
  onAreaCreated: (area: GeofenceArea) => void;
  currentArea: GeofenceArea;
  existingAreas: GeofenceArea[];
}

export default function GeofenceMap({ onAreaCreated, currentArea, existingAreas }: GeofenceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [drawingMode, setDrawingMode] = useState<"polygon" | "circle" | null>(null);
  const [currentDraw, setCurrentDraw] = useState<any>(null);
  const drawnItemsRef = useRef<any>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !L) {
        try {
          // Import Leaflet CSS
          const leafletCSS = document.createElement("link");
          leafletCSS.rel = "stylesheet";
          leafletCSS.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          leafletCSS.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
          leafletCSS.crossOrigin = "";
          document.head.appendChild(leafletCSS);

          // Import Leaflet JS - proper dynamic import
          const leafletModule = await import("leaflet");
          L = leafletModule.default;

          // Fix default markers issue
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
            iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          });

          console.log("Leaflet loaded successfully");
          setLeaflet(L);
        } catch (error) {
          console.error("Failed to load Leaflet:", error);
          toast.error("Failed to load map library");
        }
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (leaflet && mapRef.current && !mapInstance) {
      try {
        console.log("Initializing map...");
        
        // Initialize map with Jakarta coordinates
        const newMap = leaflet.map(mapRef.current, {
          center: [-6.2088, 106.8456],
          zoom: 13,
          zoomControl: true,
          attributionControl: true
        });

        // Add OpenStreetMap tiles with error handling
        const tileLayer = leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
          errorTileUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        });

        tileLayer.on('tileerror', (error: any) => {
          console.warn('Tile loading error:', error);
        });

        tileLayer.addTo(newMap);

        // Create a layer group for drawn items
        const drawnItems = new leaflet.FeatureGroup();
        newMap.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;

        // Add a default marker for reference
        leaflet.marker([-6.2088, 106.8456])
          .addTo(newMap)
          .bindPopup("Jakarta Center<br/>Drag map to explore")
          .openPopup();

        setMapInstance(newMap);
        console.log("Map initialized successfully");

        // Cleanup function
        return () => {
          console.log("Cleaning up map...");
          if (newMap) {
            newMap.off();
            newMap.remove();
          }
        };
      } catch (error) {
        console.error("Error initializing map:", error);
        toast.error("Failed to initialize map");
      }
    }
  }, [leaflet, mapInstance]);

  // Load existing areas on map
  useEffect(() => {
    if (mapInstance && drawnItemsRef.current && existingAreas.length > 0) {
      // Clear existing layers
      drawnItemsRef.current.clearLayers();

      existingAreas.forEach((area) => {
        if (area.type === "polygon" && area.coordinates.length > 0) {
          const polygon = leaflet.polygon(
            area.coordinates.map(coord => [coord.lat, coord.lng]),
            {
              color: '#3388ff',
              fillColor: '#3388ff',
              fillOpacity: 0.2,
              weight: 2
            }
          );
          polygon.bindPopup(`<strong>${area.name}</strong><br/>${area.description}`);
          drawnItemsRef.current.addLayer(polygon);
        } else if (area.type === "circle" && area.center && area.radius) {
          const circle = leaflet.circle([area.center.lat, area.center.lng], {
            radius: area.radius,
            color: '#ff3388',
            fillColor: '#ff3388',
            fillOpacity: 0.2,
            weight: 2
          });
          circle.bindPopup(`<strong>${area.name}</strong><br/>${area.description}`);
          drawnItemsRef.current.addLayer(circle);
        }
      });
    }
  }, [mapInstance, existingAreas, leaflet]);

  // Drawing handlers
  const startDrawing = (type: "polygon" | "circle") => {
    if (!mapInstance || !leaflet) return;

    setDrawingMode(type);

    if (type === "polygon") {
      mapInstance.on('click', handlePolygonClick);
      toast.info("Click on the map to start drawing a polygon. Double-click to finish.");
    } else if (type === "circle") {
      mapInstance.on('click', handleCircleClick);
      toast.info("Click on the map to set circle center, then drag to set radius.");
    }
  };

  const handlePolygonClick = (e: any) => {
    if (!leaflet || drawingMode !== "polygon") return;

    if (!currentDraw) {
      // Start new polygon
      const polygon = leaflet.polygon([[e.latlng.lat, e.latlng.lng]], {
        color: '#ff7800',
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0.3
      }).addTo(mapInstance);
      
      setCurrentDraw(polygon);
    } else {
      // Add point to existing polygon
      const coords = currentDraw.getLatLngs()[0];
      coords.push(e.latlng);
      currentDraw.setLatLngs(coords);
    }
  };

  const handleCircleClick = (e: any) => {
    if (!leaflet || drawingMode !== "circle") return;

    const circle = leaflet.circle([e.latlng.lat, e.latlng.lng], {
      radius: 100, // Default radius in meters
      color: '#ff7800',
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0.3
    }).addTo(mapInstance);

    setCurrentDraw(circle);
    
    // Enable dragging to adjust radius
    let isDragging = false;
    mapInstance.on('mousedown', () => { isDragging = false; });
    mapInstance.on('mousemove', (moveEvent: any) => {
      if (isDragging && circle) {
        const distance = e.latlng.distanceTo(moveEvent.latlng);
        circle.setRadius(distance);
      }
    });
    mapInstance.on('mouseup', () => { isDragging = false; });
  };

  const finishDrawing = () => {
    if (!currentDraw || !currentArea.name.trim()) {
      toast.error("Please enter an area name before saving.");
      return;
    }

    let areaData: GeofenceArea;

    if (drawingMode === "polygon") {
      const coords = currentDraw.getLatLngs()[0];
      if (coords.length < 3) {
        toast.error("Polygon must have at least 3 points.");
        return;
      }

      areaData = {
        ...currentArea,
        coordinates: coords.map((coord: any) => ({
          lat: coord.lat,
          lng: coord.lng
        })),
        type: "polygon"
      };
    } else if (drawingMode === "circle") {
      const center = currentDraw.getLatLng();
      const radius = currentDraw.getRadius();

      areaData = {
        ...currentArea,
        center: {
          lat: center.lat,
          lng: center.lng
        },
        radius: radius,
        coordinates: [], // Not used for circles
        type: "circle"
      };
    } else {
      return;
    }

    // Add to drawn items layer
    if (drawnItemsRef.current) {
      drawnItemsRef.current.addLayer(currentDraw);
    }

    // Callback to parent
    onAreaCreated(areaData);

    // Reset drawing state
    cancelDrawing();
  };

  const cancelDrawing = () => {
    if (currentDraw && mapInstance) {
      mapInstance.removeLayer(currentDraw);
    }
    
    if (mapInstance) {
      mapInstance.off('click');
      mapInstance.off('mousedown');
      mapInstance.off('mousemove');
      mapInstance.off('mouseup');
    }
    
    setCurrentDraw(null);
    setDrawingMode(null);
    toast.info("Drawing cancelled.");
  };

  const clearAll = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    if (currentDraw && mapInstance) {
      mapInstance.removeLayer(currentDraw);
    }
    setCurrentDraw(null);
    setDrawingMode(null);
    toast.info("All areas cleared.");
  };

  if (!leaflet) {
    return (
      <div className="h-full bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading Map...</p>
          <p className="text-xs text-muted-foreground mt-1">Initializing OpenStreetMap</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Map Controls */}
      <div className="flex gap-2 p-2 bg-muted rounded-t-lg">
        <Button
          size="sm"
          variant={drawingMode === "polygon" ? "default" : "outline"}
          onClick={() => startDrawing("polygon")}
          disabled={drawingMode === "circle"}
        >
          Draw Polygon
        </Button>
        <Button
          size="sm"
          variant={drawingMode === "circle" ? "default" : "outline"}
          onClick={() => startDrawing("circle")}
          disabled={drawingMode === "polygon"}
        >
          Draw Circle
        </Button>
        {currentDraw && (
          <>
            <Button size="sm" variant="default" onClick={finishDrawing}>
              Finish Drawing
            </Button>
            <Button size="sm" variant="destructive" onClick={cancelDrawing}>
              Cancel
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      {/* Map Container */}
      <div ref={mapRef} className="flex-1 rounded-b-lg" />

      {/* Instructions */}
      <div className="p-2 bg-muted/50 rounded-b-lg text-xs text-muted-foreground">
        {drawingMode === "polygon" && "Click to add points, double-click to finish polygon"}
        {drawingMode === "circle" && "Click to set center, drag to adjust radius"}
        {!drawingMode && "Select a drawing tool to create a geofence area"}
      </div>
    </div>
  );
}