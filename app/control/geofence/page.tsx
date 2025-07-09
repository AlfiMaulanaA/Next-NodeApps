"use client";
import { useState, useEffect, useRef } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightCircle, Settings, MapPin, Layers } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function GeoRoutePage() {
  const start = { lat: -6.3028, lng: 106.8061, name: "Stadion GBK" };
  const end = { lat: -6.1754, lng: 106.8272, name: "Monas" };
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const radius = 1000;
  const center = [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2] as [number, number];
  const mapRef = useRef<any>();
  const [modalOpen, setModalOpen] = useState(false);
  const [geoform, setGeoform] = useState({
    device_id: "d11f3075-4e6d-45a5-a3ba-86e0e6298034",
    unique_name: "Alfi Maulana - Dev",
    area_id: "Area 1",
    lat: end.lat,
    long: end.lng,
    config: [
      { device: "relay_1", pin: 1, address: 32, bus: 0, logic: false },
      { device: "relay_1", pin: 2, address: 32, bus: 0, logic: true },
      { device: "relay_2", pin: 1, address: 33, bus: 0, logic: true },
    ],
  });
  const { toast } = useToast();

  async function fetchRoute() {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const route = json.routes?.[0];
      setRoutePath(route.geometry.coordinates.map((c:[number,number]) => [c[1],c[0]]));
      setDistance(Math.round(route.distance));
      setDuration(Math.round(route.duration));
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to load route" });
    }
  }

  const formattedDistance = distance < 1000 ? `${distance} M` : `${(distance/1000).toFixed(2)} KM`;
  const formattedDuration = (() => {
    const h = Math.floor(duration/3600);
    const m = Math.floor((duration%3600)/60);
    const s = duration%60;
    if (h) return `${h}h ${m}m ${s}s`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  })();

  const focusCenter = () => {
    mapRef.current?.flyTo(center, 15);
  };

  const addGeoConfig = () => {
    setGeoform((prev) => ({
      ...prev,
      config: [
        ...prev.config,
        { device: "relay_1", pin: 1, address: 32, bus: 0, logic: false },
      ],
    }));
  };
  const removeGeoConfig = (idx: number) => {
    setGeoform((prev) => ({
      ...prev,
      config: prev.config.filter((_, i) => i !== idx),
    }));
  };
  const handleGeoformChange = (field: string, value: any) => {
    setGeoform((prev) => ({ ...prev, [field]: value }));
  };
  const handleConfigChange = (idx: number, field: string, value: any) => {
    setGeoform((prev) => ({
      ...prev,
      config: prev.config.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };
  const submitGeofenceConfig = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Geofence config saved!", description: JSON.stringify(geoform, null, 2) });
    setModalOpen(false);
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <MapPin className="w-5 h-5 " />
          <h1 className="text-lg font-semibold">Route & Geo‑Fence</h1>
        </div>
        <Button size="icon" variant="outline" onClick={() => fetchRoute()}>
          <Layers className="w-4 h-4" />
        </Button>
      </header>

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-md">
            <CardContent className="space-y-2 pt-4">
              <h6 className="text-primary font-bold">Route Info</h6>
              <p><strong>Distance:</strong> {formattedDistance}</p>
              <p><strong>Duration:</strong> {formattedDuration}</p>
              <p><strong>Radius Virtual Boundaries:</strong> {radius} m</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={focusCenter}>
                  Focus to Route Center
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" /> Config Geofencing Control
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="space-y-2 pt-4">
              <h6 className="text-success font-bold">Location Info</h6>
              <p><strong>Destination:</strong> {end.name}</p>
              <p><strong>Lat:</strong> {end.lat}</p>
              <p><strong>Long:</strong> {end.lng}</p>
              <hr className="my-2" />
              <p><strong>Current Location:</strong> {start.name}</p>
              <p><strong>Lat:</strong> {start.lat}</p>
              <p><strong>Long:</strong> {start.lng}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardContent className="pt-4">
            <h6 className="text-success font-bold mb-3">Geofencing Output Control</h6>
            <div className="grid md:grid-cols-2 gap-4 mb-2">
              <div><strong>Device ID:</strong> {geoform.device_id}</div>
              <div><strong>Unique Name:</strong> {geoform.unique_name}</div>
              <div><strong>Area ID:</strong> {geoform.area_id}</div>
              <div><strong>Latitude:</strong> {geoform.lat}</div>
              <div><strong>Longitude:</strong> {geoform.long}</div>
            </div>
            <h6 className="text-secondary font-bold mt-4 mb-2">Device Config</h6>
            <div className="overflow-x-auto">
              <table className="table-auto w-full text-sm border rounded">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Device</th>
                    <th className="px-2 py-1">Pin</th>
                    <th className="px-2 py-1">Address</th>
                    <th className="px-2 py-1">Bus</th>
                    <th className="px-2 py-1">Logic</th>
                  </tr>
                </thead>
                <tbody>
                  {geoform.config.map((c, i) => (
                    <tr key={i} className="even:bg-blue-50">
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{c.device}</td>
                      <td className="px-2 py-1">{c.pin}</td>
                      <td className="px-2 py-1">{c.address}</td>
                      <td className="px-2 py-1">{c.bus}</td>
                      <td className="px-2 py-1">{c.logic ? "true" : "false"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border shadow-sm overflow-hidden mt-3" style={{height:"500px", width:"100%"}}>
          <MapContainer ref={mapRef} center={center} zoom={12} style={{height:"100%", width:"100%"}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <Marker position={[start.lat, start.lng]}>
              <Popup>{start.name}</Popup>
            </Marker>
            <Marker position={[end.lat, end.lng]}>
              <Popup>{end.name}</Popup>
            </Marker>
            <Circle center={[end.lat, end.lng]} radius={radius} pathOptions={{color:"green", fillOpacity:0.3}}/>
            {routePath.length>0 && (
              <Polyline positions={routePath} pathOptions={{color:"#5bc0de", weight:4}} />
            )}
          </MapContainer>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={submitGeofenceConfig}>
              <DialogHeader>
                <DialogTitle>Geofencing Configuration</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium">Device ID</label>
                  <Input value={geoform.device_id} onChange={e => handleGeoformChange("device_id", e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Unique Name</label>
                  <Input value={geoform.unique_name} onChange={e => handleGeoformChange("unique_name", e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Area ID</label>
                  <Input value={geoform.area_id} onChange={e => handleGeoformChange("area_id", e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Latitude</label>
                  <Input value={geoform.lat} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium">Longitude</label>
                  <Input value={geoform.long} readOnly />
                </div>
              </div>
              <h6 className="mt-4 mb-2 font-bold">Device Config</h6>
              {geoform.config.map((conf, idx) => (
                <div key={idx} className="border rounded p-3 mb-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <div>
                    <label className="block text-xs">Device</label>
                    <select className="w-full border rounded px-2 py-1" value={conf.device} onChange={e => handleConfigChange(idx, "device", e.target.value)}>
                      <option value="relay_1">relay_1</option>
                      <option value="relay_2">relay_2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs">Pin</label>
                    <Input type="number" value={conf.pin} onChange={e => handleConfigChange(idx, "pin", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs">Address</label>
                    <Input type="number" value={conf.address} onChange={e => handleConfigChange(idx, "address", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs">Bus</label>
                    <Input type="number" value={conf.bus} onChange={e => handleConfigChange(idx, "bus", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs">Logic</label>
                    <select className="w-full border rounded px-2 py-1" value={conf.logic ? "true" : "false"} onChange={e => handleConfigChange(idx, "logic", e.target.value === "true") }>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeGeoConfig(idx)}>
                      <span className="sr-only">Remove</span>×
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addGeoConfig}>
                + Add Config
              </Button>
              <DialogFooter className="mt-4">
                <Button type="submit" variant="default">Save</Button>
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}
