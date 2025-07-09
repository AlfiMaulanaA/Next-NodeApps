"use client";
import * as React from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, Settings, Loader2, Cloud, Sun, Moon, CloudSun, CloudMoon, CloudRain, Snowflake, Zap, Cloudy } from "lucide-react";

const LOCATIONS = [
  { name: "Aceh", latitude: 5.55, longitude: 95.317 },
  { name: "Sumatera Utara", latitude: 3.5952, longitude: 98.6722 },
  { name: "Sumatera Barat", latitude: -0.95, longitude: 100.4167 },
  { name: "Riau", latitude: 0.5333, longitude: 101.45 },
  { name: "Jambi", latitude: -1.61, longitude: 103.6 },
  { name: "Sumatera Selatan", latitude: -2.975, longitude: 104.7754 },
  { name: "Bengkulu", latitude: -3.8, longitude: 102.27 },
  { name: "Lampung", latitude: -5.45, longitude: 105.2667 },
  { name: "Kep. Bangka Belitung", latitude: -2.1333, longitude: 106.1167 },
  { name: "Kep. Riau", latitude: 0.9167, longitude: 104.4667 },
  { name: "DKI Jakarta", latitude: -6.2088, longitude: 106.8456 },
  { name: "Jawa Barat", latitude: -6.9175, longitude: 107.6191 },
  { name: "Jawa Tengah", latitude: -6.9667, longitude: 110.4167 },
  { name: "DI Yogyakarta", latitude: -7.7972, longitude: 110.3688 },
  { name: "Jawa Timur", latitude: -7.2575, longitude: 112.7521 },
  { name: "Banten", latitude: -6.1214, longitude: 106.15 },
  { name: "Bali", latitude: -8.65, longitude: 115.2167 },
  { name: "Nusa Tenggara Barat", latitude: -8.5833, longitude: 116.1167 },
  { name: "Nusa Tenggara Timur", latitude: -10.18, longitude: 123.5833 },
  { name: "Kalimantan Barat", latitude: 0.0, longitude: 109.3333 },
  { name: "Kalimantan Tengah", latitude: -2.2167, longitude: 113.9167 },
  { name: "Kalimantan Selatan", latitude: -3.3167, longitude: 114.5833 },
  { name: "Kalimantan Timur", latitude: -0.5, longitude: 117.15 },
  { name: "Kalimantan Utara", latitude: 2.2167, longitude: 116.8333 },
  { name: "Sulawesi Utara", latitude: 1.4748, longitude: 124.8421 },
  { name: "Sulawesi Tengah", latitude: -0.9, longitude: 119.867 },
  { name: "Sulawesi Selatan", latitude: -5.1333, longitude: 119.4167 },
  { name: "Sulawesi Tenggara", latitude: -4.0, longitude: 122.6 },
  { name: "Gorontalo", latitude: 0.5, longitude: 122.45 },
  { name: "Sulawesi Barat", latitude: -2.6833, longitude: 118.9167 },
  { name: "Maluku", latitude: -3.7, longitude: 128.18 },
  { name: "Maluku Utara", latitude: 1.58, longitude: 127.3 },
  { name: "Papua", latitude: -2.5333, longitude: 140.7 },
  { name: "Papua Barat", latitude: -0.9, longitude: 134.0833 }
];

function getWeatherIcon(code: number, isDay: boolean | undefined) {
  if (code === 0) return isDay ? <Sun className="text-yellow-400" size={48} /> : <Moon className="text-gray-400" size={48} />;
  if ([1, 2, 3].includes(code)) return isDay ? <CloudSun className="text-yellow-300" size={48} /> : <CloudMoon className="text-gray-400" size={48} />;
  if ([45, 48].includes(code)) return <Cloudy className="text-gray-400" size={48} />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="text-blue-400" size={48} />;
  if ([66, 67, 71, 73, 75, 85, 86].includes(code)) return <Snowflake className="text-blue-200" size={48} />;
  if ([95, 96, 99].includes(code)) return <Zap className="text-yellow-500" size={48} />;
  return <Cloudy className="text-gray-400" size={48} />;
}

function getWeatherDescription(code: number) {
  const map: Record<number, string> = {
    0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing Rime Fog",
    51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle", 56: "Light Freezing Drizzle", 57: "Dense Freezing Drizzle",
    61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain", 66: "Light Freezing Rain", 67: "Heavy Freezing Rain",
    71: "Slight Snow Fall", 73: "Moderate Snow Fall", 75: "Heavy Snow Fall", 77: "Snow Grains", 80: "Slight Rain Showers",
    81: "Moderate Rain Showers", 82: "Violent Rain Showers", 85: "Slight Snow Showers", 86: "Heavy Snow Showers",
    95: "Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail"
  };
  return map[code] || "Unknown";
}

export default function WeatherPage() {
  const [selectedLocation, setSelectedLocation] = React.useState(LOCATIONS[10]); // Default: Jakarta
  const [weather, setWeather] = React.useState<any>(null);
  const [weatherMeta, setWeatherMeta] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [isCurrentLocation, setIsCurrentLocation] = React.useState(false);
  const [currentLocationMessage, setCurrentLocationMessage] = React.useState("");
  const [configOpen, setConfigOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    loc: LOCATIONS[10].name,
    lat: LOCATIONS[10].latitude,
    long: LOCATIONS[10].longitude,
    config: [{ device: "", pin: 1, address: 0, bus: 0, logic: false }]
  });

  React.useEffect(() => {
    fetchWeather();
    // eslint-disable-next-line
  }, [selectedLocation]);

  async function fetchWeather() {
    setLoading(true);
    setWeather(null);
    setWeatherMeta(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.latitude}&longitude=${selectedLocation.longitude}&current_weather=true`;
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.current_weather) {
        setWeather(data.current_weather);
        setWeatherMeta({ elevation: data.elevation, timezone: data.timezone });
      }
    } catch (e) {
      setWeather(null);
      setWeatherMeta(null);
    } finally {
      setLoading(false);
    }
  }

  function handleLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const loc = LOCATIONS.find(l => l.name === e.target.value);
    if (loc) {
      setSelectedLocation(loc);
      setIsCurrentLocation(false);
      setCurrentLocationMessage("");
      setForm(f => ({ ...f, loc: loc.name, lat: loc.latitude, long: loc.longitude }));
    }
  }

  function setCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const current = { name: "My Location", latitude: lat, longitude: lon };
          setSelectedLocation(current);
          setIsCurrentLocation(true);
          setCurrentLocationMessage(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
          setForm(f => ({ ...f, loc: "My Location", lat, long: lon }));
        },
        () => setCurrentLocationMessage("Unable to retrieve device location.")
      );
    } else {
      setCurrentLocationMessage("Geolocation is not supported by this browser.");
    }
  }

  // Device config handlers
  function handleFormChange(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function handleConfigChange(idx: number, field: string, value: any) {
    setForm(f => ({
      ...f,
      config: f.config.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    }));
  }
  function addConfig() {
    setForm(f => ({
      ...f,
      config: [...f.config, { device: "", pin: 1, address: 0, bus: 0, logic: false }]
    }));
  }
  function removeConfig(idx: number) {
    setForm(f => ({
      ...f,
      config: f.config.filter((_, i) => i !== idx)
    }));
  }
  function submitConfig(e: React.FormEvent) {
    e.preventDefault();
    setConfigOpen(false);
  }

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Cloud className="w-5 h-5 text-gray-600" />
          <h1 className="text-lg font-semibold text-gray-900">Weather Information</h1>
        </div>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="flex items-center gap-1">
              <Settings className="w-4 h-4" /> Config Control
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Device Configuration</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitConfig} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={form.loc}
                  onChange={e => {
                    handleFormChange("loc", e.target.value);
                    const loc = LOCATIONS.find(l => l.name === e.target.value);
                    if (loc) {
                      handleFormChange("lat", loc.latitude);
                      handleFormChange("long", loc.longitude);
                    }
                  }}
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.name} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium">Latitude</label>
                  <Input value={form.lat} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium">Longitude</label>
                  <Input value={form.long} readOnly />
                </div>
              </div>
              <div>
                <h6 className="font-semibold mb-2">Device Config</h6>
                {form.config.map((conf, idx) => (
                  <div key={idx} className="border rounded p-3 mb-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div>
                      <label className="block text-xs">Device</label>
                      <select className="w-full border rounded px-2 py-1" value={conf.device} onChange={e => handleConfigChange(idx, "device", e.target.value)}>
                        <option value="">Select</option>
                        <option value="relay_1">relay_1</option>
                        <option value="relay_2">relay_2</option>
                        <option value="relay_3">relay_3</option>
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
                      <select className="w-full border rounded px-2 py-1" value={conf.logic ? "true" : "false"} onChange={e => handleConfigChange(idx, "logic", e.target.value === "true")}>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeConfig(idx)}>
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addConfig}>
                  + Add Config
                </Button>
              </div>
              <DialogFooter>
                <Button type="submit" variant="default">Save</Button>
                <Button type="button" variant="secondary" onClick={() => setConfigOpen(false)}>Close</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>
      <main className="max-w-2xl mx-auto w-full p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Select Location</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={selectedLocation.name}
              onChange={handleLocationChange}
            >
              {LOCATIONS.map(loc => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" className="mt-2 md:mt-6 flex items-center gap-1" onClick={setCurrentLocation}>
            <MapPin className="w-4 h-4" /> Get My Location
          </Button>
        </div>
        {isCurrentLocation && (
          <div className="rounded bg-gray-100 text-gray-700 px-4 py-2 mb-4 text-sm">
            Your Location: {currentLocationMessage}
          </div>
        )}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              {weather && getWeatherIcon(weather.weathercode, weather.is_day === 1)}
              <div>
                <div className="text-2xl font-bold">{weather ? weather.temperature + "°C" : "-"}</div>
                <div className="text-sm text-gray-500">{weather ? getWeatherDescription(weather.weathercode) : "No data"}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-lg">Weather in {selectedLocation.name}</div>
              <div className="text-xs text-gray-500">{weather ? weather.time : "-"}</div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="animate-spin" /> Loading weather data...
            </div>
          ) : weather ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-4">
              <div><b>Daytime:</b> {weather.is_day !== undefined ? (weather.is_day ? "Yes" : "No") : "-"}</div>
              <div><b>Wind Speed:</b> {weather.windspeed} km/h</div>
              <div><b>Wind Direction:</b> {weather.winddirection}°</div>
              <div><b>Weather Code:</b> {weather.weathercode}</div>
              {weatherMeta && <div><b>Elevation:</b> {weatherMeta.elevation} m</div>}
              {weatherMeta && <div><b>Timezone:</b> {weatherMeta.timezone}</div>}
            </div>
          ) : (
            <div className="text-gray-500 mb-4">No weather data available.</div>
          )}
          {/* Show config in UI, not in dialog */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold">Device Config</h2>
              <Button type="button" variant="outline" size="sm" onClick={addConfig}>
                + Add Config
              </Button>
            </div>
            <div className="space-y-4">
              {form.config.map((conf, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border rounded p-3 bg-gray-50">
                  <div>
                    <label className="block text-xs">Device</label>
                    <select className="w-full border rounded px-2 py-1" value={conf.device} onChange={e => handleConfigChange(idx, "device", e.target.value)}>
                      <option value="">Select</option>
                      <option value="relay_1">relay_1</option>
                      <option value="relay_2">relay_2</option>
                      <option value="relay_3">relay_3</option>
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
                    <select className="w-full border rounded px-2 py-1" value={conf.logic ? "true" : "false"} onChange={e => handleConfigChange(idx, "logic", e.target.value === "true")}>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeConfig(idx)}>
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}